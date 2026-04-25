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
import { createLocalCollage } from "@/lib/client-collage";
import { usePhotoCamera } from "./photo-mission/usePhotoCamera";
import {
  CameraInitializingView, CameraView, PhotoPreview, UploadingView,
} from "./photo-mission/PhotoViews";
import PhotoSuccessView from "./photo-mission/PhotoSuccessView";
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
  // 🆕 存本地 base64 用於 client-side 拼貼（不等 server）
  const [beforeBase64, setBeforeBase64] = useState<string | null>(null);

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
  // 🚀 Optimistic：after 拍完 → client canvas 拼貼 before+after → 立刻 done
  //                 背景慢慢 upload + Cloudinary 合成（成功才替換 URL）
  useEffect(() => {
    const process = async () => {
      if (!camera.capturedImage) return;
      if (camera.mode !== "preview") return;

      try {
        const capturedLocal = camera.capturedImage;

        if (stage === "before") {
          // before 存起來，繼續 gap 倒數
          setBeforeBase64(capturedLocal);
          camera.setCapturedImage(null);
          camera.setMode("instruction");
          setStage("gap");
          // 背景也上傳（失敗沒差，有本地 base64）
          uploadMutation
            .mutateAsync(capturedLocal)
            .then((uploaded) => {
              setBeforePhotoId(uploaded.publicId);
              setBeforePhotoUrl(uploaded.url);
            })
            .catch((err) => {
              console.warn("[BeforeAfter] before 上傳失敗:", err);
            });
        } else if (stage === "after") {
          // 🎯 after 拍完 — 立刻用 client-side canvas 拼貼（100% 成功）
          camera.setMode("verifying");
          if (beforeBase64) {
            try {
              const layoutMode = ba?.layoutMode ?? "horizontal";
              const collage = await createLocalCollage(
                [beforeBase64, capturedLocal],
                {
                  layout: layoutMode === "vertical" ? "vertical" : "horizontal",
                  maxSize: 1600,
                  quality: 0.88,
                },
              );
              setCompositeUrl(collage);
              setStage("done");
              console.log("[BeforeAfter] ✅ 本地拼貼完成");
            } catch (err) {
              console.warn("[BeforeAfter] 本地拼貼失敗:", err);
              // 備用 — 至少顯示 after 那張
              setCompositeUrl(capturedLocal);
              setStage("done");
            }
          } else {
            // 沒 before base64 → 只顯示 after
            setCompositeUrl(capturedLocal);
            setStage("done");
          }

          // 背景嘗試 Cloudinary 合成（成功替換更好的 URL）
          uploadMutation
            .mutateAsync(capturedLocal)
            .then(async (uploaded) => {
              setAfterPhotoId(uploaded.publicId);
              setAfterPhotoUrl(uploaded.url);
              if (beforePhotoId) {
                try {
                  const comp = await compositeMutation.mutateAsync({
                    beforeId: beforePhotoId,
                    afterId: uploaded.publicId,
                  });
                  if (comp.compositeUrl) {
                    console.log("[BeforeAfter] ✅ Cloudinary 合成成功，替換");
                    setCompositeUrl(comp.compositeUrl);
                  }
                } catch (err) {
                  console.warn("[BeforeAfter] Cloudinary 合成失敗，保留本地:", err);
                }
              }
            })
            .catch((err) => {
              console.warn("[BeforeAfter] after 上傳失敗，保留本地拼貼:", err);
            });
          return; // 主流程結束（後續全在背景）
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

  // 🆕 一鍵保存到手機相簿
  const handleSaveToAlbum = async () => {
    if (!compositeUrl) return;
    const result = await savePhotoToAlbum({
      url: compositeUrl,
      filename: "chito-before-after",
      title: "CHITO 前後對比",
      text: "看看差多少！",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const handleDownload = async () => {
    if (!compositeUrl) return;
    const result = await savePhotoToAlbum({
      url: compositeUrl,
      filename: "chito-before-after",
      forceMethod: "download",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const handleShare = async () => {
    if (!compositeUrl) return;
    const result = await savePhotoToAlbum({
      url: compositeUrl,
      filename: "chito-before-after",
      title: "CHITO 前後對比",
      text: "看看差多少！",
      forceMethod: "share",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
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
      <PhotoSuccessView
        imageUrl={compositeUrl}
        title="對比完成！"
        subtitle={`${ba.beforeLabel || "前"} / ${ba.afterLabel || "後"}`}
        downloadPrefix="chito-ba"
        onContinue={handleContinue}
        testId="photo-before-after-done"
      />
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
          camera.startCamera(config.defaultFacingMode ?? "user");
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
