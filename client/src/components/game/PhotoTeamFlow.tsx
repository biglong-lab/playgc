// 👥 PhotoTeamFlow — 團體合影（簡化版：隊長主控連續拍所有隊員）
//
// 實作策略（不用 WebSocket，避免多人同步複雜度）：
//   1. 介紹 + 選擇實際隊員數（minMembers ~ maxMembers）
//   2. 依序為每個隊員拍一張（顯示「第 X 位：______」可輸入名稱）
//   3. 每張拍完按「下一位」
//   4. 全拍完上傳 → 合成拼貼圖（2x2 / 3x2 / 3x3 等）
//   5. 顯示結果 + 下載 / 分享 / 繼續

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Camera, CheckCircle2, AlertTriangle, Download, Share2, Users, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePhotoCamera } from "./photo-mission/usePhotoCamera";
import {
  CameraInitializingView, CameraView, PhotoPreview, UploadingView,
} from "./photo-mission/PhotoViews";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoTeamFlowProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
}

type Stage = "intro" | "select_count" | "shooting" | "transition" | "uploading" | "compositing" | "done";

interface MemberShot {
  name: string;
  imageData: string;
  publicId?: string;
}

export default function PhotoTeamFlow({
  config,
  onComplete,
  sessionId,
  gameId,
}: PhotoTeamFlowProps) {
  const { toast } = useToast();
  const camera = usePhotoCamera();
  const team = config.teamConfig;

  const minMembers = team?.minMembers ?? 2;
  const maxMembers = team?.maxMembers ?? 6;

  const [stage, setStage] = useState<Stage>("intro");
  const [memberCount, setMemberCount] = useState(minMembers);
  const [currentIdx, setCurrentIdx] = useState(0);   // 當前拍第幾位
  const [members, setMembers] = useState<MemberShot[]>([]);
  const [currentName, setCurrentName] = useState("");
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);

  const finishedRef = useRef(false);

  // 相機拍完後暫存到 members
  useEffect(() => {
    if (stage !== "shooting") return;
    if (camera.mode !== "preview") return;
    if (!camera.capturedImage) return;
    // 存到 members
    const next: MemberShot = {
      name: currentName.trim() || `隊員 ${currentIdx + 1}`,
      imageData: camera.capturedImage,
    };
    setMembers((prev) => {
      const updated = [...prev];
      updated[currentIdx] = next;
      return updated;
    });
    // 關相機進 transition
    camera.stopCamera();
    camera.setCapturedImage(null);
    setStage("transition");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.capturedImage, camera.mode, stage]);

  // 上傳 + 合成
  const compositeMutation = useMutation({
    mutationFn: async (publicIds: string[]): Promise<{ compositeUrl: string }> => {
      const layoutMode = team?.layoutMode ?? "grid";
      const n = publicIds.length;

      let cols: number;
      let rows: number;
      if (layoutMode === "strip") { cols = n; rows = 1; }
      else if (layoutMode === "circle") { cols = n; rows = 1; }    // 簡化：一排
      else if (layoutMode === "collage") {                          // 自由 — 用方格代替
        if (n <= 2) { cols = 2; rows = 1; }
        else if (n <= 4) { cols = 2; rows = 2; }
        else if (n <= 6) { cols = 3; rows = 2; }
        else { cols = 3; rows = 3; }
      } else {  // grid
        if (n <= 2) { cols = 2; rows = 1; }
        else if (n <= 4) { cols = 2; rows = 2; }
        else if (n <= 6) { cols = 3; rows = 2; }
        else { cols = 3; rows = 3; }
      }

      const cellSize = 540;
      const canvasW = cols * cellSize;
      const canvasH = rows * cellSize;

      const [firstId, ...rest] = publicIds;
      const firstName = members[0]?.name ?? "隊員 1";
      const layers = rest.map((pid, idx) => {
        const pos = idx + 1;
        const col = pos % cols;
        const row = Math.floor(pos / cols);
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

      // 文字 overlay：每位隊員名（底部半透明）
      const nameLayers = members.slice(0, n).map((m, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        return {
          type: "text" as const,
          text: m.name,
          font: "Noto_Sans_TC",
          size: 32,
          color: "white",
          background: "rgb:00000099",
          gravity: "north_west" as const,
          x: col * cellSize + 16,
          y: row * cellSize + cellSize - 60,
        };
      });

      // 略過第一張自己的 name layer（因為是底圖，取 firstName 重畫）
      const config = {
        canvas: { width: canvasW, height: canvasH, crop: "fill" as const },
        layers: [...layers, ...nameLayers],
      };

      const res = await apiRequest("POST", "/api/cloudinary/composite-photo", {
        playerPhotoPublicId: firstId,
        config,
        dynamicVars: { firstName },
      });
      return res.json();
    },
  });

  // 上傳階段：所有照片上傳到 Cloudinary → 合成
  useEffect(() => {
    if (stage !== "uploading") return;
    let cancelled = false;
    (async () => {
      try {
        const uploaded: string[] = [];
        for (const m of members) {
          if (cancelled) return;
          const res = await apiRequest("POST", "/api/cloudinary/player-photo", {
            imageData: m.imageData,
            gameId,
            sessionId,
          });
          const data = await res.json() as { publicId: string };
          uploaded.push(data.publicId);
        }
        if (cancelled) return;
        setStage("compositing");
        try {
          const comp = await compositeMutation.mutateAsync(uploaded);
          if (cancelled) return;
          setCompositeUrl(comp.compositeUrl);
        } catch (err) {
          console.warn("[Team] 合成失敗:", err);
          // fallback 用第一張的 URL
          if (uploaded.length > 0) {
            const res = await apiRequest("POST", "/api/cloudinary/composite-photo", {
              playerPhotoPublicId: uploaded[0],
              config: { canvas: { width: 1080, height: 1080, crop: "fill" }, layers: [] },
              dynamicVars: {},
            });
            const data = await res.json();
            setCompositeUrl(data.compositeUrl);
          }
        }
        setStage("done");
      } catch (err) {
        toast({
          title: "上傳失敗",
          description: err instanceof Error ? err.message : "請檢查網路",
          variant: "destructive",
        });
        setStage("intro");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const handleStartShootingMember = () => {
    setStage("shooting");
    // 團體合影預設前鏡頭（自拍），管理員可覆寫
    const facing = config.defaultFacingMode ?? "user";
    camera.startCamera(facing);
  };

  const handleNextMember = () => {
    if (currentIdx + 1 >= memberCount) {
      // 全部拍完 → 上傳
      setStage("uploading");
    } else {
      setCurrentIdx((i) => i + 1);
      setCurrentName("");
      handleStartShootingMember();
    }
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

  const handleDownload = async () => {
    if (!compositeUrl) return;
    try {
      const res = await fetch(compositeUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chito-team-${Date.now()}.jpg`;
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
        const file = new File([blob], "team.jpg", { type: "image/jpeg" });
        const canShareFiles =
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share({
            title: "CHITO 團體合照",
            text: `${memberCount} 人團體合影紀念`,
            files: [file],
          });
          return;
        }
        await navigator.share({ title: "CHITO 團體合照", url: compositeUrl });
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

  if (!team) {
    return (
      <div className="p-6 text-center" data-testid="photo-team-missing-config">
        <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
        <p className="text-destructive font-medium">缺少 teamConfig 設定</p>
      </div>
    );
  }

  // 完成
  if (stage === "done" && compositeUrl) {
    return (
      <div className="h-full w-full bg-background flex flex-col items-center justify-center p-4 gap-4" data-testid="photo-team-done">
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="w-6 h-6" />
          <h2 className="text-xl font-bold">團體合影完成！</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {memberCount} 位隊員：{members.map((m) => m.name).join("、")}
        </p>
        <div className="max-w-lg w-full bg-card rounded-lg shadow-lg overflow-hidden">
          <img src={compositeUrl} alt="團體合影" className="w-full object-cover" data-testid="photo-team-composite" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-lg">
          <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2" data-testid="btn-team-download">
            <Download className="w-4 h-4" /> 下載
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex-1 gap-2" data-testid="btn-team-share">
            <Share2 className="w-4 h-4" /> 分享
          </Button>
          <Button onClick={handleContinue} className="flex-1 gap-2" data-testid="btn-team-continue">
            繼續遊戲
          </Button>
        </div>
      </div>
    );
  }

  // 上傳/合成中
  if (stage === "uploading" || stage === "compositing") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-team-processing">
        <UploadingView />
        <p className="text-sm text-muted-foreground">
          {stage === "uploading" ? "上傳所有隊員照片..." : "合成團體照..."}
        </p>
      </div>
    );
  }

  // 相機狀態
  if (stage === "shooting") {
    if (camera.mode === "initializing" || !camera.cameraReady) {
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
            拍第 {currentIdx + 1} / {memberCount} 位：{currentName.trim() || `隊員 ${currentIdx + 1}`}
          </div>
        </div>
      );
    }
    if (camera.mode === "preview") {
      return (
        <PhotoPreview
          imageSrc={camera.capturedImage!}
          onRetake={camera.retake}
          onSubmit={() => { /* effect 處理 */ }}
        />
      );
    }
  }

  // 過場：拍完一位 → 預覽 → 下一位 / 完成
  if (stage === "transition") {
    const current = members[currentIdx];
    const isLast = currentIdx + 1 >= memberCount;
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-team-transition">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        <h2 className="text-xl font-bold">
          {current?.name} 拍好了！
        </h2>
        <p className="text-sm text-muted-foreground">
          {isLast ? `已拍完 ${memberCount} 位，準備合成...` : `還剩 ${memberCount - currentIdx - 1} 位`}
        </p>
        {current?.imageData && (
          <div className="max-w-xs rounded-lg overflow-hidden border">
            <img src={current.imageData} alt="" className="w-full aspect-square object-cover" />
          </div>
        )}
        <Button
          size="lg"
          className="gap-2 mt-2"
          onClick={handleNextMember}
          data-testid="btn-team-next"
        >
          {isLast ? (
            <>合成團體照 <ArrowRight className="w-5 h-5" /></>
          ) : (
            <>拍下一位 <ArrowRight className="w-5 h-5" /></>
          )}
        </Button>
      </div>
    );
  }

  // 選擇實際隊員數（若 min < max）
  if (stage === "select_count") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-team-select-count">
        <Users className="w-12 h-12 text-primary" />
        <h2 className="text-2xl font-bold">實際幾位隊員？</h2>
        <div className="flex flex-wrap gap-2 justify-center max-w-sm">
          {Array.from({ length: maxMembers - minMembers + 1 }, (_, i) => {
            const n = minMembers + i;
            return (
              <Button
                key={n}
                size="lg"
                variant={memberCount === n ? "default" : "outline"}
                onClick={() => setMemberCount(n)}
                className="w-14 h-14"
                data-testid={`btn-team-count-${n}`}
              >
                {n}
              </Button>
            );
          })}
        </div>
        <div className="w-full max-w-sm space-y-2">
          <label className="text-xs text-muted-foreground">第 1 位的名字（選填）</label>
          <Input
            value={currentName}
            onChange={(e) => setCurrentName(e.target.value)}
            placeholder="阿榮"
            maxLength={12}
            data-testid="input-team-first-name"
          />
        </div>
        <Button
          size="lg"
          className="gap-2 mt-2"
          onClick={() => {
            setCurrentIdx(0);
            handleStartShootingMember();
          }}
          data-testid="btn-team-start-shooting"
        >
          <Camera className="w-5 h-5" />
          開始拍第 1 位
        </Button>
      </div>
    );
  }

  // 介紹（預設）
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-team-intro">
      <Users className="w-12 h-12 text-primary" />
      <h2 className="text-2xl font-bold">
        {config.title || "團體合影任務"}
      </h2>
      {config.instruction && (
        <p className="text-center text-sm text-muted-foreground max-w-md">
          {config.instruction}
        </p>
      )}
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          為 <span className="font-bold text-primary">{minMembers}</span>
          {minMembers !== maxMembers && ` ~ ${maxMembers}`} 位隊員拍照
        </p>
        <p className="text-xs text-muted-foreground">
          隊長逐一為每位拍照，最後自動合成團體照
        </p>
      </div>
      <Button
        size="lg"
        className="gap-2"
        onClick={() => {
          if (minMembers === maxMembers) {
            setMemberCount(minMembers);
            setStage("select_count");   // 只是為了填第一位名字
          } else {
            setStage("select_count");
          }
        }}
        data-testid="btn-team-start"
      >
        <Camera className="w-5 h-5" />
        開始團體拍照
      </Button>
    </div>
  );
}
