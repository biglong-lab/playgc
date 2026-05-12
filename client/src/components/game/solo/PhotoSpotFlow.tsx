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
import { usePhotoCamera } from "../photo-mission/usePhotoCamera";
import { savePhotoToAlbum, getSaveToastMessage } from "@/lib/photo-save";
import { useStableGeolocation } from "@/lib/geolocation";
import { pickVariant } from "@/lib/variant-picker";
import { GpsAccuracyIndicator } from "../GpsAccuracyIndicator";
import { formatAiError } from "@/lib/ai-error";
import {
  CameraInitializingView,
  CameraView,
  PhotoPreview,
  UploadingView,
  VerifyingView,
} from "../photo-mission/PhotoViews";
import PhotoSuccessView from "../photo-mission/PhotoSuccessView";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoSpotFlowProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  // 🔧 v2: GamePageRenderer commonProps 會 spread 這兩個（目前未用但保留接收避免 TS excess property）
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
  // 🎨 P2: 變體池（admin 預生成的訊息陣列，玩家觸發時隨機抽）
  variantPool?: unknown;
}

interface CompositeResponse {
  success: boolean;
  compositeUrl: string;
  urlLength: number;
}

// 🐛 已修：calculateDistance 已回傳公尺（map-utils.ts R = 6371e3），
// 之前誤乘 1000 導致顯示假公尺（138 m → 138512 m）
// 保留常數註記，避免未來再出現同樣錯誤
// const KM_TO_M = 1000; // ← 廢除：已不需要

