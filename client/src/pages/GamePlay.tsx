import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useFieldLink } from "@/hooks/useFieldLink";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { queueProgressUpdate } from "@/lib/offlineStorage";
import { processOnCompleteActions, resolveFlowRouter } from "@/lib/flow-router";
import type { GameWithPages, Page, GameChapterWithPages, OnCompleteAction } from "@shared/schema";

import GameHeader from "@/components/shared/GameHeader";
import ChatPanel from "@/components/shared/ChatPanel";
import InventoryPanel from "@/components/shared/InventoryPanel";
import GamePageRenderer from "@/components/game/GamePageRenderer";
import GamePageErrorBoundary from "@/components/game/GamePageErrorBoundary";
import GameCompletionScreen from "@/components/game/GameCompletionScreen";
import ResumeDialog from "@/components/game/ResumeDialog";
import { useBgmPlayer } from "@/hooks/useBgmPlayer";
import { useSessionManager } from "./hooks/useSessionManager";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { WsConnectionBadge } from "@/components/shared/WsConnectionBadge";
import { speakTeamEvent, primeVoices } from "@/lib/voice-notification";
import LeaderDecideDialog from "@/components/team/LeaderDecideDialog";
import {
  RewardFeedbackOverlay,
  fireReward,
} from "@/components/feedback/RewardFeedback";
import { WalkieFloatingButton } from "@/components/walkie/WalkieFloatingButton";

