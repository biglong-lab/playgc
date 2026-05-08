import { useEffect, useRef, useCallback, useState } from "react";
// 🌐 全域 WS Provider — Phase 3 移除 feature flag、永遠走 Provider
import { useWebSocket as useWsProvider, type TeamMessage as ProviderTeamMessage } from "@/contexts/WebSocketContext";

interface TeamMemberLocation {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

interface TeamMessage {
  type: string;
  teamId?: string;
  userId?: string;
  userName?: string;
  message?: string;
  messageType?: string;
  timestamp?: string;
  isReady?: boolean;
  /** ready_status_changed / team_member_joined 帶完整 team 物件（含 members 陣列）*/
  team?: unknown;
  choice?: string;
  voteId?: string;
  pageId?: string;
  score?: number;
  change?: number;
  reason?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  /** game_started 訊息：隊長按開始遊戲 */
  sessionId?: string;
  gameId?: string;
  /** 🆕 team_progress_advance 訊息：隊伍最快進度更新 */
  maxPageIndex?: number;
  advancedBy?: string;
  /** 🆕 Phase 2c：grace_expired / disconnected 帶的逾時毫秒 */
  autoLeaveInMs?: number;
  graceInMs?: number;
  /** 🆕 Phase 2c+ leader-decide */
  action?: string;
  targetUserId?: string;
  leaderUserId?: string;
}

interface UseTeamWebSocketOptions {
  teamId: string | undefined;
  userId: string | undefined;
  userName: string | undefined;
  /**
   * 🆕 Phase 4：若提供 sessionId 且 true → ws 連線時同時 send "join" 訊息把
   *    ws 加進 session room。讓 territory_capture_sync 等需要 session 範圍
   *    廣播的訊息能正確收發。
   */
  alsoJoinSessionId?: string;
  onMessage?: (message: TeamMessage) => void;
  onMemberJoined?: (userId: string, userName: string) => void;
  onMemberLeft?: (userId: string, userName: string) => void;
  /** 🆕 Phase 2a：socket 斷線（暫時離線，可能會回來） */
  onMemberDisconnected?: (userId: string, userName: string) => void;
  /** 🆕 Phase 2a：socket 重連（曾連過 → 又出現） */
  onMemberReconnected?: (userId: string, userName: string) => void;
  onLocationUpdate?: (location: TeamMemberLocation) => void;
  onVoteCast?: (voteId: string, pageId: string, userId: string, choice: string) => void;
  onScoreUpdate?: (score: number, change: number, reason: string) => void;
  onReadyUpdate?: (userId: string, isReady: boolean) => void;
  /** 🆕 隊長按下開始遊戲 → 廣播給全員（含自己），所有玩家自動跳到遊戲頁 */
  onGameStarted?: (sessionId: string, gameId: string) => void;
  /** 🆕 Phase 2.B：隊伍最快進度更新（用於同步慢的玩家跟上） */
  onProgressAdvance?: (maxPageIndex: number, advancedBy: string) => void;
  /** 🆕 Phase 2c：隊員寬限期過了（30 秒未重連），autoLeaveInMs 後自動 leave */
  onGraceExpired?: (userId: string, userName: string, autoLeaveInMs: number) => void;
  /** 🆕 Phase 2c+ leader-decide：隊長對寬限期過的隊員下決定（wait / continue） */
  onLeaderDecide?: (action: "wait" | "continue", targetUserId: string, leaderUserId: string) => void;
  /** 🆕 ready_status_changed：team-lifecycle REST 廣播完整 team 物件、含 members */
  onReadyStatusChanged?: (team: unknown) => void;
  /** 🆕 2026-05-07 A4：自己被踢出隊伍（leaveTeam 後 server 主動斷 ws）*/
  onSelfKicked?: (reason: string) => void;
}


// ====================================================================
// 入口 — 透過 WebSocketProvider 共用全域單一 ws connection
// (Phase 3 移除 feature flag、永遠走 Provider)
// 完整保留所有 callbacks (16 個) + send functions (8 個) + memberLocations
// reconnect / keepalive / visibilitychange 由 Provider 統一管
// ====================================================================
export function useTeamWebSocket({
  teamId,
  userId,
  userName,
  alsoJoinSessionId,
  onMessage,
  onMemberJoined,
  onMemberLeft,
  onMemberDisconnected,
  onMemberReconnected,
  onLocationUpdate,
  onVoteCast,
  onScoreUpdate,
  onReadyUpdate,
  onGameStarted,
  onProgressAdvance,
  onGraceExpired,
  onLeaderDecide,
  onReadyStatusChanged,
  onSelfKicked,
}: UseTeamWebSocketOptions) {
  const { isConnected, isReconnecting, acquire, subscribe, send, getConnectionStats: getProviderStats } = useWsProvider();

  const [memberLocations, setMemberLocations] = useState<Map<string, TeamMemberLocation>>(new Map());

  // callbacks 用 ref（避免父元件 re-render 觸發 subscribe 重跑）
  const callbacksRef = useRef({
    onMessage,
    onMemberJoined,
    onMemberLeft,
    onMemberDisconnected,
    onMemberReconnected,
    onLocationUpdate,
    onVoteCast,
    onScoreUpdate,
    onReadyUpdate,
    onGameStarted,
    onProgressAdvance,
    onGraceExpired,
    onLeaderDecide,
    onReadyStatusChanged,
    onSelfKicked,
  });
  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onMemberJoined,
      onMemberLeft,
      onMemberDisconnected,
      onMemberReconnected,
      onLocationUpdate,
      onVoteCast,
      onScoreUpdate,
      onReadyUpdate,
      onGameStarted,
      onProgressAdvance,
      onGraceExpired,
      onLeaderDecide,
      onReadyStatusChanged,
      onSelfKicked,
    };
  }, [
    onMessage,
    onMemberJoined,
    onMemberLeft,
    onMemberDisconnected,
    onMemberReconnected,
    onLocationUpdate,
    onVoteCast,
    onScoreUpdate,
    onReadyUpdate,
    onGameStarted,
    onProgressAdvance,
    onGraceExpired,
    onLeaderDecide,
    onReadyStatusChanged,
    onSelfKicked,
  ]);

  // acquire connection 給這個 user
  useEffect(() => {
    if (!teamId || !userId || !userName) return;
    return acquire({ teamId, userId, userName, alsoJoinSessionId });
  }, [teamId, userId, userName, alsoJoinSessionId, acquire]);

  // 訂閱 message handler（dispatch 到對應 callback）
  useEffect(() => {
    return subscribe((data: ProviderTeamMessage) => {
      callbacksRef.current.onMessage?.(data);
      switch (data.type) {
        case "team_member_joined":
          callbacksRef.current.onMemberJoined?.(data.userId || "", data.userName || "");
          break;

        case "team_member_left":
          callbacksRef.current.onMemberLeft?.(data.userId || "", data.userName || "");
          setMemberLocations((prev) => {
            const newMap = new Map(prev);
            if (data.userId) newMap.delete(data.userId);
            return newMap;
          });
          break;

        case "team_kicked":
          callbacksRef.current.onSelfKicked?.(
            (data as { reason?: string }).reason || "left_team",
          );
          break;

        case "team_member_disconnected":
          callbacksRef.current.onMemberDisconnected?.(data.userId || "", data.userName || "");
          break;

        case "team_member_reconnected":
          callbacksRef.current.onMemberReconnected?.(data.userId || "", data.userName || "");
          break;

        case "team_location":
          if (data.userId) {
            const location: TeamMemberLocation = {
              userId: data.userId,
              userName: data.userName || "",
              latitude: data.latitude ?? 0,
              longitude: data.longitude ?? 0,
              accuracy: data.accuracy ?? 0,
              timestamp: data.timestamp || new Date().toISOString(),
            };
            setMemberLocations((prev) => {
              const newMap = new Map(prev);
              newMap.set(data.userId!, location);
              return newMap;
            });
            callbacksRef.current.onLocationUpdate?.(location);
          }
          break;

        case "team_vote_cast":
          if (data.voteId && data.pageId && data.userId && data.choice) {
            callbacksRef.current.onVoteCast?.(data.voteId, data.pageId, data.userId, data.choice);
          }
          break;

        case "team_score_update":
          if (data.score !== undefined && data.change !== undefined) {
            callbacksRef.current.onScoreUpdate?.(data.score, data.change, data.reason || "");
          }
          break;

        case "team_ready_update":
          if (data.userId && data.isReady !== undefined) {
            callbacksRef.current.onReadyUpdate?.(data.userId, data.isReady);
          }
          break;

        case "team_chat":
          // ChatPanel 自己處理（後續 Phase 2 會合併）
          break;

        case "game_started":
          if (data.sessionId && data.gameId) {
            callbacksRef.current.onGameStarted?.(data.sessionId, data.gameId);
          }
          break;

        case "team_progress_advance":
          if (typeof data.maxPageIndex === "number") {
            callbacksRef.current.onProgressAdvance?.(
              data.maxPageIndex,
              data.advancedBy || "",
            );
          }
          break;

        case "team_member_grace_expired":
          if (data.userId) {
            callbacksRef.current.onGraceExpired?.(
              data.userId,
              data.userName || "",
              data.autoLeaveInMs || 120_000,
            );
          }
          break;

        case "team_leader_decide":
          if (
            (data.action === "wait" || data.action === "continue") &&
            data.targetUserId &&
            data.leaderUserId
          ) {
            callbacksRef.current.onLeaderDecide?.(
              data.action,
              data.targetUserId,
              data.leaderUserId,
            );
          }
          break;

        case "ready_status_changed":
          if (data.team) {
            callbacksRef.current.onReadyStatusChanged?.(data.team);
          }
          break;
      }
    });
  }, [subscribe]);

  // ============== send functions（透過 Provider's send）==============

  const sendChat = useCallback(
    (message: string, messageType: string = "text") => {
      if (!teamId || !userId || !userName) return;
      send({ type: "team_chat", userId, userName, message, messageType });
    },
    [teamId, userId, userName, send],
  );

  const sendLocation = useCallback(
    (latitude: number, longitude: number, accuracy: number) => {
      if (!userId || !userName) return;
      send({ type: "team_location", userId, userName, latitude, longitude, accuracy });
    },
    [userId, userName, send],
  );

  const sendVote = useCallback(
    (voteId: string, pageId: string, choice: string) => {
      if (!userId || !userName) return;
      send({ type: "team_vote", voteId, pageId, userId, userName, choice });
    },
    [userId, userName, send],
  );

  const sendReady = useCallback(
    (isReady: boolean) => {
      if (!userId || !userName) return;
      send({ type: "team_ready", userId, userName, isReady });
    },
    [userId, userName, send],
  );

  const sendLockCoopSync = useCallback(
    (action: string, payload: Record<string, unknown>) => {
      if (!userId) return;
      send({ type: "team_lock_coop_sync", userId, action, payload });
    },
    [userId, send],
  );

  const sendRelaySync = useCallback(
    (action: string, payload: Record<string, unknown>) => {
      if (!userId) return;
      send({ type: "team_relay_sync", userId, action, payload });
    },
    [userId, send],
  );

  const sendTerritorySync = useCallback(
    (action: string, payload: Record<string, unknown>) => {
      if (!userId) return;
      send({ type: "territory_capture_sync", userId, action, payload });
    },
    [userId, send],
  );

  const sendRaceAnswer = useCallback(
    (record: {
      displayName: string;
      questionIndex: number;
      selectedOption: number;
      isCorrect: boolean;
      points: number;
    }) => {
      if (!userId) return;
      send({
        type: "race_answer",
        userId,
        displayName: record.displayName,
        questionIndex: record.questionIndex,
        selectedOption: record.selectedOption,
        isCorrect: record.isCorrect,
        points: record.points,
        answeredAt: new Date().toISOString(),
      });
    },
    [userId, send],
  );

  const getConnectionStats = useCallback(() => getProviderStats(), [getProviderStats]);

  return {
    isConnected,
    isReconnecting,
    memberLocations,
    sendChat,
    sendLocation,
    sendVote,
    sendReady,
    sendLockCoopSync,
    sendRelaySync,
    sendTerritorySync,
    sendRaceAnswer,
    getConnectionStats,
  };
}
