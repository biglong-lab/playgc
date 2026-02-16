import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export type PhotoMode =
  | "instruction"
  | "initializing"
  | "camera"
  | "preview"
  | "uploading"
  | "verifying";

export interface PhotoCameraState {
  mode: PhotoMode;
  setMode: (mode: PhotoMode) => void;
  capturedImage: string | null;
  setCapturedImage: (img: string | null) => void;
  cameraError: string | null;
  cameraReady: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  startCamera: () => Promise<void>;
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

  // 元件卸載時停止相機
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

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

      if (!videoRef.current) return;

      videoRef.current.onloadedmetadata = null;
      videoRef.current.onerror = null;
      videoRef.current.srcObject = mediaStream;

      // Safari/iOS fallback: 3 秒後嘗試直接播放
      const metadataTimeout = setTimeout(() => {
        if (videoRef.current && !cameraReady) {
          attemptPlay();
        }
      }, 3000);

      const attemptPlay = () => {
        if (!videoRef.current) return;
        videoRef.current
          .play()
          .then(() => {
            const check = setInterval(() => {
              if (
                videoRef.current &&
                videoRef.current.videoWidth > 0 &&
                videoRef.current.videoHeight > 0
              ) {
                clearInterval(check);
                setCameraReady(true);
                setMode("camera");
              }
            }, 100);
            setTimeout(() => clearInterval(check), 5000);
          })
          .catch(() => {
            setCameraError("無法播放相機畫面，請重試");
            stopCamera();
            setMode("instruction");
          });
      };

      videoRef.current.onloadedmetadata = () => {
        clearTimeout(metadataTimeout);
        if (!videoRef.current) return;
        videoRef.current
          .play()
          .then(() => {
            setCameraReady(true);
            setMode("camera");
          })
          .catch(() => {
            setCameraError("無法播放相機畫面，請重試");
            stopCamera();
            setMode("instruction");
          });
      };

      videoRef.current.onerror = () => {
        clearTimeout(metadataTimeout);
        setCameraError("相機發生錯誤，請重試");
        stopCamera();
        setMode("instruction");
      };
    } catch (err: unknown) {
      const errorMessage = parseCameraError(err);
      setCameraError(errorMessage);
      setMode("instruction");
      toast({
        title: "無法存取相機",
        description: "請允許相機權限或使用相簿上傳",
        variant: "destructive",
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
      toast({ title: "拍照失敗", description: "相機畫面未載入完成，請稍候再試", variant: "destructive" });
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("無法建立繪圖環境");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (!dataUrl || dataUrl.length <= 100) throw new Error("圖片資料無效");

      setCapturedImage(dataUrl);
      stopCamera();
      setMode("preview");
    } catch {
      toast({ title: "拍照失敗", description: "請重試", variant: "destructive" });
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
      if (result) {
        setCapturedImage(result);
        setMode("preview");
      }
    };
    reader.onerror = () => {
      toast({ title: "讀取檔案失敗", description: "請重試", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  };

  const retake = () => {
    setCapturedImage(null);
    setCameraError(null);
    startCamera();
  };

  const cancelCamera = () => {
    stopCamera();
    setCameraError(null);
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
