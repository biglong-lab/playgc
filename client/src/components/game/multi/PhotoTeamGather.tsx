// 👥 PhotoTeamGather — 集合模式團體合照（2026-05-05 新增 + server-driven）
//
// 解決使用者問題：
//   ✓ 隊長拍完、其他人按合照題自動跳過（不再每人重拍）
//   ✓ 重整後合照不丟（DB 持久化、跨重整 / 跨裝置）
//
// 流程：
//   進場時 GET /state：
//     - state 已存在（隊長已拍）→ 直接跳「已合照」畫面 + 「繼續」按鈕
//     - state 不存在 → intro → countdown → shooting → review → 上傳 → POST /complete
//   ws 訂 photo_gather_updated → 別人拍完了即時更新 UI
//
// 端點：
//   GET  /api/team-photo-gather/state
//   POST /api/team-photo-gather/complete
// WS：
//   photo_gather_updated

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Camera, CheckCircle2, Users, ArrowRight, AlertTriangle, Image as ImageIcon, RotateCw, Plus, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestWithTimeout } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useComponentTelemetry } from "@/hooks/useComponentTelemetry";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { usePhotoCamera } from "../photo-mission/usePhotoCamera";
import { CameraInitializingView, CameraView, PhotoPreview } from "../photo-mission/PhotoViews";
import PhotoSuccessView from "../photo-mission/PhotoSuccessView";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoTeamGatherProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  pageId?: string;
}

interface TeamGatherState {
  id: string;
  team_id: string;
  session_id: string;
  page_id: string;
  completed_by_user_id: string;
  completed_by_display_name: string;
  main_photo_url: string;
  shot_count: number;
  completed_at: string;
}

interface MyTeamResponse {
  id: string;
  leaderId?: string | null;
  members: Array<{ userId: string; user?: { firstName?: string | null; lastName?: string | null; email?: string } }>;
}

type Stage = "intro" | "countdown" | "shooting" | "review" | "uploading" | "done";

