// 📍 PhotoSpotFlow — 指定拍照（GPS + AI 雙通道驗證）
//
// 資料流：
//   1. 載入 → watchPosition 監測 GPS
//   2. 未進半徑 → 相機按鈕 disabled，顯示「距離 X 公尺」
//   3. 進入半徑 → 相機啟用 → 拍照 → 上傳 Cloudinary
//   4. 上傳完呼叫 AI 驗證（帶上 sceneDescription）
//   5. 驗證成功 → 呼叫 /api/cloudinary/composite-photo 合成紀念照
//   6. 顯示合成結果 + 下載/分享/繼續

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapPin, Camera, CheckCircle2, AlertTriangle, Download, Share2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { calculateDistance } from "@/lib/map-utils";
import { usePhotoCamera } from "./photo-mission/usePhotoCamera";
import {
  CameraInitializingView,
  CameraView,
  PhotoPreview,
  UploadingView,
  VerifyingView,
} from "./photo-mission/PhotoViews";
import PhotoSuccessView from "./photo-mission/PhotoSuccessView";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoSpotFlowProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  // 🔧 v2: GamePageRenderer commonProps 會 spread 這兩個（目前未用但保留接收避免 TS excess property）
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
}

interface CompositeResponse {
  success: boolean;
  compositeUrl: string;
  urlLength: number;
}

// 地球圓周的 per-meter 近似（km → m 轉換需要 ×1000）
const KM_TO_M = 1000;