export default function PhotoSpotFlow({
  config,
  onComplete,
  sessionId,
  gameId,
  variantPool,
}: PhotoSpotFlowProps) {
  const { toast } = useToast();
  const camera = usePhotoCamera();
  const spot = config.spotConfig;

  // 合成結果
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // 防重複完成
  const finishedRef = useRef(false);

  // 🛰️ 用 useStableGeolocation 取代直接 watchPosition
  // 修復原本 maximumAge: 10000 的 bug（會回舊位置）
  // 加上多採樣 + Kalman 濾波，定位更穩
  const {
    position: stablePos,
    accuracy: gpsAccuracy,
    quality: gpsQuality,
    samples: gpsSamples,
    active: gpsActive,
    error: gpsErrorObj,
  } = useStableGeolocation({
    mode: "watch",
    enabled: !!spot,
    sampleSize: 5,
    minSampleIntervalMs: 1000,
  });

  const userCoords = stablePos ? { lat: stablePos.lat, lng: stablePos.lng } : null;
  const gpsError = gpsErrorObj
    ? gpsErrorObj.code === gpsErrorObj.PERMISSION_DENIED
      ? "請允許 GPS 定位權限"
      : "無法取得定位"
    : !("geolocation" in navigator)
    ? "裝置不支援 GPS 定位"
    : null;

  // 計算距離（公尺）— calculateDistance 已直接回傳公尺，不需 × 1000
  const distanceMeters = userCoords && spot
    ? calculateDistance(userCoords.lat, userCoords.lng, spot.latitude, spot.longitude)
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
            // 🎨 從變體池抽失敗訊息（fallback 為 AI 即時 feedback）
            toast({
              title: "😢 AI 驗證未通過",
              description: pickVariant(
                variantPool,
                "fail",
                verifyResult.feedback || "拍到的場景不符，再試一次？",
              ),
              variant: "destructive",
            });
            camera.setMode("instruction");
            camera.setCapturedImage(null);
          } else {
            toast({
              title: "已達重試上限",
              description: pickVariant(variantPool, "hint", "可選擇跳過或下次再試"),
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
        // 🤖 統一 AI 錯誤訊息（涵蓋 502/503/504/429/timeout/billing/quota）
        const errMsg = err instanceof Error ? err.message : String(err);
        const isAiError =
          /\/api\/ai\//.test(errMsg) ||
          /AI/i.test(errMsg) ||
          /50[0-9]|429/.test(errMsg) ||
          /TIMEOUT|超時/.test(errMsg);
        if (isAiError) {
          const { title, description } = formatAiError(err);
          toast({ title, description, variant: "destructive" });
        } else {
          // 上傳階段 / 網路錯誤（截掉 HTML 避免顯示整段 nginx 錯誤頁）
          const cleanMsg = errMsg.includes("<html")
            ? "請檢查網路連線"
            : (err instanceof Error ? err.message : "請檢查網路");
          toast({
            title: "上傳失敗",
            description: cleanMsg,
            variant: "destructive",
          });
        }
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

    const points = rewardPoints ?? legacyPoints ?? 0;
    const reward: { points?: number; items?: string[] } = { points };

    const allItems = [
      ...rewardItems.filter((x) => !!x),
      ...(legacyItem ? [legacyItem] : []),
    ];
    if (allItems.length > 0) reward.items = allItems;

    onComplete(reward, config.nextPageId);
  };

  // 🆕 一鍵保存到手機相簿（手機優先 share sheet，桌機 fallback 下載）
  const handleSaveToAlbum = async () => {
    if (!compositeUrl) return;
    const result = await savePhotoToAlbum({
      url: compositeUrl,
      filename: "chito-memorial",
      title: config.title || "CHITO 紀念照",
      text: "我的 CHITO 遊戲紀念照！",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  // 桌機備援下載（保留給有需要的使用者）
  const handleDownload = async () => {
    if (!compositeUrl) return;
    const result = await savePhotoToAlbum({
      url: compositeUrl,
      filename: "chito-memorial",
      forceMethod: "download",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  // 分享紀念照（與保存分離，給想分享給朋友的場景）
  const handleShare = async () => {
    if (!compositeUrl) return;
    const result = await savePhotoToAlbum({
      url: compositeUrl,
      filename: "chito-memorial",
      title: config.title || "CHITO 紀念照",
      text: "我的 CHITO 遊戲紀念照！",
      forceMethod: "share",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
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

  // 合成完成畫面（共用 PhotoSuccessView）
  if (compositeUrl) {
    return (
      <PhotoSuccessView
        imageUrl={compositeUrl}
        title="打卡成功！"
        subtitle={spot?.sceneDescription}
        downloadPrefix="chito-spot"
        onContinue={handleContinue}
        testId="photo-spot-success"
      />
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
        stream={camera.stream}
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
        {/* 🛰️ GPS 精度即時提示（弱訊號時引導玩家移動）*/}
        {!gpsError && gpsActive && (
          <GpsAccuracyIndicator
            accuracy={gpsAccuracy}
            quality={gpsQuality}
            samples={gpsSamples}
            active={gpsActive}
          />
        )}

        <div
          className={`rounded-lg border p-4 transition-colors ${
            inRange
              ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-border bg-card"
          }`}
          data-testid="photo-spot-gps-card"
          data-in-range={inRange}
        >
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
            // 🆕 進入範圍 → 慶祝感（icon 緩脈動 + ✨）
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5 animate-[pulse_1.5s_ease-in-out_infinite]" />
              <p className="font-medium">✨ 已進入拍照點範圍！</p>
            </div>
          ) : (
            // 🆕 距離視覺化進度條（越近越短，色階：紅 → 黃 → 綠）
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">距離拍照點</span>
                <span
                  className="font-bold font-number text-primary tabular-nums"
                  data-testid="photo-spot-distance"
                >
                  {distanceMeters !== null ? Math.round(distanceMeters) : "--"} m
                </span>
              </div>
              {/* 🆕 距離進度條：clamp 0~3*radius，越接近半徑越綠 */}
              {distanceMeters !== null && (() => {
                const maxRange = Math.max(radius * 3, 100);
                const ratio = Math.min(distanceMeters / maxRange, 1);
                const closeness = 1 - ratio; // 1 = 在原點、0 = 邊緣
                const barColor =
                  closeness > 0.7
                    ? "bg-emerald-500"
                    : closeness > 0.4
                      ? "bg-amber-500"
                      : "bg-red-500";
                return (
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${closeness * 100}%` }}
                      role="progressbar"
                      aria-valuenow={Math.round(closeness * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                );
              })()}
              <p className="text-xs text-muted-foreground tabular-nums">
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
          className="w-full gap-2 h-14 transition-transform active:scale-[0.97] disabled:opacity-50"
          data-testid="btn-photo-spot-open-camera"
        >
          <Camera className="w-5 h-5" />
          {canOpenCamera ? "開啟相機拍照" : "請靠近拍照點"}
        </Button>

        {/* 🆕 soft mode 警告強化 — bg + icon 不易被忽略 */}
        {strictMode === "soft" && !inRange && userCoords && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-500/40 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 leading-relaxed text-center">
            ⚠️ 不在範圍內拍照可能無法取得完整分數
          </div>
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
