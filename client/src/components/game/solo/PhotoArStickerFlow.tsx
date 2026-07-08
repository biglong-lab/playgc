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
import { motion } from "framer-motion";
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
import { usePhotoCamera } from "../photo-mission/usePhotoCamera";
import CameraToolbar from "../photo-mission/CameraToolbar";
import { savePhotoToAlbum, getSaveToastMessage } from "@/lib/photo-save";
import { useCameraOverlayMode } from "@/hooks/useCameraOverlayMode";
import {
  CameraInitializingView, UploadingView,
} from "../photo-mission/PhotoViews";
import PhotoSuccessView from "../photo-mission/PhotoSuccessView";
import type { PhotoMissionConfig } from "@shared/schema";
import {
  getFaceLandmarker,
  detectFaceForVideo,
  getAnchorCoordinate,
  closeFaceLandmarker,
  type AnchorPoint,
  type AnchorCoordinate,
} from "@/lib/face-landmarker";
import { useArStickerGesture } from "./ar-sticker/useArStickerGesture";
import { cssGroupTransform } from "./ar-sticker/arStickerTransform";
import { useArVideoRecorder } from "./ar-sticker/useArVideoRecorder";
import { drawArFrame } from "./ar-sticker/drawArFrame";
import { loadAnimatedSticker, type AnimatedSticker } from "./ar-sticker/animatedSticker";
import ArVideoResultView from "./ar-sticker/ArVideoResultView";
import {
  type StickerConfigItem,
  positionToStyle,
  preloadStickers,
  FaceStickersOverlay,
} from "./ar-sticker/arStickerParts";

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

