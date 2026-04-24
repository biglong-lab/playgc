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
  Shield, Lock, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// localStorage key — 使用者同意臉部追蹤後記住
const FACE_CONSENT_KEY = "chito-ar-face-consent-v1";

// B4 效能優化：每 N 幀偵測一次（1=每幀、2=半 FPS、3=1/3 FPS）
// 30fps → 15fps 足夠 AR 貼圖跟隨，省 50% GPU
const FACE_DETECT_FRAME_INTERVAL = 2;

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

// 🎨 預載貼圖（單張失敗不影響其他，回傳 array，失敗位置為 null）
// 加 timeout 避免壞 URL 永遠卡住
async function preloadStickers(
  items: StickerConfigItem[],
): Promise<(HTMLImageElement | null)[]> {
  const results = await Promise.allSettled(
    items.map(
      (s) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const timer = setTimeout(
            () => reject(new Error("timeout")),
            10000,
          );
          img.onload = () => {
            clearTimeout(timer);
            resolve(img);
          };
          img.onerror = () => {
            clearTimeout(timer);
            reject(new Error(`載入失敗: ${s.imageUrl}`));
          };
          img.src = s.imageUrl;
        }),
    ),
  );
  return results.map((r) => (r.status === "fulfilled" ? r.value : null));
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
  const anchorPoint: AnchorPoint = (ar?.anchorPoint ?? "none") as AnchorPoint;
  const useFaceTracking = anchorPoint !== "none" && anchorPoint !== "hand";

  const [stage, setStage] = useState<"intro" | "camera" | "uploading" | "done">("intro");
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  // 🎨 B4+：陣列元素可能為 null（單張載入失敗）— 不阻斷遊戲
  const [preloadedStickers, setPreloadedStickers] = useState<(HTMLImageElement | null)[]>([]);
  const [preloadDone, setPreloadDone] = useState(false);
  const failedCount = preloadedStickers.filter((x) => x === null).length;

  // 🆕 B2: 臉部追蹤狀態
  const [faceAnchor, setFaceAnchor] = useState<AnchorCoordinate | null>(null);
  const [faceReady, setFaceReady] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  // B4 效能優化：frame skip counter
  const frameCounterRef = useRef(0);

  // 🆕 B4: 隱私 opt-in Dialog
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsent, setHasConsent] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(FACE_CONSENT_KEY) === "1";
    } catch {
      return false;
    }
  });

  const finishedRef = useRef(false);

  // 預載貼圖（只做一次）— 單張失敗不影響其他、不卡關
  useEffect(() => {
    if (stickers.length === 0) return;
    preloadStickers(stickers).then((arr) => {
      setPreloadedStickers(arr);
      setPreloadDone(true);
    });
  }, [stickers]);

  // 相機就緒後啟動（AR 預設前鏡頭；管理員可在編輯器覆寫）
  useEffect(() => {
    if (stage !== "camera") return;
    if (camera.mode === "instruction") {
      const facing = config.defaultFacingMode ?? "user"; // 🆕 編輯器可覆寫
      camera.startCamera(facing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // 🆕 B2: 臉部追蹤 RAF loop
  useEffect(() => {
    if (stage !== "camera") return;
    if (!useFaceTracking) return;
    if (!camera.cameraReady) return;

    let cancelled = false;

    const init = async () => {
      try {
        const landmarker = await getFaceLandmarker();
        if (cancelled) return;
        setFaceReady(true);
        setFaceError(null);

        const loop = () => {
          if (cancelled) return;
          const video = camera.videoRef.current;
          if (!video || video.readyState < 2) {
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          // B4: frame skip — 每 N 幀才跑一次偵測（省 GPU、電量）
          frameCounterRef.current += 1;
          if (frameCounterRef.current % FACE_DETECT_FRAME_INTERVAL !== 0) {
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          const ts = performance.now();
          // VIDEO mode 要求 timestamp 嚴格遞增
          if (ts <= lastTsRef.current) {
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }
          lastTsRef.current = ts;

          try {
            const result = detectFaceForVideo(landmarker, video, ts);
            const coord = getAnchorCoordinate(result, anchorPoint);
            setFaceAnchor(coord);
          } catch (e) {
            // 偵測失敗不中斷 loop
          }
          rafIdRef.current = requestAnimationFrame(loop);
        };
        rafIdRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (!cancelled) {
          setFaceError(err instanceof Error ? err.message : "臉部追蹤載入失敗");
        }
      }
    };
    init();

    return () => {
      cancelled = true;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, camera.cameraReady, useFaceTracking, anchorPoint]);

  // 離開時釋放 FaceLandmarker
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (useFaceTracking) {
        closeFaceLandmarker().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      // 底圖：video 畫面（user 鏡頭要水平翻轉讓拍出來的是鏡像，跟預覽一致）
      const isMirror = camera.facingMode === "user";
      if (isMirror) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (isMirror) ctx.restore();

      // 疊上每個貼圖
      for (let i = 0; i < stickers.length; i++) {
        const s = stickers[i];
        const img = preloadedStickers[i];
        if (!img) continue;
        const ratio = img.naturalWidth / img.naturalHeight;

        // 🆕 B2: 若有 face anchor，用臉部座標定位；否則 fallback 固定位置
        if (useFaceTracking) {
          if (!faceAnchor) continue; // 沒臉就不畫
          // size 縮小（與 DOM overlay 一致）
          const anchorW = faceAnchor.width * canvas.width * (s.sizeRatio || 0.6);
          const anchorH = anchorW / ratio;
          // 🎨 mirror 模式：MediaPipe 回傳的座標是未鏡像的，要反推到鏡像後座標
          const cx = (isMirror ? 1 - faceAnchor.x : faceAnchor.x) * canvas.width;
          const cy = faceAnchor.y * canvas.height;
          ctx.save();
          ctx.translate(cx, cy);
          if (faceAnchor.rotationY) ctx.rotate(faceAnchor.rotationY);
          ctx.drawImage(img, -anchorW / 2, -anchorH / 2, anchorW, anchorH);
          ctx.restore();
        } else {
          const rect = computeStickerRect(s.position, s.sizeRatio, canvas.width, canvas.height, ratio);
          ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
        }
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
      // 🎯 優先用 Web Share URL（不 fetch blob，避 CORS / iOS Safari 問題）
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "CHITO AR 拍照",
          text: "看看我的 AR 造型！",
          url: finalUrl,
        });
        return;
      }
      // fallback 複製連結
      await navigator.clipboard.writeText(finalUrl);
      toast({ title: "✅ 已複製連結", description: "可貼到 LINE / FB 分享" });
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      // 最後 fallback：開新 tab 讓使用者手動儲存
      window.open(finalUrl, "_blank", "noopener,noreferrer");
      toast({
        title: "已開啟圖片",
        description: "長按圖片可儲存到相簿",
      });
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

  // 🎨 B4+：所有貼圖都載入失敗才阻擋；部分失敗只靜默提示，遊戲繼續
  if (preloadDone && failedCount === stickers.length) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center gap-3" data-testid="photo-ar-preload-fail">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <p className="text-lg font-medium">貼圖暫時無法載入</p>
        <p className="text-sm text-muted-foreground">
          你仍可繼續遊戲，可以略過此關
        </p>
        <Button onClick={handleContinue} variant="outline" data-testid="btn-ar-skip">
          跳過此任務
        </Button>
      </div>
    );
  }

  if (stage === "done" && finalUrl) {
    return (
      // 🎨 修正 layout 歪斜：用 overflow-y-auto + 內層置中，不依賴 h-full（GamePlay main 可能高度不足）
      <div
        className="w-full min-h-full overflow-y-auto bg-background"
        data-testid="photo-ar-done"
      >
        <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="w-6 h-6" />
            <h2 className="text-xl font-bold">AR 拍照完成！</h2>
          </div>
          {/* 圖片容器：明確 aspect + 寬度 */}
          <div className="w-full rounded-lg shadow-lg overflow-hidden bg-card border">
            <img
              src={finalUrl}
              alt="AR 成果"
              className="w-full h-auto block"
              data-testid="photo-ar-final"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 w-full">
            {/* 🎯 下載改用 <a href download>，iOS Safari 可直接存到相簿（不用 fetch blob 避 CORS）*/}
            <a
              href={finalUrl}
              download={`chito-ar-${Date.now()}.jpg`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 h-10 rounded-md border border-input bg-background text-foreground hover:bg-accent text-sm"
              data-testid="btn-ar-download"
            >
              <Download className="w-4 h-4" /> 下載
            </a>
            <Button onClick={handleShare} variant="outline" className="gap-1" data-testid="btn-ar-share">
              <Share2 className="w-4 h-4" /> 分享
            </Button>
            <Button onClick={handleContinue} className="gap-1" data-testid="btn-ar-continue">
              繼續
            </Button>
          </div>
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
      // 🎨 fixed inset-0 z-50 蓋過 GamePlay header + sticky footer，沉浸式相機
      // transform: user 鏡頭鏡像翻轉（使用者看到的和鏡子一樣）
      <div className="fixed inset-0 z-50 bg-black" data-testid="photo-ar-camera">
        <video
          ref={camera.videoRef}
          className="w-full h-full object-cover"
          style={{ transform: camera.facingMode === "user" ? "scaleX(-1)" : undefined }}
          autoPlay playsInline muted
        />

        {/* 🆕 B2: 臉部追蹤狀態（大型明顯卡片）*/}
        {useFaceTracking && (
          <div className="absolute top-4 left-4 right-16 z-10 pointer-events-none">
            <div className="bg-black/75 backdrop-blur-md rounded-xl px-4 py-3 text-sm shadow-lg border border-white/20">
              {!faceReady ? (
                <div className="flex items-center gap-2" data-testid="face-tracking-loading">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-white">載入臉部追蹤模型（約 5 秒）...</span>
                </div>
              ) : faceError ? (
                <span className="text-destructive" data-testid="face-tracking-error">
                  ⚠️ {faceError}
                </span>
              ) : faceAnchor ? (
                <div data-testid="face-tracking-active">
                  <p className="text-emerald-400 font-bold">✓ 已抓到你的臉</p>
                  <p className="text-white/80 text-xs mt-0.5">按下方快門拍照</p>
                </div>
              ) : (
                <div data-testid="face-tracking-searching">
                  <p className="text-amber-400 font-bold">👀 找不到臉</p>
                  <p className="text-white/80 text-xs mt-0.5">讓臉在畫面中央再試</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🆕 切換前後鏡頭按鈕（右上 z-10 確保在貼圖之上）*/}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => camera.switchCamera()}
          className="absolute top-4 right-4 z-20 bg-black/60 backdrop-blur hover:bg-black/80 text-white w-12 h-12 rounded-full shadow-lg"
          data-testid="btn-ar-switch-camera"
          title={camera.facingMode === "user" ? "切到後鏡頭" : "切到前鏡頭（自拍）"}
        >
          <RefreshCw className="w-5 h-5" />
        </Button>

        {/* 貼圖 overlay 預覽 — 沒偵測到臉時不要顯示（避免中央大面具擋住畫面）*/}
        {stickers.map((s, idx) => {
          const img = preloadedStickers[idx];
          if (preloadDone && !img) return null; // 該張 URL 壞掉，跳過
          const imgRatio = img ? img.naturalWidth / img.naturalHeight : 1;

          // 🆕 B2: face anchor 定位 — 只在偵測到臉時顯示
          if (useFaceTracking) {
            if (!faceAnchor) return null; // 沒臉就不顯示（避免大面具擋住）
            // 🎨 size 稍微縮小，避免完全擋住畫面
            const widthPct = faceAnchor.width * 100 * (s.sizeRatio || 0.6);
            const heightPct = widthPct / imgRatio;
            const rotation = faceAnchor.rotationY
              ? `rotate(${(faceAnchor.rotationY * 180) / Math.PI}deg)`
              : "";
            // user facing 時畫面已 scaleX(-1)，貼圖跟著翻（否則會文字反向）
            const mirror = camera.facingMode === "user" ? " scaleX(-1)" : "";
            return (
              <img
                key={idx}
                src={s.imageUrl}
                alt=""
                style={{
                  position: "absolute",
                  left: `${faceAnchor.x * 100}%`,
                  top: `${faceAnchor.y * 100}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  transform: `translate(-50%, -50%) ${rotation}${mirror}`,
                  pointerEvents: "none",
                  transition: "top 0.08s, left 0.08s",
                }}
                data-testid={`ar-sticker-face-${idx}`}
              />
            );
          }

          // 非臉部追蹤 — 固定位置（原 positionToStyle）
          return (
            <img
              key={idx}
              src={s.imageUrl}
              alt=""
              style={positionToStyle(s.position, s.sizeRatio)}
              data-testid={`ar-sticker-overlay-${idx}`}
            />
          );
        })}

        {/* 🎨 底部沉浸式按鈕列（含 safe-area + 清楚的返回/快門） */}
        <div
          className="absolute bottom-0 left-0 right-0 py-6 px-6 flex justify-between items-center gap-4 bg-gradient-to-t from-black/80 to-transparent"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <Button
            variant="outline"
            onClick={() => { camera.cancelCamera(); setStage("intro"); }}
            className="bg-white/15 border-white/40 text-white hover:bg-white/25 backdrop-blur px-5"
            data-testid="btn-ar-cancel"
          >
            ✕ 返回
          </Button>
          <div className="flex flex-col items-center">
            <Button
              size="icon"
              onClick={handleCapture}
              disabled={!preloadDone || (useFaceTracking && !faceAnchor)}
              className="bg-white text-black hover:bg-white/90 w-20 h-20 rounded-full ring-4 ring-white/30 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="btn-ar-capture"
              title={!faceAnchor && useFaceTracking ? "請讓臉入鏡" : "拍照"}
            >
              <Camera className="w-9 h-9" />
            </Button>
            {useFaceTracking && !faceAnchor && (
              <span className="text-amber-400 text-xs mt-1 bg-black/50 px-2 py-0.5 rounded">
                等找到臉才能拍
              </span>
            )}
          </div>
          <div className="w-[72px]"></div>{/* spacer 讓拍照鍵居中 */}
        </div>
      </div>
    );
  }

  // 介紹頁
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-ar-intro">
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
        onClick={() => {
          // 🆕 B4: 啟用臉部追蹤前先徵求同意（localStorage 快取）
          if (useFaceTracking && !hasConsent) {
            setShowConsent(true);
            return;
          }
          setStage("camera");
        }}
        disabled={!preloadDone}
        data-testid="btn-ar-start"
      >
        <Camera className="w-5 h-5" />
        {!preloadDone ? "貼圖載入中..." : "開始拍照"}
      </Button>
      {preloadDone && failedCount > 0 && (
        <p className="text-xs text-amber-500 text-center">
          ⚠️ {failedCount} 張貼圖載入失敗，其他仍可使用
        </p>
      )}

      {/* 🆕 B4: 臉部追蹤隱私 opt-in Dialog */}
      <Dialog open={showConsent} onOpenChange={setShowConsent}>
        <DialogContent
          className="max-w-md"
          data-testid="ar-privacy-consent"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              啟用臉部追蹤功能
            </DialogTitle>
            <DialogDescription>
              此貼圖會跟著你的臉部移動。開始前請先了解隱私資訊。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex gap-3 items-start">
              <Lock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">資料不離開你的裝置</p>
                <p className="text-xs text-muted-foreground">
                  所有臉部偵測在瀏覽器本地執行，不傳送到伺服器
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <Cpu className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">只偵測位置，不做身份辨識</p>
                <p className="text-xs text-muted-foreground">
                  使用 MediaPipe 開源模型，僅定位五官座標，不存 face data
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">首次載入約 10MB 模型</p>
                <p className="text-xs text-muted-foreground">
                  WASM + WebGL 執行，後續有快取
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConsent(false)}
              className="flex-1"
              data-testid="btn-ar-consent-decline"
            >
              取消
            </Button>
            <Button
              onClick={() => {
                try {
                  localStorage.setItem(FACE_CONSENT_KEY, "1");
                } catch {
                  // localStorage 不可用也沒關係，當次 session 有用
                }
                setHasConsent(true);
                setShowConsent(false);
                setStage("camera");
              }}
              className="flex-1"
              data-testid="btn-ar-consent-accept"
            >
              同意並開始
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
