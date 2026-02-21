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
  });

  const [forceNewSession, setForceNewSession] = useState(isReplayMode);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);
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

  // 建立新 session
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sessions", {
        gameId,
        teamName: `${userName}'s Team`,
        playerCount: 1,
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
      });
      setForceNewSession(false);
      setHasRestoredProgress(true);
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/active", gameId] });
      toast({ title: "遊戲開始", description: "祝你好運!" });
    },
    onError: () => {
      setForceNewSession(false);
      toast({ title: "錯誤", description: "無法開始遊戲，請重試", variant: "destructive" });
    },
  });

  // Session 恢復/新建邏輯
  useEffect(() => {
    if (!userId || !gameId) return;

    // replay 模式：強制建新 session
    if (forceNewSession && !state.sessionId && !createSessionMutation.isPending) {
      if (isReplayMode) {
        setLocation(`/game/${gameId}`, { replace: true });
      }
      sessionCreationAttemptedRef.current = true;
      createSessionMutation.mutate();
      return;
    }

    if (forceNewSession || createSessionMutation.isPending) return;

    // 恢復現有 session
    if (existingSession?.session && !hasRestoredProgress && activePages.length > 0) {
      restoreSession(existingSession);
      return;
    }

    // 無現有 session，建新的
    if (existingSession === null && !state.sessionId && !forceNewSession && !createSessionMutation.isPending && !sessionCreationAttemptedRef.current) {
      sessionCreationAttemptedRef.current = true;
      createSessionMutation.mutate();
    }
  }, [userId, gameId, existingSession, activePages, state.sessionId, hasRestoredProgress, forceNewSession, isReplayMode, createSessionMutation.isPending]);

  function restoreSession(data: ExistingSessionData) {
    const newScore = data.progress?.score || data.session.score || 0;
    const newInventory = data.progress?.inventory || [];
    const newVariables = data.progress?.variables || {};
    let pageIndex = 0;

    if (data.session.status === "completed") {
      setState({
        sessionId: data.session.id,
        score: newScore,
        inventory: newInventory,
        variables: newVariables,
        currentPageIndex: activePages.length - 1,
        isCompleted: true,
      });
      setHasRestoredProgress(true);
      toast({ title: "遊戲已完成", description: `最終得分: ${newScore} 分` });
      return;
    }

    if (data.progress?.currentPageId) {
      const foundIndex = activePages.findIndex(p => p.id === data.progress?.currentPageId);
      if (foundIndex !== -1) pageIndex = foundIndex;
    }

    setState({
      sessionId: data.session.id,
      score: newScore,
      inventory: newInventory,
      variables: newVariables,
      currentPageIndex: pageIndex,
      isCompleted: false,
    });
    setHasRestoredProgress(true);
    toast({ title: "繼續遊戲", description: "從上次進度繼續" });
  }

  // 重新開始遊戲
  function resetAndCreateNew() {
    setState({
      sessionId: null,
      score: 0,
      inventory: [],
      variables: {},
      currentPageIndex: 0,
      isCompleted: false,
    });
    setHasRestoredProgress(false);
    createSessionMutation.mutate();
  }

  return {
    ...state,
    stateRef,
    activePagesRef,
    setState,
    createSessionMutation,
    resetAndCreateNew,
  };
}
