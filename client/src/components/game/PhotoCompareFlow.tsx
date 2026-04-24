// 🔍 PhotoCompareFlow — 拍照確認（AI 比對玩家照 vs 參考照）
//
// 資料流：
//   1. 顯示參考照 + 描述
//   2. 玩家按開啟相機 → 拍照 → 上傳
//   3. 呼叫 AI 比對 endpoint（multi-image prompt）
//   4. 返回相似度 + 符合/缺少特徵
//   5. 通過門檻 → 合成紀念照 → 顯示結果

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share2,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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

interface PhotoCompareFlowProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  // 🔧 v2: GamePageRenderer commonProps 會 spread 這兩個
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
}

interface CompareResponse {
  verified: boolean;
  similarity: number;
  matchedFeatures: string[];
  missingFeatures: string[];
  feedback: string;
}

export default function PhotoCompareFlow({
  config,
  onComplete,
  sessionId,
  gameId,
}: PhotoCompareFlowProps) {
  const { toast } = useToast();
  const camera = usePhotoCamera();
  const compare = config.compareConfig;

  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastResult, setLastResult] = useState<CompareResponse | null>(null);
  const [showReference, setShowReference] = useState<boolean>(
    compare?.showReferenceToPlayer !== false
  );

  const finishedRef = useRef(false);

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

  // AI 比對（呼叫 /api/ai/compare-photos — 輪 5 會實作後端；這輪先用既有 verify-photo 搭描述）
  const compareMutation = useMutation({
    mutationFn: async (imageUrl: string): Promise<CompareResponse> => {
      if (!compare) throw new Error("缺少 compareConfig");
      try {
        // 優先走新 endpoint（若後端尚未部署，fallback 走 verify-photo）
        const res = await apiRequest("POST", "/api/ai/compare-photos", {
          playerImageUrl: imageUrl,
          referenceImageUrl: compare.referenceImageUrl,
          referenceDescription: compare.referenceDescription,
          compareMode: compare.compareMode ?? "scene",
          similarityThreshold: compare.similarityThreshold ?? 0.6,
          gameId,
        });
        return res.json();
      } catch {
        // Fallback: 用 verify-photo，把 description 當 keyword
        const keywords = compare.referenceDescription
          ? [compare.referenceDescription]
          : ["參考場景"];
        const res = await apiRequest("POST", "/api/ai/verify-photo", {
          imageUrl,
          targetKeywords: keywords,
          instruction: compare.referenceDescription,
          confidenceThreshold: compare.similarityThreshold ?? 0.6,
          gameId,
        });
        const data = await res.json();
        return {
          verified: data.verified,
          similarity: data.confidence,
          matchedFeatures: data.detectedObjects ?? [],
          missingFeatures: [],
          feedback: data.feedback ?? "",
        };
      }
    },
  });

  // 合成紀念照
  const compositeMutation = useMutation({
    mutationFn: async (publicId: string) => {
      // 🆕 v2: 場域自訂 memorial 模板優先
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
          gameTitle: config.title || "拍照比對",
        },
      });
      return res.json() as Promise<{ compositeUrl: string }>;
    },
  });

  // 主流程
  useEffect(() => {
    const process = async () => {
      if (!camera.capturedImage) return;
      if (camera.mode !== "preview") return;

      try {
        camera.setMode("uploading");
        const uploaded = await uploadMutation.mutateAsync(camera.capturedImage);
        setOriginalUrl(uploaded.url);

        camera.setMode("verifying");
        const result = await compareMutation.mutateAsync(uploaded.url);
        setLastResult(result);

        if (!result.verified) {
          setRetryCount((c) => c + 1);
          const canRetry =
            (config.allowRetryOnAiFail ?? true) &&
            retryCount < (config.maxAiRetries ?? 3);
          if (canRetry) {
            toast({
              title: `相似度 ${Math.round(result.similarity * 100)}%`,
              description: result.feedback || "跟參考照不夠像，再試一次？",
              variant: "destructive",
            });
            // 失敗後顯示參考照（若原本隱藏）
            if (compare?.showReferenceAfterFail) setShowReference(true);
            camera.setMode("instruction");
            camera.setCapturedImage(null);
          } else {
            camera.setMode("ai_fail");
          }
          return;
        }

        // 通過 → 合成
        if (config.enableComposite !== false && compare?.enableComposite !== false) {
          try {
            const compRes = await compositeMutation.mutateAsync(uploaded.publicId);
            setCompositeUrl(compRes.compositeUrl);
          } catch (err) {
            console.warn("[PhotoCompare] 合成失敗，用原圖:", err);
            setCompositeUrl(uploaded.url);
          }
        } else {
          setCompositeUrl(uploaded.url);
        }
      } catch (err) {
        toast({
          title: "處理失敗",
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

  const handleDownload = async () => {
    if (!compositeUrl) return;
    try {
      const res = await fetch(compositeUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chito-compare-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast({ title: "下載完成", duration: 1500 });
    } catch {
      toast({ title: "下載失敗", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!compositeUrl) return;
    try {
      if (typeof navigator.share === "function") {
        const res = await fetch(compositeUrl);
        const blob = await res.blob();
        const file = new File([blob], "compare.jpg", { type: "image/jpeg" });
        const canShareFiles =
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share({
            title: config.title || "CHITO 拍照比對",
            text: "我成功配對這張照片！",
            files: [file],
          });
          return;
        }
        await navigator.share({
          title: config.title || "CHITO 拍照比對",
          text: "我成功配對這張照片！",
          url: compositeUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(compositeUrl);
      toast({ title: "已複製連結" });
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      toast({ title: "分享失敗", variant: "destructive" });
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  if (!compare) {
    return (
      <div className="p-6 text-center" data-testid="photo-compare-missing-config">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
        <p className="text-destructive font-medium">photo_compare 元件缺少 compareConfig 設定</p>
      </div>
    );
  }

  // 合成完成（共用 PhotoSuccessView）
  if (compositeUrl) {
    const simText = lastResult
      ? `相似度 ${Math.round(lastResult.similarity * 100)}%${
          lastResult.matchedFeatures.length > 0
            ? ` · ${lastResult.matchedFeatures.slice(0, 3).join(" / ")}`
            : ""
        }`
      : undefined;
    return (
      <PhotoSuccessView
        imageUrl={compositeUrl}
        title="比對通過！"
        subtitle={simText}
        downloadPrefix="chito-compare"
        onContinue={handleContinue}
        testId="photo-compare-success"
      />
    );
  }

  // 相機狀態
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
  if (camera.mode === "uploading") return <UploadingView />;
  if (camera.mode === "preview") {
    return (
      <PhotoPreview
        imageSrc={camera.capturedImage!}
        onRetake={camera.retake}
        onSubmit={() => { /* auto */ }}
      />
    );
  }
  if (camera.mode === "verifying") return <VerifyingView />;

  if (camera.mode === "ai_fail") {
    return (
      <div className="p-6 text-center space-y-4" data-testid="photo-compare-ai-fail">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500" />
        <p className="text-lg font-medium">比對未通過</p>
        {lastResult && (
          <p className="text-sm text-muted-foreground">
            最高相似度 {Math.round(lastResult.similarity * 100)}%，已用完重試次數
          </p>
        )}
        <Button onClick={handleContinue} variant="outline" data-testid="btn-photo-compare-skip">
          跳過此任務
        </Button>
      </div>
    );
  }

  // 預設：參考照 + 開始拍照
  return (
    <div className="h-full w-full flex flex-col items-center p-4 gap-4 overflow-y-auto" data-testid="photo-compare-instruction">
      <div className="text-center space-y-2 pt-4">
        <h2 className="text-2xl font-bold" data-testid="photo-compare-title">
          {config.title || "拍照比對任務"}
        </h2>
        {compare.referenceDescription && (
          <p className="text-muted-foreground text-sm">{compare.referenceDescription}</p>
        )}
      </div>

      <div className="max-w-md mx-auto w-full space-y-4">
        {showReference && (
          <div className="rounded-lg overflow-hidden border shadow-sm" data-testid="photo-compare-reference">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted text-sm">
              <Eye className="w-4 h-4" />
              <span className="font-medium">參考照片</span>
            </div>
            <img
              src={compare.referenceImageUrl}
              alt="參考"
              className="w-full aspect-square object-cover"
            />
            <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/50">
              請拍出跟這張照片類似的畫面
            </div>
          </div>
        )}

        {!showReference && compare.showReferenceAfterFail && retryCount === 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1"
            onClick={() => setShowReference(true)}
            data-testid="btn-show-reference"
          >
            <Eye className="w-4 h-4" />
            查看參考照
          </Button>
        )}

        {lastResult && retryCount > 0 && (
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-3 text-sm" data-testid="photo-compare-last-feedback">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              上次相似度 {Math.round(lastResult.similarity * 100)}%
            </p>
            {lastResult.missingFeatures.length > 0 && (
              <p className="text-xs mt-1">缺少：{lastResult.missingFeatures.join("、")}</p>
            )}
            {lastResult.feedback && (
              <p className="text-xs mt-1 italic">{lastResult.feedback}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              剩餘重試次數：{(config.maxAiRetries ?? 3) - retryCount}
            </p>
          </div>
        )}

        <Button
          onClick={() => camera.startCamera(config.defaultFacingMode ?? "environment")}
          size="lg"
          className="w-full gap-2 h-14"
          data-testid="btn-photo-compare-open-camera"
        >
          <Camera className="w-5 h-5" />
          開啟相機拍照
        </Button>

        <input
          ref={camera.fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={camera.handleFileUpload}
          className="hidden"
          data-testid="input-photo-compare-upload"
        />
      </div>
    </div>
  );
}