import {
  ChevronLeft, ChevronRight, MessageCircle, Backpack,
  Map as MapIcon, AlertTriangle, Home
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function GamePlay() {
  const { gameId, chapterId } = useParams<{ gameId: string; chapterId?: string }>();
  const [, setLocation] = useLocation();
  const link = useFieldLink();
  const searchString = useSearch();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const isChapterMode = !!chapterId;

  // 🆕 2026-05-22 業主 docx #11/#14：
  //   - replay=true 或 restart=1 → 強制重新開始、不顯示 ResumeDialog
  //   - 由 GameBySlug 三態按鈕「重新開始 / 再玩一次」帶入
  const isReplayMode = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("replay") === "true" || params.get("restart") === "1";
  }, [searchString]);

  const [showChat, setShowChat] = useState(false);
  // 🆕 F1: 離開遊戲確認 Dialog
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showInventory, setShowInventory] = useState(false);

  const { data: game, isLoading: gameLoading, error: gameError } = useQuery<GameWithPages>({
    queryKey: ["/api/games", gameId],
  });

  // 🆕 多人遊戲時拿 my-team 用來「自願離開」呼叫 /leave 設 leftAt
  //   solo mode → my-team 為 null，跳過 leave API（直接 setLocation 即可）
  //   leaderId 給 leader-decide dialog 判斷我是不是隊長用
  const { data: myTeam } = useQuery<{ id: string; leaderId: string | null } | null>({
    queryKey: ["/api/games", gameId, "my-team"],
    enabled: !!gameId,
  });

  // 🆕 leader-decide：寬限期過的玩家（隊長收到時設值，顯示 dialog）
  const [pendingDecisionTarget, setPendingDecisionTarget] = useState<
    { userId: string; userName: string } | null
  >(null);
  const [decidePending, setDecidePending] = useState(false);

  const handleLeaderDecide = useCallback(
    async (action: "wait" | "continue") => {
      if (!myTeam?.id || !pendingDecisionTarget) return;
      setDecidePending(true);
      try {
        await apiRequest("POST", `/api/teams/${myTeam.id}/leader-decide`, {
          targetUserId: pendingDecisionTarget.userId,
          action,
        });
        // pendingDecisionTarget 由 onLeaderDecide WS 廣播觸發後才清空
      } catch (err) {
        const msg = err instanceof Error ? err.message : "決定失敗";
        toast({ title: "決定失敗", description: msg, variant: "destructive" });
      } finally {
        setDecidePending(false);
      }
    },
    [myTeam?.id, pendingDecisionTarget, toast],
  );

  // 🆕 Phase 2.B：拿隊伍當前進度（給進入時自動跳到最快頁面）
  //   server schema 不一致時 retry: false 避免無謂重試（玩家仍能玩自己進度）
  const { data: activeSession } = useQuery<{ sessionId: string; maxPageIndex: number } | null>({
    queryKey: ["/api/teams", myTeam?.id, "active-session"],
    enabled: !!myTeam?.id,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/teams/${myTeam!.id}/active-session`, {
        credentials: "include",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("查詢隊伍進度失敗");
      return res.json();
    },
  });

  // 章節模式：載入章節頁面
  const { data: chapterData } = useQuery<GameChapterWithPages>({
    queryKey: ["/api/games", gameId, "chapters", chapterId],
    enabled: isChapterMode && !!gameId && !!chapterId,
  });

  // 章節模式下使用章節頁面，否則使用全部頁面
  const activePages: Page[] = useMemo(() => {
    if (isChapterMode && chapterData?.pages) {
      return [...chapterData.pages].sort((a, b) => a.pageOrder - b.pageOrder);
    }
    return game?.pages ?? [];
  }, [isChapterMode, chapterData?.pages, game?.pages]);

  const {
    sessionId, score, inventory, variables,
    currentPageIndex, isCompleted, completedPageIds,
    stateRef, activePagesRef,
    setState, resetAndCreateNew,
    hasRestoredProgress,
    pendingDecision,
    confirmContinue,
    existingProgressInfo,
  } = useSessionManager({
    gameId,
    userId: user?.id,
    isReplayMode,
    activePages,
    userName: user?.firstName || "玩家",
  });

  // 🆕 2026-05-12 #5: pendingDecision = true → 顯示 ResumeDialog 在遊戲頁面之前
  //   useSessionManager 偵測有實質進度的 existingSession 時 setPendingDecision(true)
  //   玩家選「繼續」→ confirmContinue() / 選「重新開始」→ resetAndCreateNew()
  //   兩種選擇後 dialog 自動關閉、進遊戲流程
  const showResumeDialog = pendingDecision && !isReplayMode;
  const pendingProgressIndex = existingProgressInfo?.currentPageId
    ? activePages.findIndex((p) => p.id === existingProgressInfo.currentPageId)
    : -1;

  const currentPage = activePages[currentPageIndex];
  const totalPages = activePages.length;
  const progressPercent = totalPages > 0 ? ((currentPageIndex + 1) / totalPages) * 100 : 0;

  // 🆕 2026-05-16 #9：玩家訪問歷史 stack（解決跳轉後上一頁回不到 jump source 的問題）
  // 業主回報：流程 #2 → #7（跳轉）時上一頁應回 #2、不是 page order #6
  // 🐛 2026-05-18：改用 localStorage 持久化（業主回報重整後 stack 消失）
  const stackKey = sessionId ? `chito:visitStack:${sessionId}` : null;
  const visitStackRef = useRef<number[]>([]);

  // 初始化：從 localStorage 讀
  useEffect(() => {
    if (!stackKey) return;
    try {
      const stored = localStorage.getItem(stackKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          visitStackRef.current = parsed.filter((n) => typeof n === "number");
        }
      }
    } catch { /* ignore */ }
  }, [stackKey]);

  // 紀錄訪問 + 持久化
  useEffect(() => {
    const stack = visitStackRef.current;
    if (stack[stack.length - 1] !== currentPageIndex) {
      stack.push(currentPageIndex);
      if (stack.length > 50) stack.shift();
      // 🆕 寫入 localStorage（重整還在）
      if (stackKey) {
        try {
          localStorage.setItem(stackKey, JSON.stringify(stack));
        } catch { /* 隱私模式可能拒寫 */ }
      }
    }
  }, [currentPageIndex, stackKey]);

  const goBackByVisitStack = () => {
    const stack = visitStackRef.current;
    if (stack.length < 2) {
      setState(prev => ({ ...prev, currentPageIndex: Math.max(0, prev.currentPageIndex - 1) }));
      return;
    }
    stack.pop();
    const previousIndex = stack[stack.length - 1];
    setState(prev => ({ ...prev, currentPageIndex: previousIndex }));
    // 🆕 同步寫回 localStorage
    if (stackKey) {
      try {
        localStorage.setItem(stackKey, JSON.stringify(stack));
      } catch { /* ignore */ }
    }
  };

  // 🆕 2026-05-07 K.2 + N.1：BGM 兩層覆蓋
  //   game.bgmUrl 整場 BGM（fallback）
  //   currentPage.config.bgmUrl 元件個別 BGM（覆蓋 game、優先）
  //   兩者皆無 → 停 BGM
  const bgm = useBgmPlayer();
  const gameBgmUrl = (game as { bgmUrl?: string | null } | undefined)?.bgmUrl ?? null;
  const gameBgmVolume = (game as { bgmVolume?: number | null } | undefined)?.bgmVolume ?? 50;
  const pageBgmUrl =
    (currentPage?.config as { bgmUrl?: string | null } | undefined)?.bgmUrl ?? null;
  useEffect(() => {
    // page 級優先、否則用 game 級
    const url = pageBgmUrl || gameBgmUrl || null;
    bgm.setBgmUrl(url);
    return () => {
      bgm.setBgmUrl(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameBgmUrl, pageBgmUrl]);

  // 🆕 2026-05-12 #11: 套用 game.bgmVolume 到 BGM player
  useEffect(() => {
    bgm.setNormalVolume(gameBgmVolume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameBgmVolume]);

  // 🆕 Phase 3：首次掛載時 prime SpeechSynthesis voices（Chrome 需要）
  useEffect(() => {
    primeVoices();
  }, []);

  // 🆕 Phase 2a：遊戲中也訂閱 team WS，顯示隊友離線/重連/離開 toast（存在感）
  //   solo mode → myTeam 為 null，hook 內部 effect 會跳過建立連線
  // 🆕 Phase 2.B：訂閱 team_progress_advance → 慢的玩家自動跟上最快進度
  const { isConnected: isTeamWsConnected, isReconnecting: isTeamWsReconnecting } = useTeamWebSocket({
    teamId: myTeam?.id,
    userId: user?.id,
    userName: user?.firstName || user?.email?.split("@")[0] || "玩家",
    onMemberDisconnected: (userId, userName) => {
      toast({
        title: `⚠️ ${userName} 暫時離線`,
        description: "30 秒寬限期內回來不影響",
        duration: 3000,
      });
      speakTeamEvent(userId, userName, "disconnected");
    },
    onMemberReconnected: (userId, userName) => {
      toast({
        title: `✅ ${userName} 回來了`,
        duration: 2000,
      });
      speakTeamEvent(userId, userName, "reconnected");
    },
    onMemberLeft: (userId, userName) => {
      toast({
        title: `👋 ${userName} 已離開遊戲`,
        duration: 3000,
      });
      speakTeamEvent(userId, userName, "left");
    },
    // 🆕 Phase 2c：寬限期過了 — 倒數 2 分鐘自動 leave
    onGraceExpired: (userId, userName, autoLeaveInMs) => {
      const seconds = Math.round(autoLeaveInMs / 1000);
      toast({
        title: `⏳ ${userName} 寬限期已過`,
        description: `${seconds} 秒後將自動視為離開（隊長可介入決定）`,
        duration: 5000,
        variant: "destructive",
      });
      speakTeamEvent(userId, userName, "graceExpired");
      // 🆕 leader-decide：若我是隊長 → 開 dialog 讓決定
      if (myTeam?.leaderId === user?.id) {
        setPendingDecisionTarget({ userId, userName });
      }
    },
    // 🆕 Phase 2c+ leader-decide：隊長下決定後 ws 廣播
    onLeaderDecide: (action) => {
      if (action === "wait") {
        toast({
          title: "👑 隊長選擇等待",
          description: "繼續等離線玩家回來",
          duration: 4000,
        });
      } else {
        toast({
          title: "👑 隊長選擇先繼續",
          description: "離線玩家已標為離開",
          duration: 4000,
        });
      }
      setPendingDecisionTarget(null);
    },
    onProgressAdvance: (newMax, advancedBy) => {
      // 自己引發的 advance 不要再跳（已經在 newMax 頁面了）
      if (advancedBy === user?.id) return;
      setState((prev) => {
        if (newMax <= prev.currentPageIndex) return prev;
        // 跳到隊伍最快進度，跳過的頁面標 visited 不重複出現
        const skippedIds = activePagesRef.current
          .slice(prev.currentPageIndex, newMax)
          .map((p) => p.id);
        toast({
          title: "🏃 跟上隊伍進度",
          description: `跳過 ${skippedIds.length} 頁，跟上最快的隊友`,
          duration: 2500,
        });
        return {
          ...prev,
          currentPageIndex: Math.min(newMax, activePagesRef.current.length - 1),
          completedPageIds: Array.from(new Set([...prev.completedPageIds, ...skippedIds])),
        };
      });
    },
  });

  // 🆕 Phase 2.B：玩家自己往前 → 呼叫 advance API（server 用 Math.max 更新隊伍 max）
  //   失敗不阻塞遊戲（離線可重連時補上）
  const lastAdvancedIndexRef = useRef(-1);
  useEffect(() => {
    if (!myTeam?.id) return;
    if (currentPageIndex <= lastAdvancedIndexRef.current) return;
    lastAdvancedIndexRef.current = currentPageIndex;
    apiRequest("POST", `/api/teams/${myTeam.id}/advance-progress`, {
      pageIndex: currentPageIndex,
    }).catch(() => {
      /* advance 失敗不阻塞遊戲 */
    });
  }, [currentPageIndex, myTeam?.id]);

  // 🆕 Phase 2.B：進入遊戲時，若隊伍 maxPageIndex > 自己 → 跳上去
  //   只在 maxPageIndex 第一次有值 + currentPageIndex 還很前面時觸發（避免覆蓋使用者操作）
  const hasJumpedToTeamMaxRef = useRef(false);
  useEffect(() => {
    if (hasJumpedToTeamMaxRef.current) return;
    if (!activeSession || !activePages.length) return;
    const teamMax = activeSession.maxPageIndex;
    if (teamMax > currentPageIndex) {
      hasJumpedToTeamMaxRef.current = true;
      const skippedIds = activePages.slice(currentPageIndex, teamMax).map((p) => p.id);
      toast({
        title: "🏃 跟上隊伍進度",
        description: `從第 ${currentPageIndex + 1} 頁跳到第 ${teamMax + 1} 頁`,
        duration: 3000,
      });
      setState((prev) => ({
        ...prev,
        currentPageIndex: Math.min(teamMax, activePages.length - 1),
        completedPageIds: Array.from(new Set([...prev.completedPageIds, ...skippedIds])),
      }));
    }
  }, [activeSession, activePages.length, currentPageIndex, setState, toast]);

  // 玩家已造訪的位置（供 ConditionalVerifyPage 的 visited_location 條件判定）
  const { data: visitsData } = useQuery<Array<{ locationId: string | number }>>({
    queryKey: [`/api/sessions/${sessionId}/visits`],
    enabled: !!sessionId,
  });

  const visitedLocations: string[] = useMemo(() => {
    if (!Array.isArray(visitsData)) return [];
    return visitsData.map((v) => String(v.locationId));
  }, [visitsData]);

  // 道具 name lookup（給 RewardFeedback 顯示用）
  const { data: gameItems } = useQuery<Array<{ id: string; name: string; iconUrl?: string | null }>>({
    queryKey: [`/api/games/${gameId}/items`],
    enabled: !!gameId,
    staleTime: 60_000,
  });
  const itemIdToInfo = useMemo(() => {
    const map = new Map<string, { name: string; iconUrl?: string | null }>();
    for (const it of gameItems ?? []) {
      map.set(it.id, { name: it.name, iconUrl: it.iconUrl });
    }
    return map;
  }, [gameItems]);

  // === 遊戲/章節完成處理 ===
  const handleCompletion = useCallback((finalScore: number) => {
    const sid = stateRef.current.sessionId;
    if (!sid) return;
    if (isChapterMode) {
      apiRequest("PATCH", `/api/sessions/${sid}/chapter-complete`, { score: finalScore })
        .then(() => {
          setState(prev => ({ ...prev, isCompleted: true }));
          toast({ title: "章節完成!", description: `得分: ${finalScore} 分` });
        });
    } else {
      apiRequest("PATCH", `/api/sessions/${sid}`, { status: "completed", score: finalScore })
        .then(() => {
          setState(prev => ({ ...prev, isCompleted: true }));
          toast({ title: "恭喜通關!", description: `最終得分: ${finalScore} 分` });
        });
    }
  }, [isChapterMode, toast, stateRef, setState]);

  // === 頁面完成 → 更新分數/道具/變數 → 導航 ===
  // 防線：若子元件仍漏網雙觸發，GamePlay 用 ref 做 window-based 節流（150ms）
  // 避免玩家跳過一頁或重複加分。正常單次呼叫不受影響。
  const lastCompleteAtRef = useRef(0);
  const handlePageComplete = useCallback((reward?: { points?: number; items?: string[] }, nextPageId?: string) => {
    const now = Date.now();
    if (now - lastCompleteAtRef.current < 150) {
      // DEV 模式警示：雙觸發屬於 bug，不應該正常發生
      if ((import.meta as any).env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[GamePlay] handlePageComplete 雙觸發已被節流", { reward, nextPageId });
      }
      return;
    }
    lastCompleteAtRef.current = now;

    const currentState = stateRef.current;
    const pages = activePagesRef.current;
    let newScore = currentState.score;
    let newInventory = [...currentState.inventory];
    let newVariables = { ...currentState.variables };

    // 1. 處理 reward（現有邏輯）
    if (reward?.points) newScore += reward.points;
    if (reward?.items) newInventory = [...newInventory, ...reward.items];

    // 2. 處理 onCompleteActions（通用變數/道具/分數操作）
    const currentPage = pages[currentState.currentPageIndex];
    if (currentPage) {
      const cfg = currentPage.config as Record<string, unknown>;
      const actions = (cfg.onCompleteActions || []) as OnCompleteAction[];
      if (actions.length > 0) {
        const result = processOnCompleteActions(actions, newVariables, newInventory, newScore);
        newVariables = result.variables;
        newInventory = result.inventory;
        newScore = result.score;
      }
    }

    // 2.5 觸發獎勵反饋 — 讓玩家看到「剛剛發生了什麼」
    const pointsDelta = newScore - currentState.score;
    const newItemIds = newInventory.filter(
      (id) => !currentState.inventory.includes(id),
    );
    if (pointsDelta > 0 || newItemIds.length > 0) {
      // 🔍 fallback warn：若 itemId 在 game items 中找不到（被刪 / 跨遊戲污染）
      newItemIds.forEach((id) => {
        if (!itemIdToInfo.get(id)) {
          console.warn(
            `[GamePlay] itemId ${id} 不在當前遊戲的 items 列表中，可能是孤兒 ID（item 被刪 / DB 污染）`,
          );
        }
      });
      fireReward({
        points: pointsDelta > 0 ? pointsDelta : undefined,
        items: newItemIds.map((id) => ({
          name: itemIdToInfo.get(id)?.name || `❓ 未知道具`,
          iconUrl: itemIdToInfo.get(id)?.iconUrl ?? undefined,
        })),
      });
    }

    // 3. 遊戲結束特殊指令
    if (nextPageId === "_end") {
      setState(prev => ({ ...prev, score: newScore, inventory: newInventory, variables: newVariables }));
      handleCompletion(newScore);
      return;
    }

    // 4. 導航到下一頁（含 flow_router 解析）
    setState(prev => {
      let nextIndex = prev.currentPageIndex + 1;
      if (nextPageId && pages) {
        const foundIndex = pages.findIndex(p => p.id === nextPageId);
        if (foundIndex !== -1) nextIndex = foundIndex;
      }

      // 🆕 標記當前頁為已完成
      const completedPage = pages[prev.currentPageIndex];
      const newCompletedIds = completedPage
        ? Array.from(new Set([...prev.completedPageIds, completedPage.id]))
        : prev.completedPageIds;

      // 解析連續的 flow_router 頁面
      const resolvedIndex = resolveFlowRouter(pages, nextIndex, newVariables, newInventory, newScore);
      if (resolvedIndex === -1) {
        handleCompletion(newScore);
        return { ...prev, score: newScore, inventory: newInventory, variables: newVariables, completedPageIds: newCompletedIds };
      }

      if (resolvedIndex < pages.length) {
        const nextPage = pages[resolvedIndex];
        if (nextPage && prev.sessionId) {
          const progressData = {
            sessionId: prev.sessionId,
            pageId: nextPage.id,
            score: newScore,
            inventory: newInventory,
            variables: newVariables,
          };
          if (navigator.onLine) {
            apiRequest("PATCH", `/api/sessions/${prev.sessionId}/progress`, {
              pageId: nextPage.id,
              score: newScore,
              inventory: newInventory,
              variables: newVariables,
            })
              .then(async (res) => {
                // 後端回傳即時解鎖的成就 → 用 RewardFeedback 推播
                try {
                  const data = await res.json();
                  const unlocked = (data?.unlockedAchievements || []) as Array<{
                    id: number;
                    name: string;
                    iconUrl?: string | null;
                    rarity?: string | null;
                  }>;
                  if (unlocked.length > 0) {
                    // 延遲 1s 讓 points/items 反饋先顯示，再推播成就（避免重疊）
                    setTimeout(() => {
                      fireReward({
                        achievements: unlocked.map((a) => ({
                          name: a.name,
                          iconUrl: a.iconUrl ?? undefined,
                          rarity: a.rarity ?? undefined,
                        })),
                      });
                    }, 1000);
                  }
                } catch {
                  /* 舊版 API 無 unlockedAchievements，跳過 */
                }
              })
              .catch(() => queueProgressUpdate(progressData));
          } else {
            queueProgressUpdate(progressData);
          }
        }
        return { ...prev, score: newScore, inventory: newInventory, variables: newVariables, currentPageIndex: resolvedIndex, completedPageIds: newCompletedIds };
      }
      handleCompletion(newScore);
      return { ...prev, score: newScore, inventory: newInventory, variables: newVariables, completedPageIds: newCompletedIds };
    });
  }, [stateRef, activePagesRef, setState, handleCompletion, itemIdToInfo]);

  // 🆕 2026-05-16 #7：預覽模式強制過關事件監聽
  // PreviewNavBar 按「強制過關」→ dispatch CustomEvent → 此 useEffect 呼叫 handlePageComplete
  useEffect(() => {
    const handler = () => {
      if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
        console.log("[GamePlay] preview-force-complete 觸發");
      }
      handlePageComplete();
    };
    window.addEventListener("preview-force-complete", handler);
    return () => window.removeEventListener("preview-force-complete", handler);
  }, [handlePageComplete]);

  const handleVariableUpdate = useCallback((key: string, value: unknown) => {
    setState(prev => ({ ...prev, variables: { ...prev.variables, [key]: value } }));
  }, [setState]);

  const goToMap = useCallback(() => {
    setLocation(`/map/${gameId}?session=${sessionId}`);
  }, [gameId, sessionId, setLocation]);

  // 🆕 2026-05-12 #5: pendingDecision 時、整頁顯示 ResumeDialog（蓋遊戲頁面、玩家先選）
  //   避免 dialog 在遊戲頁面渲染後才彈、玩家先看到第一個 page 才選
  if (pendingDecision && !isReplayMode) {
    return (
      <div className="min-h-screen-dynamic bg-background flex items-center justify-center p-4">
        <ResumeDialog
          open={true}
          onContinue={() => confirmContinue()}
          onReset={() => resetAndCreateNew()}
          currentPageIndex={pendingProgressIndex >= 0 ? pendingProgressIndex : 0}
          totalPages={totalPages}
          score={existingProgressInfo?.score ?? 0}
        />
      </div>
    );
  }

  // === 載入中/錯誤/完成 狀態 ===
  if (authLoading || gameLoading) {
    return (
      <div className="min-h-screen-dynamic bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">載入任務中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/");
    return (
      <div className="min-h-screen-dynamic bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">請先登入...</p>
        </div>
      </div>
    );
  }

  if (gameError || !game) {
    return (
      <div className="min-h-screen-dynamic bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold mb-2">找不到遊戲</h2>
          <p className="text-muted-foreground mb-6">此遊戲可能已被刪除或不存在</p>
          <Button onClick={() => setLocation(link("/home"))} className="gap-2">
            <Home className="w-4 h-4" />
            返回大廳
          </Button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <GameCompletionScreen
        score={score}
        gameTitle={game.title}
        isChapterMode={isChapterMode}
        chapterTitle={chapterData?.title}
        gameId={gameId || ""}
        sessionId={sessionId || undefined}   /* 🆕 傳入以便「看本場相簿」*/
        onPlayAgain={resetAndCreateNew}
        onNavigate={setLocation}
      />
    );
  }

  return (
    <div className="gameplay-immersive min-h-screen-dynamic bg-background flex flex-col">
      <GameHeader
        title={isChapterMode && chapterData?.title ? `${game.title} - ${chapterData.title}` : game.title}
        score={score}
        onBack={() => {
          // 🆕 F1: 玩家按返回時不直接離開，先彈 Dialog 確認（避免誤觸 + 說明進度會保留）
          // 遊戲已完成時（isCompleted）照常走 GameCompletionScreen 流程，不會到這
          setShowLeaveDialog(true);
        }}
        onChat={() => setShowChat(true)}
        onMap={goToMap}
        onInventory={() => setShowInventory(true)}
        inventoryCount={inventory.length}
      />

      {/* 🆕 WS 失連警示（Stage 2 #3）多人組隊才顯示、避免玩家以為「lag」 */}
      {myTeam?.id && !isTeamWsConnected && (
        <div className={`border-b px-4 py-2 flex items-center justify-between gap-3 text-xs ${
          isTeamWsReconnecting
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-destructive/10 border-destructive/30"
        }`}>
          <WsConnectionBadge isConnected={false} isReconnecting={isTeamWsReconnecting} />
          <span className={`flex-1 ${isTeamWsReconnecting ? "text-amber-600 dark:text-amber-300" : "text-destructive"}`}>
            {isTeamWsReconnecting
              ? "正在重新連線、稍候即可繼續…"
              : "隊伍即時同步中斷、隊員操作可能不會更新到你這邊"}
          </span>
        </div>
      )}

      {/* 🆕 F1: 離開遊戲確認 Dialog
          多人：呼叫 /leave 設 leftAt → 下次回 lobby 不會被自動拉回（明確自願退出）
          單人：只更新 lastActiveAt，session 保留可繼續 */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {myTeam?.id ? "確定要離開遊戲？" : "確定要返回大廳？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {myTeam?.id
                ? "你會脫離隊伍。已獲得的分數 / 道具會保留，但隊伍進行中時不會被自動拉回。"
                : "你的進度和已獲得的分數 / 道具都會保留。從大廳的「進行中」就能接著玩。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-leave-game-cancel">繼續遊戲</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                // 更新 lastActiveAt（session 狀態保持 playing，不動 status）
                const sid = stateRef.current.sessionId;
                if (sid) {
                  apiRequest("PATCH", `/api/sessions/${sid}`, {
                    lastActiveAt: new Date().toISOString(),
                  }).catch(() => {
                    /* 離開本來就不該 block，失敗也要讓玩家離開 */
                  });
                }
                // 🆕 多人遊戲：呼叫 /leave 設 leftAt → 下次回 lobby 不會被自動拉回
                //   失敗也讓玩家走（離開不該 block）
                if (myTeam?.id) {
                  try {
                    await apiRequest("POST", `/api/teams/${myTeam.id}/leave`, {});
                    toast({ title: "已離開隊伍" });
                  } catch {
                    /* 忽略，仍讓玩家離開 */
                  }
                }
                setShowLeaveDialog(false);
                setLocation(isChapterMode ? link(`/game/${gameId}/chapters`) : link("/home"));
              }}
              data-testid="button-leave-game"
            >
              {myTeam?.id ? "離開隊伍" : "離開（保留進度）"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🆕 2026-05-16 #10：game.showProgress = false 時隱藏進度條 */}
      {(game as { showProgress?: boolean })?.showProgress !== false && (
        <div className="px-4 py-2 bg-card/50 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              進度: {currentPageIndex + 1} / {totalPages}
            </span>
            <span className="text-xs font-number text-primary">
              {Math.round(progressPercent)}%
            </span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* 🆕 2026-05-22 業主 docx #3：字級切換無效根因 — game-prose class 零元件用
          把 class 加到 main、後代繼承 → 字級切換有感 */}
      <main className="flex-1 relative overflow-hidden game-prose">
        {currentPage && (
          // 🛡️ ErrorBoundary 防止單頁 crash 導致整個遊戲白屏
          //   page.id key 讓換頁時重新建立 ErrorBoundary（舊 error 清掉）
          <GamePageErrorBoundary
            key={currentPage.id}
            pageType={currentPage.pageType}
            onSkip={() => handlePageComplete()}
          >
            <GamePageRenderer
              page={currentPage}
              onComplete={handlePageComplete}
              onVariableUpdate={handleVariableUpdate}
              sessionId={sessionId || ""}
              gameId={gameId || ""}
              variables={variables}
              inventory={inventory}
              score={score}
              visitedLocations={visitedLocations}
            />
          </GamePageErrorBoundary>
        )}
      </main>

      {/* 🎉 獎勵反饋覆蓋層 — 每當 handlePageComplete 偵測到分數/道具增加時顯示 */}
      <RewardFeedbackOverlay />

      {/* 📻 對講機浮動按鈕（玩家可跟隊友語音） */}
      {/* hasTeam=true：多人模式自動連 session 對講群、不必手動點 */}
      {/* hasTeam=false：單人模式不自動連、玩家可透過 QR 邀請朋友建組（沒需求就不用）*/}
      {!isCompleted && (
        <WalkieFloatingButton
          sessionId={sessionId}
          gameId={gameId}
          enabled
          hasTeam={!!myTeam?.id}
        />
      )}

      {/* 🐛 2026-05-22 業主 docx #14：移除 runtime 層 ResumeDialog
          原本 line 583 已 early return 整頁覆蓋、line 789 是冗餘渲染
          業主回報「進入遊戲後又彈進度提示」就是這裡造成（玩家進遊戲後 query 重 fetch 又彈）
          正確：只在進場前彈一次（line 583 early return）、玩家做決定後永不再彈 */}

      {(() => {
        // 🔒 導航規則：
        // - 上一頁：只要不是第 0 頁就能回顧（已完成或進行中都行）
        // - 下一頁：當前頁必須已完成（在 completedPageIds 中）才能前進
        //   → 防止玩家「什麼都沒做就拿碎片」的漏洞
        const currentPageId = currentPage?.id;
        const currentPageCompleted = currentPageId
          ? completedPageIds.includes(currentPageId)
          : false;
        // 如果下一個 index 的頁面也已完成，代表玩家是「回顧」模式可以純導航
        const nextPageId = activePages[currentPageIndex + 1]?.id;
        const nextPageCompleted = nextPageId ? completedPageIds.includes(nextPageId) : false;
        // 可前進條件：當前頁已完成，或下一頁也已完成（代表是回顧）
        const canAdvance = currentPageCompleted || nextPageCompleted;

        const goNext = () => {
          if (!canAdvance) {
            toast({
              title: "請先完成當前任務",
              description: "完成此頁任務後才能前進下一關",
              variant: "destructive",
            });
            return;
          }
          // 已完成 → 純導航，不觸發 handlePageComplete（避免重複發獎勵）
          setState((prev) => ({
            ...prev,
            currentPageIndex: Math.min(totalPages - 1, prev.currentPageIndex + 1),
          }));
        };

        return (
      <nav className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-4 py-3 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={goBackByVisitStack}
          disabled={visitStackRef.current.length < 2 && currentPageIndex === 0}
          className="gap-1"
          data-testid="button-prev-page"
          aria-label="回到上一個訪問的頁面"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          上一頁
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowChat(true)} data-testid="button-open-chat">
            <MessageCircle className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowInventory(true)}
            className="relative"
            data-testid="button-open-inventory"
          >
            <Backpack className="w-5 h-5" />
            {inventory.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                {inventory.length}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={goToMap} data-testid="button-open-map">
            <MapIcon className="w-5 h-5" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={goNext}
          disabled={currentPageIndex >= totalPages - 1 || !canAdvance}
          title={!canAdvance ? "請先完成當前任務" : undefined}
          className="gap-1"
          data-testid="button-next-page"
        >
          下一頁
          <ChevronRight className="w-4 h-4" />
        </Button>
      </nav>
        );
      })()}

      {showChat && sessionId && (
        <ChatPanel
          sessionId={sessionId}
          userId={user.id}
          userName={user.firstName || user.email?.split("@")[0] || "玩家"}
          onClose={() => setShowChat(false)}
        />
      )}

      {showInventory && (
        <InventoryPanel
          items={inventory}
          gameId={gameId}
          onClose={() => setShowInventory(false)}
        />
      )}

      {/* 🆕 Phase 2c+ leader-decide dialog（多人遊戲中隊長介入） */}
      <LeaderDecideDialog
        open={!!pendingDecisionTarget}
        targetUserName={pendingDecisionTarget?.userName ?? null}
        onWait={() => handleLeaderDecide("wait")}
        onContinue={() => handleLeaderDecide("continue")}
        onCancel={() => setPendingDecisionTarget(null)}
      />
    </div>
  );
}
