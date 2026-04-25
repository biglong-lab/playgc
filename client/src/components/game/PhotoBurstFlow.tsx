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
  Camera, CheckCircle2, AlertTriangle, Download, Share2, Zap, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestWithTimeout } from "@/lib/queryClient";
import { createLocalCollage } from "@/lib/client-collage";
import { createClientGif } from "@/lib/client-gif";
import { usePhotoCamera } from "./photo-mission/usePhotoCamera";
import { savePhotoToAlbum, savePhotosToAlbum, getSaveToastMessage } from "@/lib/photo-save";
import { useCameraOverlayMode } from "@/hooks/useCameraOverlayMode";
import {
  CameraInitializingView, CameraView, UploadingView,
} from "./photo-mission/PhotoViews";
import PhotoSuccessView from "./photo-mission/PhotoSuccessView";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoBurstFlowProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
}

// 🎨 加入 preview + countdown 兩個 stage，讓使用者有時間準備
type Stage = "intro" | "preview" | "countdown" | "shooting" | "uploading" | "compositing" | "done";

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

  // 🆕 拍照時隱藏 Walkie 浮動按鈕（避免擋切鏡頭等按鈕）
  useCameraOverlayMode(
    stage === "preview" || stage === "countdown" || stage === "shooting",
  );

  const [burstImages, setBurstImages] = useState<string[]>([]);     // base64 陣列
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);      // Cloudinary publicIds
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);    // 🆕 Cloudinary 個別照片 URL
  const [countdown, setCountdown] = useState(0);                     // 正在倒數到第 N 張
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [compositeProgress, setCompositeProgress] = useState<string>("準備中..."); // 合成階段進度文字
  const [compositeElapsed, setCompositeElapsed] = useState(0); // compositing 已等待秒數
  const skipGifRef = useRef(false); // 使用者主動跳過 GIF

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

  // 上傳單張照片（帶 burst tag + 10s timeout + Firebase Auth token）
  // 🐛 關鍵修：原本用裸 fetch 沒帶 token → HTTP 401
  //   改用 apiRequestWithTimeout（會自動加 Authorization: Bearer ${firebaseToken}）
  const uploadSingle = async (imageData: string): Promise<{ publicId: string; url: string }> => {
    const res = await apiRequestWithTimeout(
      "POST",
      "/api/cloudinary/burst-frame",
      { imageData, gameId, sessionId, tag: getBurstTag() },
      10000,
    );
    const data = (await res.json()) as { publicId: string; url: string };
    return { publicId: data.publicId, url: data.url };
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
  //
  // 🚀 新策略 Optimistic Completion：
  //   拍完 5 張 → 立刻用本地 base64 第一張當紀念 → 直接進 "done" 顯示給玩家
  //   背景非同步上傳 Cloudinary + 合成 GIF → 成功後替換成合成結果
  //   使用者體感：拍完 3 秒內 → 看到結果頁（不用等上傳！）
  useEffect(() => {
    if (stage !== "shooting") return;
    if (!camera.cameraReady) return;
    if (burstImagesRef.current.length >= frameCount) return;

    let cancelled = false;
    const captureNext = (index: number) => {
      if (cancelled) return;
      if (index >= frameCount) {
        // 全拍完 → 停相機
        camera.stopCamera();

        // 🚀 3 段式 Progressive Enhancement
        const images = burstImagesRef.current;
        const firstLocal = images[0];
        if (firstLocal) {
          // Step 1: 立刻顯示第一張（0.1 秒）
          setCompositeUrl(firstLocal);
          setStage("done");

          // Step 2: Canvas 拼貼（1 秒）— 讓使用者看到 5 張都在
          createLocalCollage(images, { maxSize: 1600, quality: 0.88 })
            .then((collage) => {
              console.log("[Burst] ✅ Step 2: 拼貼完成");
              setCompositeUrl(collage);

              // Step 3: 🎞️ Client GIF 編碼（2-5 秒）— 真正的動畫！
              //   在 Web Worker 跑，不 block UI
              //   boomerang 來回播放更生動
              createClientGif(images, {
                frameDelayMs: frameIntervalMs,
                width: 800,
                quality: 10,
                boomerang: true,
              })
                .then((gifUrl) => {
                  console.log("[Burst] ✅ Step 3: Client GIF 動畫完成！");
                  setCompositeUrl(gifUrl);
                })
                .catch((err) => {
                  console.warn("[Burst] Client GIF 失敗，保留拼貼:", err);
                });
            })
            .catch((err) => {
              console.warn("[Burst] 拼貼失敗，保留第一張:", err);
            });
        } else {
          setStage("uploading");
        }

        // Step 4（可選）：背景上傳 Cloudinary（若網路有，分享 URL 更穩）
        backgroundUploadAndComposite();
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

  // 🔄 背景上傳 + 合成（不 block UI，成功後靜默替換 URL）
  const backgroundUploadAndComposite = async () => {
    try {
      const images = burstImagesRef.current;
      if (images.length === 0) return;

      // 並行上傳（10s timeout per image）
      const uploadPromises = images.map(async (img, idx) => {
        try {
          const result = await uploadSingle(img);
          return { idx, ...result };
        } catch (err) {
          console.warn(`[Burst BG] upload #${idx} failed:`, err);
          return null;
        }
      });
      const results = await Promise.all(uploadPromises);
      const sorted = results
        .filter((r): r is { idx: number; publicId: string; url: string } => r !== null)
        .sort((a, b) => a.idx - b.idx);
      const sortedIds = sorted.map((r) => r.publicId);
      const sortedUrls = sorted.map((r) => r.url);

      if (sortedIds.length === 0) {
        console.warn("[Burst BG] 全部上傳失敗，保持本地圖");
        return;
      }
      setUploadedIds(sortedIds);
      setUploadedUrls(sortedUrls); // 🆕 記下個別照片 URL，給「保存全部」用

      // 等 tag propagate
      await new Promise((r) => setTimeout(r, 500));

      // 嘗試 GIF 合成（10s timeout + Firebase auth token）
      try {
        const gifRes = await apiRequestWithTimeout(
          "POST",
          "/api/cloudinary/burst-to-gif",
          { tag: getBurstTag(), format: "gif", delayMs: frameIntervalMs },
          10000,
        );
        const gifData = (await gifRes.json()) as {
          success?: boolean;
          url?: string;
        };
        if (gifData.success && gifData.url) {
          console.log("[Burst BG] ✅ GIF 合成成功，替換 URL");
          setCompositeUrl(gifData.url);
          return;
        }
      } catch (gifErr) {
        console.warn("[Burst BG] GIF 失敗，保留本地圖:", gifErr);
      }

      // GIF 失敗 → 直接保留本地 base64（已經在 setCompositeUrl 了）
      // 不再嘗試組 Cloudinary URL（需要 cloud name，複雜）
    } catch (err) {
      console.warn("[Burst BG] 背景處理錯誤:", err);
      // 使用者已經看到本地圖了，靜默失敗
    }
  };

  // 上傳階段：**並行**上傳（從 sequential → parallel，速度 5 倍）→ 合成 GIF
  useEffect(() => {
    if (stage !== "uploading") return;
    let cancelled = false;
    (async () => {
      try {
        // 🚀 並行上傳：5 張同時傳而非一張一張傳（速度從 10-15s → 2-3s）
        const ids: string[] = [];
        const uploadPromises = burstImagesRef.current.map(async (img, idx) => {
          const result = await uploadSingle(img);
          if (cancelled) return null;
          ids.push(result.publicId);
          setUploadedIds([...ids]); // 進度更新（注意：並行，順序不保證）
          return { idx, ...result };
        });
        const results = await Promise.all(uploadPromises);
        if (cancelled) return;

        // 🔑 重要：依照原本拍攝順序排序（並行上傳會亂序）
        const sortedResults = results
          .filter((r): r is { idx: number; publicId: string; url: string } => r !== null)
          .sort((a, b) => a.idx - b.idx);
        const sortedIds = sortedResults.map((r) => r.publicId);
        const sortedUrls = sortedResults.map((r) => r.url);
        setUploadedUrls(sortedUrls); // 🆕 記下 URLs 給「保存全部」用

        setStage("compositing");
        skipGifRef.current = false;
        setCompositeProgress("建立動畫中...");

        // 🆕 v2: 先嘗試合成真 GIF（動態）
        // 🐛 修：Cloudinary multi API 偶爾 hang 住（tag propagation 慢）
        //   加 15s timeout，超時自動 fallback 到拼貼（2 秒內完成）
        //   使用者也可點「立即改用拼貼圖」主動跳出
        try {
          const gifAbort = new AbortController();
          const gifTimer = setTimeout(() => gifAbort.abort(), 10000);
          const skipCheck = setInterval(() => {
            if (skipGifRef.current) gifAbort.abort();
          }, 500);
          // 🐛 GIF 合成也要帶 Firebase token（apiRequestWithTimeout 會自動加）
          const gifRes = await apiRequestWithTimeout(
            "POST",
            "/api/cloudinary/burst-to-gif",
            { tag: getBurstTag(), format: "gif", delayMs: frameIntervalMs },
            10000,
          ).finally(() => {
            clearTimeout(gifTimer);
            clearInterval(skipCheck);
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
          console.warn("[Burst] GIF 失敗或超時，改用拼貼:", gifErr);
          setCompositeProgress("改用拼貼圖...");
          try {
            // 🐛 拼貼也要帶 token
            const res = await apiRequestWithTimeout(
              "POST",
              "/api/cloudinary/composite-photo",
              {
                playerPhotoPublicId: sortedIds[0] ?? "",
                config: { canvas: { width: 1080, height: 1080, crop: "fill" }, layers: [] },
                dynamicVars: {},
              },
              6000,
            );
            const data = await res.json().catch(() => ({} as { compositeUrl?: string }));
            if (cancelled) return;
            if (data.compositeUrl) {
              setCompositeUrl(data.compositeUrl);
              setStage("done");
              return;
            }
            throw new Error("拼貼回傳無 URL");
          } catch (err) {
            console.warn("[Burst] 拼貼也失敗 → 用本地第一張:", err);
          }
          // 🛟 最終 fallback：本地第一張 base64（不靠 server，絕對能進 done）
          const firstLocal = burstImagesRef.current[0];
          if (firstLocal) {
            setCompositeProgress("合成失敗，顯示拍攝紀念");
            setCompositeUrl(firstLocal);
          }
          setStage("done");
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

  // 🎨 改成三段式：intro → preview（預覽 + 準備）→ countdown（3-2-1）→ shooting
  const handleStart = () => {
    burstImagesRef.current = [];
    setBurstImages([]);
    setUploadedIds([]);
    setStage("preview");
    // 連拍預設前鏡頭（自拍/表情），管理員可在編輯器覆寫
    const facing = config.defaultFacingMode ?? "user";
    camera.startCamera(facing);
  };

  // 🆕 合成階段：秒數計時 + hard deadline
  useEffect(() => {
    if (stage !== "compositing") {
      setCompositeElapsed(0);
      return;
    }
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 1;
      setCompositeElapsed(elapsed);
      if (elapsed >= 12) {
        console.warn("[Burst] Compositing deadline 12s → force done");
        clearInterval(timer);
        const firstImage = burstImagesRef.current[0];
        if (firstImage) setCompositeUrl(firstImage);
        setStage("done");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  // 🚨 全局 SUPER DEADLINE — uploading/compositing 任一階段超過 25 秒都強制 done
  //   用 Date.now() 比對 + 每秒 tick（iOS throttle 也不影響）
  //   這是最終救命機制：不管 Promise.all 卡住、setState batch、iOS throttle 都會觸發
  useEffect(() => {
    if (stage !== "uploading" && stage !== "compositing") return;
    const startAt = Date.now();
    console.log("[Burst] Super deadline armed at", startAt);
    const check = setInterval(() => {
      const elapsed = Date.now() - startAt;
      if (elapsed >= 25000) {
        console.warn("[Burst] ⚠️ SUPER DEADLINE 25s 觸發 → force done", {
          stage,
          uploaded: burstImagesRef.current.length,
        });
        clearInterval(check);
        const firstImage = burstImagesRef.current[0];
        if (firstImage) setCompositeUrl(firstImage);
        setStage("done");
      }
    }, 1000);
    return () => clearInterval(check);
  }, [stage]);

  // 倒數 3-2-1 後才開始連拍
  const [countdownToStart, setCountdownToStart] = useState(3);
  useEffect(() => {
    if (stage !== "countdown") return;
    setCountdownToStart(3);
    let n = 3;
    const timer = setInterval(() => {
      n -= 1;
      setCountdownToStart(n);
      if (n <= 0) {
        clearInterval(timer);
        setStage("shooting");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

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

  // 🆕 一鍵保存「動態 GIF + 全部個別照片」到手機相簿
  // 使用者要求：除了 GIF 也要每張獨立照片
  const handleSaveToAlbum = async () => {
    if (!compositeUrl) return;
    // 組合：[GIF, frame1, frame2, ...]
    const allUrls = [compositeUrl, ...uploadedUrls];
    const result = await savePhotosToAlbum({
      urls: allUrls,
      filenamePrefix: "chito-burst",
      title: "CHITO 連拍紀念",
      text: `${frameCount} 連拍紀念圖（含動態 GIF）`,
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const handleDownload = async () => {
    if (!compositeUrl) return;
    const result = await savePhotoToAlbum({
      url: compositeUrl,
      filename: "chito-burst",
      forceMethod: "download",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const handleShare = async () => {
    if (!compositeUrl) return;
    const result = await savePhotoToAlbum({
      url: compositeUrl,
      filename: "chito-burst",
      title: "CHITO 連拍紀念",
      text: `${frameCount} 連拍紀念圖`,
      forceMethod: "share",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
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
      <PhotoSuccessView
        imageUrl={compositeUrl}
        title="連拍完成！"
        downloadPrefix="chito-burst"
        onContinue={handleContinue}
        testId="photo-burst-done"
      />
    );
  }

  // 🎯 關鍵修復：preview / countdown / shooting 共用同一個 video（不 re-mount，保留 stream）
  //   用 overlay 切換 UI，video 永遠是同一個 DOM node
  if (stage === "preview" || stage === "countdown" || stage === "shooting") {
    const notReady = camera.mode === "initializing" || !camera.cameraReady;
    return (
      <div
        className="fixed inset-0 z-50 bg-black"
        data-testid={`photo-burst-${stage}`}
      >
        {/* 唯一的 video（跨 stage 共用）*/}
        <video
          ref={camera.videoRef}
          className="w-full h-full object-cover"
          style={{ transform: camera.facingMode === "user" ? "scaleX(-1)" : undefined }}
          autoPlay playsInline muted
        />

        {/* 相機尚未就緒 → 灰色遮罩 + loading */}
        {notReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-white text-sm">相機啟動中...</p>
          </div>
        )}

        {/* ─── Stage: preview ─── 清楚大字引導 */}
        {stage === "preview" && !notReady && (
          <>
            {/* 🎨 大型中央提示卡（使用者一眼看到）*/}
            <div className="absolute top-20 left-4 right-4 bg-black/85 backdrop-blur-md text-white rounded-2xl p-5 shadow-2xl border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-primary" />
                </div>
                <p className="text-base font-bold">準備好了嗎？</p>
              </div>
              <p className="text-sm text-white/90 leading-relaxed">
                按下方大按鈕後會 <span className="text-amber-400 font-bold">倒數 3 秒</span> 再開始連拍<br/>
                期間會拍 <span className="text-amber-400 font-bold">{frameCount} 張</span>，擺個有趣的 pose 吧！
              </p>
            </div>

            {/* 🎨 右上切換鏡頭 — 大按鈕帶文字 */}
            <Button
              onClick={() => camera.switchCamera()}
              className="absolute top-4 right-4 bg-black/75 backdrop-blur hover:bg-black/90 text-white gap-2 px-4 h-12 rounded-full border-2 border-white/30 shadow-xl"
              data-testid="btn-burst-switch-camera"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="text-sm font-medium">
                {camera.facingMode === "user" ? "切後鏡頭" : "切前鏡頭"}
              </span>
            </Button>

            {/* 底部：取消 + 開始連拍 */}
            <div
              className="absolute bottom-0 left-0 right-0 py-6 px-4 flex items-center justify-center gap-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent"
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            >
              <Button
                variant="outline"
                onClick={() => { camera.cancelCamera(); setStage("intro"); }}
                className="bg-white/15 border-white/40 text-white hover:bg-white/25 backdrop-blur px-5 h-12"
                data-testid="btn-burst-cancel-preview"
              >
                ✕ 取消
              </Button>
              <Button
                size="lg"
                onClick={() => setStage("countdown")}
                className="bg-primary text-primary-foreground h-14 px-8 text-lg font-bold rounded-full shadow-2xl animate-pulse"
                data-testid="btn-burst-go"
              >
                <Camera className="w-5 h-5 mr-2" />
                開始連拍
              </Button>
            </div>
          </>
        )}

        {/* ─── Stage: countdown ─── 大字 3-2-1 */}
        {stage === "countdown" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
            <p className="text-white/80 text-xl mb-4">即將開始連拍...</p>
            <div
              key={countdownToStart}
              className="text-white text-[180px] font-bold font-number drop-shadow-2xl leading-none"
              style={{ animation: "countdownPulse 1s ease-out" }}
            >
              {countdownToStart > 0 ? countdownToStart : "GO!"}
            </div>
          </div>
        )}

        {/* ─── Stage: shooting ─── 顯示進度 */}
        {stage === "shooting" && (
          <>
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-full text-lg font-bold shadow-2xl">
              📸 第 {countdown} / {frameCount} 張
            </div>
            <div
              className="absolute left-1/2 -translate-x-1/2 text-white text-base bg-black/70 px-5 py-2 rounded-full"
              style={{ bottom: "max(2rem, env(safe-area-inset-bottom) + 1rem)" }}
            >
              保持動作，不要移動！
            </div>
          </>
        )}
      </div>
    );
  }

  // 🎨 上傳 / 合成階段 — 明確進度提示 + 預期時間
  if (stage === "uploading" || stage === "compositing") {
    const uploadPercent = Math.round((uploadedIds.length / frameCount) * 100);
    const buildCommit = (import.meta.env.VITE_APP_COMMIT as string) || "dev";
    return (
      <div
        className="fixed inset-0 z-40 bg-background flex flex-col items-center justify-center p-6 gap-6"
        data-testid="photo-burst-processing"
      >
        {/* 🐛 Debug info — 右上角小字讓使用者回報時能看到 bundle 版本 */}
        <div className="absolute top-2 right-2 text-[10px] text-muted-foreground/50 font-mono">
          v:{buildCommit.slice(0, 7)} · {stage} · {compositeElapsed}s
        </div>

        <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />

        {stage === "uploading" ? (
          <>
            <div className="text-center space-y-2">
              <p className="text-2xl font-bold">上傳照片中</p>
              <p className="text-sm text-muted-foreground">
                {uploadedIds.length} / {frameCount} 張（{uploadPercent}%）
              </p>
            </div>
            {/* 進度條 */}
            <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              通常 2-5 秒完成（依網路速度）<br/>
              每張 10 秒沒傳到會自動跳過
            </p>

            {/* 🆕 上傳階段也加「立即完成」按鈕（避免 Promise.all hang 住時卡死）*/}
            <Button
              size="lg"
              onClick={() => {
                console.log("[Burst] 使用者在 uploading 階段強制完成");
                const first = burstImagesRef.current[0];
                if (first) setCompositeUrl(first);
                setStage("done");
              }}
              variant="outline"
              className="gap-2 mt-2"
              data-testid="btn-burst-skip-upload"
            >
              ⚡ 跳過上傳，直接看紀念照
            </Button>
          </>
        ) : (
          <>
            <div className="text-center space-y-2">
              <p className="text-2xl font-bold">合成動畫中</p>
              <p className="text-sm text-primary font-medium">{compositeProgress}</p>
            </div>

            {/* 🎨 秒數進度（12s 絕對 deadline）*/}
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  已等待 <span className="font-number font-bold text-foreground">{compositeElapsed}</span> 秒
                </span>
                <span>
                  {compositeElapsed >= 12
                    ? "即將完成..."
                    : `最多還等 ${12 - compositeElapsed} 秒`}
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    compositeElapsed >= 10
                      ? "bg-destructive"
                      : compositeElapsed >= 6
                      ? "bg-amber-500"
                      : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(100, (compositeElapsed / 12) * 100)}%` }}
                />
              </div>
            </div>

            {/* 🚀 大型「立即完成」按鈕 — 立刻顯示（不等 3 秒）*/}
            <Button
              size="lg"
              onClick={() => {
                console.log("[Burst] 使用者手動強制完成");
                const first = burstImagesRef.current[0];
                if (first) setCompositeUrl(first);
                setStage("done");
              }}
              className="bg-primary text-primary-foreground font-bold gap-2 shadow-lg h-14 px-8 text-base animate-pulse"
              data-testid="btn-burst-force-done"
            >
              ⚡ 立即完成（跳過合成）
            </Button>

            <p className="text-xs text-muted-foreground text-center max-w-xs">
              12 秒內會自動完成 · 不想等就按上方按鈕
            </p>

            {/* 🛟 最終救命鈕 — 10 秒後出現（若連 force done 都失效）*/}
            {compositeElapsed >= 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  console.warn("[Burst] 使用者觸發清快取 + reload");
                  try {
                    if ("serviceWorker" in navigator) {
                      const regs = await navigator.serviceWorker.getRegistrations();
                      await Promise.all(regs.map((r) => r.unregister()));
                    }
                    if ("caches" in window) {
                      const keys = await caches.keys();
                      await Promise.all(keys.map((k) => caches.delete(k)));
                    }
                    localStorage.removeItem("chito_cache_purge_v6_burst_deadline_fix");
                  } catch (e) {
                    console.error("[Burst] 清快取失敗:", e);
                  }
                  window.location.reload();
                }}
                className="gap-1 text-xs text-destructive border-destructive/50"
                data-testid="btn-burst-nuke-cache"
              >
                🔄 還是卡住？清快取重新整理
              </Button>
            )}
          </>
        )}
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
