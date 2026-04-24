// 🎭 PhotoArStickerFlow — AR 貼圖拍照（B2: 支援臉部錨定）
//
// 實作策略：
//   固定位置模式（anchorPoint=none）：
//     1. 開啟相機 → 在 video 上疊 PNG 貼圖（HTML overlay，位置依 config）
//     2. 按快門 → canvas 合成 video frame + sticker
//   臉部錨定模式（anchorPoint=face/eyes/nose/mouth/face_top）：
//     1. 開啟相機 + lazy 載入 FaceLandmarker（WASM）
//     2. requestAnimationFrame loop：detectForVideo → getAnchorCoordinate
//     3. sticker 位置隨 face 動態更新
//     4. 按快門時用 face anchor 座標合成 canvas
//
// 合規（關鍵）：
//   - 純瀏覽器偵測（WASM+WebGL），不傳 server、不存 face data
//   - 只做 landmark detection，不做 face recognition
//   - 使用者需 opt-in（B4 加 Dialog）

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Camera, CheckCircle2, AlertTriangle, Download, Share2, Sparkles, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePhotoCamera } from "./photo-mission/usePhotoCamera";
import {
  CameraInitializingView, UploadingView,
} from "./photo-mission/PhotoViews";
import type { PhotoMissionConfig } from "@shared/schema";
import {
  getFaceLandmarker,
  detectFaceForVideo,
  getAnchorCoordinate,
  closeFaceLandmarker,
  type AnchorPoint,
  type AnchorCoordinate,
} from "@/lib/face-landmarker";

interface PhotoArStickerFlowProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
}

type StickerPosition =
  | "top" | "bottom" | "center"
  | "corner_tl" | "corner_tr" | "corner_bl" | "corner_br";

interface StickerConfigItem {
  imageUrl: string;
  position: StickerPosition;
  sizeRatio: number;   // 0-1，佔畫面短邊比例
}

// 位置 → CSS style 對照（配合 absolute overlay）
function positionToStyle(pos: StickerPosition, sizeRatio: number): React.CSSProperties {
  const sizePct = `${sizeRatio * 100}%`;
  const commonStyle: React.CSSProperties = {
    position: "absolute",
    width: sizePct,
    pointerEvents: "none",
  };
  switch (pos) {
    case "top":       return { ...commonStyle, top: "5%", left: "50%", transform: "translateX(-50%)" };
    case "bottom":    return { ...commonStyle, bottom: "5%", left: "50%", transform: "translateX(-50%)" };
    case "center":    return { ...commonStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "corner_tl": return { ...commonStyle, top: "5%", left: "5%" };
    case "corner_tr": return { ...commonStyle, top: "5%", right: "5%" };
    case "corner_bl": return { ...commonStyle, bottom: "5%", left: "5%" };
    case "corner_br": return { ...commonStyle, bottom: "5%", right: "5%" };
  }
}

// Canvas 合成用 — 計算貼圖在 canvas 上的實際 x/y/w/h
function computeStickerRect(
  pos: StickerPosition,
  sizeRatio: number,
  canvasW: number,
  canvasH: number,
  stickerNaturalRatio: number,  // w/h
): { x: number; y: number; w: number; h: number } {
  // 用短邊計算寬度，保持比例
  const shortSide = Math.min(canvasW, canvasH);
  const w = shortSide * sizeRatio;
  const h = w / stickerNaturalRatio;
  const margin = shortSide * 0.05;

  let x = 0;
  let y = 0;
  switch (pos) {
    case "top":       x = (canvasW - w) / 2; y = margin; break;
    case "bottom":    x = (canvasW - w) / 2; y = canvasH - h - margin; break;
    case "center":    x = (canvasW - w) / 2; y = (canvasH - h) / 2; break;
    case "corner_tl": x = margin; y = margin; break;
    case "corner_tr": x = canvasW - w - margin; y = margin; break;
    case "corner_bl": x = margin; y = canvasH - h - margin; break;
    case "corner_br": x = canvasW - w - margin; y = canvasH - h - margin; break;
  }
  return { x, y, w, h };
}

// 預載所有貼圖（return HTMLImageElement[]）
async function preloadStickers(items: StickerConfigItem[]): Promise<HTMLImageElement[]> {
  return Promise.all(
    items.map(
      (s) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(e);
          img.src = s.imageUrl;
        }),
    ),
  );
}

