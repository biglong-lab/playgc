import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Camera, Check, X, Upload, RotateCcw, Loader2, AlertTriangle, RefreshCw, Image } from "lucide-react";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoMissionPageProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: any) => void;
}

export default function PhotoMissionPage({ config, onComplete, sessionId, gameId }: PhotoMissionPageProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [mode, setMode] = useState<"instruction" | "initializing" | "camera" | "preview" | "uploading" | "verifying">("instruction");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const uploadMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const response = await apiRequest("POST", "/api/cloudinary/player-photo", {
        imageData,
        gameId: gameId,
        sessionId: sessionId,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "上傳失敗");
      }
      
      return response.json();
    },
    onSuccess: () => {
      const reward: { points?: number; items?: string[] } = { points: config.aiVerify ? 20 : 10 };
      if (config.onSuccess?.grantItem) {
        reward.items = [config.onSuccess.grantItem];
      }
      
      if (config.aiVerify) {
        setMode("verifying");
        setTimeout(() => {
          toast({
            title: "照片驗證通過!",
            description: config.onSuccess?.message || "任務完成!",
          });
          onComplete(reward);
        }, 2000);
      } else {
        toast({
          title: "照片已上傳",
          description: config.onSuccess?.message || "任務完成!",
        });
        onComplete(reward);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "上傳失敗",
        description: error.message || "請重試",
        variant: "destructive",
      });
      setMode("preview");
    },
  });

  const checkCameraSupport = (): boolean => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("您的瀏覽器不支援相機功能。請使用較新版本的瀏覽器，或從相簿選擇照片。");
      return false;
    }
    return true;
  };

  const startCamera = async () => {
    setCameraError(null);
    setCameraReady(false);
    
    if (!checkCameraSupport()) {
      return;
    }

    setMode("initializing");

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        // Clear any previous handlers
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onerror = null;
        
        videoRef.current.srcObject = mediaStream;
        
        // Set up timeout fallback for stalled metadata (Safari/iOS issue)
        const metadataTimeout = setTimeout(() => {
          if (videoRef.current && !cameraReady) {
            attemptPlayWithPolling();
          }
        }, 3000);

        const attemptPlayWithPolling = () => {
          if (!videoRef.current) return;
          
          videoRef.current.play()
            .then(() => {
              // Poll for valid video dimensions
              const checkDimensions = setInterval(() => {
                if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                  clearInterval(checkDimensions);
                  setCameraReady(true);
                  setMode("camera");
                }
              }, 100);
              
              // Give up after 5 seconds of polling
              setTimeout(() => clearInterval(checkDimensions), 5000);
            })
            .catch(() => {
              setCameraError("無法播放相機畫面，請重試");
              stopCamera();
              setMode("instruction");
            });
        };

        videoRef.current.onloadedmetadata = () => {
          clearTimeout(metadataTimeout);
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                setCameraReady(true);
                setMode("camera");
              })
              .catch(() => {
                setCameraError("無法播放相機畫面，請重試");
                stopCamera();
                setMode("instruction");
              });
          }
        };

        videoRef.current.onerror = () => {
          clearTimeout(metadataTimeout);
          setCameraError("相機發生錯誤，請重試");
          stopCamera();
          setMode("instruction");
        };
      }
    } catch (err: any) {
      let errorMessage = "無法存取相機";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMessage = "相機權限被拒絕。請在瀏覽器設定中允許相機權限，然後重試。";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMessage = "找不到相機設備。請確認您的設備有相機功能。";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMessage = "相機正在被其他應用程式使用中。請關閉其他使用相機的應用程式後重試。";
      } else if (err.name === "OverconstrainedError") {
        errorMessage = "相機設定不支援。請嘗試使用其他設備。";
      } else if (err.name === "SecurityError") {
        errorMessage = "需要安全連線 (HTTPS) 才能使用相機功能。";
      } else if (err.message) {
        errorMessage = `相機錯誤: ${err.message}`;
      }
      
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
      toast({
        title: "拍照失敗",
        description: "相機未就緒，請重試",
        variant: "destructive",
      });
      return;
    }

    const video = videoRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast({
        title: "拍照失敗",
        description: "相機畫面未載入完成，請稍候再試",
        variant: "destructive",
      });
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        
        if (dataUrl && dataUrl.length > 100) {
          setCapturedImage(dataUrl);
          stopCamera();
          setMode("preview");
        } else {
          throw new Error("圖片資料無效");
        }
      } else {
        throw new Error("無法建立繪圖環境");
      }
    } catch (err) {
      toast({
        title: "拍照失敗",
        description: "請重試",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "檔案格式錯誤",
        description: "請選擇圖片檔案",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "檔案太大",
        description: "請選擇小於 10MB 的圖片",
        variant: "destructive",
      });
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
      toast({
        title: "讀取檔案失敗",
        description: "請重試",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const submitPhoto = async () => {
    if (!capturedImage) {
      toast({
        title: "沒有照片",
        description: "請先拍攝或選擇照片",
        variant: "destructive",
      });
      return;
    }
    
    setMode("uploading");
    uploadMutation.mutate(capturedImage);
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

  return (
    <div className="min-h-full flex flex-col p-4">
      {mode === "instruction" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <Camera className="w-10 h-10 text-primary" />
              </div>
              
              <h2 className="text-xl font-display font-bold text-center mb-4">
                {config.title || "拍照任務"}
              </h2>
              
              <div className="bg-accent/50 border border-border rounded-lg p-4 mb-6">
                <p className="text-sm font-medium mb-2">任務說明:</p>
                <p className="text-muted-foreground">
                  {config.instruction || config.prompt || config.description || "請拍攝符合要求的照片"}
                </p>
              </div>

              {config.targetKeywords && config.targetKeywords.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium mb-2">需要拍攝:</p>
                  <div className="flex flex-wrap gap-2">
                    {config.targetKeywords.map((keyword, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
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
                    onClick={() => { setCameraError(null); startCamera(); }}
                    className="mt-3 w-full gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重試
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <Button 
                  onClick={startCamera} 
                  className="w-full gap-2"
                  data-testid="button-open-camera"
                >
                  <Camera className="w-4 h-4" />
                  開啟相機
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full gap-2"
                  data-testid="button-upload-photo"
                >
                  <Image className="w-4 h-4" />
                  從相簿選擇
                </Button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <p className="text-xs text-muted-foreground text-center mt-4">
                提示: 請確保允許瀏覽器使用相機權限，並在光線充足的環境拍攝
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "initializing" && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative bg-black rounded-lg overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                <p className="text-lg">正在啟動相機...</p>
                <p className="text-sm text-white/60 mt-2">請允許相機權限</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center">
            <Button 
              variant="outline" 
              onClick={cancelCamera}
              data-testid="button-cancel-init"
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {mode === "camera" && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4/5 h-3/4 border-2 border-dashed border-primary/50 rounded-lg" />
            </div>

            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-4">
            <Button 
              variant="outline" 
              onClick={cancelCamera}
              data-testid="button-cancel-camera"
            >
              取消
            </Button>
            
            <Button
              size="lg"
              onClick={capturePhoto}
              disabled={!cameraReady}
              className="w-20 h-20 rounded-full"
              data-testid="button-capture"
            >
              <Camera className="w-8 h-8" />
            </Button>
            
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-gallery"
            >
              <Image className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-2">
            將拍攝對象對準框內，然後按下快門
          </p>
        </div>
      )}

      {mode === "preview" && capturedImage && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative bg-black rounded-lg overflow-hidden">
            <img 
              src={capturedImage} 
              alt="Captured" 
              className="w-full h-full object-contain"
            />
          </div>

          <div className="mt-4 flex items-center justify-center gap-4">
            <Button 
              variant="outline" 
              onClick={retake}
              className="gap-2"
              data-testid="button-retake"
            >
              <RotateCcw className="w-4 h-4" />
              重拍
            </Button>
            
            <Button 
              onClick={submitPhoto}
              className="gap-2"
              data-testid="button-submit-photo"
            >
              <Check className="w-4 h-4" />
              確認上傳
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-2">
            確認照片清晰且符合任務要求
          </p>
        </div>
      )}

      {mode === "uploading" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">上傳中...</p>
            <p className="text-sm text-muted-foreground">請稍候，不要離開此頁面</p>
          </div>
        </div>
      )}

      {mode === "verifying" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Camera className="w-8 h-8 text-primary" />
            </div>
            <p className="text-lg font-medium">AI 驗證中...</p>
            <p className="text-sm text-muted-foreground">正在分析照片內容</p>
          </div>
        </div>
      )}
    </div>
  );
}
