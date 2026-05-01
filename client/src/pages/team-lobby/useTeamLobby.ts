// 隊伍大廳邏輯 Hook
import { useState, useCallback, useEffect, useRef } from "react";
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
 *
 * 匯出供單元測試用（純函式）
 */
export function parseInviteCode(search: string): string {
  try {
    const params = new URLSearchParams(search);
    const code = params.get("code") ?? "";
    // 限定 4-8 位英數（防注入用，Server 端再次驗證）
    return /^[A-Z0-9]{4,8}$/i.test(code) ? code.toUpperCase() : "";
  } catch {
    return "";
  }
}

function readInviteCodeFromUrl(): string {
  if (typeof window === "undefined") return "";
  return parseInviteCode(window.location.search);
}

// 🆕 Phase 1.5：localStorage 記憶上次隊伍（80% 不彈 Dialog 設計）
const LAST_SQUAD_KEY = "chito:lastSquadId";

/** 取得上次使用的隊伍 ID（用於組隊預設值） */
export function getLastUsedSquadId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_SQUAD_KEY);
  } catch {
    return null;
  }
}

/** 記憶這次使用的隊伍（每次組隊成功時呼叫） */
export function setLastUsedSquadId(squadId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (squadId) {
      localStorage.setItem(LAST_SQUAD_KEY, squadId);
    } else {
      localStorage.removeItem(LAST_SQUAD_KEY);
    }
  } catch {
    // ignore
  }
}

export interface TeamWithDetails extends Team {
  members: (TeamMember & { user: User })[];
  game: Game;
  leader: User;
  /** 🆕 status='playing' 時 server 補上正在進行的 sessionId（重連用） */
  activeSessionId?: string | null;
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
  // 🆕 開始遊戲倒數狀態
  startingCountdown: number | null;
  /** 區分「全員開始倒數（5 秒）」vs「掉線重連 flash（1 秒）」— UI 顯示不同畫面 */
  startingMode: "starting" | "reconnecting" | null;
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
  // 🆕 開始遊戲倒數（null = 沒在倒數 / 數字 = 剩餘秒數）
  const [startingCountdown, setStartingCountdown] = useState<number | null>(null);
  // 🆕 區分模式：starting = 全員開始 5 秒倒數；reconnecting = 掉線回來 1 秒 flash
  const [startingMode, setStartingMode] = useState<"starting" | "reconnecting" | null>(null);
  const startSessionIdRef = useRef<string | null>(null);

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

  // 🆕 Phase 1.5：成功加入/建立隊伍後記憶 squad ID（下次自動帶入）
  useEffect(() => {
    if (myTeam?.id) {
      setLastUsedSquadId(myTeam.id);
    }
  }, [myTeam?.id]);

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
    // 🆕 Phase 2a：暫時離線（socket 斷）— 提示但不刷新成員（人還在）
    onMemberDisconnected: (_userId, userName) => {
      toast({
        title: `⚠️ ${userName} 暫時離線`,
        description: "30 秒寬限期內回來不影響",
        duration: 3000,
      });
    },
    // 🆕 Phase 2a：重連回來
    onMemberReconnected: (_userId, userName) => {
      toast({
        title: `✅ ${userName} 回來了`,
        duration: 2000,
      });
    },
    // 🆕 Phase 2c：寬限期過了 — 顯示倒數提醒（autoLeaveInMs 後自動 leave）
    onGraceExpired: (_userId, userName, autoLeaveInMs) => {
      const seconds = Math.round(autoLeaveInMs / 1000);
      toast({
        title: `⏳ ${userName} 寬限期已過`,
        description: `${seconds} 秒後將自動視為離開`,
        duration: 5000,
        variant: "destructive",
      });
    },
    onReadyUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    // 🆕 隊長按開始 → 全員（含隊長）進入 5 秒倒數緩衝畫面，
    //   讓所有玩家確認上線、對講機就緒，再一起進遊戲
    onGameStarted: (sessionId, _gameId) => {
      // 防重複：mutation 與 ws 兩個都會觸發，只取第一個
      if (startSessionIdRef.current) return;
      startSessionIdRef.current = sessionId;
      setStartingMode("starting");
      setStartingCountdown(5);
    },
  });

  // 🆕 重連場景：myTeam.status='playing' + activeSessionId → 1 秒「歡迎回來」flash
  //   遊戲已開打了不該再 5、4、3 倒數讓玩家乾等，直接 1 秒 flash 顯示存在感後跳遊戲。
  //   （自願退出的玩家 leftAt 已設值，my-team 回 null，不會走到這裡 → 不會被拉回）
  useEffect(() => {
    if (
      myTeam?.status === "playing" &&
      myTeam.activeSessionId &&
      !startSessionIdRef.current
    ) {
      startSessionIdRef.current = myTeam.activeSessionId;
      setStartingMode("reconnecting");
      setStartingCountdown(1);
    }
  }, [myTeam?.status, myTeam?.activeSessionId]);

  // 倒數 effect：每秒減 1，到 0 → setLocation 跳遊戲
  useEffect(() => {
    if (startingCountdown === null) return;
    if (startingCountdown <= 0) {
      const sid = startSessionIdRef.current;
      if (sid) {
        setLocation(`/game/${gameId}?session=${sid}`);
      }
      setStartingCountdown(null);
      setStartingMode(null);
      startSessionIdRef.current = null;
      return;
    }
    const timer = setTimeout(() => {
      setStartingCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [startingCountdown, gameId, setLocation]);

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
      toast({ title: "遊戲即將開始！" });
      // 🆕 改成觸發倒數（跟 onGameStarted ws callback 同樣效果，防 ws 漏接）
      //   防重複：ref 已有值 → 不再觸發
      if (!startSessionIdRef.current) {
        startSessionIdRef.current = data.sessionId;
        setStartingMode("starting");
        setStartingCountdown(5);
      }
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
    startingCountdown,
    startingMode,
  };
}