// 型別 / positionToStyle / preloadStickers / FaceStickersOverlay 已移到 ar-sticker/arStickerParts.tsx


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

  // 🆕 拍照時隱藏 Walkie 等浮動 UI（避免擋切鏡頭按鈕）
  useCameraOverlayMode(stage === "camera");
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

  // 🖐️ AR #1（CHITO）：固定位置模式下、單指拖曳 + 雙指縮放貼圖
  //   臉部錨定模式貼圖跟著臉走、不套用此手勢。
  const previewRef = useRef<HTMLDivElement>(null);
  const gesture = useArStickerGesture(previewRef);
  const [previewShort, setPreviewShort] = useState(0);
  const gestureEnabled = !useFaceTracking;

  // 量測預覽容器短邊（給 CSS transform 用）— 與 hook 內 getBoundingClientRect 同基準
  // 🐛 2026-07-03 修「單指拖不動貼圖」：原本只依賴 stage、但 stage=camera 初期
  //   相機還在 initializing、previewRef 尚未掛載 → 量測 early-return 後不再重跑
  //   → previewShort 永遠 0 → 拖曳位移 ×0、視覺完全不動。
  //   修：加 camera.cameraReady 依賴（相機就緒、previewRef 掛載後重量測）+ fallback 視窗尺寸。
  useEffect(() => {
    if (stage !== "camera" || !gestureEnabled) return;
    const el = previewRef.current;
    if (!el) {
      // previewRef 未掛載（相機 initializing）→ 先用視窗尺寸當 fallback
      setPreviewShort(Math.min(window.innerWidth, window.innerHeight));
      return;
    }
    const measure = () => {
      const r = el.getBoundingClientRect();
      const short = Math.min(r.width, r.height);
      setPreviewShort(short > 0 ? short : Math.min(window.innerWidth, window.innerHeight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage, gestureEnabled, camera.cameraReady]);

  // 🎬 AR #2（CHITO）：長按錄影 — 錄「已合成貼圖」的 canvas
  const recorder = useArVideoRecorder();
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordRafRef = useRef<number | null>(null);
  // 每次 render 更新合成參數 ref，錄製 loop 讀 ref 取最新（避免 stale closure）
  const drawOptsRef = useRef({
    stickers,
    preloadedStickers,
    useFaceTracking,
    faceAnchor,
    isMirror: camera.facingMode === "user",
    pageOpacity: (config as any).stickerOpacity ?? 1,
    gestureTransform: gesture.transform,
    applyGesture: gesture.isDirty,
  });
  drawOptsRef.current = {
    stickers,
    preloadedStickers,
    useFaceTracking,
    faceAnchor,
    isMirror: camera.facingMode === "user",
    pageOpacity: (config as any).stickerOpacity ?? 1,
    gestureTransform: gesture.transform,
    applyGesture: gesture.isDirty,
  };

  // 🎞️ 2026-07-08 CHITO #1bc34792：動態 WebP/GIF 貼圖幀序列（錄影用）
  //   drawImage(HTMLImageElement) 只畫動態圖第一幀 → 成品影片貼圖靜止。
  //   用 ImageDecoder 解幀、錄影 loop 依經過時間取當前幀。
  //   iOS Safari 不支援 ImageDecoder → animatedStickersRef 全 null、維持既有行為。
  const animatedStickersRef = useRef<(AnimatedSticker | null)[]>([]);
  const recordStartMsRef = useRef(0);

  const startRecording = () => {
    const video = camera.videoRef.current;
    const canvas = recordCanvasRef.current;
    if (!video || !canvas || !recorder.isSupported) return;
    if (useFaceTracking && !faceAnchor) return; // 臉部模式沒臉不錄
    recordStartMsRef.current = performance.now();
    // 🎞️ 依經過時間解出各貼圖的當前動畫幀（靜態貼圖為 null → fallback img）
    const withFrames = () => ({
      ...drawOptsRef.current,
      stickerFrames: animatedStickersRef.current.map((a) =>
        a ? a.getFrameAt(performance.now() - recordStartMsRef.current) : null,
      ),
    });
    drawArFrame(canvas, video, withFrames()); // 先畫一幀（設定尺寸+內容）
    const loop = () => {
      const v = camera.videoRef.current;
      const c = recordCanvasRef.current;
      if (v && c) drawArFrame(c, v, withFrames());
      recordRafRef.current = requestAnimationFrame(loop);
    };
    recordRafRef.current = requestAnimationFrame(loop);
    recorder.start(canvas);
  };

  const stopRecording = () => {
    recorder.stop();
    if (recordRafRef.current !== null) {
      cancelAnimationFrame(recordRafRef.current);
      recordRafRef.current = null;
    }
  };

  // 卸載/離開相機時停錄製 loop
  useEffect(() => {
    return () => {
      if (recordRafRef.current !== null) cancelAnimationFrame(recordRafRef.current);
    };
  }, []);

  // 預載貼圖（只做一次）— 單張失敗不影響其他、不卡關
  useEffect(() => {
    if (stickers.length === 0) return;
    preloadStickers(stickers).then((arr) => {
      setPreloadedStickers(arr);
      setPreloadDone(true);
    });
  }, [stickers]);

  // 🎞️ 2026-07-08 CHITO #1bc34792：背景解動態貼圖幀（失敗/靜態/不支援 → null）
  //   不阻塞預載流程；解好前開始錄影則該貼圖先用靜態幀
  useEffect(() => {
    if (stickers.length === 0) return;
    let cancelled = false;
    Promise.all(stickers.map((s) => loadAnimatedSticker(s.imageUrl))).then((arr) => {
      if (cancelled) {
        arr.forEach((a) => a?.close());
        return;
      }
      animatedStickersRef.current = arr;
    });
    return () => {
      cancelled = true;
      animatedStickersRef.current.forEach((a) => a?.close());
      animatedStickersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // 🖼️ 合成 video + 貼圖（拍照與錄影共用 drawArFrame）
      const ok = drawArFrame(canvas, video, {
        stickers,
        preloadedStickers,
        useFaceTracking,
        faceAnchor,
        isMirror: camera.facingMode === "user",
        pageOpacity: (config as any).stickerOpacity ?? 1,
        gestureTransform: gesture.transform,
        applyGesture: gesture.isDirty,
      });
      if (!ok) throw new Error("無法建立 canvas context");

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
    // 🎯 2026-07-08 CHITO #c1149bc8：末端 fallback 20 → 0（給分需明確設定；
    //   全站同步：TextVerify/ConditionalVerify/ChoiceVerify 前輪已改 0）
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
    if (!finalUrl) return;
    const result = await savePhotoToAlbum({
      url: finalUrl,
      filename: "chito-ar",
      title: "CHITO AR 拍照",
      text: "看看我的 AR 造型！",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const handleDownload = async () => {
    if (!finalUrl) return;
    const result = await savePhotoToAlbum({
      url: finalUrl,
      filename: "chito-ar",
      forceMethod: "download",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const handleShare = async () => {
    if (!finalUrl) return;
    const result = await savePhotoToAlbum({
      url: finalUrl,
      filename: "chito-ar",
      title: "CHITO AR 拍照",
      text: "看看我的 AR 造型！",
      forceMethod: "share",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
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

  // 🎬 AR #2：錄影結果本地預覽（優先於相機畫面）
  if (recorder.result) {
    return (
      <ArVideoResultView
        url={recorder.result.url}
        blob={recorder.result.blob}
        mimeType={recorder.result.mimeType}
        onRetake={() => recorder.clearResult()}
        onContinue={() => {
          recorder.clearResult();
          camera.stopCamera();
          handleContinue();
        }}
      />
    );
  }

  if (stage === "done" && finalUrl) {
    return (
      <PhotoSuccessView
        imageUrl={finalUrl}
        title="AR 拍照完成！"
        downloadPrefix="chito-ar"
        onContinue={handleContinue}
        testId="photo-ar-done"
      />
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
      <div ref={previewRef} className="fixed inset-0 z-50 bg-black" data-testid="photo-ar-camera">
        <video
          ref={camera.videoRef}
          className="w-full h-full object-cover"
          style={{ transform: camera.facingMode === "user" ? "scaleX(-1)" : undefined }}
          autoPlay playsInline muted
        />

        {/* 🎬 AR #2：隱藏合成 canvas（錄影來源，captureStream）*/}
        <canvas ref={recordCanvasRef} className="hidden" aria-hidden="true" />

        {/* 🎬 錄影中：紅點 + 秒數（00:SS / 00:30）*/}
        {recorder.isRecording && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-full pointer-events-none"
            data-testid="ar-recording-indicator"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs tabular-nums">
              {String(Math.floor(recorder.elapsedSec / 60)).padStart(2, "0")}:
              {String(recorder.elapsedSec % 60).padStart(2, "0")} / 00:30
            </span>
          </div>
        )}

        {/* 🆕 B2: 臉部追蹤狀態（大型明顯卡片）— 邊框依狀態變色（綠/橘/紅）*/}
        {useFaceTracking && (
          <div className="absolute top-4 left-4 right-16 z-10 pointer-events-none">
            <div
              className={`bg-black/75 backdrop-blur-md rounded-xl px-4 py-3 text-sm shadow-lg border-2 transition-colors ${
                faceError
                  ? "border-red-500/60"
                  : faceAnchor
                    ? "border-emerald-400/60"
                    : !faceReady
                      ? "border-white/20"
                      : "border-amber-400/60"
              }`}
            >
              {!faceReady ? (
                <div className="flex items-center gap-2" data-testid="face-tracking-loading">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-white">載入臉部追蹤模型（約 5 秒）...</span>
                </div>
              ) : faceError ? (
                <span className="text-red-300" data-testid="face-tracking-error">
                  ⚠️ {faceError}
                </span>
              ) : faceAnchor ? (
                <div data-testid="face-tracking-active">
                  <p className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    ✓ 已抓到你的臉
                  </p>
                  <p className="text-white/80 text-xs mt-0.5">按下方快門拍照</p>
                </div>
              ) : (
                <div data-testid="face-tracking-searching">
                  <p className="text-amber-400 font-bold animate-pulse">👀 找不到臉</p>
                  <p className="text-white/80 text-xs mt-0.5">讓臉在畫面中央再試</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 切鏡頭按鈕已移到下方 footer（避開 iPhone 瀏海）*/}

        {/* 🎯 face tracking 模式：用獨立 memo'd 子元件，避免高頻 setFaceAnchor 連帶 re-render 整個 flow */}
        {useFaceTracking ? (
          <FaceStickersOverlay
            stickers={stickers}
            preloadedStickers={preloadedStickers}
            preloadDone={preloadDone}
            faceAnchor={faceAnchor}
            isMirror={camera.facingMode === "user"}
            pageOpacity={(config as any).stickerOpacity ?? 1}
          />
        ) : (
          /* 非臉部追蹤 — 固定位置 + 🖐️ AR #1 單指拖曳/雙指縮放（群組 transform）
             wrapper 吃手勢；內層貼圖維持 positionToStyle，靠 wrapper 的 CSS transform 一起移動/縮放。*/
          <div
            className="absolute inset-0"
            style={{
              transform: cssGroupTransform(gesture.transform, previewShort),
              transformOrigin: "center",
              touchAction: "none",
              cursor: gesture.isDirty ? "grabbing" : "grab",
            }}
            {...gesture.handlers}
            data-testid="ar-sticker-gesture-layer"
          >
            {stickers.map((s, idx) => {
              const img = preloadedStickers[idx];
              if (preloadDone && !img) return null;
              return (
                <img
                  key={idx}
                  src={s.imageUrl}
                  alt=""
                  style={{ ...positionToStyle(s.position, s.sizeRatio), pointerEvents: "none" }}
                  data-testid={`ar-sticker-overlay-${idx}`}
                />
              );
            })}
          </div>
        )}

        {/* 🖐️ AR #1：拖曳/縮放提示 + 重置（只在固定位置模式顯示）*/}
        {gestureEnabled && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 pointer-events-none">
            <span className="text-white/80 text-xs bg-black/50 px-2 py-0.5 rounded">
              單指拖曳移動貼圖、雙指縮放大小
            </span>
            {gesture.isDirty && (
              <button
                type="button"
                onClick={gesture.reset}
                className="text-white text-xs bg-black/60 px-2 py-0.5 rounded pointer-events-auto hover:bg-black/80"
                data-testid="btn-ar-reset-transform"
              >
                ↺ 重置位置
              </button>
            )}
          </div>
        )}

        {/* 🎨 底部沉浸式按鈕列（CameraToolbar + safe-area） */}
        <div
          className="absolute bottom-0 left-0 right-0 py-4 px-4 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 to-transparent"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {/* 🆕 2026-05-07：用 CameraToolbar 統一外觀（拍照含臉部追蹤檢查）*/}
          <CameraToolbar
            stream={camera.stream}
            facingMode={camera.facingMode}
            onCapture={handleCapture}
            onSwitchCamera={camera.switchCamera}
            // 🆕 2026-05-12 #3 fix: 只鎖拍照、保留閃光燈 / 翻鏡頭可用
            disabled={!preloadDone}
            captureDisabled={useFaceTracking && !faceAnchor}
            // 🎬 AR #2：短按拍照、長按錄影（裝置支援才啟用）
            videoEnabled={recorder.isSupported}
            isRecording={recorder.isRecording}
            recordProgress={recorder.progress}
            onRecordStart={startRecording}
            onRecordStop={stopRecording}
          />
          {useFaceTracking && !faceAnchor && (
            <span
              className="text-amber-400 text-xs bg-black/50 px-2 py-0.5 rounded animate-pulse"
              role="status"
              aria-live="polite"
            >
              等找到臉才能拍
            </span>
          )}
          <button
            type="button"
            onClick={() => { camera.cancelCamera(); setStage("intro"); }}
            className="text-white/70 text-sm hover:text-white py-1 px-3"
            data-testid="btn-ar-cancel"
            aria-label="取消 AR 拍照、返回介紹頁"
          >
            ✕ 返回
          </button>
        </div>
      </div>
    );
  }

  // 介紹頁
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4"
      data-testid="photo-ar-intro"
    >
      <Sparkles className="w-12 h-12 text-primary" />
      <h2 className="text-2xl font-bold">
        {config.title || "AR 貼圖拍照"}
      </h2>
      {config.instruction && (
        <p className="text-center text-sm text-muted-foreground max-w-md">
          {config.instruction}
        </p>
      )}
      <p className="text-xs text-muted-foreground tabular-nums">
        將在畫面疊上 {stickers.length} 個 AR 貼圖
      </p>

      {/* 貼圖預覽縮圖（🆕 hover 微放大、未載入時 skeleton 提示） */}
      <div className="flex gap-2 flex-wrap justify-center max-w-md">
        {stickers.map((s, idx) => (
          <div
            key={idx}
            className="relative w-16 h-16 border rounded overflow-hidden bg-muted hover:scale-105 transition-transform"
            title={`貼圖 ${idx + 1}`}
          >
            <img
              src={s.imageUrl}
              alt=""
              className="w-full h-full object-contain"
              loading="lazy"
              decoding="async"
            />
            {!preloadDone && (
              <div className="absolute inset-0 bg-muted/60 flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              </div>
            )}
          </div>
        ))}
      </div>

      <Button
        size="lg"
        className="gap-2 mt-2 transition-transform active:scale-[0.97]"
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
        aria-label={!preloadDone ? "貼圖載入中、請稍候" : "開始 AR 拍照"}
        aria-busy={!preloadDone}
      >
        <Camera className="w-5 h-5" aria-hidden="true" />
        {!preloadDone ? "貼圖載入中..." : "開始拍照"}
      </Button>
      {preloadDone && failedCount > 0 && (
        <p
          className="text-xs text-amber-500 text-center"
          role="status"
          aria-live="polite"
        >
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
    </motion.div>
  );
}