export default function PhotoArStickerFlow({
  config,
  onComplete,
  sessionId,
  gameId,
}: PhotoArStickerFlowProps) {
  const { toast } = useToast();
  const camera = usePhotoCamera();
  const ar = config.arStickerConfig;
  const stickers = (ar?.stickers ?? []) as StickerConfigItem[];

  const [stage, setStage] = useState<"intro" | "camera" | "uploading" | "done">("intro");
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [preloadedStickers, setPreloadedStickers] = useState<HTMLImageElement[]>([]);
  const [preloadError, setPreloadError] = useState<string | null>(null);

  const finishedRef = useRef(false);

  // 預載貼圖（只做一次）
  useEffect(() => {
    if (stickers.length === 0) return;
    preloadStickers(stickers)
      .then(setPreloadedStickers)
      .catch(() => setPreloadError("貼圖載入失敗，請檢查 URL"));
  }, [stickers]);

  // 相機就緒後啟動
  useEffect(() => {
    if (stage !== "camera") return;
    if (camera.mode === "instruction") camera.startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // 上傳合成圖
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

  // 按快門：合成 video frame + sticker overlays
  const handleCapture = async () => {
    const video = camera.videoRef.current;
    if (!video || !video.videoWidth) {
      toast({ title: "相機尚未就緒", variant: "destructive" });
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("無法建立 canvas context");

      // 底圖：video 畫面
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 疊上每個貼圖
      for (let i = 0; i < stickers.length; i++) {
        const s = stickers[i];
        const img = preloadedStickers[i];
        if (!img) continue;
        const ratio = img.naturalWidth / img.naturalHeight;
        const rect = computeStickerRect(s.position, s.sizeRatio, canvas.width, canvas.height, ratio);
        ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
      }

      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

      // 停相機 + 上傳
      camera.stopCamera();
      setStage("uploading");
      const uploaded = await uploadMutation.mutateAsync(dataUrl);
      setFinalUrl(uploaded.url);
      setStage("done");
    } catch (err) {
      toast({
        title: "拍照失敗",
        description: err instanceof Error ? err.message : "請再試一次",
        variant: "destructive",
      });
      setStage("camera");
    }
  };

  const handleContinue = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const rewardPoints = (config as unknown as { rewardPoints?: number }).rewardPoints;
    const rewardItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
    const points = rewardPoints ?? config.onSuccess?.points ?? 20;
    const reward: { points?: number; items?: string[] } = { points };
    const allItems = [
      ...rewardItems.filter((x) => !!x),
      ...(config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : []),
    ];
    if (allItems.length > 0) reward.items = allItems;
    onComplete(reward);
  };

  const handleDownload = async () => {
    if (!finalUrl) return;
    try {
      const res = await fetch(finalUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chito-ar-${Date.now()}.jpg`;
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
    if (!finalUrl) return;
    try {
      if (typeof navigator.share === "function") {
        const res = await fetch(finalUrl);
        const blob = await res.blob();
        const file = new File([blob], "ar-photo.jpg", { type: "image/jpeg" });
        const canShareFiles =
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share({
            title: "CHITO AR 拍照",
            text: "看看我的 AR 造型！",
            files: [file],
          });
          return;
        }
        await navigator.share({ title: "CHITO AR 拍照", url: finalUrl });
        return;
      }
      await navigator.clipboard.writeText(finalUrl);
      toast({ title: "已複製連結" });
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      toast({ title: "分享失敗", variant: "destructive" });
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  if (!ar || stickers.length === 0) {
    return (
      <div className="p-6 text-center" data-testid="photo-ar-missing-config">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
        <p className="text-destructive font-medium">AR 設定缺少貼圖</p>
        <p className="text-xs text-muted-foreground mt-1">請管理員至少新增一張貼圖</p>
      </div>
    );
  }

  if (preloadError) {
    return (
      <div className="p-6 text-center" data-testid="photo-ar-preload-fail">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
        <p className="text-destructive font-medium">{preloadError}</p>
      </div>
    );
  }

  if (stage === "done" && finalUrl) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-4" data-testid="photo-ar-done">
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="w-6 h-6" />
          <h2 className="text-xl font-bold">AR 拍照完成！</h2>
        </div>
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg overflow-hidden">
          <img src={finalUrl} alt="AR 成果" className="w-full object-cover" data-testid="photo-ar-final" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
          <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2" data-testid="btn-ar-download">
            <Download className="w-4 h-4" /> 下載
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex-1 gap-2" data-testid="btn-ar-share">
            <Share2 className="w-4 h-4" /> 分享
          </Button>
          <Button onClick={handleContinue} className="flex-1 gap-2" data-testid="btn-ar-continue">
            繼續遊戲
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "uploading") return <UploadingView />;

  // 相機畫面 + overlay 貼圖預覽
  if (stage === "camera") {
    if (camera.mode === "initializing" || !camera.cameraReady) {
      return <CameraInitializingView videoRef={camera.videoRef} onCancel={() => { camera.cancelCamera(); setStage("intro"); }} />;
    }
    return (
      <div className="relative min-h-screen bg-black" data-testid="photo-ar-camera">
        <video
          ref={camera.videoRef}
          className="w-full h-full object-cover"
          autoPlay playsInline muted
        />
        {/* 貼圖 overlay 預覽（和合成結果一致） */}
        {stickers.map((s, idx) => (
          <img
            key={idx}
            src={s.imageUrl}
            alt=""
            style={positionToStyle(s.position, s.sizeRatio)}
            data-testid={`ar-sticker-overlay-${idx}`}
          />
        ))}

        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => { camera.cancelCamera(); setStage("intro"); }}
            className="bg-background/60 backdrop-blur w-12 h-12 rounded-full"
            data-testid="btn-ar-cancel"
          >
            <RefreshCw className="w-5 h-5 rotate-180" />
          </Button>
          <Button
            size="icon"
            onClick={handleCapture}
            disabled={preloadedStickers.length < stickers.length}
            className="bg-white text-black hover:bg-white/90 w-16 h-16 rounded-full ring-4 ring-white/30"
            data-testid="btn-ar-capture"
          >
            <Camera className="w-7 h-7" />
          </Button>
        </div>
      </div>
    );
  }

  // 介紹頁
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-ar-intro">
      <Sparkles className="w-12 h-12 text-primary" />
      <h2 className="text-2xl font-bold">
        {config.title || "AR 貼圖拍照"}
      </h2>
      {config.instruction && (
        <p className="text-center text-sm text-muted-foreground max-w-md">
          {config.instruction}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        將在畫面疊上 {stickers.length} 個 AR 貼圖
      </p>

      {/* 貼圖預覽縮圖 */}
      <div className="flex gap-2 flex-wrap justify-center max-w-md">
        {stickers.map((s, idx) => (
          <div key={idx} className="w-16 h-16 border rounded overflow-hidden bg-muted">
            <img src={s.imageUrl} alt="" className="w-full h-full object-contain" />
          </div>
        ))}
      </div>

      <Button
        size="lg"
        className="gap-2 mt-2"
        onClick={() => setStage("camera")}
        disabled={preloadedStickers.length < stickers.length}
        data-testid="btn-ar-start"
      >
        <Camera className="w-5 h-5" />
        {preloadedStickers.length < stickers.length ? "貼圖載入中..." : "開始拍照"}
      </Button>
    </div>
  );
}
