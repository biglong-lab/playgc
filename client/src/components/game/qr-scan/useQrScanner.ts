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

  // 容器就緒後初始化
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

  // 檢查相機權限
  const checkCameraPermission = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("您的瀏覽器不支援相機功能，請使用手動輸入方式");
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err: unknown) {
      setCameraError(parseCameraError(err));
      return false;
    }
  };

  // 開始掃描
  const startScanning = () => {
    setCameraError(null);
    initAttemptedRef.current = false;
    setMode("initializing");
    setContainerReady(false);

    const checkInterval = setInterval(() => {
      const container = document.getElementById("qr-reader");
      if (container && container.offsetWidth > 0) {
        clearInterval(checkInterval);
        setContainerReady(true);
      }
    }, 50);

    setTimeout(() => {
      clearInterval(checkInterval);
      if (!containerReady) setContainerReady(true);
    }, 3000);
  };

  // 初始化掃描器
  const initializeScanner = async () => {
    const hasPermission = await checkCameraPermission();
    if (!hasPermission) { setMode("instruction"); return; }

    const container = document.getElementById("qr-reader");
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
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1, disableFlip: false },
        (decodedText) => { verifyCode(decodedText); },
        () => {},
      );
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

/** 解析相機權限錯誤 */
function parseCameraError(err: unknown): string {
  const error = err as { name?: string; message?: string };
  switch (error.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "相機權限被拒絕。請在瀏覽器設定中允許相機權限，然後重試";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "找不到相機設備。請確認您的設備有相機功能";
    case "NotReadableError":
    case "TrackStartError":
      return "相機正在被其他應用程式使用中。請關閉其他使用相機的應用程式後重試";
    case "OverconstrainedError":
      return "相機設定不支援。請嘗試使用其他設備";
    case "SecurityError":
      return "需要 HTTPS 連線才能使用相機功能";
    default:
      return `無法存取相機: ${error.message || "未知錯誤"}`;
  }
}

/** 解析掃描器啟動錯誤 */
function parseScannerError(err: unknown): string {
  const message = (err as { message?: string }).message || "";
  if (message.includes("Permission")) return "相機權限被拒絕，請允許相機權限後重試";
  if (message.includes("NotFound") || message.includes("no cameras")) return "找不到可用的相機設備";
  if (message.includes("NotReadable")) return "相機正在被其他程式使用中";
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
