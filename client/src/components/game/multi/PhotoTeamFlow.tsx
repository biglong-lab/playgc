// 👥 PhotoTeamFlow — 團體合影路由元件
//
// 2026-05-05 重構：依 captureMode 路由到不同實作
//   'gather'（新預設）：→ PhotoTeamGather（集合 → 5 秒倒數 → 拍 1-5 張、不合成）
//   'collage'（舊）：→ 現檔內邏輯（逐位拍 N 張、Cloudinary 合成拼貼）
//   undefined（既有遊戲）：fallback 'collage'（向後兼容）
//
// 舊版註解（collage 模式）：
//   1. 介紹 + 選擇實際隊員數（minMembers ~ maxMembers）
//   2. 依序為每個隊員拍一張
//   3. 每張拍完按「下一位」
//   4. 全拍完上傳 → 合成拼貼圖
//   5. 顯示結果 + 下載 / 分享 / 繼續
// （collage 已知問題：cloudinary 偶發卡 86%、有 30s timeout fallback）

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Camera, CheckCircle2, Download, Share2, Users, ArrowRight, AlertTriangle, Image as ImageIcon, RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestWithTimeout } from "@/lib/queryClient";
import { usePhotoCamera } from "../photo-mission/usePhotoCamera";
import { savePhotoToAlbum, getSaveToastMessage } from "@/lib/photo-save";
import { reportClientEvent } from "@/lib/event-report";
import {
  CameraInitializingView, CameraView, PhotoPreview, UploadingView,
} from "../photo-mission/PhotoViews";
import PhotoSuccessView from "../photo-mission/PhotoSuccessView";
import PhotoTeamGather from "./PhotoTeamGather";
import type { PhotoMissionConfig } from "@shared/schema";

interface PhotoTeamFlowProps {
  config: PhotoMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  variables?: Record<string, unknown>;
  onVariableUpdate?: (key: string, value: unknown) => void;
  /** 🆕 2026-05-05: gather 模式 server-driven 持久化用 */
  pageId?: string;
}

type Stage = "intro" | "select_count" | "shooting" | "transition" | "uploading" | "compositing" | "done";

interface MemberShot {
  name: string;
  imageData: string;
  publicId?: string;
}

export default function PhotoTeamFlow(props: PhotoTeamFlowProps) {
  // 🔒 2026-05-10: 全面強制走 gather（含隊長鎖）
  //   原因：業主回報「合照只能隊長拍」、collage 模式逐位拍 N 張無法套用隊長鎖
  //   既有 admin 設定 captureMode='collage' 也統一走 gather、行為一致整齊
  //   PhotoTeamCollage 程式碼保留作向後兼容（未啟用、未來可評估刪除）
  if (props.config.teamConfig?.captureMode === "collage") {
    console.warn(
      "[PhotoTeamFlow] captureMode='collage' 已 deprecated、自動走 gather 模式",
    );
  }
  return (
    <PhotoTeamGather
      config={props.config}
      onComplete={props.onComplete}
      sessionId={props.sessionId}
      gameId={props.gameId}
      pageId={(props as { pageId?: string }).pageId}
    />
  );
}