export default function PhotoTeamGather({ config, onComplete, sessionId, gameId, pageId }: PhotoTeamGatherProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const camera = usePhotoCamera();
  const team = config.teamConfig;
  const maxShots = Math.max(1, Math.min(5, team?.gatherMaxShots ?? 3));
  const effectivePageId = pageId ?? "default";

  const [stage, setStage] = useState<Stage>("intro");
  const [countdown, setCountdown] = useState(5);
  const [shots, setShots] = useState<string[]>([]);   // 已拍到的照片 dataURL
  const [mainUrl, setMainUrl] = useState<string | null>(null);
  const finishedRef = useRef(false);

  // === 取得 myTeam（拿 teamId）===
  const { data: myTeam } = useQuery<MyTeamResponse | null>({
    queryKey: [`/api/games/${gameId}/my-team`],
    enabled: !!gameId && !!user,
  });
  const teamId = myTeam?.id;

  const myDisplayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.email?.split("@")[0] ||
      user.id.slice(0, 8)
    : "我";

  // 📊 Phase 1 telemetry
  const tele = useComponentTelemetry({
    componentType: "photo_team_gather",
    sessionId, userId: user?.id, teamId, pageId: effectivePageId,
  });

  // 🔒 2026-05-10: 隊長鎖 — 只有隊長能用鏡頭拍合照
  //   非隊長：等待隊長拍 → ws 訂閱 photo_gather_updated 自動跳 done
  //   隊長未設定（leaderId=null）→ 退回「任何人都能拍」舊行為（向後兼容）
  const leaderId = myTeam?.leaderId ?? null;
  const isLeader = !!user && !!leaderId && leaderId === user.id;
  const hasLeader = !!leaderId;
  const leaderMember = leaderId
    ? myTeam?.members.find((m) => m.userId === leaderId)
    : null;
  const leaderDisplayName = leaderMember
    ? [leaderMember.user?.firstName, leaderMember.user?.lastName].filter(Boolean).join(" ").trim() ||
      leaderMember.user?.email?.split("@")[0] ||
      leaderMember.userId.slice(0, 8)
    : "隊長";

  // === Team-level 合照狀態（隊長拍完全隊看到）===
  const [teamGatherState, setTeamGatherState] = useState<TeamGatherState | null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);

  // mount 時拉 team gather state
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    apiRequest(
      "GET",
      `/api/team-photo-gather/state?teamId=${encodeURIComponent(teamId)}` +
        `&sessionId=${encodeURIComponent(sessionId)}` +
        `&pageId=${encodeURIComponent(effectivePageId)}`,
    )
      .then((r) => r.json())
      .then((data: { state: TeamGatherState | null }) => {
        if (cancelled) return;
        setTeamGatherState(data.state);
        setStateLoaded(true);
        // 已有合照 → 直接跳 done
        if (data.state) {
          setMainUrl(data.state.main_photo_url);
          setStage("done");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStateLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, sessionId, effectivePageId]);

  // ws 訂閱 photo_gather_updated → 別人拍完即時更新
  const handleWsMessage = useCallback(
    (msg: { type: string }) => {
      if (msg.type !== "photo_gather_updated") return;
      const m = msg as unknown as { type: string; state: TeamGatherState };
      // 已 done 不蓋（避免自己剛拍完被別人廣播覆蓋）— 但 main_photo_url 仍要更新
      setTeamGatherState(m.state);
      // 自己還沒拍 → 跳到 done 顯示別人拍的
      if (stage !== "done" && stage !== "uploading") {
        setMainUrl(m.state.main_photo_url);
        camera.stopCamera();
        camera.setCapturedImage(null);
        setStage("done");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage],
  );

  useTeamWebSocket({
    teamId,
    userId: user?.id,
    userName: myDisplayName,
    onMessage: handleWsMessage,
  });

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
    let finalUrl = main; // fallback dataURL
    try {
      const data = await uploadMutation.mutateAsync(main);
      finalUrl = data.url;
    } catch (err) {
      console.warn("[Gather] cloudinary 上傳失敗、用本地 dataURL:", err);
      toast({
        title: "上傳失敗",
        description: "已使用本地照片繼續",
      });
    }
    setMainUrl(finalUrl);

    // 🆕 寫進 team_photo_gather DB（idempotent — 第一個寫成功、其他人 ws 收到自動跳 done）
    if (teamId) {
      try {
        const res = await apiRequest("POST", "/api/team-photo-gather/complete", {
          teamId,
          sessionId,
          pageId: effectivePageId,
          mainPhotoUrl: finalUrl,
          shotCount: shots.length,
          displayName: myDisplayName,
        });
        const data = (await res.json()) as { state: TeamGatherState | null };
        if (data.state) {
          setTeamGatherState(data.state);
          // 若 server 回的 state 不是自己（被別人搶先 INSERT）→ 採對方的主照
          if (data.state.completed_by_user_id !== user?.id) {
            setMainUrl(data.state.main_photo_url);
          }
        }
      } catch (err) {
        console.warn("[Gather] 寫 team-photo-gather 失敗（不阻塞流程）:", err);
      }
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
    // 📊 telemetry：跳過 vs 完成
    tele.reportComplete(stage === "done" ? "completed" : "skipped");
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

  // ===== Render =====

  // 完成 — 顯示主照 + 拍照者姓名（若不是自己）
  if (stage === "done" && mainUrl) {
    const tookByOther =
      teamGatherState && teamGatherState.completed_by_user_id !== user?.id;
    const subtitle = tookByOther
      ? `${teamGatherState.completed_by_display_name} 拍下了團體合照`
      : shots.length > 1
        ? `共 ${shots.length} 張留念`
        : undefined;
    return (
      <PhotoSuccessView
        imageUrl={mainUrl}
        title={tookByOther ? "團體合照已完成！" : "團體合照完成！"}
        subtitle={subtitle}
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
    // 🛡️ 2026-05-05: 統一的「取消 → 回 intro」處理（避免按了沒反應）
    //   原 bug：onCancel 只呼叫 camera.cancelCamera() 把 mode 設 instruction、
    //   但 stage 還是 'shooting'、UI fallback 又 render 同個 InitializingView →
    //   使用者體感「按取消沒反應、卡住」
    //   修法：所有取消按鈕都 stopCamera() + setCapturedImage(null) + setStage('intro')
    const cancelToIntro = () => {
      camera.stopCamera();
      camera.setCapturedImage(null);
      setStage("intro");
    };

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
            <Button variant="ghost" onClick={cancelToIntro}>取消</Button>
          </div>
          <input ref={camera.fileInputRef} type="file" accept="image/*" onChange={camera.handleFileUpload} className="hidden" />
        </div>
      );
    }
    if (camera.mode === "initializing") {
      return <CameraInitializingView videoRef={camera.videoRef} onCancel={cancelToIntro} />;
    }
    if (camera.mode === "camera") {
      return (
        <div className="relative h-full w-full">
          <CameraView
            videoRef={camera.videoRef}
            cameraReady={camera.cameraReady}
            fileInputRef={camera.fileInputRef}
            onCapture={camera.capturePhoto}
            onCancel={cancelToIntro}
            onRestart={() => camera.startCamera()}
            onSwitchCamera={camera.switchCamera}
            facingMode={camera.facingMode}
            stream={camera.stream}
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
    return <CameraInitializingView videoRef={camera.videoRef} onCancel={cancelToIntro} />;
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

  // 等待 team gather state 載入（避免 race：剛進來就拍、但其實隊長已拍過）
  if (teamId && !stateLoaded) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 space-y-3" data-testid="photo-gather-state-loading">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">同步隊伍合照狀態...</p>
      </div>
    );
  }

  // 🔒 2026-05-10: 非隊長等待頁 — 不開鏡頭、訂 ws、等隊長拍完自動跳 done
  if (hasLeader && !isLeader) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-gather-waiting-leader">
        <div className="relative">
          <Users className="w-12 h-12 text-primary" />
          <Loader2 className="w-5 h-5 text-primary absolute -bottom-1 -right-1 animate-spin" />
        </div>
        <h2 className="text-xl font-bold">{config.title || "團體合照"}</h2>
        <Card className="w-full max-w-md bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50">
          <CardContent className="p-4 text-sm space-y-2 text-blue-900 dark:text-blue-100">
            <p className="font-semibold">📸 等待隊長 {leaderDisplayName} 拍照</p>
            <ul className="text-xs space-y-1 list-disc pl-4">
              <li>請集合到隊長身邊、保持微笑</li>
              <li>隊長拍完會自動同步給全隊</li>
              <li>相機只開放給隊長使用</li>
            </ul>
          </CardContent>
        </Card>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleContinue}
          data-testid="btn-gather-skip"
          className="text-muted-foreground"
        >
          先跳過此題、稍後再拍 →
        </Button>
      </div>
    );
  }

  // intro（隊長 / 無 leaderId 向後兼容）
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-gather-intro">
      <Users className="w-12 h-12 text-primary" />
      <h2 className="text-2xl font-bold">{config.title || "團體合照"}</h2>
      {config.instruction && (
        <p className="text-center text-sm text-muted-foreground max-w-md">{config.instruction}</p>
      )}
      <Card className="w-full max-w-md bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50">
        <CardContent className="p-4 text-sm space-y-2 text-amber-900 dark:text-amber-100">
          <p className="font-semibold">
            📸 {isLeader ? "隊長拍照（整隊共享）" : "怎麼拍（只需要一個人拍、整隊共享）"}
          </p>
          <ol className="text-xs space-y-1 list-decimal pl-4">
            <li>對講機叫大家集合到隊長身邊</li>
            <li>按下「開始拍照」→ 5 秒倒數</li>
            <li>倒數結束會切到相機畫面、按快門即可</li>
            <li>可選再多拍 1-{maxShots} 張留念（不上傳，本地保留）</li>
          </ol>
          <p className="text-xs italic mt-2 opacity-80">
            💡 想留個人照？可以先「跳過此題」、之後在原頁面用相機拍個人留念。
          </p>
        </CardContent>
      </Card>
      <div className="w-full max-w-md grid gap-2">
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
        {/* 🆕 D2-c+ (2026-05-09)：先跳過此題、之後可回來補拍 — 不強制完成 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleContinue}
          data-testid="btn-gather-skip"
          className="text-muted-foreground"
        >
          先跳過此題、稍後再拍 →
        </Button>
      </div>
    </div>
  );
}
