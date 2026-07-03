// 遊戲 session 管理 — 恢復/新建/replay 邏輯
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GameSession, Page } from "@shared/schema";

interface SessionProgress {
  score?: number;
  inventory?: string[];
  variables?: Record<string, unknown>;
  currentPageId?: string;
}

interface ExistingSessionData {
  session: GameSession;
  progress: SessionProgress | null;
}

interface UseSessionManagerParams {
  gameId: string | undefined;
  userId: string | undefined;
  isReplayMode: boolean;
  activePages: Page[];
  userName: string;
}

interface SessionState {
  sessionId: string | null;
  score: number;
  inventory: string[];
  variables: Record<string, unknown>;
  currentPageIndex: number;
  isCompleted: boolean;
  /** 🆕 已完成頁面 ID 清單 — 防止玩家直接按下一頁跳過任務 */
  completedPageIds: string[];
}

export function useSessionManager({
  gameId,
  userId,
  isReplayMode,
  activePages,
  userName,
}: UseSessionManagerParams) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [state, setState] = useState<SessionState>({
    sessionId: null,
    score: 0,
    inventory: [],
    variables: {},
    currentPageIndex: 0,
    isCompleted: false,
    completedPageIds: [],
  });

  const [forceNewSession, setForceNewSession] = useState(isReplayMode);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
  // 🆕 2026-05-12 #5: existingSession 偵測到後、等玩家決定（繼續 / 重新開始）才動作
  //   pendingDecision = true → 顯示 ResumeDialog 在遊戲頁前、不 restore 也不建新
  const [pendingDecision, setPendingDecision] = useState(false);
  const [userDecided, setUserDecided] = useState(false);
  const sessionCreationAttemptedRef = useRef(false);

  // Refs 避免 stale closure
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const activePagesRef = useRef(activePages);
  useEffect(() => { activePagesRef.current = activePages; }, [activePages]);

  // 查詢現有 session
  const { data: existingSession } = useQuery<ExistingSessionData | null>({
    queryKey: ["/api/sessions/active", gameId],
    queryFn: async () => {
      try {
        const { getIdToken } = await import("@/lib/firebase");
        const token = await getIdToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const response = await fetch(`/api/sessions/active?gameId=${gameId}`, {
          credentials: 'include',
          headers,
        });
        if (response.ok) {
          return response.json();
        }
        return null;
      } catch {
        return null;
      }
    },
    enabled: !!userId && !!gameId,
  });

  // 🌐 取得當前 GPS 位置（給 location_lock 用）
  // 失敗不阻斷 — 後端會 return error 並提示玩家允許定位
  const getCurrentGpsCoords = async (): Promise<{ lat: number; lng: number } | null> => {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(null), 8000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeoutId);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          clearTimeout(timeoutId);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
      );
    });
  };

  // 建立新 session
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      // 🆕 匿名玩家在 Home 填的暱稱帶進來；無則 undefined（後端 schema 不會寫入）
      let playerName: string | undefined;
      try {
        const stored = localStorage.getItem("anonymous_player_name");
        if (stored && stored.trim()) playerName = stored.trim();
      } catch { /* ignore */ }

      // 🌐 location_lock：先試取 GPS（後端會檢查是否在指定地點）
      // 不阻塞：取不到也送出，後端會回 400 並提示玩家
      const coords = await getCurrentGpsCoords();

      const response = await apiRequest("POST", "/api/sessions", {
        gameId,
        teamName: playerName ? `${playerName}'s Team` : `${userName}'s Team`,
        playerName,
        playerCount: 1,
        // 帶上 GPS（給後端 location_lock 驗證）
        ...(coords ? { playerLat: coords.lat, playerLng: coords.lng } : {}),
      });
      return response.json();
    },
    onSuccess: (data: GameSession) => {
      setState({
        sessionId: data.id,
        score: 0,
        inventory: [],
        variables: {},
        currentPageIndex: 0,
        isCompleted: false,
        completedPageIds: [],
      });
      setForceNewSession(false);
      // 🐛 2026-05-12 fix: 新建 session 不設 hasRestoredProgress=true
      //   原 bug：新建也標 true、ResumeDialog 在 currentPageIndex>0 時誤觸（如玩家玩 1 步離開又回來）
      //   新建純粹是「沒有舊進度」、不該被視為「恢復進度」
      setHasRestoredProgress(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/active", gameId] });
      // 🐛 2026-05-22 業主 docx #13：移除「遊戲開始祝你好運」橫幅、太遮擋且顯示太久
      //   玩家本來就知道自己按了開始遊戲、不需要通知
    },
    onError: (err: any) => {
      setForceNewSession(false);
      // 🌐 location_lock 錯誤訊息（後端回 400/403 + requireLocation: true）
      const errMsg = err?.message ?? err?.response?.data?.message ?? "";
      if (errMsg.includes("地點") || errMsg.includes("GPS")) {
        toast({
          title: "需在指定地點才能開始",
          description: errMsg,
          variant: "destructive",
        });
      } else {
        toast({ title: "錯誤", description: "無法開始遊戲，請重試", variant: "destructive" });
      }
    },
  });

  // Session 恢復/新建邏輯
  useEffect(() => {
    if (!userId || !gameId) return;

    // 🐛 2026-05-12 深度修「再玩一次跳通關」：state.sessionId 已存在 = 不再 restore
    //   server `getActiveSessionByUserAndGame` 先回 completed session（line 67）
    //   新建 session 後 query refetch 拿到舊 completed → 又 restore → 跳通關
    //   修法：state.sessionId 已存在（新建 / restore 成功）→ 一律不再覆蓋 state
    if (state.sessionId) return;

    // replay 模式：強制建新 session
    if (forceNewSession && !state.sessionId && !createSessionMutation.isPending) {
      if (isReplayMode) {
        // 🐛 2026-07-03 修：原本寫死跳 `/game/:id`、把場域路徑（/f/:code/game/:id）玩家
        //   踢出場域 context → 路由改變 → GamePlay 重掛 → replay 進度被 refetch 蓋掉。
        //   改保留當前 pathname、只去掉 ?replay query。
        setLocation(window.location.pathname, { replace: true });
      }
      sessionCreationAttemptedRef.current = true;
      createSessionMutation.mutate();
      return;
    }

    if (forceNewSession || createSessionMutation.isPending) return;

    // 🆕 2026-05-12 #5 / 2026-05-22 業主 docx #14: existingSession + 未決定 → 顯示 dialog
    //   業主回報 runtime 中又彈進度提示：根因是 query refetch 又把 existingSession 帶回來
    //   防護：只在還沒有 sessionId（= 真正第一次進場）才考慮 setPendingDecision
    //   已 restore / 已建新 / 已決定 → 一律不再彈
    if (
      existingSession?.session &&
      !hasRestoredProgress &&
      !userDecided &&
      !pendingDecision &&
      !state.sessionId &&
      activePages.length > 0
    ) {
      const progressedPages = existingSession.progress?.currentPageId
        ? activePages.findIndex((p) => p.id === existingSession.progress?.currentPageId)
        : -1;
      const sessionInProgress = existingSession.session.status !== "completed" && progressedPages > 0;
      if (sessionInProgress) {
        // 等玩家決定（繼續 / 重新開始）
        setPendingDecision(true);
        return;
      }
      // 沒實質進度 → 直接 restore（completed session 走 completed 路徑、無進度 session 視為新場）
      restoreSession(existingSession);
      return;
    }

    // 等玩家決定中 → 不動作
    if (pendingDecision) return;

    // 玩家已決定繼續 → restore
    if (userDecided && existingSession?.session && !hasRestoredProgress && activePages.length > 0) {
      restoreSession(existingSession);
      return;
    }

    // 無現有 session，建新的
    if (existingSession === null && !state.sessionId && !forceNewSession && !createSessionMutation.isPending && !sessionCreationAttemptedRef.current) {
      sessionCreationAttemptedRef.current = true;
      createSessionMutation.mutate();
    }
    // state.sessionId 已在條件式內 reference、無需重複加 deps
  }, [userId, gameId, existingSession, activePages, state.sessionId, hasRestoredProgress, forceNewSession, isReplayMode, createSessionMutation.isPending, pendingDecision, userDecided]);

  function restoreSession(data: ExistingSessionData) {
    const newScore = data.progress?.score || data.session.score || 0;
    const newInventory = data.progress?.inventory || [];
    const newVariables = data.progress?.variables || {};
    let pageIndex = 0;

    if (data.session.status === "completed") {
      // 全部完成的 session → 所有頁面都標記為已完成（允許回顧）
      setState({
        sessionId: data.session.id,
        score: newScore,
        inventory: newInventory,
        variables: newVariables,
        currentPageIndex: activePages.length - 1,
        isCompleted: true,
        completedPageIds: activePages.map((p) => p.id),
      });
      setHasRestoredProgress(true);
      toast({ title: "遊戲已完成", description: `最終得分: ${newScore} 分` });
      return;
    }

    if (data.progress?.currentPageId) {
      const foundIndex = activePages.findIndex(p => p.id === data.progress?.currentPageId);
      if (foundIndex !== -1) pageIndex = foundIndex;
    }

    // 恢復 session 時，currentPageIndex 之前的頁面視為已完成（允許回顧）
    const completedIds = activePages.slice(0, pageIndex).map((p) => p.id);

    setState({
      sessionId: data.session.id,
      score: newScore,
      inventory: newInventory,
      variables: newVariables,
      currentPageIndex: pageIndex,
      isCompleted: false,
      completedPageIds: completedIds,
    });
    setHasRestoredProgress(true);
    toast({ title: "繼續遊戲", description: "從上次進度繼續" });
  }

  // 重新開始遊戲
  function resetAndCreateNew() {
    // 🐛 2026-05-12 深度修「再玩一次跳通關」根因：
    //   server `getActiveSessionByUserAndGame` 邏輯先回 completed session（看 line 67）
    //   新建 session 後 query refetch 仍會拿到舊 completed → 觸發 restore 跳通關
    //
    //   修法雙保險：
    //   1. setForceNewSession(true) + sessionCreationAttemptedRef = false → 走建新分支
    //   2. removeQueries 清掉 query cache + setQueryData(null) → 避免 refetch 又拿 completed
    //   3. userDecided 不設 true（意義是「玩家選繼續舊」、reset 不算）
    //   4. useEffect 內已加 state.sessionId 已存在 = 不再 restore 的保護
    setForceNewSession(true);
    sessionCreationAttemptedRef.current = false;
    setState({
      sessionId: null,
      score: 0,
      inventory: [],
      variables: {},
      currentPageIndex: 0,
      isCompleted: false,
      completedPageIds: [],
    });
    setHasRestoredProgress(false);
    setPendingDecision(false);
    setUserDecided(false);
    // 清快取 + 移除 query、避免 refetch 後又拿到舊 completed session
    queryClient.setQueryData(["/api/sessions/active", gameId], null);
    queryClient.removeQueries({ queryKey: ["/api/sessions/active", gameId] });
    createSessionMutation.mutate();
  }

  // 🆕 2026-05-12 #5: 玩家在 ResumeDialog 選「繼續」
  function confirmContinue() {
    setUserDecided(true);
    setPendingDecision(false);
  }

  return {
    ...state,
    stateRef,
    activePagesRef,
    setState,
    createSessionMutation,
    resetAndCreateNew,
    // 🆕 2026-05-07：暴露 hasRestoredProgress 給 GamePlay 顯示 ResumeDialog
    hasRestoredProgress,
    // 🆕 2026-05-12 #5: 玩家未決定狀態（GamePlay 用來蓋遊戲頁面）
    pendingDecision,
    confirmContinue,
    /** 給 dialog 顯示用：上次玩到第幾頁、目前分數 */
    existingProgressInfo: existingSession?.session && existingSession.progress
      ? {
          currentPageId: existingSession.progress.currentPageId ?? null,
          score: existingSession.progress.score ?? existingSession.session.score ?? 0,
        }
      : null,
  };
}
