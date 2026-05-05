// 👥 PhotoTeamGather — 集合模式團體合照（2026-05-05 新增）
//
// 設計依據：使用者反饋「合成易卡 86%、希望改成集合 → 拍 1 張就好」
//
// 流程：
//   1. intro：說明「集合大家」+ 開始按鈕
//   2. countdown：5 秒倒數（提醒就位、語音通知）
//   3. shooting：拍 1 張（可重拍）
//   4. review：「拍好了、要再多拍幾張留念嗎？」
//      ├─ 再拍一張（max 5 張）→ 回 shooting
//      └─ 完成 → 上傳第一張 + 顯示成果
//   5. done：PhotoSuccessView（含主照 + 副照預覽）
//
// 與舊 PhotoTeamFlow（collage 模式）差異：
//   - 不分玩家、不輸入名字、不合成拼貼
//   - 隊長一台手機拍即可（用前/後鏡頭看現場）
//   - 上傳僅 1 張主照、副照可選不上傳（純本地留念）
//
// 端點依賴：
//   - POST /api/cloudinary/player-photo（上傳主照、儲存）

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Camera, CheckCircle2, Users, ArrowRight, AlertTriangle, Image as ImageIcon, RotateCw, Plus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequestWithTimeout } from "@/lib/queryClient";
import { usePhotoCamera } from "../photo-mission/usePhotoCamera";
import { CameraInitializingView, CameraView, PhotoPreview } from "../photo-mission/PhotoViews";
import PhotoSuccessView from "../photo-mission/PhotoSuccessView";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoTeamGatherProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
}

type Stage = "intro" | "countdown" | "shooting" | "review" | "uploading" | "done";

