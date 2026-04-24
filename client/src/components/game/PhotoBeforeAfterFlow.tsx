// 🔀 PhotoBeforeAfterFlow — 前後對比拍照元件
//
// 流程：
//   1. 拍第一張（before 標籤，如「整理前」）
//   2. 等待 N 秒（minGapSeconds，預設 10 秒）
//   3. 拍第二張（after 標籤，如「整理後」）
//   4. 兩張上傳 Cloudinary → 合成對比圖（左右或上下）
//   5. 顯示合成結果 + 下載/分享/繼續

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Camera, CheckCircle2, AlertTriangle, Download, Share2, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePhotoCamera } from "./photo-mission/usePhotoCamera";
import {
  CameraInitializingView, CameraView, PhotoPreview, UploadingView,
} from "./photo-mission/PhotoViews";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoBeforeAfterFlowProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
}

type Stage = "intro" | "before" | "gap" | "after" | "done";

export default function PhotoBeforeAfterFlow({
  config,
  onComplete,
  sessionId,
  gameId,
}: PhotoBeforeAfterFlowProps) {
  const { toast } = useToast();
  const camera = usePhotoCamera();
  const ba = config.beforeAfterConfig;

  const [stage, setStage] = useState<Stage>("intro");
  const [beforePhotoId, setBeforePhotoId] = useState<string | null>(null);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState<string | null>(null);
  const [afterPhotoId, setAfterPhotoId] = useState<string | null>(null);
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [gapCountdown, setGapCountdown] = useState(0);

  const finishedRef = useRef(false);

  // 最少間隔倒數（stage === 'gap' 時計時）
  useEffect(() => {
    if (stage !== "gap") return;
    const gap = ba?.minGapSeconds ?? 10;
    setGapCountdown(gap);
    const tick = setInterval(() => {
      setGapCountdown((c) => {
        if (c <= 1) {
          clearInterval(tick);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [stage, ba?.minGapSeconds]);

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

  // 合成對比圖（用 Cloudinary multi-image composition）
  const compositeMutation = useMutation({
    mutationFn: async ({
      beforeId,
      afterId,
    }: {
      beforeId: string;
      afterId: string;
    }): Promise<{ compositeUrl: string }> => {
      const layoutMode = ba?.layoutMode ?? "horizontal";
      // 上下 = vertical (w, 2h), 左右 = horizontal (2w, h)
      const isVertical = layoutMode === "vertical";

      const config = {
        canvas: {
          width: isVertical ? 1080 : 2160,
          height: isVertical ? 2160 : 1080,
          crop: "fill" as const,
        },
        layers: [
          // 底圖是 beforeId（Cloudinary fetch 自動抓）
          // after 放在另一半
          {
            type: "image" as const,
            publicId: afterId,
            gravity: isVertical ? "south" : "east",
            width: isVertical ? 1080 : 1080,
            height: isVertical ? 1080 : 1080,
          },
          // 標籤
          {
            type: "text" as const,
            text: ba?.beforeLabel || "前",
            font: "Noto_Sans_TC",
            size: 48,
            weight: "bold" as const,
            color: "white",
            background: "rgb:00000099",
            gravity: isVertical ? "north" : "north_west",
            y: 40,
            x: isVertical ? 0 : 40,
          },
          {
            type: "text" as const,
            text: ba?.afterLabel || "後",
            font: "Noto_Sans_TC",
            size: 48,
            weight: "bold" as const,
            color: "white",
            background: "rgb:00000099",
            gravity: isVertical ? "south" : "north_east",
            y: isVertical ? 40 : 40,
            x: isVertical ? 0 : 40,
          },
        ],
      };

      const res = await apiRequest("POST", "/api/cloudinary/composite-photo", {
        playerPhotoPublicId: beforeId,
        config,
        dynamicVars: {},
      });
      return res.json();
    },
  });

  // 主流程：拍完一張 → 進下一階段
  useEffect(() => {
    const process = async () => {
      if (!camera.capturedImage) return;
      if (camera.mode !== "preview") return;

      try {
        camera.setMode("uploading");
        const uploaded = await uploadMutation.mutateAsync(camera.capturedImage);

        if (stage === "before") {
          setBeforePhotoId(uploaded.publicId);
          setBeforePhotoUrl(uploaded.url);
          camera.setCapturedImage(null);
          camera.setMode("instruction");
          setStage("gap");
        } else if (stage === "after") {
          setAfterPhotoId(uploaded.publicId);
          setAfterPhotoUrl(uploaded.url);
          camera.setMode("verifying");

          // 合成
          if (beforePhotoId) {
            try {
              const comp = await compositeMutation.mutateAsync({
                beforeId: beforePhotoId,
                afterId: uploaded.publicId,
              });
              setCompositeUrl(comp.compositeUrl);
            } catch (err) {
              console.warn("[BeforeAfter] 合成失敗:", err);
              // fallback: 顯示兩張原圖並排
              setCompositeUrl(uploaded.url);
            }
          }
          setStage("done");
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
  }, [camera.capturedImage, camera.mode, stage]);

  // 完成
  const handleContinue = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const rewardPoints = (config as unknown as { rewardPoints?: number }).rewardPoints;
    const rewardItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
    const points = rewardPoints ?? config.onSuccess?.points ?? 30;
    const reward: { points?: number; items?: string[] } = { points };
    const allItems = [
      ...rewardItems.filter((x) => !!x),
      ...(config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : []),
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
      a.download = `chito-before-after-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast({ title: "下載完成", duration: 1200 });
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
        const file = new File([blob], "before-after.jpg", { type: "image/jpeg" });
        const canShareFiles =
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share({
            title: "CHITO 前後對比",
            text: "看看差多少！",
            files: [file],
          });
          return;
        }
        await navigator.share({
          title: "CHITO 前後對比",
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

  if (!ba) {
    return (
      <div className="p-6 text-center" data-testid="photo-before-after-missing-config">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
        <p className="text-destructive font-medium">缺少 beforeAfterConfig 設定</p>
      </div>
    );
  }

  // 完成畫面
  if (stage === "done" && compositeUrl) {
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center p-4 gap-4" data-testid="photo-before-after-done">
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="w-6 h-6" />
          <h2 className="text-xl font-bold">對比完成！</h2>
        </div>
        <div className="max-w-lg w-full bg-card rounded-lg shadow-lg overflow-hidden">
          <img
            src={compositeUrl}
            alt="前後對比"
            className={`w-full object-cover ${ba.layoutMode === "vertical" ? "aspect-[1/2]" : "aspect-[2/1]"}`}
            data-testid="photo-before-after-composite"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-lg">
          <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2" data-testid="btn-ba-download">
            <Download className="w-4 h-4" /> 下載
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex-1 gap-2" data-testid="btn-ba-share">
            <Share2 className="w-4 h-4" /> 分享
          </Button>
          <Button onClick={handleContinue} className="flex-1 gap-2" data-testid="btn-ba-continue">
            繼續遊戲
          </Button>
        </div>
      </div>
    );
  }

  // 相機模式（拍 before 或 after）
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

  // 等待間隔
  if (stage === "gap") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-before-after-gap">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <h2 className="text-xl font-bold">第一張 OK！</h2>
        <p className="text-sm text-muted-foreground text-center">
          請到「{ba.afterLabel || "後"}」狀態後再拍第二張
        </p>
        <div className="flex items-center gap-2 text-lg font-number">
          <Clock className="w-5 h-5" />
          {gapCountdown > 0 ? `${gapCountdown} 秒後可拍` : "可以拍第二張了"}
        </div>
        {beforePhotoUrl && (
          <img src={beforePhotoUrl} alt="前" className="max-w-xs rounded border" />
        )}
        <Button
          size="lg"
          disabled={gapCountdown > 0}
          onClick={() => {
            setStage("after");
            camera.startCamera(config.defaultFacingMode ?? "user");
          }}
          data-testid="btn-ba-start-after"
        >
          <Camera className="w-5 h-5 mr-2" />
          {gapCountdown > 0 ? `等待 ${gapCountdown} 秒` : `拍「${ba.afterLabel || "後"}」`}
        </Button>
      </div>
    );
  }

  // 介紹 + 開始
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-before-after-intro">
      <Camera className="w-12 h-12 text-primary" />
      <h2 className="text-2xl font-bold">
        {config.title || "前後對比任務"}
      </h2>
      {config.instruction && (
        <p className="text-center text-sm text-muted-foreground max-w-md">
          {config.instruction}
        </p>
      )}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center font-bold">1</div>
          <span className="mt-1">{ba.beforeLabel || "前"}</span>
        </div>
        <div className="text-muted-foreground">→</div>
        <div className="flex flex-col items-center">
          <Clock className="w-6 h-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mt-1">
            等 {ba.minGapSeconds ?? 10} 秒
          </span>
        </div>
        <div className="text-muted-foreground">→</div>
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center font-bold">2</div>
          <span className="mt-1">{ba.afterLabel || "後"}</span>
        </div>
      </div>
      <Button
        size="lg"
        className="gap-2 mt-4"
        onClick={() => {
          setStage("before");
          camera.startCamera();
        }}
        data-testid="btn-ba-start-before"
      >
        <Camera className="w-5 h-5" />
        開始拍「{ba.beforeLabel || "前"}」
      </Button>
      <input
        ref={camera.fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={camera.handleFileUpload}
        className="hidden"
      />
    </div>
  );
}
