// 對戰大廳邏輯 Hook
import { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useMatchWebSocket } from "@/hooks/use-match-websocket";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Game } from "@shared/schema";

export type MatchLobbyView = "loading" | "browse" | "waiting" | "countdown" | "playing" | "finished";

export function useMatchLobby() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setLocation] = useLocation();
  const { user, firebaseUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);

  // WebSocket 連線
  const ws = useMatchWebSocket(currentMatchId);

  // 載入遊戲資訊
  const { data: game, isLoading: gameLoading } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
  });

  // 載入對戰列表
  const { data: matches } = useQuery({
    queryKey: ["/api/games", gameId, "matches"],
    queryFn: () => apiRequest("GET", `/api/games/${gameId}/matches`).then((r) => r.json()),
    enabled: !!gameId,
  });

  // 載入當前對戰詳情
  const { data: currentMatch } = useQuery({
    queryKey: ["/api/matches", currentMatchId],
    queryFn: () => apiRequest("GET", `/api/matches/${currentMatchId}`).then((r) => r.json()),
    enabled: !!currentMatchId,
    refetchInterval: 5000,
  });

  // 建立對戰
  const createMatchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/games/${gameId}/matches`, body);
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentMatchId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "matches"] });
      toast({ title: "對戰已建立", description: `存取碼：${data.accessCode}` });
    },
    onError: () => {
      toast({ title: "建立失敗", variant: "destructive" });
    },
  });

  // 加入對戰
  const joinMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const res = await apiRequest("POST", `/api/matches/${matchId}/join`);
      return res.json();
    },
    onSuccess: (_data, matchId) => {
      setCurrentMatchId(matchId);
      toast({ title: "已加入對戰" });
    },
    onError: () => {
      toast({ title: "加入失敗", variant: "destructive" });
    },
  });

  // 開始對戰
  const startMatchMutation = useMutation({
    mutationFn: async () => {
      if (!currentMatchId) throw new Error("無對戰 ID");
      const res = await apiRequest("POST", `/api/matches/${currentMatchId}/start`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "對戰開始！" });
    },
  });

  // 計算當前視圖
  const determineView = useCallback((): MatchLobbyView => {
    if (authLoading || gameLoading) return "loading";
    if (!currentMatchId) return "browse";
    if (ws.matchStatus === "countdown") return "countdown";
    if (ws.matchStatus === "playing") return "playing";
    if (ws.matchStatus === "finished") return "finished";
    if (currentMatch?.status === "playing") return "playing";
    if (currentMatch?.status === "finished") return "finished";
    return "waiting";
  }, [authLoading, gameLoading, currentMatchId, ws.matchStatus, currentMatch]);

  const handleGoBack = useCallback(() => {
    setLocation("/home");
  }, [setLocation]);

  // 使用 firebaseUser.uid 作為 userId 識別
  const currentUserId = firebaseUser?.uid ?? user?.id;

  return {
    gameId,
    game,
    user,
    matches: matches ?? [],
    currentMatch,
    currentMatchId,
    currentView: determineView(),
    ws,
    isLoading: authLoading || gameLoading,
    isCreator: currentMatch?.creatorId === currentUserId,
    currentUserId,
    createMatch: createMatchMutation.mutate,
    joinMatch: joinMatchMutation.mutate,
    startMatch: startMatchMutation.mutate,
    isCreating: createMatchMutation.isPending,
    isJoining: joinMatchMutation.isPending,
    isStarting: startMatchMutation.isPending,
    handleGoBack,
  };
}
