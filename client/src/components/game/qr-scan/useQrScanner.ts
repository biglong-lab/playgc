import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import type { QrScanConfig } from "@shared/schema";

export type ScanMode = "instruction" | "initializing" | "scanning" | "manual" | "success" | "error";

export interface QrScannerState {
  mode: ScanMode;
  manualCode: string;
  isProcessing: boolean;
  cameraError: string | null;
  /** 🆕 當前使用的鏡頭 */
  facingMode: "environment" | "user";
}

export interface QrScannerActions {
  startScanning: () => void;
  handleCancelScan: () => Promise<void>;
  handleRetry: () => void;
  handleManualSubmit: () => void;
  setMode: (mode: ScanMode) => void;
  setManualCode: (code: string) => void;
  stopScanning: () => Promise<void>;
  /** 🆕 切換前後鏡頭（重啟掃描器）*/
  switchCamera: () => Promise<void>;
}

export interface UseQrScannerReturn {
  state: QrScannerState;
  actions: QrScannerActions;
  scannerContainerRef: React.RefObject<HTMLDivElement>;
}

/**
 * QR 掃描器邏輯 Hook
 * 封裝相機控制、掃描器生命週期和驗證邏輯
 */
export function useQrScanner(
  config: QrScanConfig,
  sessionId: string,
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void,
): UseQrScannerReturn {
  const { toast } = useToast();
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const initAttemptedRef = useRef(false);

  const [mode, setMode] = useState<ScanMode>("instruction");
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [containerReady, setContainerReady] = useState(false);
  // ref 防掃描器連續偵測同一 QR / 手動輸入 rage-click 造成多次 verifyCode
  const isProcessingRef = useRef(false);
  const finishedRef = useRef(false);

  const visitLocationMutation = useMutation({
    mutationFn: async (locationId: number) => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/locations/${locationId}/visit`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "visits"] });
    },
  });

  // 停止掃描器
  const stopScanning = useCallback(async () => {
    if (!html5QrCodeRef.current) return;
    try {
      const scannerState = html5QrCodeRef.current.getState();
      if (scannerState === Html5QrcodeScannerState.SCANNING || scannerState === Html5QrcodeScannerState.PAUSED) {
        await html5QrCodeRef.current.stop();
      }
    } catch {
      // 清理錯誤可忽略
    }
    html5QrCodeRef.current = null;
  }, []);

  // 清理
  useEffect(() => {
    return () => { stopScanning(); };
  }, [stopScanning]);

  // 容器就緒後初始化（用 ref 而非 id 避免 React 生命週期競態）
  useEffect(() => {
    if (mode === "initializing" && containerReady && !initAttemptedRef.current) {
      initAttemptedRef.current = true;
      initializeScanner();
    }
  }, [mode, containerReady]);

  // 重置 initAttempted
  useEffect(() => {
    if (mode === "instruction") {
      initAttemptedRef.current = false;
    }
  }, [mode]);

  // 開始掃描（不預檢 getUserMedia，避免 iOS 相機鎖釋放/再取的時序衝突）
  const startScanning = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("您的瀏覽器不支援相機功能，請使用手動輸入方式");
      return;
    }
    setCameraError(null);
    initAttemptedRef.current = false;
    setMode("initializing");
    setContainerReady(false);

    // 用 requestAnimationFrame 等 React commit 完成後再檢查 container
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      const container = scannerContainerRef.current || document.getElementById("qr-reader");
      if (container && container.offsetWidth > 0) {
        setContainerReady(true);
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);

    // 3 秒保險
    setTimeout(() => { cancelled = true; setContainerReady(true); }, 3000);
  };

  // 初始化掃描器
  const initializeScanner = async () => {
    const container = scannerContainerRef.current || document.getElementById("qr-reader");
    if (!container) {
      setCameraError("掃描器初始化失敗，請重試");
      setMode("instruction");
      return;
    }

    await stopScanning();

    const startConfig = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1,
      disableFlip: false,
    };

    // 每次嘗試都用新的 Html5Qrcode 實例，避免內部 state 污染
    const tryStart = async (facingMode: "environment" | "user") => {
      const instance = new Html5Qrcode("qr-reader");
      try {
        await instance.start(
          { facingMode },
          startConfig,
          (decodedText) => { verifyCode(decodedText); },
          () => {},
        );
        html5QrCodeRef.current = instance;
      } catch (err) {
        // 失敗時清理實例再向上拋
        try { await instance.clear(); } catch { /* ignore */ }
        throw err;
      }
    };

    try {
      try {
        await tryStart(facingMode);
        // 成功記下實際使用的鏡頭
      } catch (envErr) {
        const fallback = facingMode === "environment" ? "user" : "environment";
        console.warn(`[QR] ${facingMode} 鏡頭啟動失敗，嘗試 ${fallback}`, envErr);
        await tryStart(fallback);
        setFacingMode(fallback);
      }

      // iOS Safari 保險：補上 playsInline（html5-qrcode 沒全部處理）
      const video = container.querySelector("video");
      if (video) {
        video.setAttribute("playsinline", "true");
        video.setAttribute("muted", "true");
        video.setAttribute("autoplay", "true");
      }

      setMode("scanning");
    } catch (err: unknown) {
      console.error("[QR] 掃描器啟動失敗", err);
      const errorMessage = parseScannerError(err);
      setCameraError(errorMessage);
      setMode("instruction");
      toast({ title: "無法啟動掃描器", description: "請改用手動輸入", variant: "destructive" });
    }
  };

  // 🆕 切換前後鏡頭
  const switchCamera = async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    console.log(`[QR] 切換鏡頭 ${facingMode} → ${next}`);
    setFacingMode(next);
    await stopScanning();
    // 給 iOS 一點時間釋放硬體
    await new Promise((r) => setTimeout(r, 200));
    // 重啟掃描（會用新的 facingMode）
    setTimeout(() => startScanning(), 100);
    toast({
      title: next === "user" ? "📷 已切到前鏡頭" : "📷 已切到後鏡頭",
      duration: 1500,
    });
  };

  // 驗證 QR Code
  const verifyCode = async (code: string) => {
    // ref 讀最新值，避免 closure stale（掃描器連續 decode 同一 QR / 手動連點）
    if (isProcessingRef.current || finishedRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);
    await stopScanning();

    // 管理員端 QRCodeGenerator 會把 qrCodeId 包在 JSON 內（含 gameId/pageId/timestamp 防偽），
    // 這裡先解 JSON 抽 qrCodeId；若不是 JSON 就視為純字串（手動輸入 / 外部貼紙）
    const normalizedCode = extractScanCode(code);
    const isValid = validateQrCode(normalizedCode, config);
    const locationId = extractLocationId(normalizedCode);

    if (isValid) {
      if (locationId && sessionId) {
        try { await visitLocationMutation.mutateAsync(locationId); } catch { /* 可忽略 */ }
      }
      setMode("success");
      toast({ title: config.onSuccess?.message || config.successMessage || "QR Code 驗證成功!", description: "任務完成!" });

      const grantItems = config.onSuccess?.grantItem
        ? [config.onSuccess.grantItem]
        : (config.rewardItems || config.reward?.items);

      setTimeout(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onComplete({ points: config.rewardPoints || config.reward?.points || 10, items: grantItems }, config.nextPageId);
      }, 1500);
    } else {
      setMode("error");
      const primaryCode = config.primaryCode || config.expectedCode || config.qrCodeId || "";
      const debugHint = primaryCode ? `（提示：代碼格式類似 "${primaryCode.substring(0, 3)}..."）` : "";
      toast({ title: "驗證失敗", description: `輸入的代碼不正確${debugHint}，請確認後重試`, variant: "destructive" });
      setTimeout(() => {
        setMode("instruction");
        isProcessingRef.current = false;
        setIsProcessing(false);
      }, 2000);
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) verifyCode(manualCode.trim());
  };

  const handleCancelScan = async () => {
    await stopScanning();
    setMode("instruction");
    setCameraError(null);
  };

  const handleRetry = () => {
    setCameraError(null);
    startScanning();
  };

  return {
    state: { mode, manualCode, isProcessing, cameraError },
    actions: { startScanning, handleCancelScan, handleRetry, handleManualSubmit, setMode, setManualCode, stopScanning },
    scannerContainerRef,
  };
}

// ==================== 工具函式 ====================

/** 解析掃描器啟動錯誤（處理 Error 物件、字串、純文字等各種型態）*/
function parseScannerError(err: unknown): string {
  // html5-qrcode 有時會拋出字串而非 Error 物件
  if (typeof err === "string") {
    return matchErrorKeyword(err) || `掃描器錯誤: ${err}`;
  }

  const error = err as { name?: string; message?: string };
  const name = error.name || "";
  const message = error.message || "";
  const combined = `${name} ${message}`;

  const matched = matchErrorKeyword(combined);
  if (matched) return matched;

  if (message) return `掃描器錯誤: ${message}`;
  if (name) return `掃描器錯誤: ${name}`;
  return "無法啟動掃描器（可能是相機權限或硬體問題）";
}

/** 從錯誤文字比對關鍵字，回傳對應的中文訊息 */
function matchErrorKeyword(text: string): string | null {
  if (/NotAllowed|PermissionDenied|Permission/i.test(text)) {
    return "相機權限被拒絕。請在瀏覽器或系統設定中允許相機權限，重新整理頁面後再試";
  }
  if (/NotFound|DevicesNotFound|no cameras|no camera/i.test(text)) {
    return "找不到可用的相機設備";
  }
  if (/NotReadable|TrackStart|in use/i.test(text)) {
    return "相機正在被其他應用程式使用中，請關閉後重試";
  }
  if (/Overconstrained|facing mode/i.test(text)) {
    return "相機設定不支援，請嘗試其他設備";
  }
  if (/SecurityError|secure context/i.test(text)) {
    return "需要 HTTPS 連線才能使用相機功能";
  }
  return null;
}

/** 驗證 QR Code 是否正確 */
function validateQrCode(code: string, config: QrScanConfig): boolean {
  const primaryCode = config.primaryCode || config.expectedCode || config.qrCodeId || "";
  const alternativeCodes = config.alternativeCodes || [];
  const validationMode = config.validationMode || "case_insensitive";

  // 位置 ID 格式 (JC-LOC-xxx)
  const codeMatch = code.match(/^JC-LOC-(\d+)$/i);
  const primaryMatch = primaryCode.match(/^JC-LOC-(\d+)$/i);
  if (codeMatch && primaryMatch) {
    return codeMatch[1] === primaryMatch[1];
  }

  const normalizedInput = code.trim();
  const normalizedPrimary = primaryCode.trim();
  let isValid = false;

  switch (validationMode) {
    case "exact":
      isValid = normalizedInput === normalizedPrimary;
      break;
    case "regex":
      try { isValid = new RegExp(normalizedPrimary, "i").test(normalizedInput); } catch { isValid = false; }
      break;
    case "location_id": {
      const inputNumbers = normalizedInput.replace(/\D/g, "");
      const expectedNumbers = normalizedPrimary.replace(/\D/g, "");
      isValid = inputNumbers === expectedNumbers;
      break;
    }
    case "case_insensitive":
    default:
      isValid = normalizedInput.toUpperCase() === normalizedPrimary.toUpperCase();
      break;
  }

  if (!isValid && alternativeCodes.length > 0) {
    isValid = alternativeCodes.some(alt => {
      const normalizedAlt = alt.trim();
      return validationMode === "exact"
        ? normalizedInput === normalizedAlt
        : normalizedInput.toUpperCase() === normalizedAlt.toUpperCase();
    });
  }

  return isValid;
}

/** 從 QR Code 提取位置 ID */
function extractLocationId(code: string): number | null {
  const match = code.match(/^JC-LOC-(\d+)$/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 從掃到的原始字串抽出要比對的 code。
 * 支援兩種來源：
 *   1. 管理員 QRCodeGenerator 產生的 JSON QR：`{"type":"game_qr","qrCodeId":"XXX",...}` → 回傳 qrCodeId
 *   2. 純字串 QR / 手動輸入 / 舊外部貼紙 → 直接回傳 trim 後字串
 */
export function extractScanCode(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { type?: unknown; qrCodeId?: unknown };
      if (parsed && parsed.type === "game_qr" && typeof parsed.qrCodeId === "string") {
        return parsed.qrCodeId.trim();
      }
    } catch {
      // 非合法 JSON，維持原始字串
    }
  }
  return trimmed;
}
