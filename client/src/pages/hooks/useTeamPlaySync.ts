// 👥 useTeamPlaySync — GamePlay 的多人隊伍同步邏輯（抽自 GamePlay.tsx）
//
// 背景（2026-07-09 全站優化盤點 C1）：GamePlay.tsx 逼近千行紅線，
// 把「隊伍同步」這塊高內聚邏輯抽成 hook（行為不變、純搬移）：
//   - my-team 查詢（自願離開 / leader-decide 用）
//   - 帶 ?session= 重進時自動 rejoin（CHITO #ec3f612b）
//   - leader-decide 狀態與呼叫（寬限期過隊長介入）
//   - active-session 進度查詢（10s 輪詢兜底）
//   - team WS 訂閱（離線/重連/離開 toast + 進度廣播跟隊）
//   - 自己前進 → advance-progress 上報
//   - 隊伍 maxPageIndex > 自己 → 跳上去（只前進不後退）

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { speakTeamEvent } from "@/lib/voice-notification";

interface TeamPlayUser {
  id: string;
  firstName?: string | null;
  email?: string | null;
}

export interface UseTeamPlaySyncOptions<
  P extends { id: string },
  S extends { currentPageIndex: number; completedPageIds: string[] },
> {
  gameId: string | undefined;
  /** 多人共用 session（?session=）— 有值才做自動 rejoin */
  sharedSessionId: string | undefined;
  user: TeamPlayUser | null | undefined;
  currentPageIndex: number;
  activePages: P[];
  activePagesRef: MutableRefObject<P[]>;
  setState: Dispatch<SetStateAction<S>>;
}

export interface UseTeamPlaySyncResult {
  myTeam: { id: string; leaderId: string | null } | null | undefined;
  isTeamWsConnected: boolean;
  isTeamWsReconnecting: boolean;
  pendingDecisionTarget: { userId: string; userName: string } | null;
  setPendingDecisionTarget: (
    v: { userId: string; userName: string } | null,
  ) => void;
  decidePending: boolean;
  handleLeaderDecide: (action: "wait" | "continue") => Promise<void>;
}

export function useTeamPlaySync<
  P extends { id: string },
  S extends { currentPageIndex: number; completedPageIds: string[] },
>({
  gameId,
  sharedSessionId,
  user,
  currentPageIndex,
  activePages,
  activePagesRef,
  setState,
}: UseTeamPlaySyncOptions<P, S>): UseTeamPlaySyncResult {
  const { toast } = useToast();

  // 🆕 多人遊戲時拿 my-team 用來「自願離開」呼叫 /leave 設 leftAt
  //   solo mode → my-team 為 null，跳過 leave API（直接 setLocation 即可）
  //   leaderId 給 leader-decide dialog 判斷我是不是隊長用
  const { data: myTeam, isFetched: myTeamFetched } = useQuery<
    { id: string; leaderId: string | null } | null
  >({
    queryKey: ["/api/games", gameId, "my-team"],
    enabled: !!gameId,
  });

  // 🛟 2026-07-08 CHITO #ec3f612b：帶 ?session=（多人流程）重進但 my-team 回 null
  //   → 玩家曾是隊員但被 auto-leave / leader-continue 設了 leftAt
  //   → 自動嘗試 rejoin 一次（成功則 my-team 恢復、多人元件自動接回）
  const autoRejoinTriedRef = useRef(false);
  useEffect(() => {
    if (!sharedSessionId || !gameId) return; // 只處理多人共用 session 流程
    if (!myTeamFetched || myTeam) return; // 還沒查完 / 已有隊伍 → 不用
    if (autoRejoinTriedRef.current) return; // 只試一次，避免無限迴圈
    autoRejoinTriedRef.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/games/${gameId}/rejoinable-team`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const rejoinable = (await res.json()) as { teamId: string } | null;
        if (!rejoinable?.teamId) return;
        await apiRequest("POST", `/api/teams/${rejoinable.teamId}/rejoin`, {});
        queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
        toast({
          title: "✅ 已自動重新連線原隊伍",
          description: "隊伍狀態恢復中...",
          duration: 3000,
        });
      } catch {
        /* rejoin 失敗 → 元件層 TeamRequiredFallback 仍提供手動入口 */
      }
    })();
  }, [sharedSessionId, gameId, myTeamFetched, myTeam, toast]);

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
  // 🛡️ 2026-07-04 多人穩定性 Phase A1：加 10s 輪詢兜底 —
  //   team_progress_advance WS 廣播漏接（斷線/背景）時，慢玩家 10 秒內仍能跟上隊伍。
  const { data: activeSession } = useQuery<
    { sessionId: string; maxPageIndex: number } | null
  >({
    queryKey: ["/api/teams", myTeam?.id, "active-session"],
    enabled: !!myTeam?.id,
    retry: false,
    refetchInterval: 10_000,
    queryFn: async () => {
      const res = await fetch(`/api/teams/${myTeam!.id}/active-session`, {
        credentials: "include",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("查詢隊伍進度失敗");
      return res.json();
    },
  });

  // 🆕 Phase 2a：遊戲中也訂閱 team WS，顯示隊友離線/重連/離開 toast（存在感）
  //   solo mode → myTeam 為 null，hook 內部 effect 會跳過建立連線
  // 🆕 Phase 2.B：訂閱 team_progress_advance → 慢的玩家自動跟上最快進度
  const { isConnected: isTeamWsConnected, isReconnecting: isTeamWsReconnecting } =
    useTeamWebSocket({
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
            completedPageIds: Array.from(
              new Set([...prev.completedPageIds, ...skippedIds]),
            ),
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

  // 🆕 Phase 2.B：若隊伍 maxPageIndex > 自己 → 跳上去
  // 🛡️ 2026-07-04 多人穩定性 Phase A1：原本用 ref 只跳一次（進場時），
  //   WS 漏接後就永遠落後。改為持續兜底（配合上方 10s 輪詢）——
  //   語意與 WS onProgressAdvance 一致：只前進不後退、追上後不再觸發。
  useEffect(() => {
    if (!activeSession || !activePages.length) return;
    const teamMax = activeSession.maxPageIndex;
    if (teamMax > currentPageIndex) {
      const skippedIds = activePages.slice(currentPageIndex, teamMax).map((p) => p.id);
      toast({
        title: "🏃 跟上隊伍進度",
        description: `從第 ${currentPageIndex + 1} 頁跳到第 ${teamMax + 1} 頁`,
        duration: 3000,
      });
      setState((prev) => ({
        ...prev,
        currentPageIndex: Math.min(teamMax, activePages.length - 1),
        completedPageIds: Array.from(
          new Set([...prev.completedPageIds, ...skippedIds]),
        ),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, activePages.length, currentPageIndex, setState, toast]);

  return {
    myTeam,
    isTeamWsConnected,
    isTeamWsReconnecting,
    pendingDecisionTarget,
    setPendingDecisionTarget,
    decidePending,
    handleLeaderDecide,
  };
}
