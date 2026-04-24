import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { logError, logMilestone, logWarning } from "@/lib/clientLogger";

export type PhotoMode =
  | "instruction"
  | "initializing"
  | "camera"
  | "preview"
  | "uploading"
  | "verifying"
  | "ai_fail";

export type CameraFacing = "user" | "environment";

export interface PhotoCameraState {
  mode: PhotoMode;
  setMode: (mode: PhotoMode) => void;
  capturedImage: string | null;
  setCapturedImage: (img: string | null) => void;
  cameraError: string | null;
  cameraReady: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  /** 啟動相機；可指定前後鏡頭（預設 environment 後鏡頭）*/
  startCamera: (facingMode?: CameraFacing) => Promise<void>;
  /** 切換前後鏡頭（會重啟 stream）*/
  switchCamera: () => Promise<void>;
  /** 當前使用的鏡頭 */
  facingMode: CameraFacing;
  stopCamera: () => void;
  capturePhoto: () => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  cancelCamera: () => void;
  retake: () => void;
}

/**
 * 封裝拍照相機的所有邏輯：
 * 開啟/關閉相機、拍照、相簿上傳、錯誤處理
 */
export function usePhotoCamera(): PhotoCameraState {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<PhotoMode>("instruction");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacing>("environment");

  // 🛡 自動重啟保護機制
  // 避免「health check 發現不健康 → 重啟 → 又不健康 → 再重啟」無窮迴圈
  const autoRestartCountRef = useRef(0);        // 本次 session 已自動重啟幾次
  const lastRestartAtRef = useRef(0);           // 上次重啟 timestamp
  const MAX_AUTO_RESTART = 2;                   // 最多自動重啟 2 次（再失敗就停，交給使用者手動）
  const RESTART_COOLDOWN_MS = 5000;             // 兩次自動重啟最少間隔 5 秒

  /** 判斷是否可以自動重啟（含上限 + 冷卻） */
  const canAutoRestart = useCallback((): boolean => {
    if (autoRestartCountRef.current >= MAX_AUTO_RESTART) {
      console.warn("[camera] 已達自動重啟上限，停止 auto-recovery");
      return false;
    }
    const since = Date.now() - lastRestartAtRef.current;
    if (since < RESTART_COOLDOWN_MS) {
      console.warn(`[camera] 重啟冷卻中（剩 ${RESTART_COOLDOWN_MS - since}ms）`);
      return false;
    }
    return true;
  }, []);

  /** 標記發起一次自動重啟 */
  const markAutoRestart = useCallback(() => {
    autoRestartCountRef.current += 1;
    lastRestartAtRef.current = Date.now();
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, [stream]);

  /** 手動重置：使用者按「重新啟動相機」按鈕時呼叫；重設 counter */
  const resetRestartCounter = useCallback(() => {
    autoRestartCountRef.current = 0;
    lastRestartAtRef.current = 0;
  }, []);

  // 元件卸載時停止相機
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // 🔑 關鍵修復：mode 切換會導致 <video> 元素重新 mount（CameraInitializingView → CameraView 是兩個不同 video）
  // 每次 mode 變化後重新同步 srcObject，否則新 video 沒有 stream → videoWidth 永遠 0
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      // 新 video 需要重新 play
      video.play().catch((err) => {
        console.warn("[camera] play failed after mode switch:", err);
      });
    }
  }, [mode, stream]);

  // 🛡 頁面切回前景時，若 stream 已掛（Android Chrome/Edge 切 tab 會 suspend）
  // 自動重啟相機；但有重啟上限 + 冷卻時間，避免無窮迴圈
  useEffect(() => {
    if (mode !== "camera") return;
    const handler = () => {
      if (document.visibilityState !== "visible") return;
      const video = videoRef.current;
      const streamActive =
        stream?.getVideoTracks()?.[0]?.readyState === "live";
      if (!streamActive || !video || video.videoWidth === 0) {
        if (!canAutoRestart()) {
          // 已達上限 → 提示使用者手動重啟
          setCameraError("相機無法自動恢復，請點下方按鈕手動重啟");
          return;
        }
        markAutoRestart();
        stopCamera();
        setTimeout(() => void startCamera(), 200);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stream, canAutoRestart, markAutoRestart]);

  // 🩺 健康監控（有 cooldown + 上限）：
  // 關鍵防迴圈：每次檢查到不健康 → 先檢查能否自動重啟
  // 若已重啟 2 次或在冷卻中 → 停止 auto-recover，顯示錯誤讓使用者手動處理
  useEffect(() => {
    if (mode !== "camera" || !cameraReady) return;

    // 給新 stream 2 秒「緩衝時間」，避免 iOS Safari 第一秒 videoWidth 還沒 fill
    const GRACE_PERIOD_MS = 2000;
    const healthStartAt = Date.now();
    let unhealthyCount = 0;

    const healthCheck = setInterval(() => {
      // 緩衝期內不判定（避免剛 setCameraReady(true) 就立刻觸發迴圈）
      if (Date.now() - healthStartAt < GRACE_PERIOD_MS) return;

      const video = videoRef.current;
      if (!video) return;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        unhealthyCount += 1;
        // 連續 3 次（1.5 秒）都 0 → 判定掛掉
        if (unhealthyCount >= 3) {
          clearInterval(healthCheck);
          console.warn("[camera] video 連續不健康");
          logWarning(
            "camera",
            "video_unhealthy",
            "videoWidth 持續為 0",
            {
              restartCount: autoRestartCountRef.current,
              userAgent: navigator.userAgent,
            },
          );
          if (!canAutoRestart()) {
            // 已達上限 → 放棄自動重啟，告知使用者
            console.warn("[camera] 停止自動恢復，請使用者手動重啟");
            setCameraError("相機畫面異常，請點下方按鈕手動重啟");
            logError(
              "camera",
              "auto_restart_exhausted",
              new Error("相機自動重啟達上限"),
              { userAgent: navigator.userAgent },
            );
            return;
          }
          markAutoRestart();
          setCameraReady(false);
          stopCamera();
          setTimeout(() => void startCamera(), 300);
        }
      } else {
        unhealthyCount = 0;
      }
    }, 500);
    return () => clearInterval(healthCheck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cameraReady, canAutoRestart, markAutoRestart]);

  const startCamera = async () => {
    setCameraError(null);
    setCameraReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "您的瀏覽器不支援相機功能。請使用較新版本的瀏覽器，或從相簿選擇照片。",
      );
      return;
    }

    setMode("initializing");

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(mediaStream);
      // ✅ 不直接操作 videoRef（可能為 null 或 mode 會切換）
      // srcObject 同步由 useEffect 負責（見上方 mode+stream effect）

      // 接下來靠 useEffect 偵測 video 是否 ready（見下方 stream-ready effect）
      // 若 10 秒還沒 ready → 給 error
      const readinessCheckStart = Date.now();
      const readinessInterval = setInterval(() => {
        const video = videoRef.current;
        if (video && video.videoWidth > 0 && video.videoHeight > 0) {
          clearInterval(readinessInterval);
          setCameraReady(true);
          setMode("camera");
          return;
        }
        // 超過 10 秒 → 失敗
        if (Date.now() - readinessCheckStart > 10000) {
          clearInterval(readinessInterval);
          setCameraError("相機啟動超時，請點取消重試");
          stopCamera();
          setMode("instruction");
        }
      }, 200);
    } catch (err: unknown) {
      const errorMessage = parseCameraError(err);
      setCameraError(errorMessage);
      setMode("instruction");
      toast({
        title: "無法存取相機",
        description: "請允許相機權限或使用相簿上傳",
        variant: "destructive",
      });
      // 📊 錯誤上報
      logError("camera", "start_failed", err, {
        userAgent: navigator.userAgent,
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) {
      toast({ title: "拍照失敗", description: "相機未就緒，請重試", variant: "destructive" });
      return;
    }

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      // 相機 ready 但 video frame 沒資料
      if (canAutoRestart()) {
        toast({
          title: "相機異常重連",
          description: "正在重啟相機，請稍候...",
        });
        markAutoRestart();
        stopCamera();
        setTimeout(() => void startCamera(), 300);
      } else {
        // 已達上限，告知使用者
        toast({
          title: "相機畫面有問題",
          description: "請點「重啟相機」按鈕或改用相簿上傳",
          variant: "destructive",
        });
        setCameraError("相機無法正常顯示，請手動重啟");
      }
      return;
    }

    try {
      // 壓縮：最大邊限制 1920px（避免 iPhone 4K 產生 5MB+ dataURL 上傳慢、AI 分析貴）
      const MAX_DIMENSION = 1920;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("無法建立繪圖環境");

      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (!dataUrl || dataUrl.length <= 100) throw new Error("圖片資料無效");

      setCapturedImage(dataUrl);
      stopCamera();
      setMode("preview");
      logMilestone("camera", "photo_captured", { size: dataUrl.length });
    } catch (err) {
      toast({ title: "拍照失敗", description: "請重試", variant: "destructive" });
      logError("camera", "capture_failed", err);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "檔案格式錯誤", description: "請選擇圖片檔案", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "檔案太大", description: "請選擇小於 10MB 的圖片", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;
      // 相簿選來的圖片也要壓縮到 1920px 最大邊
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 1920;
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        if (scale === 1) {
          // 已夠小，直接使用
          setCapturedImage(result);
          setMode("preview");
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setCapturedImage(result);
          setMode("preview");
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.85);
        setCapturedImage(compressed || result);
        setMode("preview");
      };
      img.onerror = () => {
        setCapturedImage(result);
        setMode("preview");
      };
      img.src = result;
    };
    reader.onerror = () => {
      toast({ title: "讀取檔案失敗", description: "請重試", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  };

  const retake = () => {
    setCapturedImage(null);
    setCameraError(null);
    resetRestartCounter(); // 使用者主動動作 → 重置自動重啟計數
    startCamera();
  };

  const cancelCamera = () => {
    stopCamera();
    setCameraError(null);
    resetRestartCounter();
    // 清空之前拍過的照片，避免再次開啟相機時舊 preview 仍殘留
    setCapturedImage(null);
    setMode("instruction");
  };

  return {
    mode,
    setMode,
    capturedImage,
    setCapturedImage,
    cameraError,
    cameraReady,
    videoRef,
    fileInputRef,
    startCamera,
    stopCamera,
    capturePhoto,
    handleFileUpload,
    cancelCamera,
    retake,
  };
}

/** 將相機錯誤轉為使用者友好訊息 */
function parseCameraError(err: unknown): string {
  const name = (err as { name?: string })?.name || "";
  const message = (err as { message?: string })?.message || "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "相機權限被拒絕。請在瀏覽器設定中允許相機權限，然後重試。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "找不到相機設備。請確認您的設備有相機功能。";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "相機正在被其他應用程式使用中。請關閉其他使用相機的應用程式後重試。";
  }
  if (name === "OverconstrainedError") {
    return "相機設定不支援。請嘗試使用其他設備。";
  }
  if (name === "SecurityError") {
    return "需要安全連線 (HTTPS) 才能使用相機功能。";
  }
  if (message) {
    return `相機錯誤: ${message}`;
  }
  return "無法存取相機";
}
