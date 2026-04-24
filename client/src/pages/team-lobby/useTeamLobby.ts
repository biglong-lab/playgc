// 隊伍大廳邏輯 Hook
import { useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useFieldLink } from "@/hooks/useFieldLink";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import type { Game, Team, TeamMember, User } from "@shared/schema";

/**
 * 從 URL search string 解出 ?code= 邀請碼
 * 例如 ?code=ABC123 → "ABC123"
 *      不存在或為空 → ""
 */
function readInviteCodeFromUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? "";
    // 限定 6 位英數（保護用，Server 端再驗證）
    return /^[A-Z0-9]{4,8}$/i.test(code) ? code.toUpperCase() : "";
  } catch {
    return "";
  }
}

export interface TeamWithDetails extends Team {
  members: (TeamMember & { user: User })[];
  game: Game;
  leader: User;
}

export interface TeamLobbyReturn {
  // 資料
  game: Game | undefined;
  myTeam: TeamWithDetails | null | undefined;
  currentUserId: string | undefined;
  // 狀態
  gameLoading: boolean;
  teamLoading: boolean;
  wsConnected: boolean;
  // 表單
  accessCode: string;
  setAccessCode: (v: string) => void;
  teamName: string;
  setTeamName: (v: string) => void;
  showJoinForm: boolean;
  setShowJoinForm: (v: boolean) => void;
  copied: boolean;
  // 計算屬性
  isLeader: boolean;
  myMembership: (TeamMember & { user: User }) | undefined;
  allReady: boolean;
  hasEnoughPlayers: boolean;
  // 操作
  navigate: (path: string) => void;
  refetchTeam: () => void;
  handleCopyCode: () => void;
  handleCreateTeam: () => void;
  handleJoinTeam: () => void;
  toggleReady: () => void;
  startGame: () => void;
  leaveTeam: () => void;
  // Mutation 狀態
  createPending: boolean;
  joinPending: boolean;
  readyPending: boolean;
  startPending: boolean;
  leavePending: boolean;
}

export function useTeamLobby(): TeamLobbyReturn {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setLocation] = useLocation();
  const link = useFieldLink();   // 🔧 場域感知 link builder
  const { toast } = useToast();
  const { user: dbUser } = useAuth();

  // 🔗 從 URL ?code= 預填邀請碼（朋友點連結時自動帶入）
  const initialInviteCode = readInviteCodeFromUrl();
  const [accessCode, setAccessCode] = useState(initialInviteCode);
  const [teamName, setTeamName] = useState("");
  const [copied, setCopied] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(!!initialInviteCode); // 有 code 自動展開 join form

  const currentUserId = dbUser?.id;

  // 查詢
  const { data: game, isLoading: gameLoading } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    enabled: !!gameId,
  });

  const { data: myTeam, isLoading: teamLoading, refetch: refetchTeam } = useQuery<TeamWithDetails | null>({
    queryKey: ["/api/games", gameId, "my-team"],
    enabled: !!gameId,
    refetchInterval: 5000,
  });

  // 🔗 偵測到 ?code= 邀請碼時提示使用者「您被邀請了」
  useEffect(() => {
    if (initialInviteCode && !myTeam && game) {
      toast({
        title: `🎮 您被邀請加入隊伍`,
        description: `邀請碼：${initialInviteCode}（已自動填入，按「加入隊伍」即可）`,
        duration: 5000,
      });
    }
    // 只在第一次載入後顯示，依賴用 game/myTeam 是否載入完成
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, myTeam?.id]);

  // WebSocket
  const { isConnected: wsConnected } = useTeamWebSocket({
    teamId: myTeam?.id,
    userId: currentUserId,
    userName: dbUser?.firstName || dbUser?.email || "Player",
    onMemberJoined: (_userId, userName) => {
      toast({ title: `${userName} 加入了隊伍` });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onMemberLeft: (_userId, userName) => {
      toast({ title: `${userName} 離開了隊伍` });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onReadyUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
  });

  // Mutations
  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("POST", `/api/games/${gameId}/teams`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "隊伍已創建" });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "無法創建隊伍";
      toast({ title: "創建失敗", description: msg, variant: "destructive" });
    },
  });

  const joinTeamMutation = useMutation({
    mutationFn: async (data: { accessCode: string }) => {
      const response = await apiRequest("POST", "/api/teams/join", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "已加入隊伍" });
      setAccessCode("");
      setShowJoinForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "無法加入隊伍";
      toast({ title: "加入失敗", description: msg, variant: "destructive" });
    },
  });

  const updateReadyMutation = useMutation({
    mutationFn: async (data: { isReady: boolean }) => {
      const response = await apiRequest("PATCH", `/api/teams/${myTeam?.id}/ready`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onError: () => {
      toast({ title: "更新失敗", variant: "destructive" });
    },
  });

  const leaveTeamMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/teams/${myTeam?.id}/leave`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "已離開隊伍" });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onError: () => {
      toast({ title: "離開失敗", variant: "destructive" });
    },
  });

  const startGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/teams/${myTeam?.id}/start`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "遊戲開始！" });
      setLocation(`/game/${gameId}?session=${data.sessionId}`);
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "無法開始遊戲";
      toast({ title: "開始失敗", description: msg, variant: "destructive" });
    },
  });

  // Handlers
  const handleCopyCode = useCallback(() => {
    if (myTeam?.accessCode) {
      navigator.clipboard.writeText(myTeam.accessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "組隊碼已複製" });
    }
  }, [myTeam?.accessCode, toast]);

  const handleCreateTeam = () => {
    createTeamMutation.mutate({ name: teamName || "" });
  };

  const handleJoinTeam = () => {
    if (!accessCode.trim()) {
      toast({ title: "請輸入組隊碼", variant: "destructive" });
      return;
    }
    joinTeamMutation.mutate({ accessCode: accessCode.trim().toUpperCase() });
  };

  // 計算屬性
  const isLeader = myTeam?.leaderId === currentUserId;
  const myMembership = myTeam?.members.find(m => m.userId === currentUserId);
  const allReady = myTeam?.members.every(m => m.isReady) || false;
  const hasEnoughPlayers = (myTeam?.members.length || 0) >= (myTeam?.minPlayers || 2);

  return {
    game,
    myTeam,
    currentUserId,
    gameLoading,
    teamLoading,
    wsConnected,
    accessCode,
    setAccessCode,
    teamName,
    setTeamName,
    showJoinForm,
    setShowJoinForm,
    copied,
    isLeader,
    myMembership,
    allReady,
    hasEnoughPlayers,
    // 🔧 場域感知 navigate — 避免後浦玩家按返回大廳跑到賈村
    navigate: (path: string) => setLocation(link(path)),
    refetchTeam: () => refetchTeam(),
    handleCopyCode,
    handleCreateTeam,
    handleJoinTeam,
    toggleReady: () => updateReadyMutation.mutate({ isReady: !myMembership?.isReady }),
    startGame: () => startGameMutation.mutate(),
    leaveTeam: () => leaveTeamMutation.mutate(),
    createPending: createTeamMutation.isPending,
    joinPending: joinTeamMutation.isPending,
    readyPending: updateReadyMutation.isPending,
    startPending: startGameMutation.isPending,
    leavePending: leaveTeamMutation.isPending,
  };
}
