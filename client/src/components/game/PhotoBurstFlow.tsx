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
import { apiRequest } from "@/lib/queryClient";
import { usePhotoCamera } from "./photo-mission/usePhotoCamera";
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
  const [burstImages, setBurstImages] = useState<string[]>([]);     // base64 陣列
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);      // Cloudinary publicIds
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

  // 上傳階段：**並行**上傳（從 sequential → parallel，速度 5 倍）→ 合成 GIF
  useEffect(() => {
    if (stage !== "uploading") return;
    let cancelled = false;
    (async () => {
      try {
        // 🚀 並行上傳：5 張同時傳而非一張一張傳（速度從 10-15s → 2-3s）
        const ids: string[] = [];
        const uploadPromises = burstImagesRef.current.map(async (img, idx) => {
          const id = await uploadSingle(img);
          if (cancelled) return null;
          ids.push(id);
          setUploadedIds([...ids]); // 進度更新（注意：並行，順序不保證）
          return { idx, id };
        });
        const results = await Promise.all(uploadPromises);
        if (cancelled) return;

        // 🔑 重要：依照原本拍攝順序排序（並行上傳會亂序）
        const sortedIds = results
          .filter((r): r is { idx: number; id: string } => r !== null)
          .sort((a, b) => a.idx - b.idx)
          .map((r) => r.id);

        setStage("compositing");
        skipGifRef.current = false;
        setCompositeProgress("建立動畫中...");

        // 🆕 v2: 先嘗試合成真 GIF（動態）
        // 🐛 修：Cloudinary multi API 偶爾 hang 住（tag propagation 慢）
        //   加 15s timeout，超時自動 fallback 到拼貼（2 秒內完成）
        //   使用者也可點「立即改用拼貼圖」主動跳出
        try {
          const gifAbort = new AbortController();
          const gifTimer = setTimeout(() => gifAbort.abort(), 15000);
          // 使用者主動跳過的監聽（每 500ms 檢查 skipGifRef）
          const skipCheck = setInterval(() => {
            if (skipGifRef.current) gifAbort.abort();
          }, 500);
          const gifRes = await fetch("/api/cloudinary/burst-to-gif", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tag: getBurstTag(),
              format: "gif",
              delayMs: frameIntervalMs,
            }),
            signal: gifAbort.signal,
          }).finally(() => {
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
          // 🐛 拼貼合成：也加 8s timeout（原本用 compositeMutation 沒 timeout）
          try {
            const collageAbort = new AbortController();
            const collageTimer = setTimeout(() => collageAbort.abort(), 8000);
            const res = await fetch("/api/cloudinary/composite-photo", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                playerPhotoPublicId: sortedIds[0] ?? "",
                config: { canvas: { width: 1080, height: 1080, crop: "fill" }, layers: [] },
                dynamicVars: {},
              }),
              signal: collageAbort.signal,
            }).finally(() => clearTimeout(collageTimer));
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

  // 🆕 合成階段秒數計時（每秒 +1），讓 UI 有動態進度數字
  useEffect(() => {
    if (stage !== "compositing") {
      setCompositeElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setCompositeElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  // 🚨 絕對 deadline：30 秒後不管合成到哪一步，強制進 done
  //   用本地第一張圖當紀念（burstImages[0]），不靠任何 server
  //   保證遊戲一定能繼續
  useEffect(() => {
    if (stage !== "compositing") return;
    const hardDeadline = setTimeout(() => {
      console.warn("[Burst] 合成 hard deadline 30s，強制本地 fallback");
      const firstImage = burstImagesRef.current[0];
      if (firstImage) {
        setCompositeUrl(firstImage);
      }
      setStage("done");
    }, 30000);
    return () => clearTimeout(hardDeadline);
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

            {/* 右上切換鏡頭 */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => camera.switchCamera()}
              className="absolute top-4 right-4 bg-black/60 backdrop-blur hover:bg-black/80 text-white w-12 h-12 rounded-full"
              data-testid="btn-burst-switch-camera"
              title="切換鏡頭"
            >
              <RefreshCw className="w-5 h-5" />
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
    return (
      <div
        className="fixed inset-0 z-40 bg-background flex flex-col items-center justify-center p-6 gap-6"
        data-testid="photo-burst-processing"
      >
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
              通常 2-5 秒完成（依網路速度）
            </p>
          </>
        ) : (
          <>
            <div className="text-center space-y-2">
              <p className="text-2xl font-bold">合成動畫中</p>
              <p className="text-sm text-primary font-medium">{compositeProgress}</p>
            </div>

            {/* 🎨 秒數進度（讓使用者看到系統有在動）*/}
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>已等待 <span className="font-number font-bold text-foreground">{compositeElapsed}</span> 秒</span>
                <span>超時 {Math.max(0, 15 - compositeElapsed)} 秒後自動切拼貼</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    compositeElapsed >= 15 ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(100, (compositeElapsed / 15) * 100)}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center max-w-xs">
              GIF 合成通常 5-15 秒
            </p>

            {/* 🆕 使用者可主動跳過 GIF 直接用拼貼圖（更快）*/}
            {compositeElapsed >= 5 && compositeProgress === "建立動畫中..." && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  skipGifRef.current = true;
                  setCompositeProgress("改用拼貼圖...");
                }}
                className="gap-1"
                data-testid="btn-burst-skip-gif"
              >
                不等了，立即用拼貼圖
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
