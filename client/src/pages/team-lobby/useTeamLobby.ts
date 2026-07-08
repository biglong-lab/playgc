// 隊伍大廳邏輯 Hook
import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useFieldLink } from "@/hooks/useFieldLink";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { speakTeamEvent, primeVoices } from "@/lib/voice-notification";
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

/** 讀取訪客在大廳輸入的遊戲暱稱（localStorage）；無則 undefined */
function getGuestDisplayName(): string | undefined {
  try {
    const v = localStorage.getItem("anonymous_player_name")?.trim();
    return v || undefined;
  } catch {
    return undefined;
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
  /** 🆕 2026-05-04: status='playing' 但找不到 active session（中斷），UI 提示「等待重連 / 解散」 */
  sessionInterrupted?: boolean;
}

/** 🆕 2026-05-04: 我參與的所有 Squad（精簡版、用於進場時選擇出戰） */
export interface MySquadOption {
  id: string;
  name: string;
  tag: string;
  primaryColor: string | null;
  myRole: "leader" | "officer" | "member";
}

export interface TeamLobbyReturn {
  // 資料
  game: Game | undefined;
  myTeam: TeamWithDetails | null | undefined;
  currentUserId: string | undefined;
  /** 🆕 2026-05-04: 使用者已保留的 Squad 清單（給「用 X 出戰」UI 用） */
  mySquads: MySquadOption[];
  mySquadsLoading: boolean;
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
  handleCreateTeam: (squadId?: string) => void;
  handleJoinTeam: () => void;
  toggleReady: () => void;
  startGame: () => void;
  leaveTeam: () => void;
  /** 🆕 2026-05-04: 把當前 team 升級為永久 Squad（保留下次再用） */
  promoteToSquad: (data: { name: string; tag?: string; primaryColor?: string }) => void;
  // Mutation 狀態
  createPending: boolean;
  joinPending: boolean;
  readyPending: boolean;
  startPending: boolean;
  leavePending: boolean;
  /** 🆕 2026-05-04 */
  promotePending: boolean;
  // 🆕 開始遊戲倒數狀態
  startingCountdown: number | null;
  /** 區分「全員開始倒數（5 秒）」vs「掉線重連 flash（1 秒）」— UI 顯示不同畫面 */
  startingMode: "starting" | "reconnecting" | null;
  /** 🆕 leader-decide：寬限期過的玩家 — 隊長收到時設值，顯示 dialog */
  pendingDecisionTarget: { userId: string; userName: string } | null;
  setPendingDecisionTarget: (
    v: { userId: string; userName: string } | null,
  ) => void;
  /** 隊長對 pendingDecision 下決定（傳 wait / continue） */
  decideLeader: (action: "wait" | "continue") => Promise<void>;
  decidePending: boolean;
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
  // 🆕 2026-05-05: 同 user grace dialog dedup（60 秒內只跳一次）
  const lastGraceShownRef = useRef<Map<string, number>>(new Map());

  // 🆕 leader-decide：寬限期過的玩家（隊長收到時設值，顯示 dialog）
  const [pendingDecisionTarget, setPendingDecisionTarget] = useState<
    { userId: string; userName: string } | null
  >(null);
  const [decidePending, setDecidePending] = useState(false);

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

  // 🆕 2026-05-04: 載入使用者已保留的 Squad（進場時選擇出戰用）
  const { data: mySquadsData, isLoading: mySquadsLoading } = useQuery<{ memberships: MySquadOption[] }>({
    queryKey: ["/api/me/squads"],
    enabled: !!currentUserId && !myTeam,  // 沒既有 team 才需要 — 已有 team 直接顯示大廳
  });
  const mySquads = mySquadsData?.memberships ?? [];

  // 🆕 2026-07-08 CHITO #ec3f612b：沒隊伍時查「可重新加入的原隊伍」
  //   （退出 / 被 auto-leave 後重進 → 顯示「重新連線原隊伍」入口）
  const { data: rejoinableTeam } = useQuery<{
    teamId: string;
    name: string;
    status: string;
    memberCount: number;
  } | null>({
    queryKey: ["/api/games", gameId, "rejoinable-team"],
    enabled: !!gameId && !!currentUserId && !teamLoading && !myTeam,
  });

  const rejoinMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const response = await apiRequest("POST", `/api/teams/${teamId}/rejoin`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "已重新加入隊伍" });
      // 重新接回 → 清除「拒絕自動接回」旗標，讓歡迎回來流程能再次啟動
      declinedReconnectRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "rejoinable-team"] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "無法重新加入";
      toast({ title: "重新加入失敗", description: msg, variant: "destructive" });
    },
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

  // 🆕 Phase 3：首次掛載時 prime SpeechSynthesis voices（Chrome 需要）
  useEffect(() => {
    primeVoices();
  }, []);

  // WebSocket
  const { isConnected: wsConnected } = useTeamWebSocket({
    teamId: myTeam?.id,
    userId: currentUserId,
    userName: dbUser?.firstName || dbUser?.email || "Player",
    onMemberJoined: (userId, userName) => {
      toast({ title: `${userName} 加入了隊伍` });
      speakTeamEvent(userId, userName, "joined");
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onMemberLeft: (userId, userName) => {
      toast({ title: `${userName} 離開了隊伍` });
      speakTeamEvent(userId, userName, "left");
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    // 🆕 Phase 2a：暫時離線（socket 斷）— 提示但不刷新成員（人還在）
    // 🛡️ 2026-05-05: dedup 60s（同 user 60s 內只跳一次 toast + 語音）
    //   原問題：browser tab throttle 反覆 close→reconnect → 反覆觸發 disconnected
    //   server 端已加 5s 延遲廣播緩解、client 再加 60s dedup 雙重保險
    onMemberDisconnected: (userId, userName) => {
      const lastShown = lastGraceShownRef.current.get(`disc:${userId}`) ?? 0;
      const now = Date.now();
      if (now - lastShown < 60_000) return;
      lastGraceShownRef.current.set(`disc:${userId}`, now);
      toast({
        title: `⚠️ ${userName} 暫時離線`,
        description: "30 秒寬限期內回來不影響",
        duration: 3000,
      });
      speakTeamEvent(userId, userName, "disconnected");
    },
    // 🆕 Phase 2a：重連回來
    onMemberReconnected: (userId, userName) => {
      toast({
        title: `✅ ${userName} 回來了`,
        duration: 2000,
      });
      speakTeamEvent(userId, userName, "reconnected");
      // 🛡️ 2026-05-05: 若該玩家正卡在隊長 grace dialog 中、自動關閉（玩家已回、不需手動處理）
      //   原 bug：玩家斷線 30s → grace_expired → 隊長 dialog 跳；玩家 reconnect 後 dialog 還在
      //   server 端 cancelDisconnectTimer 邏輯正確、只是 client 沒同步關 UI
      setPendingDecisionTarget((prev) => (prev?.userId === userId ? null : prev));
    },
    // 🆕 Phase 2c：寬限期過了 — 顯示倒數提醒（autoLeaveInMs 後自動 leave）
    onGraceExpired: (userId, userName, autoLeaveInMs) => {
      // 🛡️ 2026-05-05: dedup — 同 user 60 秒內只跳一次
      //   原問題：browser tab throttle 反覆觸發 → server 反覆 grace_expired → toast 一直跳
      //   修法：client side 60s 內同 userId 只觸發一次
      const lastShown = lastGraceShownRef.current.get(userId) ?? 0;
      const now = Date.now();
      if (now - lastShown < 60_000) return; // skip dedup
      lastGraceShownRef.current.set(userId, now);

      const seconds = Math.round(autoLeaveInMs / 1000);
      toast({
        title: `⏳ ${userName} 寬限期已過`,
        description: `${seconds} 秒後將自動視為離開（隊長可介入決定）`,
        duration: 5000,
        variant: "destructive",
      });
      speakTeamEvent(userId, userName, "graceExpired");
      // 🆕 leader-decide：若我是隊長，跳 dialog 讓隊長決定（其他人不跳）
      if (myTeam?.leaderId === currentUserId) {
        setPendingDecisionTarget({ userId, userName });
      }
    },
    // 🆕 Phase 2c+ leader-decide：隊長對寬限期過的隊員下決定
    onLeaderDecide: (action, _targetUserId, _leaderUserId) => {
      if (action === "wait") {
        toast({
          title: "👑 隊長選擇等待",
          description: "隊長決定等待離線玩家回來，遊戲繼續",
          duration: 4000,
        });
      } else {
        toast({
          title: "👑 隊長選擇先繼續",
          description: "離線玩家已標為離開，遊戲繼續進行",
          duration: 4000,
        });
      }
      setPendingDecisionTarget(null);
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

  // 🆕 重連場景：myTeam.status='playing' + activeSessionId →「歡迎回來」畫面
  //   （自願退出的玩家 leftAt 已設值，my-team 回 null，不會走到這裡 → 不會被拉回）
  // 🛡️ 2026-07-08 CHITO #e2f14e8b：原本 1 秒 flash 強制跳轉、玩家無法選擇 →
  //   被鎖在舊隊伍離不開。改 3 秒倒數 + 顯示「立即繼續 / 離開隊伍」按鈕，
  //   點離開 → declinedReconnectRef 擋住 effect 重入，不再被拉回。
  const declinedReconnectRef = useRef(false);
  useEffect(() => {
    if (
      myTeam?.status === "playing" &&
      myTeam.activeSessionId &&
      !startSessionIdRef.current &&
      !declinedReconnectRef.current
    ) {
      startSessionIdRef.current = myTeam.activeSessionId;
      setStartingMode("reconnecting");
      setStartingCountdown(3);
    }
  }, [myTeam?.status, myTeam?.activeSessionId]);

  // 🆕 立即繼續（不等倒數）
  const continueReconnectNow = useCallback(() => {
    setStartingCountdown(0);
  }, []);

  // 🆕 取消自動接回並離開隊伍
  const cancelReconnectAndLeave = useCallback(() => {
    declinedReconnectRef.current = true;
    startSessionIdRef.current = null;
    setStartingCountdown(null);
    setStartingMode(null);
    leaveTeamMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    mutationFn: async (data: { name?: string; squadId?: string }) => {
      // 🆕 CHITO #7：帶上訪客在大廳輸入的暱稱、後端寫進 users.firstName（成員列表才顯示得到）
      const displayName = getGuestDisplayName();
      const response = await apiRequest("POST", `/api/games/${gameId}/teams`, {
        ...data,
        ...(displayName ? { displayName } : {}),
      });
      return response.json();
    },
    onSuccess: (_data, vars) => {
      // 🆕 PR4：記住這次用的 squad，下次自動帶入
      if (vars.squadId) setLastUsedSquadId(vars.squadId);
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
      // 🆕 CHITO #7：帶上訪客暱稱、後端寫進 users.firstName
      const displayName = getGuestDisplayName();
      const response = await apiRequest("POST", "/api/teams/join", {
        ...data,
        ...(displayName ? { displayName } : {}),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setAccessCode("");
      setShowJoinForm(false);

      // 🛡️ 2026-05-05 fix：加入跨遊戲的組隊碼會卡頁
      //   原 bug：使用者在遊戲 A 頁面輸入遊戲 B 的組隊碼 → server 寫入成功（team.gameId=B）
      //          但 GET /api/games/A/my-team 找不到（gameId 不匹配）→ myTeam 持續 null
      //          頁面繼續顯示 JoinOrCreateView、第二次按 → 「您已經在此隊伍中」
      //   修法：拿 returned team.gameId 比對、不同 → 跳轉到正確 lobby
      const returnedGameId = (data as { gameId?: string } | null)?.gameId;
      if (returnedGameId && returnedGameId !== gameId) {
        toast({
          title: "已加入隊伍",
          description: "此組隊碼屬於另一場遊戲，正在帶您過去...",
        });
        setLocation(link(`/team/${returnedGameId}`));
        return;
      }

      toast({ title: "已加入隊伍" });
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

  // 🆕 2026-05-04: 把臨時 team 升級為永久 Squad（保留下次再用）
  const promoteToSquadMutation = useMutation({
    mutationFn: async (data: { name: string; tag?: string; primaryColor?: string }) => {
      const response = await apiRequest("POST", `/api/teams/${myTeam?.id}/promote-to-squad`, data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✨ 隊伍已保留",
        description: data?.message ?? "下次進活動可直接使用這隊伍出戰",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/squads"] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "保留隊伍失敗";
      toast({ title: "保留失敗", description: msg, variant: "destructive" });
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

  const handleCreateTeam = (squadId?: string) => {
    // 🛡️ 2026-05-04: 新 flow（先玩、想留再留）— 顯式 squadId-only：
    //   - 點「用 X 出戰」→ 明確帶 squadId
    //   - 點「+ 建另一隊」→ 不帶 squadId（建純新 team）
    //   不再 fallback 上次用過的 squadId（避免「建新隊」時誤帶舊 squad 造成 403）
    //   PR4 原 fallback 在新 mySquads 列表 UI 露出後已是多餘
    const safeSquadId = typeof squadId === "string" ? squadId : undefined;
    // 🛡️ 空 name 不送、避免 schema 驗證 too_small；server 會 fallback 用 squad name 或 access code
    const trimmedName = teamName.trim();
    createTeamMutation.mutate({
      ...(trimmedName ? { name: trimmedName } : {}),
      ...(safeSquadId ? { squadId: safeSquadId } : {}),
    });
  };

  const handleJoinTeam = () => {
    if (!accessCode.trim()) {
      toast({ title: "請輸入組隊碼", variant: "destructive" });
      return;
    }
    joinTeamMutation.mutate({ accessCode: accessCode.trim().toUpperCase() });
  };

  // 🆕 leader-decide：隊長對 pendingDecision 下決定
  const decideLeader = useCallback(
    async (action: "wait" | "continue") => {
      if (!myTeam?.id || !pendingDecisionTarget) return;
      setDecidePending(true);
      try {
        await apiRequest("POST", `/api/teams/${myTeam.id}/leader-decide`, {
          targetUserId: pendingDecisionTarget.userId,
          action,
        });
        // 不在這 setPendingDecisionTarget(null) — 等 onLeaderDecide WS 廣播觸發
      } catch (err) {
        const msg = err instanceof Error ? err.message : "決定失敗";
        toast({ title: "決定失敗", description: msg, variant: "destructive" });
      } finally {
        setDecidePending(false);
      }
    },
    [myTeam?.id, pendingDecisionTarget, toast],
  );

  // 計算屬性
  const isLeader = myTeam?.leaderId === currentUserId;
  const myMembership = myTeam?.members.find(m => m.userId === currentUserId);
  const allReady = myTeam?.members.every(m => m.isReady) || false;
  const hasEnoughPlayers = (myTeam?.members.length || 0) >= (myTeam?.minPlayers || 2);

  return {
    game,
    myTeam,
    currentUserId,
    mySquads,
    mySquadsLoading,
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
    promoteToSquad: (data) => promoteToSquadMutation.mutate(data),
    createPending: createTeamMutation.isPending,
    joinPending: joinTeamMutation.isPending,
    readyPending: updateReadyMutation.isPending,
    startPending: startGameMutation.isPending,
    leavePending: leaveTeamMutation.isPending,
    promotePending: promoteToSquadMutation.isPending,
    startingCountdown,
    startingMode,
    pendingDecisionTarget,
    setPendingDecisionTarget,
    decideLeader,
    decidePending,
    // 🆕 2026-07-08 CHITO #e2f14e8b：歡迎回來畫面的選擇權
    continueReconnectNow,
    cancelReconnectAndLeave,
    // 🆕 2026-07-08 CHITO #ec3f612b：重新加入原隊伍
    rejoinableTeam: rejoinableTeam ?? null,
    rejoinTeam: (teamId: string) => rejoinMutation.mutate(teamId),
    rejoinPending: rejoinMutation.isPending,
  };
}
