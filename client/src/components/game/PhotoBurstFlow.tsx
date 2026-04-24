// 📸 PhotoBurstFlow — 連拍元件（MVP：連拍 4 張 → 四宮格紀念圖）
//
// 流程：
//   1. 介紹畫面 → 開始連拍
//   2. 自動連拍 N 張（預設 4 張，間隔 1 秒）
//   3. 上傳所有照片
//   4. Cloudinary 合成 2x2 拼貼（或 3x3 若 frameCount=9）
//   5. 顯示結果 + 下載 / 分享

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Camera, CheckCircle2, AlertTriangle, Download, Share2, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePhotoCamera } from "./photo-mission/usePhotoCamera";
import {
  CameraInitializingView, CameraView, UploadingView,
} from "./photo-mission/PhotoViews";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoBurstFlowProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
}

type Stage = "intro" | "shooting" | "uploading" | "compositing" | "done";

export default function PhotoBurstFlow({
  config,
  onComplete,
  sessionId,
  gameId,
}: PhotoBurstFlowProps) {
  const { toast } = useToast();
  const camera = usePhotoCamera();
  const burst = config.burstConfig;

  const [stage, setStage] = useState<Stage>("intro");
  const [burstImages, setBurstImages] = useState<string[]>([]);     // base64 陣列
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);      // Cloudinary publicIds
  const [countdown, setCountdown] = useState(0);                     // 正在倒數到第 N 張
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);

  const finishedRef = useRef(false);
  const burstImagesRef = useRef<string[]>([]);

  const frameCount = burst?.frameCount ?? 4;
  const frameIntervalMs = burst?.frameIntervalMs ?? 1000;

  // 🆕 v2: 每次 burst 產生唯一 tag（後續合成 GIF 用）
  const burstTagRef = useRef<string>("");
  const getBurstTag = (): string => {
    if (!burstTagRef.current) {
      burstTagRef.current = `burst_${sessionId.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;
    }
    return burstTagRef.current;
  };

  // 上傳單張照片（帶 burst tag）
  const uploadSingle = async (imageData: string): Promise<string> => {
    const res = await apiRequest("POST", "/api/cloudinary/burst-frame", {
      imageData,
      gameId,
      sessionId,
      tag: getBurstTag(),
    });
    const data = await res.json() as { publicId: string };
    return data.publicId;
  };

  // 合成四宮格 / 九宮格（用既有 composite-photo endpoint）
  const compositeMutation = useMutation({
    mutationFn: async (publicIds: string[]): Promise<{ compositeUrl: string }> => {
      // 2x2 for 4, 3x3 for 9, 1x3 for 3
      let cols: number;
      let rows: number;
      if (publicIds.length <= 3) { cols = 3; rows = 1; }
      else if (publicIds.length <= 4) { cols = 2; rows = 2; }
      else if (publicIds.length <= 6) { cols = 3; rows = 2; }
      else { cols = 3; rows = 3; }

      const cellSize = 540;              // 每格 540px
      const canvasW = cols * cellSize;
      const canvasH = rows * cellSize;

      // 第一張當底圖，其餘以 l_image 疊加
      const [firstId, ...rest] = publicIds;
      const layers = rest.map((pid, idx) => {
        const pos = idx + 1;  // 第 2 張起
        const col = pos % cols;
        const row = Math.floor(pos / cols);
        // Cloudinary gravity 用 north_west 為原點，x/y 是偏移
        return {
          type: "image" as const,
          publicId: pid,
          gravity: "north_west" as const,
          width: cellSize,
          height: cellSize,
          x: col * cellSize,
          y: row * cellSize,
        };
      });

      const config = {
        canvas: { width: canvasW, height: canvasH, crop: "fill" as const },
        layers,
      };

      const res = await apiRequest("POST", "/api/cloudinary/composite-photo", {
        playerPhotoPublicId: firstId,
        config,
        dynamicVars: {},
      });
      return res.json();
    },
  });

  // 連拍主迴圈（camera 就緒後觸發）
  useEffect(() => {
    if (stage !== "shooting") return;
    if (!camera.cameraReady) return;
    if (burstImagesRef.current.length >= frameCount) return;

    let cancelled = false;
    const captureNext = (index: number) => {
      if (cancelled) return;
      if (index >= frameCount) {
        // 全拍完 → 停相機 + 進上傳階段
        camera.stopCamera();
        setStage("uploading");
        return;
      }
      setCountdown(index + 1);
      // 直接抓當前 video frame
      const video = camera.videoRef.current;
      if (!video) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      burstImagesRef.current = [...burstImagesRef.current, dataUrl];
      setBurstImages(burstImagesRef.current);

      setTimeout(() => captureNext(index + 1), frameIntervalMs);
    };

    captureNext(0);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, camera.cameraReady, frameCount, frameIntervalMs]);

  // 上傳階段：所有照片上傳 → **優先合成 GIF 動畫**，失敗 fallback 到拼貼
  useEffect(() => {
    if (stage !== "uploading") return;
    let cancelled = false;
    (async () => {
      try {
        const ids: string[] = [];
        for (const img of burstImagesRef.current) {
          if (cancelled) return;
          const id = await uploadSingle(img);
          ids.push(id);
          setUploadedIds([...ids]);
        }

        if (cancelled) return;
        setStage("compositing");

        // 🆕 v2: 先嘗試合成真 GIF（動態）
        try {
          const gifRes = await apiRequest("POST", "/api/cloudinary/burst-to-gif", {
            tag: getBurstTag(),
            format: "gif",
            delayMs: frameIntervalMs,
          });
          const gifData = await gifRes.json() as { success?: boolean; url?: string };
          if (gifData.success && gifData.url) {
            if (cancelled) return;
            setCompositeUrl(gifData.url);
            setStage("done");
            return;
          }
          throw new Error("GIF 合成無輸出 URL");
        } catch (gifErr) {
          console.warn("[Burst] GIF fallback to collage:", gifErr);
          // Fallback: 舊拼貼合成
          try {
            const comp = await compositeMutation.mutateAsync(ids);
            if (cancelled) return;
            setCompositeUrl(comp.compositeUrl);
            setStage("done");
            return;
          } catch (err) {
            console.warn("[Burst] 拼貼也失敗:", err);
            // 最後 fallback：第一張當紀念
            if (ids.length > 0) {
              const res = await apiRequest("POST", "/api/cloudinary/composite-photo", {
                playerPhotoPublicId: ids[0],
                config: { canvas: { width: 1080, height: 1080, crop: "fill" }, layers: [] },
                dynamicVars: {},
              });
              const data = await res.json();
              setCompositeUrl(data.compositeUrl);
            }
            setStage("done");
          }
        }
      } catch (err) {
        toast({
          title: "上傳失敗",
          description: err instanceof Error ? err.message : "請檢查網路",
          variant: "destructive",
        });
        setStage("intro");
        burstImagesRef.current = [];
        setBurstImages([]);
        setUploadedIds([]);
        burstTagRef.current = "";  // 重置 tag
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const handleStart = () => {
    burstImagesRef.current = [];
    setBurstImages([]);
    setUploadedIds([]);
    setStage("shooting");
    camera.startCamera();
  };

  const handleContinue = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const rewardPoints = (config as unknown as { rewardPoints?: number }).rewardPoints;
    const rewardItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
    const points = rewardPoints ?? config.onSuccess?.points ?? 25;
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
      // 🆕 依 URL 副檔名決定下載檔名（GIF / JPG 視合成結果而定）
      const ext = compositeUrl.match(/\.(gif|webp|mp4|jpg|jpeg|png)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpg";
      a.download = `chito-burst-${Date.now()}.${ext}`;
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
        const file = new File([blob], "burst.jpg", { type: "image/jpeg" });
        const canShareFiles =
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share({
            title: "CHITO 連拍紀念",
            text: `${frameCount} 連拍紀念圖`,
            files: [file],
          });
          return;
        }
        await navigator.share({ title: "CHITO 連拍紀念", url: compositeUrl });
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

  if (!burst) {
    return (
      <div className="p-6 text-center" data-testid="photo-burst-missing-config">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
        <p className="text-destructive font-medium">缺少 burstConfig 設定</p>
      </div>
    );
  }

  // 完成
  if (stage === "done" && compositeUrl) {
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center p-4 gap-4" data-testid="photo-burst-done">
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="w-6 h-6" />
          <h2 className="text-xl font-bold">連拍完成！</h2>
        </div>
        <div className="max-w-md w-full bg-card rounded-lg shadow-lg overflow-hidden">
          <img src={compositeUrl} alt="連拍紀念" className="w-full aspect-square object-cover" data-testid="photo-burst-composite" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
          <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2" data-testid="btn-burst-download">
            <Download className="w-4 h-4" /> 下載
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex-1 gap-2" data-testid="btn-burst-share">
            <Share2 className="w-4 h-4" /> 分享
          </Button>
          <Button onClick={handleContinue} className="flex-1 gap-2" data-testid="btn-burst-continue">
            繼續遊戲
          </Button>
        </div>
      </div>
    );
  }

  // 拍攝中
  if (stage === "shooting") {
    if (camera.mode === "initializing" || !camera.cameraReady) {
      return <CameraInitializingView videoRef={camera.videoRef} onCancel={camera.cancelCamera} />;
    }
    return (
      <div className="fixed inset-0 z-50 bg-black" data-testid="photo-burst-shooting">
        <video
          ref={camera.videoRef}
          className="w-full h-full object-cover"
          style={{ transform: camera.facingMode === "user" ? "scaleX(-1)" : undefined }}
          autoPlay playsInline muted
        />
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-full text-lg font-bold">
          {countdown} / {frameCount}
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/50 px-4 py-2 rounded-full">
          連拍中，請保持穩定
        </div>
      </div>
    );
  }

  // 上傳中
  if (stage === "uploading" || stage === "compositing") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-burst-processing">
        <UploadingView />
        <p className="text-sm text-muted-foreground">
          {stage === "uploading"
            ? `上傳中... ${uploadedIds.length} / ${frameCount}`
            : "合成中..."}
        </p>
      </div>
    );
  }

  // 介紹（預設）
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-6" data-testid="photo-burst-intro">
      <Zap className="w-12 h-12 text-primary" />
      <h2 className="text-2xl font-bold">
        {config.title || "連拍任務"}
      </h2>
      {config.instruction && (
        <p className="text-center text-sm text-muted-foreground max-w-md">
          {config.instruction}
        </p>
      )}
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          將自動連拍 <span className="font-bold text-primary">{frameCount}</span> 張
        </p>
        <p className="text-xs text-muted-foreground">
          每張間隔 {frameIntervalMs / 1000} 秒
        </p>
      </div>
      <Button size="lg" className="gap-2" onClick={handleStart} data-testid="btn-burst-start">
        <Camera className="w-5 h-5" />
        開始連拍
      </Button>
    </div>
  );
}
