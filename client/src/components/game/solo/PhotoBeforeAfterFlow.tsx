// 🔀 PhotoBeforeAfterFlow — 前後對比拍照元件
//
// 流程：
//   1. 拍第一張（before 標籤，如「整理前」）
//   2. 等待 N 秒（minGapSeconds，預設 10 秒）
//   3. 拍第二張（after 標籤，如「整理後」）
//   4. 兩張上傳 Cloudinary → 合成對比圖（左右或上下）
//   5. 顯示合成結果 + 下載/分享/繼續

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import {
  Camera, CheckCircle2, AlertTriangle, Download, Share2, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { createLocalCollage } from "@/lib/client-collage";
import { usePhotoCamera } from "../photo-mission/usePhotoCamera";
import { savePhotoToAlbum, getSaveToastMessage } from "@/lib/photo-save";
import {
  CameraInitializingView, CameraView, PhotoPreview, UploadingView,
} from "../photo-mission/PhotoViews";
import PhotoSuccessView from "../photo-mission/PhotoSuccessView";
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
                  // 🆕 嚴格驗證 URL 才替換 — 避免空字串/null 把本地 collage 蓋掉造成破圖
                  if (
                    comp.compositeUrl &&
                    typeof comp.compositeUrl === "string" &&
                    comp.compositeUrl.startsWith("http")
                  ) {
                    // 🆕 預先驗證圖片可載入，避免直接替換造成 user 看到破圖
                    const ok = await new Promise<boolean>((resolve) => {
                      const img = new Image();
                      img.onload = () => resolve(true);
                      img.onerror = () => resolve(false);
                      img.src = comp.compositeUrl;
                      // 5 秒內沒 load 也視為失敗
                      setTimeout(() => resolve(false), 5000);
                    });
                    if (ok) {
                      setCompositeUrl(comp.compositeUrl);
                    } else {
                      console.warn(
                        "[BeforeAfter] Cloudinary URL 載入失敗，保留本地拼貼",
                      );
                    }
                  } else {
                    console.warn(
                      "[BeforeAfter] Cloudinary 回傳無效 URL，保留本地:",
                      comp,
                    );
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
    const points = rewardPoints ?? config.onSuccess?.points ?? 0;
    const reward: { points?: number; items?: string[] } = { points };
    const allItems = [
      ...rewardItems.filter((x) => !!x),
      ...(config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : []),
    ];
    if (allItems.length > 0) reward.items = allItems;
    onComplete(reward, config.nextPageId);
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
        stream={camera.stream}
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
    // 🆕 倒數進度比例（0=全滿、1=完成可拍）
    const totalGap = ba.minGapSeconds ?? 10;
    const progress = totalGap > 0 ? 1 - gapCountdown / totalGap : 1;
    const ready = gapCountdown === 0;

    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-before-after-gap">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-[pulse_1.5s_ease-in-out_infinite]" />
        <h2 className="text-xl font-bold">第一張 OK！</h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          請到「<span className="font-semibold text-foreground">{ba.afterLabel || "後"}</span>」狀態後再拍第二張
        </p>

        {/* 🆕 倒數圓環 — SVG 視覺化進度（比純數字更直觀） */}
        <div className="relative w-24 h-24" data-testid="ba-countdown-ring">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/30" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke="currentColor" strokeWidth="6" strokeLinecap="round"
              className={ready ? "text-emerald-500" : "text-primary"}
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - progress)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {ready ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            ) : (
              <span className="text-2xl font-bold tabular-nums">{gapCountdown}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="tabular-nums">
            {ready ? "可以拍第二張了！" : `${gapCountdown} 秒後可拍`}
          </span>
        </div>

        {beforePhotoUrl && (
          <div className="relative max-w-xs">
            <img src={beforePhotoUrl} alt="前" className="w-full rounded-lg border-2 border-emerald-500/50 shadow-md" />
            {/* 🆕 已拍標示 */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              已拍 · {ba.beforeLabel || "前"}
            </div>
          </div>
        )}

        <Button
          size="lg"
          disabled={!ready}
          onClick={() => {
            setStage("after");
            camera.startCamera(config.defaultFacingMode ?? "user");
          }}
          className="transition-transform active:scale-[0.97] disabled:opacity-50"
          data-testid="btn-ba-start-after"
        >
          <Camera className="w-5 h-5 mr-2" />
          <span className="tabular-nums">
            {ready ? `拍「${ba.afterLabel || "後"}」` : `等待 ${gapCountdown} 秒`}
          </span>
        </Button>
      </div>
    );
  }

  // 介紹 + 開始
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4"
      data-testid="photo-before-after-intro"
      role="region"
      aria-label="前後對比拍照任務"
    >
      <Camera className="w-12 h-12 text-primary" />
      <h2 className="text-2xl font-bold">
        {config.title || "前後對比任務"}
      </h2>
      {config.instruction && (
        <p className="text-center text-sm text-muted-foreground max-w-md">
          {config.instruction}
        </p>
      )}
      {/* 🆕 流程步驟卡片化 — 三段視覺化更清楚 */}
      <div className="flex items-center gap-2 sm:gap-3 text-sm" data-testid="ba-flow-steps">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-lg bg-primary/15 border-2 border-primary/40 flex items-center justify-center text-2xl font-bold text-primary shadow-sm">
            1
          </div>
          <span className="mt-1 font-medium">{ba.beforeLabel || "前"}</span>
        </div>
        <div className="flex flex-col items-center text-muted-foreground/60 text-2xl">→</div>
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-lg bg-muted/50 border border-dashed border-muted-foreground/30 flex items-center justify-center">
            <Clock className="w-6 h-6 text-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground mt-1 tabular-nums">
            等 {ba.minGapSeconds ?? 10} 秒
          </span>
        </div>
        <div className="flex flex-col items-center text-muted-foreground/60 text-2xl">→</div>
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-lg bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center text-2xl font-bold text-emerald-600 dark:text-emerald-400 shadow-sm">
            2
          </div>
          <span className="mt-1 font-medium">{ba.afterLabel || "後"}</span>
        </div>
      </div>
      <Button
        size="lg"
        className="gap-2 mt-4 transition-transform active:scale-[0.97]"
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
    </motion.div>
  );
}
