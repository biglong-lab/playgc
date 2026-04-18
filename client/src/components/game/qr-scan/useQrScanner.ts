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
}

export interface QrScannerActions {
  startScanning: () => void;
  handleCancelScan: () => Promise<void>;
  handleRetry: () => void;
  handleManualSubmit: () => void;
  setMode: (mode: ScanMode) => void;
  setManualCode: (code: string) => void;
  stopScanning: () => Promise<void>;
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
  const [containerReady, setContainerReady] = useState(false);

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

    try {
      await stopScanning();
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: { ideal: "environment" } },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1, disableFlip: false },
        (decodedText) => { verifyCode(decodedText); },
        () => {},
      );

      // iOS Safari 保險：補上 playsInline（html5-qrcode 沒全部處理）
      const video = container.querySelector("video");
      if (video) {
        video.setAttribute("playsinline", "true");
        video.setAttribute("muted", "true");
        video.setAttribute("autoplay", "true");
      }

      setMode("scanning");
    } catch (err: unknown) {
      const errorMessage = parseScannerError(err);
      setCameraError(errorMessage);
      setMode("instruction");
      toast({ title: "無法啟動掃描器", description: "請使用手動輸入方式", variant: "destructive" });
    }
  };

  // 驗證 QR Code
  const verifyCode = async (code: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    await stopScanning();

    const isValid = validateQrCode(code, config);
    const locationId = extractLocationId(code);

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
        onComplete({ points: config.rewardPoints || config.reward?.points || 10, items: grantItems }, config.nextPageId);
      }, 1500);
    } else {
      setMode("error");
      const primaryCode = config.primaryCode || config.expectedCode || config.qrCodeId || "";
      const debugHint = primaryCode ? `（提示：代碼格式類似 "${primaryCode.substring(0, 3)}..."）` : "";
      toast({ title: "驗證失敗", description: `輸入的代碼不正確${debugHint}，請確認後重試`, variant: "destructive" });
      setTimeout(() => { setMode("instruction"); setIsProcessing(false); }, 2000);
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

/** 解析掃描器啟動錯誤（合併 name 和 message 兩種判斷）*/
function parseScannerError(err: unknown): string {
  const error = err as { name?: string; message?: string };
  const name = error.name || "";
  const message = error.message || "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError" || message.includes("Permission")) {
    return "相機權限被拒絕。請在瀏覽器或系統設定中允許相機權限，重新整理頁面後再試";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || message.includes("NotFound") || message.includes("no cameras")) {
    return "找不到可用的相機設備";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || message.includes("NotReadable")) {
    return "相機正在被其他應用程式使用中，請關閉後重試";
  }
  if (name === "OverconstrainedError") {
    return "相機設定不支援，請嘗試其他設備";
  }
  if (name === "SecurityError") {
    return "需要 HTTPS 連線才能使用相機功能";
  }
  if (message) return `掃描器錯誤: ${message}`;
  return "無法啟動掃描器";
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