function PhotoTeamCollage({
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

  // 🆕 上傳/合成進度顯示（避免玩家誤以為卡住）
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [progressMessage, setProgressMessage] = useState("");

  const finishedRef = useRef(false);
  const cancelRef = useRef(false);

  // 🛡️ 2026-05-04: 改為 imperative — 玩家在 PhotoPreview 點「確認」才存進 members
  //   原 useEffect 監聽 camera.capturedImage 有 race 問題：
  //   切換到下一位時 capturedImage 還沒被 React 清乾淨、useEffect 誤觸發又存一張、
  //   造成「選 2 人但每人拍 2 張」的 bug。
  //   改 imperative + ref 雙重防重複（即時 lock、不等 React state batching）
  const confirmingRef = useRef(false);
  const handleConfirmShot = () => {
    if (confirmingRef.current) return;
    if (!camera.capturedImage) return;
    confirmingRef.current = true;
    const next: MemberShot = {
      name: currentName.trim() || `隊員 ${currentIdx + 1}`,
      imageData: camera.capturedImage,
    };
    setMembers((prev) => {
      const updated = [...prev];
      updated[currentIdx] = next;
      return updated;
    });
    camera.stopCamera();
    camera.setCapturedImage(null);
    setStage("transition");
    // 切換完釋放 lock（下一位會重新進 shooting → 重置）
    setTimeout(() => {
      confirmingRef.current = false;
    }, 200);
  };

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

      // 🛡️ 用 apiRequestWithTimeout（AbortController），背景 tab 也能 abort
      const res = await apiRequestWithTimeout(
        "POST",
        "/api/cloudinary/composite-photo",
        {
          playerPhotoPublicId: firstId,
          config,
          dynamicVars: { firstName },
        },
        30_000,
      );
      return res.json();
    },
  });

  // 🆕 2026-05-04: 合成倒數計時（讓使用者看到「還有幾秒會自動 fallback」）
  const [compositeRemaining, setCompositeRemaining] = useState<number | null>(null);

  // 上傳階段：所有照片上傳到 Cloudinary → 合成
  // 🐛 修：加 timeout + 改進 fallback 邏輯（不再呼叫同一個壞掉的端點）
  // 🆕 加 AbortController（背景 tab 也能 abort）+ 進度顯示 + 取消按鈕
  // 🛡️ 2026-05-04 加：合成階段 hard timeout 30s 強制 fallback（保證不卡住）
  useEffect(() => {
    if (stage !== "uploading") return;
    let cancelled = false;
    cancelRef.current = false;
    setUploadProgress({ current: 0, total: members.length });
    setProgressMessage("準備上傳...");

    // 取首張照片 dataURL 當失敗的 fallback（不依賴後端合成）
    const firstMemberDataUrl = members[0]?.imageData ?? null;

    (async () => {
      try {
        const uploaded: { publicId: string; url: string }[] = [];
        for (let i = 0; i < members.length; i++) {
          if (cancelled || cancelRef.current) return;
          const m = members[i];
          setUploadProgress({ current: i + 1, total: members.length });
          setProgressMessage(`上傳 ${m.name}（第 ${i + 1}/${members.length} 張）...`);

          // 🛡️ 單張上傳 timeout 25 秒（apiRequestWithTimeout 用 AbortController，背景 tab 也有效）
          let res: Response;
          try {
            res = await apiRequestWithTimeout(
              "POST",
              "/api/cloudinary/player-photo",
              { imageData: m.imageData, gameId, sessionId },
              25_000,
            );
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
              throw new Error(`第 ${i + 1} 張上傳超時（25 秒）`);
            }
            throw err;
          }
          const data = (await res.json()) as { publicId: string; url: string };
          uploaded.push(data);
        }
        if (cancelled || cancelRef.current) return;

        setStage("compositing");
        setProgressMessage("合成團體照中...");

        // 🛡️ 2026-05-04 hard timeout 30 秒倒數 + 強制 fallback
        //   原 30s timeout 仰賴 apiRequestWithTimeout AbortController、但 Cloudinary
        //   偶發 hang 時 fetch 不一定 abort → 用獨立 setTimeout 保證 fallback 觸發
        setCompositeRemaining(30);
        const tickTimer = setInterval(() => {
          setCompositeRemaining((s) => (s === null ? null : Math.max(s - 1, 0)));
        }, 1000);
        const hardTimer = setTimeout(() => {
          if (cancelled || cancelRef.current) return;
          clearInterval(tickTimer);
          // 強制 fallback：用第一張上傳的 url
          if (uploaded.length > 0) {
            setCompositeUrl(uploaded[0].url);
            toast({
              title: "合成超時，使用首張代替",
              description: "已逾 30 秒、自動用首張隊員照片繼續",
            });
            setStage("done");
          } else if (firstMemberDataUrl) {
            setCompositeUrl(firstMemberDataUrl);
            setStage("done");
          }
          cancelRef.current = true; // 阻止後續 mutate 結果再覆蓋 state
          // 🆕 2026-05-05: 上報「合成超時」事件
          reportClientEvent({
            event: "cloudinary_composite_timeout",
            message: `團體合成 30s 超時、用首張代替`,
            context: { gameId, sessionId, memberCount: members.length },
          });
        }, 30_000);

        try {
          const comp = await compositeMutation.mutateAsync(
            uploaded.map((u) => u.publicId),
          );
          clearInterval(tickTimer);
          clearTimeout(hardTimer);
          setCompositeRemaining(null);
          if (cancelled || cancelRef.current) return;
          setCompositeUrl(comp.compositeUrl);
        } catch (err) {
          clearInterval(tickTimer);
          clearTimeout(hardTimer);
          setCompositeRemaining(null);
          console.warn("[Team] 合成失敗，用第一張當紀念:", err);
          // 🐛 修：fallback 直接用第一張的原始 URL，不再呼叫 composite-photo
          // （避免端點本身掛掉時 fallback 也卡住）
          if (cancelled || cancelRef.current) return;
          if (uploaded.length > 0) {
            setCompositeUrl(uploaded[0].url);
            toast({
              title: "合成失敗，使用首張代替",
              description: "可能是 Cloudinary 處理超時，已用首張隊員照片繼續",
            });
          } else if (firstMemberDataUrl) {
            // 上傳成功但合成失敗 → 用本地 dataURL（最後保險）
            setCompositeUrl(firstMemberDataUrl);
          }
        }
        if (!cancelled && !cancelRef.current) setStage("done");
      } catch (err) {
        if (cancelled || cancelRef.current) return;
        console.error("[Team] 上傳階段失敗:", err);
        toast({
          title: "上傳失敗",
          description: err instanceof Error ? err.message : "請檢查網路",
          variant: "destructive",
        });
        // 🐛 修：上傳失敗也提供繼續選項（不要直接回 intro 讓玩家重來）
        if (firstMemberDataUrl) {
          setCompositeUrl(firstMemberDataUrl);
          setStage("done");
        } else {
          setStage("intro");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  /** 取消上傳/合成（玩家手動中斷） */
  const handleCancelUpload = () => {
    cancelRef.current = true;
    const fallbackUrl = members[0]?.imageData ?? null;
    if (fallbackUrl) {
      setCompositeUrl(fallbackUrl);
      setStage("done");
      toast({ title: "已取消", description: "用首張照片繼續" });
    } else {
      setStage("intro");
    }
  };

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
      filename: "chito-team",
      title: "CHITO 團體合照",
      text: `${memberCount} 人團體合影紀念`,
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const handleDownload = async () => {
    if (!compositeUrl) return;
    const result = await savePhotoToAlbum({
      url: compositeUrl,
      filename: "chito-team",
      forceMethod: "download",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const handleShare = async () => {
    if (!compositeUrl) return;
    const result = await savePhotoToAlbum({
      url: compositeUrl,
      filename: "chito-team",
      title: "CHITO 團體合照",
      text: `${memberCount} 人團體合影紀念`,
      forceMethod: "share",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════


  // 🔧 fix（2026-05-02）：teamConfig 是 schema optional，admin 拖元件但沒填欄位時
  //   不應該整個畫面 reject，下面流程已用 ?? defaults 給合理預設值（minMembers=2, maxMembers=6, layoutMode='grid'）
  //   原本「缺少 teamConfig 設定」紅字頁卡住玩家。

  // 完成（共用 PhotoSuccessView）
  if (stage === "done" && compositeUrl) {
    return (
      <PhotoSuccessView
        imageUrl={compositeUrl}
        title="團體合影完成！"
        subtitle={`${memberCount} 位隊員：${members.map((m) => m.name).join("、")}`}
        downloadPrefix="chito-team"
        onContinue={handleContinue}
        testId="photo-team-done"
      />
    );
  }

  // 上傳/合成中
  if (stage === "uploading" || stage === "compositing") {
    const pct =
      uploadProgress.total > 0
        ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
        : 0;
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-team-processing">
        <UploadingView />
        <p className="text-sm font-medium text-foreground">
          {progressMessage || (stage === "uploading" ? "上傳所有隊員照片..." : "合成團體照...")}
        </p>
        {stage === "uploading" && uploadProgress.total > 0 && (
          <div className="w-full max-w-xs">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2 tabular-nums">
              {uploadProgress.current} / {uploadProgress.total} 張（{pct}%）
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center px-4">
          請保持網路連線；單張上傳上限 25 秒、合成上限 30 秒，逾時會自動使用首張代替
        </p>
        {/* 🆕 2026-05-04: 合成階段顯示倒數秒數讓使用者知道何時 fallback */}
        {stage === "compositing" && compositeRemaining !== null && compositeRemaining > 0 && (
          <p
            className="text-xs text-amber-600 dark:text-amber-400 text-center font-medium tabular-nums"
            data-testid="composite-countdown"
          >
            ⏱ {compositeRemaining} 秒後自動使用首張照片
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancelUpload}
          data-testid="button-cancel-upload"
        >
          取消並使用首張照片
        </Button>
      </div>
    );
  }

  // 相機狀態
  // 🛡️ 2026-05-05 重構：依 camera.mode 細分、避免「mode='instruction' 但 cameraReady=false」誤觸 InitializingView 卡死
  //   原 bug：`mode==='initializing' || !cameraReady` 條件太寬、相機啟動失敗後仍卡在 InitializingView
  //   新邏輯：有 cameraError → 顯示錯誤救援 UI；mode 各狀態獨立處理
  if (stage === "shooting") {
    // 1. 啟動失敗（有 cameraError 或 mode='instruction' 沒 ready）→ 救援 UI
    if (camera.cameraError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-6 space-y-5 max-w-md mx-auto" data-testid="camera-error-rescue">
          <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold">相機無法啟動</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {camera.cameraError}
            </p>
          </div>
          <div className="w-full rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3 text-xs text-amber-800 dark:text-amber-200">
            常見原因：瀏覽器阻擋相機權限 / 桌面無 webcam / 已有其他 App 佔用相機
          </div>
          <div className="w-full grid grid-cols-1 gap-2">
            <Button
              onClick={() => camera.startCamera()}
              className="w-full gap-2"
              data-testid="btn-retry-camera"
            >
              <RotateCw className="w-4 h-4" /> 重試啟動相機
            </Button>
            <Button
              variant="outline"
              onClick={() => camera.fileInputRef.current?.click()}
              className="w-full gap-2"
              data-testid="btn-pick-from-gallery"
            >
              <ImageIcon className="w-4 h-4" /> 從相簿選擇照片
            </Button>
            <Button
              variant="ghost"
              onClick={camera.cancelCamera}
              className="w-full"
              data-testid="btn-cancel-shooting"
            >
              取消、回上一步
            </Button>
          </div>
          {/* 隱藏的 file input，「從相簿選擇」按鈕觸發 */}
          <input
            ref={camera.fileInputRef}
            type="file"
            accept="image/*"
            onChange={camera.handleFileUpload}
            className="hidden"
          />
        </div>
      );
    }
    // 🛡️ 2026-05-05: 統一取消處理 — 避免「按取消沒反應」
    //   原 bug：camera.cancelCamera() 把 mode 設 instruction、但 stage 仍 'shooting'
    //   → fallback 又 render InitializingView → 看起來「卡住」
    const cancelToIntro = () => {
      camera.stopCamera();
      camera.setCapturedImage(null);
      setStage("intro");
    };
    // 2. 啟動中（真正的 initializing）→ Loader UI（含 5 秒卡住提示、見 PhotoViews）
    if (camera.mode === "initializing") {
      return <CameraInitializingView videoRef={camera.videoRef} onCancel={cancelToIntro} />;
    }
    // 3. 相機就緒 → 拍攝 UI
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
            拍第 {currentIdx + 1} / {memberCount} 位：{currentName.trim() || `隊員 ${currentIdx + 1}`}
          </div>
        </div>
      );
    }
    // 4. 拍完預覽
    if (camera.mode === "preview") {
      return (
        <PhotoPreview
          imageSrc={camera.capturedImage!}
          onRetake={camera.retake}
          onSubmit={handleConfirmShot}
        />
      );
    }
    // 5. mode='idle' 或 'instruction'（剛 stop 還沒 start）→ Loader fallback、稍候會自動切換
    return <CameraInitializingView videoRef={camera.videoRef} onCancel={cancelToIntro} />;
  }

  // 過場：拍完一位 → 預覽 → 下一位 / 完成
  if (stage === "transition") {
    const current = members[currentIdx];
    const isLast = currentIdx + 1 >= memberCount;
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4" data-testid="photo-team-transition">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-[pulse_1.5s_ease-in-out_infinite]" />
        <h2 className="text-xl font-bold">
          {current?.name} 拍好了！
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {isLast ? `已拍完 ${memberCount} 位，準備合成...` : `還剩 ${memberCount - currentIdx - 1} 位`}
        </p>

        {/* 🆕 進度點 — 與 BurstFlow 一致的視覺語言 */}
        <div className="flex gap-2" data-testid="team-progress-dots" role="status" aria-label="團體拍照進度">
          {Array.from({ length: memberCount }).map((_, i) => (
            <span
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i <= currentIdx
                  ? "bg-emerald-500 scale-100"
                  : "bg-muted-foreground/30 scale-90"
              }`}
            />
          ))}
        </div>

        {current?.imageData && (
          <div className="max-w-xs rounded-lg overflow-hidden border-2 border-emerald-500/40 shadow-md">
            <img src={current.imageData} alt="" className="w-full aspect-square object-cover" />
          </div>
        )}
        <Button
          size="lg"
          className="gap-2 mt-2 transition-transform active:scale-[0.97]"
          onClick={handleNextMember}
          data-testid="btn-team-next"
        >
          {isLast ? (
            <>合成團體照 <ArrowRight className="w-5 h-5" /></>
          ) : (
            <>拍下一位（第 {currentIdx + 2} 位）<ArrowRight className="w-5 h-5" /></>
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
        {/* 🆕 數字按鈕加強視覺 + 觸感 */}
        <div className="flex flex-wrap gap-2 justify-center max-w-sm">
          {Array.from({ length: maxMembers - minMembers + 1 }, (_, i) => {
            const n = minMembers + i;
            const selected = memberCount === n;
            return (
              <Button
                key={n}
                size="lg"
                variant={selected ? "default" : "outline"}
                onClick={() => setMemberCount(n)}
                className={`w-14 h-14 text-lg font-bold tabular-nums transition-all active:scale-[0.95] ${
                  selected ? "ring-2 ring-primary/40 shadow-md" : ""
                }`}
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
          className="gap-2 mt-2 transition-transform active:scale-[0.97]"
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
