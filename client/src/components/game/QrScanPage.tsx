import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { QrCode, Camera, CheckCircle, XCircle, Keyboard, Loader2, MapPin, AlertTriangle, RefreshCw } from "lucide-react";
import type { QrScanConfig } from "@shared/schema";

interface QrScanPageProps {
  config: QrScanConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: any) => void;
}

export default function QrScanPage({ config, onComplete, sessionId }: QrScanPageProps) {
  const { toast } = useToast();
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const initAttemptedRef = useRef(false);
  
  const [mode, setMode] = useState<"instruction" | "initializing" | "scanning" | "manual" | "success" | "error">("instruction");
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

  const stopScanning = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {
        // 清理時的錯誤可忽略
      }
      html5QrCodeRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  useEffect(() => {
    if (mode === "initializing" && containerReady && !initAttemptedRef.current) {
      initAttemptedRef.current = true;
      initializeScanner();
    }
  }, [mode, containerReady]);

  // Reset initAttemptedRef when mode changes to allow retry
  useEffect(() => {
    if (mode === "instruction") {
      initAttemptedRef.current = false;
    }
  }, [mode]);

  const checkCameraPermission = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("您的瀏覽器不支援相機功能，請使用手動輸入方式");
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("相機權限被拒絕。請在瀏覽器設定中允許相機權限，然後重試");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("找不到相機設備。請確認您的設備有相機功能");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setCameraError("相機正在被其他應用程式使用中。請關閉其他使用相機的應用程式後重試");
      } else if (err.name === "OverconstrainedError") {
        setCameraError("相機設定不支援。請嘗試使用其他設備");
      } else if (err.name === "SecurityError") {
        setCameraError("需要 HTTPS 連線才能使用相機功能");
      } else {
        setCameraError(`無法存取相機: ${err.message || "未知錯誤"}`);
      }
      return false;
    }
  };

  const startScanning = async () => {
    setCameraError(null);
    initAttemptedRef.current = false;
    setMode("initializing");
    setContainerReady(false);
    
    // Use interval to check for container readiness instead of fixed timeout
    const checkInterval = setInterval(() => {
      const container = document.getElementById("qr-reader");
      if (container && container.offsetWidth > 0) {
        clearInterval(checkInterval);
        setContainerReady(true);
      }
    }, 50);
    
    // Fallback timeout after 3 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!containerReady) {
        setContainerReady(true);
      }
    }, 3000);
  };

  const initializeScanner = async () => {
    const hasPermission = await checkCameraPermission();
    if (!hasPermission) {
      setMode("instruction");
      return;
    }

    const containerId = "qr-reader";
    const container = document.getElementById(containerId);
    
    if (!container) {
      setCameraError("掃描器初始化失敗，請重試");
      setMode("instruction");
      return;
    }

    try {
      await stopScanning();
      
      const html5QrCode = new Html5Qrcode(containerId);
      html5QrCodeRef.current = html5QrCode;

      const config_qr = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
        disableFlip: false,
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config_qr,
        (decodedText) => {
          verifyCode(decodedText);
        },
        () => {}
      );
      
      setMode("scanning");
    } catch (err: any) {
      let errorMessage = "無法啟動掃描器";
      if (err.message?.includes("Permission")) {
        errorMessage = "相機權限被拒絕，請允許相機權限後重試";
      } else if (err.message?.includes("NotFound") || err.message?.includes("no cameras")) {
        errorMessage = "找不到可用的相機設備";
      } else if (err.message?.includes("NotReadable")) {
        errorMessage = "相機正在被其他程式使用中";
      } else if (err.message) {
        errorMessage = `掃描器錯誤: ${err.message}`;
      }
      
      setCameraError(errorMessage);
      setMode("instruction");
      
      toast({
        title: "無法啟動掃描器",
        description: "請使用手動輸入方式",
        variant: "destructive",
      });
    }
  };

  const verifyCode = async (code: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    await stopScanning();
    
    // 獲取驗證代碼 - 優先使用新字段，向後兼容舊字段
    const primaryCode = config.primaryCode || config.expectedCode || config.qrCodeId || "";
    const alternativeCodes = config.alternativeCodes || [];
    const validationMode = config.validationMode || 'case_insensitive';
    
    let isValid = false;
    let locationId: number | null = null;

    // 檢查位置ID格式 (JC-LOC-xxx)
    const codeMatch = code.match(/^JC-LOC-(\d+)$/i);
    const primaryMatch = primaryCode.match(/^JC-LOC-(\d+)$/i);
    
    if (codeMatch && primaryMatch) {
      // 位置ID模式
      isValid = codeMatch[1] === primaryMatch[1];
      locationId = parseInt(codeMatch[1], 10);
    } else {
      // 根據驗證模式進行比較
      const normalizedInput = code.trim();
      const normalizedPrimary = primaryCode.trim();
      
      switch (validationMode) {
        case 'exact':
          // 精確匹配（區分大小寫）
          isValid = normalizedInput === normalizedPrimary;
          break;
        case 'case_insensitive':
        default:
          // 不區分大小寫（預設）
          isValid = normalizedInput.toUpperCase() === normalizedPrimary.toUpperCase();
          break;
        case 'regex':
          // 正則表達式匹配
          try {
            const regex = new RegExp(normalizedPrimary, 'i');
            isValid = regex.test(normalizedInput);
          } catch (e) {
            isValid = false;
          }
          break;
        case 'location_id':
          // 僅比較數字部分
          const inputNumbers = normalizedInput.replace(/\D/g, '');
          const expectedNumbers = normalizedPrimary.replace(/\D/g, '');
          isValid = inputNumbers === expectedNumbers;
          break;
      }
      
      // 檢查備用代碼
      if (!isValid && alternativeCodes.length > 0) {
        isValid = alternativeCodes.some(alt => {
          const normalizedAlt = alt.trim();
          if (validationMode === 'exact') {
            return normalizedInput === normalizedAlt;
          }
          return normalizedInput.toUpperCase() === normalizedAlt.toUpperCase();
        });
      }
    }

    if (isValid) {
      if (locationId && sessionId) {
        try {
          await visitLocationMutation.mutateAsync(locationId);
        } catch (error) {
          // 位置紀錄失敗可忽略
        }
      }

      setMode("success");
      toast({
        title: config.onSuccess?.message || config.successMessage || "QR Code 驗證成功!",
        description: "任務完成!",
      });
      
      const grantItems = config.onSuccess?.grantItem 
        ? [config.onSuccess.grantItem] 
        : (config.rewardItems || config.reward?.items);
      
      setTimeout(() => {
        onComplete({
          points: config.rewardPoints || config.reward?.points || 10,
          items: grantItems,
        }, config.nextPageId);
      }, 1500);
    } else {
      setMode("error");
      // 更詳細的錯誤提示（開發模式）
      const debugHint = primaryCode ? `（提示：代碼格式類似 "${primaryCode.substring(0, 3)}..."）` : "";
      toast({
        title: "驗證失敗",
        description: `輸入的代碼不正確${debugHint}，請確認後重試`,
        variant: "destructive",
      });
      setTimeout(() => {
        setMode("instruction");
        setIsProcessing(false);
      }, 2000);
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      verifyCode(manualCode.trim());
    }
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

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      {mode === "instruction" && (
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <QrCode className="w-10 h-10 text-primary" />
            </div>
            
            <h2 className="text-xl font-display font-bold mb-2">
              {config.title || "掃描 QR Code"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {config.instruction || config.prompt || config.description || "找到並掃描指定的 QR Code 來完成任務"}
            </p>

            {config.locationHint && (
              <div className="bg-accent/50 rounded-lg p-3 mb-6 flex items-start gap-2">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-left">{config.locationHint}</p>
              </div>
            )}

            {cameraError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="text-sm text-destructive font-medium mb-1">相機問題</p>
                    <p className="text-sm text-destructive/80">{cameraError}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRetry}
                  className="mt-3 w-full gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  重試
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <Button 
                onClick={startScanning}
                className="w-full gap-2"
                data-testid="button-start-scan"
              >
                <Camera className="w-4 h-4" />
                開啟掃描器
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => setMode("manual")}
                className="w-full gap-2"
                data-testid="button-manual-input"
              >
                <Keyboard className="w-4 h-4" />
                手動輸入代碼
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              提示: 請確保允許瀏覽器使用相機權限
            </p>
          </CardContent>
        </Card>
      )}

      {mode === "initializing" && (
        <div className="w-full max-w-md">
          <div 
            id="qr-reader" 
            ref={scannerContainerRef}
            className="relative bg-black rounded-lg overflow-hidden aspect-square mb-4 flex items-center justify-center"
          >
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p className="text-lg">正在啟動相機...</p>
              <p className="text-sm text-white/60 mt-2">請允許相機權限</p>
            </div>
          </div>

          <Button 
            variant="outline"
            onClick={handleCancelScan}
            className="w-full"
            data-testid="button-cancel-init"
          >
            取消
          </Button>
        </div>
      )}

      {mode === "scanning" && (
        <div className="w-full max-w-md">
          <div 
            id="qr-reader" 
            ref={scannerContainerRef}
            className="relative bg-black rounded-lg overflow-hidden aspect-square mb-4"
          />

          <p className="text-center text-sm text-muted-foreground mb-4">
            將 QR Code 對準掃描框內
          </p>

          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={handleCancelScan}
              className="flex-1"
              data-testid="button-cancel-scan"
            >
              取消
            </Button>
            <Button 
              variant="outline"
              onClick={async () => { await stopScanning(); setMode("manual"); }}
              className="flex-1 gap-2"
              data-testid="button-switch-manual"
            >
              <Keyboard className="w-4 h-4" />
              手動輸入
            </Button>
          </div>
        </div>
      )}

      {mode === "manual" && (
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
              <Keyboard className="w-8 h-8 text-muted-foreground" />
            </div>
            
            <h2 className="text-lg font-display font-bold text-center mb-4">手動輸入代碼</h2>
            <p className="text-sm text-muted-foreground text-center mb-4">
              輸入 QR Code 上顯示的代碼
            </p>
            
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder={
                (() => {
                  const code = config.primaryCode || config.expectedCode || config.qrCodeId || "";
                  if (code) {
                    // 顯示代碼格式提示，隱藏部分內容
                    if (code.length <= 4) return `輸入代碼`;
                    return `格式類似: ${code.substring(0, Math.min(4, code.length))}...`;
                  }
                  return "輸入代碼";
                })()
              }
              className="text-center font-mono mb-4"
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              data-testid="input-manual-code"
            />

            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => { setMode("instruction"); setManualCode(""); }}
                className="flex-1"
              >
                取消
              </Button>
              <Button 
                onClick={handleManualSubmit}
                disabled={!manualCode.trim() || isProcessing}
                className="flex-1"
                data-testid="button-submit-code"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "確認"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "success" && (
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6 animate-scaleIn">
            <CheckCircle className="w-12 h-12 text-success" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2 text-success">驗證成功!</h2>
          <p className="text-muted-foreground">{config.onSuccess?.message || config.successMessage || "QR Code 已確認"}</p>
        </div>
      )}

      {mode === "error" && (
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6 animate-scaleIn">
            <XCircle className="w-12 h-12 text-destructive" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2 text-destructive">驗證失敗</h2>
          <p className="text-muted-foreground">這不是正確的 QR Code</p>
        </div>
      )}
    </div>
  );
}