export default function PhotoSpotFlow({
  config,
  onComplete,
  sessionId,
  gameId,
}: PhotoSpotFlowProps) {
  const { toast } = useToast();
  const camera = usePhotoCamera();
  const spot = config.spotConfig;

  // GPS 相關狀態
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // 合成結果
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // 防重複完成
  const finishedRef = useRef(false);

  // 監測 GPS
  useEffect(() => {
    if (!spot) return;
    if (!("geolocation" in navigator)) {
      setGpsError("裝置不支援 GPS 定位");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError(null);
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "請允許 GPS 定位權限"
            : "無法取得定位"
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [spot]);

  // 計算距離（公尺）
  const distanceMeters = userCoords && spot
    ? calculateDistance(userCoords.lat, userCoords.lng, spot.latitude, spot.longitude) * KM_TO_M
    : null;
  const radius = spot?.radiusMeters ?? 20;
  const inRange = distanceMeters !== null && distanceMeters <= radius;
  const strictMode = spot?.gpsStrictMode ?? "hard";
  const canOpenCamera = strictMode === "soft" || inRange;

  // 上傳照片
  const uploadMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const res = await apiRequest("POST", "/api/cloudinary/player-photo", {
        imageData,
        gameId,
        sessionId,
      });
      return res.json() as Promise<{ url: string; publicId: string }>;
    },
  });

  // AI 驗證（photo_spot 模式，使用 sceneDescription）
  const verifyMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const keywords = spot?.sceneKeywords?.length
        ? spot.sceneKeywords
        : spot?.sceneDescription
          ? [spot.sceneDescription]
          : [];
      const res = await apiRequest("POST", "/api/ai/verify-photo", {
        imageUrl,
        targetKeywords: keywords,
        instruction: spot?.sceneDescription,
        confidenceThreshold: config.aiConfidenceThreshold ?? 0.6,
        gameId,
      });
      return res.json() as Promise<{
        verified: boolean;
        confidence: number;
        feedback: string;
        detectedObjects: string[];
      }>;
    },
  });

  // 合成紀念照
  const compositeMutation = useMutation({
    mutationFn: async (publicId: string): Promise<CompositeResponse> => {
      // 🆕 v2: 優先取場域 memorial 模板（沒設則 fallback 系統預設）
      // 嘗試從 URL 取 fieldCode（場域頁 path /f/:code）
      const fieldCodeMatch = window.location.pathname.match(/\/f\/([A-Z0-9_-]+)/i);
      const fieldCode = fieldCodeMatch?.[1]?.toUpperCase();
      const memorialUrl = fieldCode
        ? `/api/photo-composite/memorial-config?fieldCode=${encodeURIComponent(fieldCode)}`
        : "/api/photo-composite/default-config";
      const configRes = await fetch(memorialUrl);
      const { config: defaultConfig } = await configRes.json();

      const res = await apiRequest("POST", "/api/cloudinary/composite-photo", {
        playerPhotoPublicId: publicId,
        config: defaultConfig,
        dynamicVars: {
          gameTitle: config.title || "遊戲任務",
        },
      });
      return res.json();
    },
  });

  // 主流程：拍照完成 → 上傳 → 驗證 → 合成
  useEffect(() => {
    const process = async () => {
      if (!camera.capturedImage) return;
      if (camera.mode !== "preview") return;

      try {
        camera.setMode("uploading");
        const uploaded = await uploadMutation.mutateAsync(camera.capturedImage);
        setOriginalUrl(uploaded.url);

        // AI 驗證
        camera.setMode("verifying");
        const verifyResult = await verifyMutation.mutateAsync(uploaded.url);

        if (!verifyResult.verified) {
          // AI 驗證失敗
          setRetryCount((c) => c + 1);
          const canRetry =
            (config.allowRetryOnAiFail ?? true) &&
            retryCount < (config.maxAiRetries ?? 3);
          if (canRetry) {
            toast({
              title: "😢 AI 驗證未通過",
              description: verifyResult.feedback || "拍到的場景不符，再試一次？",
              variant: "destructive",
            });
            camera.setMode("instruction");
            camera.setCapturedImage(null);
          } else {
            toast({
              title: "已達重試上限",
              description: "可選擇跳過或下次再試",
            });
            camera.setMode("ai_fail");
          }
          return;
        }

        // 驗證成功 → 合成紀念照
        if (config.enableComposite !== false && spot?.enableComposite !== false) {
          try {
            const compRes = await compositeMutation.mutateAsync(uploaded.publicId);
            setCompositeUrl(compRes.compositeUrl);
          } catch (err) {
            // 合成失敗不阻擋遊戲進度 — 用原圖當紀念
            console.warn("[PhotoSpot] 合成失敗，使用原圖:", err);
            setCompositeUrl(uploaded.url);
          }
        } else {
          setCompositeUrl(uploaded.url);
        }
      } catch (err) {
        toast({
          title: "上傳失敗",
          description: err instanceof Error ? err.message : "請檢查網路",
          variant: "destructive",
        });
        camera.setMode("instruction");
        camera.setCapturedImage(null);
      }
    };
    process();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.capturedImage, camera.mode]);

  // 完成按鈕：繼續遊戲
  const handleContinue = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // 🔧 修：同時讀 rewardPoints/rewardItems (RewardsSection 存的) + onSuccess.* (向後相容)
    const rewardPoints = (config as unknown as { rewardPoints?: number }).rewardPoints;
    const rewardItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
    const legacyPoints = config.onSuccess?.points;
    const legacyItem = config.onSuccess?.grantItem;

    const points = rewardPoints ?? legacyPoints ?? 30;
    const reward: { points?: number; items?: string[] } = { points };

    const allItems = [
      ...rewardItems.filter((x) => !!x),
      ...(legacyItem ? [legacyItem] : []),
    ];
    if (allItems.length > 0) reward.items = allItems;

    onComplete(reward);
  };

  // 下載紀念照
  const handleDownload = async () => {
    if (!compositeUrl) return;
    try {
      const res = await fetch(compositeUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chito-memorial-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast({ title: "下載完成", duration: 1500 });
    } catch {
      toast({ title: "下載失敗", variant: "destructive" });
    }
  };

  // 分享紀念照（Web Share API）
  const handleShare = async () => {
    if (!compositeUrl) return;
    try {
      if (typeof navigator.share === "function") {
        const res = await fetch(compositeUrl);
        const blob = await res.blob();
        const file = new File([blob], "memorial.jpg", { type: "image/jpeg" });
        const canShareFiles = typeof navigator.canShare === "function"
          && navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share({
            title: config.title || "CHITO 紀念照",
            text: "我的 CHITO 遊戲紀念照！",
            files: [file],
          });
          return;
        }
        await navigator.share({
          title: config.title || "CHITO 紀念照",
          text: "我的 CHITO 遊戲紀念照！",
          url: compositeUrl,
        });
        return;
      }
      // Fallback: 複製連結
      await navigator.clipboard.writeText(compositeUrl);
      toast({ title: "已複製連結", description: "可貼到 LINE / FB 分享" });
    } catch (err) {
      // AbortError 是使用者取消
      if ((err as DOMException)?.name === "AbortError") return;
      toast({ title: "分享失敗", variant: "destructive" });
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  // 防護：缺 spotConfig
  if (!spot) {
    return (
      <div className="p-6 text-center" data-testid="photo-spot-missing-config">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
        <p className="text-destructive font-medium">photo_spot 元件缺少 spotConfig 設定</p>
        <p className="text-sm text-muted-foreground mt-1">請聯絡管理員檢查頁面設定</p>
      </div>
    );
  }

  // 合成完成畫面
  if (compositeUrl) {
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center p-4 gap-4" data-testid="photo-spot-success">
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="w-6 h-6" />
          <h2 className="text-xl font-bold">拍照成功！</h2>
        </div>

        <div className="max-w-md w-full bg-card rounded-lg shadow-lg overflow-hidden">
          <img
            src={compositeUrl}
            alt="紀念照"
            className="w-full aspect-square object-cover"
            data-testid="photo-spot-composite-image"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
          <Button
            onClick={handleDownload}
            variant="outline"
            className="flex-1 gap-2"
            data-testid="btn-photo-spot-download"
          >
            <Download className="w-4 h-4" />
            下載
          </Button>
          <Button
            onClick={handleShare}
            variant="outline"
            className="flex-1 gap-2"
            data-testid="btn-photo-spot-share"
          >
            <Share2 className="w-4 h-4" />
            分享
          </Button>
          <Button
            onClick={handleContinue}
            className="flex-1 gap-2"
            data-testid="btn-photo-spot-continue"
          >
            繼續遊戲
          </Button>
        </div>
      </div>
    );
  }

  // 相機進行中
  if (camera.mode === "initializing") {
    return <CameraInitializingView videoRef={camera.videoRef} onCancel={camera.cancelCamera} />;
  }
  if (camera.mode === "camera") {
    return (
      <CameraView
        videoRef={camera.videoRef}
        cameraReady={camera.cameraReady}
        fileInputRef={camera.fileInputRef}
        onCapture={camera.capturePhoto}
        onCancel={camera.cancelCamera}
        onRestart={() => camera.startCamera()}
        onSwitchCamera={camera.switchCamera}
        facingMode={camera.facingMode}
      />
    );
  }
  if (camera.mode === "uploading") {
    return <UploadingView />;
  }
  if (camera.mode === "preview") {
    return (
      <PhotoPreview
        imageSrc={camera.capturedImage!}
        onRetake={camera.retake}
        onSubmit={() => { /* 自動流程 — effect 處理 */ }}
      />
    );
  }
  if (camera.mode === "verifying") {
    return <VerifyingView />;
  }
  if (camera.mode === "ai_fail") {
    return (
      <div className="p-6 text-center space-y-4" data-testid="photo-spot-ai-fail">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
        <p className="text-lg font-medium">拍照與場景不符</p>
        <p className="text-sm text-muted-foreground">已用完重試次數</p>
        <Button onClick={handleContinue} variant="outline" data-testid="btn-photo-spot-skip">
          跳過此任務
        </Button>
      </div>
    );
  }

  // 預設：instruction 畫面（GPS 指引）
  return (
    <div className="h-full w-full flex flex-col items-center p-4 gap-4 overflow-y-auto" data-testid="photo-spot-instruction">
      <div className="text-center space-y-2 pt-6">
        <MapPin className="w-10 h-10 mx-auto text-primary" />
        <h2 className="text-2xl font-bold" data-testid="photo-spot-title">
          {config.title || "指定拍照任務"}
        </h2>
        {spot.sceneDescription && (
          <p className="text-muted-foreground">{spot.sceneDescription}</p>
        )}
      </div>

      {/* GPS 狀態卡片 */}
      <div className="max-w-md mx-auto w-full space-y-3">
        <div className="rounded-lg border bg-card p-4" data-testid="photo-spot-gps-card">
          {gpsError ? (
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">GPS 錯誤</p>
                <p className="text-sm">{gpsError}</p>
              </div>
            </div>
          ) : !userCoords ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <p className="text-sm">正在取得你的位置...</p>
            </div>
          ) : inRange ? (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              <p className="font-medium">已進入拍照點範圍</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">距離拍照點</span>
                <span className="font-bold font-number text-primary" data-testid="photo-spot-distance">
                  {distanceMeters !== null ? Math.round(distanceMeters) : "--"} m
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                請靠近目標 {radius} 公尺內才能拍照
              </p>
            </div>
          )}
        </div>

        {spot.referenceImageUrl && (
          <div className="rounded-lg overflow-hidden border">
            <p className="text-xs text-muted-foreground px-3 py-2 bg-muted">📸 參考畫面</p>
            <img src={spot.referenceImageUrl} alt="參考" className="w-full aspect-video object-cover" />
          </div>
        )}

        <Button
          onClick={() => camera.startCamera(config.defaultFacingMode ?? "environment")}
          disabled={!canOpenCamera}
          size="lg"
          className="w-full gap-2 h-14"
          data-testid="btn-photo-spot-open-camera"
        >
          <Camera className="w-5 h-5" />
          {canOpenCamera ? "開啟相機拍照" : "請靠近拍照點"}
        </Button>

        {strictMode === "soft" && !inRange && (
          <p className="text-xs text-center text-amber-600">
            ⚠️ 不在範圍內拍照可能無法取得完整分數
          </p>
        )}

        <input
          ref={camera.fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={camera.handleFileUpload}
          className="hidden"
          data-testid="input-photo-spot-upload"
        />
      </div>
    </div>
  );
}