export default function PhotoTeamGather({ config, onComplete, sessionId, gameId }: PhotoTeamGatherProps) {
  const { toast } = useToast();
  const camera = usePhotoCamera();
  const team = config.teamConfig;
  const maxShots = Math.max(1, Math.min(5, team?.gatherMaxShots ?? 3));

  const [stage, setStage] = useState<Stage>("intro");
  const [countdown, setCountdown] = useState(5);
  const [shots, setShots] = useState<string[]>([]);   // 已拍到的照片 dataURL
  const [mainUrl, setMainUrl] = useState<string | null>(null);
  const finishedRef = useRef(false);

  // ===== Countdown 邏輯 =====
  useEffect(() => {
    if (stage !== "countdown") return;
    if (countdown <= 0) {
      setStage("shooting");
      const facing = config.defaultFacingMode ?? "user";
      camera.startCamera(facing);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, countdown, camera, config.defaultFacingMode]);

  // ===== Confirm shot（imperative + ref 防雙觸發）=====
  const confirmingRef = useRef(false);
  const handleConfirmShot = () => {
    if (confirmingRef.current) return;
    if (!camera.capturedImage) return;
    confirmingRef.current = true;
    setShots((prev) => [...prev, camera.capturedImage!]);
    camera.stopCamera();
    camera.setCapturedImage(null);
    setStage("review");
    setTimeout(() => { confirmingRef.current = false; }, 200);
  };

  // ===== 上傳主照 =====
  const uploadMutation = useMutation({
    mutationFn: async (imageData: string): Promise<{ url: string }> => {
      const res = await apiRequestWithTimeout(
        "POST",
        "/api/cloudinary/player-photo",
        { imageData, gameId, sessionId },
        25_000,
      );
      return res.json();
    },
  });

  const handleFinish = async () => {
    if (shots.length === 0) return;
    setStage("uploading");
    const main = shots[0];
    try {
      const data = await uploadMutation.mutateAsync(main);
      setMainUrl(data.url);
    } catch (err) {
      // 上傳失敗 fallback 用 dataURL（純本地留念也 OK）
      console.warn("[Gather] 上傳失敗、用本地 dataURL:", err);
      toast({
        title: "上傳失敗",
        description: "已使用本地照片繼續",
      });
      setMainUrl(main);
    }
    setStage("done");
  };

  const handleAgain = () => {
    if (shots.length >= maxShots) return;
    const facing = config.defaultFacingMode ?? "user";
    camera.startCamera(facing);
    setStage("shooting");
  };

  const handleRemoveShot = (idx: number) => {
    setShots((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleContinue = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const rewardPoints = (config as unknown as { rewardPoints?: number }).rewardPoints;
    const rewardItems = (config as unknown as { rewardItems?: string[] }).rewardItems ?? [];
    const points = rewardPoints ?? config.onSuccess?.points ?? 40;
    const reward: { points?: number; items?: string[] } = { points };
    const allItems = [
      ...rewardItems.filter((x) => !!x),
      ...(config.onSuccess?.grantItem ? [config.onSuccess.grantItem] : []),
    ];
    if (allItems.length > 0) reward.items = allItems;
    onComplete(reward);
  };

  // ===== Render =====

  // 完成
  if (stage === "done" && mainUrl) {
    return (
      <PhotoSuccessView
        imageUrl={mainUrl}
        title="團體合照完成！"
        subtitle={shots.length > 1 ? `共 ${shots.length} 張留念` : undefined}
        downloadPrefix="chito-team-gather"
        onContinue={handleContinue}
        testId="photo-gather-done"
      />
    );
  }

  // 上傳中
  if (stage === "uploading") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 space-y-4" data-testid="photo-gather-uploading">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium">上傳合照中…</p>
        <p className="text-xs text-muted-foreground">請保持網路連線</p>
      </div>
    );
  }

  // 拍攝
  if (stage === "shooting") {
    if (camera.cameraError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-6 space-y-5 max-w-md mx-auto" data-testid="gather-camera-error">
          <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold">相機無法啟動</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{camera.cameraError}</p>
          </div>
          <div className="w-full grid gap-2">
            <Button onClick={() => camera.startCamera()} className="w-full gap-2">
              <RotateCw className="w-4 h-4" /> 重試
            </Button>
            <Button variant="outline" onClick={() => camera.fileInputRef.current?.click()} className="w-full gap-2">
              <ImageIcon className="w-4 h-4" /> 從相簿選
            </Button>
            <Button variant="ghost" onClick={() => setStage("intro")}>取消</Button>
          </div>
          <input ref={camera.fileInputRef} type="file" accept="image/*" onChange={camera.handleFileUpload} className="hidden" />
        </div>
      );
    }
    if (camera.mode === "initializing") {
      return <CameraInitializingView videoRef={camera.videoRef} onCancel={camera.cancelCamera} />;
    }
    if (camera.mode === "camera") {
      return (
        <div className="relative h-full w-full">
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
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
            第 {shots.length + 1} 張 / 最多 {maxShots} 張
          </div>
        </div>
      );
    }
    if (camera.mode === "preview") {
      return <PhotoPreview imageSrc={camera.capturedImage!} onRetake={camera.retake} onSubmit={handleConfirmShot} />;
    }
    return <CameraInitializingView videoRef={camera.videoRef} onCancel={camera.cancelCamera} />;
  }

  // 倒數
  if (stage === "countdown") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 space-y-4" data-testid="photo-gather-countdown">
        <Users className="w-12 h-12 text-primary animate-pulse" />
        <h2 className="text-xl font-bold">請大家集合！</h2>
        <div className="my-4">
          <span className="text-7xl font-bold font-number tabular-nums text-primary">{countdown}</span>
        </div>
        <p className="text-sm text-muted-foreground">準備好笑容、我要拍囉～</p>
        <Button variant="ghost" size="sm" onClick={() => setStage("intro")}>取消</Button>
      </div>
    );
  }

  // 拍完預覽 / 再拍 / 完成
  if (stage === "review") {
    const reachedMax = shots.length >= maxShots;
    return (
      <div className="h-full w-full flex flex-col items-center p-4 space-y-4" data-testid="photo-gather-review">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        <h2 className="text-xl font-bold">拍好了！</h2>
        <p className="text-sm text-muted-foreground">
          {reachedMax ? `已拍 ${shots.length} 張（達上限）` : `已拍 ${shots.length} / ${maxShots} 張、可再多拍幾張留念`}
        </p>

        {/* 已拍照片預覽列 */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-md">
          {shots.map((src, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border-2 border-emerald-500/40">
              <img src={src} alt="" className="w-full h-full object-cover" />
              {shots.length > 1 && (
                <button
                  onClick={() => handleRemoveShot(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-destructive transition-colors"
                  aria-label="刪除此張"
                  data-testid={`btn-remove-shot-${i}`}
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
              {i === 0 && (
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-medium">
                  主照
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="w-full max-w-md grid gap-2 mt-2">
          {!reachedMax && (
            <Button variant="outline" onClick={handleAgain} className="gap-2" data-testid="btn-gather-again">
              <Plus className="w-4 h-4" /> 再拍一張留念
            </Button>
          )}
          <Button size="lg" onClick={handleFinish} className="gap-2" data-testid="btn-gather-finish">
            完成 <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  // intro（預設）
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-gather-intro">
      <Users className="w-12 h-12 text-primary" />
      <h2 className="text-2xl font-bold">{config.title || "團體合照"}</h2>
      {config.instruction && (
        <p className="text-center text-sm text-muted-foreground max-w-md">{config.instruction}</p>
      )}
      <Card className="w-full max-w-md bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50">
        <CardContent className="p-4 text-sm space-y-2 text-amber-900 dark:text-amber-100">
          <p className="font-semibold">📸 怎麼拍</p>
          <ol className="text-xs space-y-1 list-decimal pl-4">
            <li>對講機叫大家集合到隊長身邊</li>
            <li>按下「開始拍照」→ 5 秒倒數</li>
            <li>倒數結束會切到相機畫面、按快門即可</li>
            <li>可選再多拍 1-{maxShots} 張留念（不上傳，本地保留）</li>
          </ol>
        </CardContent>
      </Card>
      <Button
        size="lg"
        className="gap-2"
        onClick={() => {
          setCountdown(5);
          setStage("countdown");
        }}
        data-testid="btn-gather-start"
      >
        <Camera className="w-5 h-5" />
        開始拍照（5 秒倒數）
      </Button>
    </div>
  );
}
