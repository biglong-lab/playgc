import { useEffect, useRef, useCallback, useState } from "react";
import { reportClientEvent } from "@/lib/event-report";

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
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // 🆕 2026-05-05: reconnect 狀態（給 UI 顯示「重連中」用）
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [memberLocations, setMemberLocations] = useState<Map<string, TeamMemberLocation>>(new Map());
  // 🆕 2026-05-05: reconnect with exponential backoff
  //   原本 onclose 只 setIsConnected(false)、永不重連 → 玩家切 tab / 鎖屏 / 短暫斷網就死
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false); // unmount 時設 true、避免 cleanup 後仍嘗試重連
  // 🆕 統計給 P1 觀測用（每場 session 結束時上報）
  const statsRef = useRef({
    connectAt: 0,
    disconnectCount: 0,
    reconnectSuccessCount: 0,
    reconnectFailCount: 0,
  });

  // 🔧 Fix（2026-05-02）：把 callback 放進 ref，避免父元件 re-render 時
  //   產生新 reference 觸發 useEffect 重跑 → WebSocket 重連 →
  //   server 又廣播 member_joined → toast 一直跳
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
    };
  }, [onMessage, onMemberJoined, onMemberLeft, onMemberDisconnected, onMemberReconnected, onLocationUpdate, onVoteCast, onScoreUpdate, onReadyUpdate, onGameStarted, onProgressAdvance, onGraceExpired, onLeaderDecide, onReadyStatusChanged]);

  useEffect(() => {
    if (!teamId || !userId || !userName) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    intentionalCloseRef.current = false;

    /** 🆕 2026-05-05: backoff 計算 — 1s → 2s → 4s → 8s → 16s → max 30s */
    const computeBackoff = (attempts: number): number => {
      const base = 1000;
      const ms = Math.min(base * Math.pow(2, attempts), 30_000);
      // 加 ±20% jitter 避免大量 client 同時重連衝擊 server
      const jitter = ms * 0.2 * (Math.random() * 2 - 1);
      return Math.max(500, Math.floor(ms + jitter));
    };

    /** 🆕 2026-05-05: 排定下次重連 */
    const scheduleReconnect = () => {
      if (intentionalCloseRef.current) return;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      const delay = computeBackoff(reconnectAttemptsRef.current);
      reconnectAttemptsRef.current += 1;
      setIsReconnecting(true);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    /** 🆕 2026-05-05: 包裝建立 ws + handlers（重連時會多次呼叫） */
    const connect = () => {
      if (intentionalCloseRef.current) return;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setIsReconnecting(false);
        statsRef.current.connectAt = Date.now();
        // 🆕 重連成功（attempts > 0）→ 統計
        if (reconnectAttemptsRef.current > 0) {
          statsRef.current.reconnectSuccessCount += 1;
        }
        reconnectAttemptsRef.current = 0;

        ws.send(JSON.stringify({
          type: "team_join",
          teamId,
          userId,
          userName,
        }));
        // 🆕 Phase 4：若 alsoJoinSessionId → 同 ws 也 join session room
        //   讓 broadcastToSession 廣播的 territory_capture_sync 等訊息能收到
        if (alsoJoinSessionId) {
          ws.send(JSON.stringify({
            type: "join",
            sessionId: alsoJoinSessionId,
            userId,
            userName,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: TeamMessage = JSON.parse(event.data);

          // 🔧 用 callbacksRef.current 取代直接呼叫，確保拿最新 callback
          //   且不會把 callback 列入 deps 觸發重連
          callbacksRef.current.onMessage?.(data);

          switch (data.type) {
            case "team_member_joined":
              callbacksRef.current.onMemberJoined?.(data.userId || "", data.userName || "");
              break;

            case "team_member_left":
              callbacksRef.current.onMemberLeft?.(data.userId || "", data.userName || "");
              setMemberLocations(prev => {
                const newMap = new Map(prev);
                if (data.userId) newMap.delete(data.userId);
                return newMap;
              });
              break;

            // 🆕 2026-05-07 A4：自己被踢出隊伍
            // server 在 leaveTeam 後立即送此訊息 + close ws
            // client 跳彈窗 + redirect 大廳（避免繼續占位 / 困惑）
            case "team_kicked":
              callbacksRef.current.onSelfKicked?.(
                (data as { reason?: string }).reason || "left_team",
              );
              break;

            // 🆕 Phase 2a：socket 斷線（暫時離線）
            case "team_member_disconnected":
              callbacksRef.current.onMemberDisconnected?.(data.userId || "", data.userName || "");
              break;

            // 🆕 Phase 2a：socket 重連（回來了）
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
                setMemberLocations(prev => {
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
              break;

            case "game_started":
              if (data.sessionId && data.gameId) {
                callbacksRef.current.onGameStarted?.(data.sessionId, data.gameId);
              }
              break;

            // 🆕 Phase 2.B：隊伍最快進度同步
            case "team_progress_advance":
              if (typeof data.maxPageIndex === "number") {
                callbacksRef.current.onProgressAdvance?.(
                  data.maxPageIndex,
                  data.advancedBy || "",
                );
              }
              break;

            // 🆕 Phase 2c：寬限期過了（30 秒未重連）
            case "team_member_grace_expired":
              if (data.userId) {
                callbacksRef.current.onGraceExpired?.(
                  data.userId,
                  data.userName || "",
                  data.autoLeaveInMs || 120_000,
                );
              }
              break;

            // 🆕 Phase 2c+ leader-decide：隊長下決定
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

            // ready_status_changed：team-lifecycle REST 廣播完整 team 物件（含 members）
            case "ready_status_changed":
              if (data.team) {
                callbacksRef.current.onReadyStatusChanged?.(data.team);
              }
              break;
          }
        } catch {
          // WebSocket 訊息解析失敗
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        // 🆕 2026-05-05: 統計 + 排重連（除非 unmount 主動關）
        statsRef.current.disconnectCount += 1;
        if (!intentionalCloseRef.current) {
          if (reconnectAttemptsRef.current >= 1) {
            statsRef.current.reconnectFailCount += 1;
          }
          // 🆕 連 3 次重連失敗 → 上報事件（網路長時間不通）
          if (reconnectAttemptsRef.current === 3) {
            reportClientEvent({
              event: "ws_reconnect_failed",
              message: `WS 重連失敗 ${reconnectAttemptsRef.current} 次`,
              context: {
                teamId,
                userId,
                disconnectCount: statsRef.current.disconnectCount,
                reconnectFailCount: statsRef.current.reconnectFailCount,
              },
            });
          }
          scheduleReconnect();
        }
      };

      wsRef.current = ws;
    } catch {
      // WebSocket 連線建立失敗 → 也排重連
      if (!intentionalCloseRef.current) scheduleReconnect();
    }
    };

    // 🆕 2026-05-05: 切回 app / 解鎖時、若已斷線 → 立即重連（不等 backoff）
    //   也順便發 keepalive 通知 server「我還活著」（即使連線正常、避免被 terminate）
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        reconnectAttemptsRef.current = 0;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        connect();
      } else if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "keepalive" }));
        } catch { /* ignore */ }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // 🆕 2026-05-05: 主動 keepalive 每 25 秒送 — 對抗 browser tab background throttle
    //   原問題：玩家看 tab 還開、但 browser throttle 沒及時回 pong → server terminate
    //   修法：client 主動送 message、server 視為「還活著」（重置 missedPings）
    //   25s < server ping interval (30s)、確保至少每個 ping 週期內有訊號
    const keepaliveInterval = setInterval(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "keepalive" }));
        } catch { /* ignore */ }
      }
    }, 25_000);

    // 第一次連線
    connect();

    return () => {
      intentionalCloseRef.current = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(keepaliveInterval);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [teamId, userId, userName, alsoJoinSessionId]); // ⚠️ 不放 callback：用 callbacksRef.current 取代

  const sendChat = useCallback((message: string, messageType: string = "text") => {
    if (wsRef.current?.readyState === WebSocket.OPEN && teamId && userId && userName) {
      wsRef.current.send(JSON.stringify({
        type: "team_chat",
        userId,
        userName,
        message,
        messageType,
      }));
    }
  }, [teamId, userId, userName]);

  const sendLocation = useCallback((latitude: number, longitude: number, accuracy: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userId && userName) {
      wsRef.current.send(JSON.stringify({
        type: "team_location",
        userId,
        userName,
        latitude,
        longitude,
        accuracy,
      }));
    }
  }, [userId, userName]);

  const sendVote = useCallback((voteId: string, pageId: string, choice: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userId && userName) {
      wsRef.current.send(JSON.stringify({
        type: "team_vote",
        voteId,
        pageId,
        userId,
        userName,
        choice,
      }));
    }
  }, [userId, userName]);

  const sendReady = useCallback((isReady: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && userId && userName) {
      wsRef.current.send(JSON.stringify({
        type: "team_ready",
        userId,
        userName,
        isReady,
      }));
    }
  }, [userId, userName]);

  /**
   * 🆕 Phase 3.2 LockCoop 廣播 — 廣義「動作 + payload」訊息
   *   action: "code"（共享輸入更新）/ "attempt"（次數累計）/ "unlocked" / "failed"
   *   server 端純轉發，不驗證；驗證在 client 觸發者
   */
  const sendLockCoopSync = useCallback(
    (action: string, payload: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
        wsRef.current.send(
          JSON.stringify({
            type: "team_lock_coop_sync",
            userId,
            action,
            payload,
          }),
        );
      }
    },
    [userId],
  );

  /**
   * 🆕 Phase 3.3 RelayMission 廣播 — 接力任務段間切換
   *   action: "segment_complete" / "all_complete"
   *   payload: { segmentIndex, completedBy, nextSegmentIndex? }
   */
  const sendRelaySync = useCallback(
    (action: string, payload: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
        wsRef.current.send(
          JSON.stringify({
            type: "team_relay_sync",
            userId,
            action,
            payload,
          }),
        );
      }
    },
    [userId],
  );

  /**
   * 🆕 Phase 4 TerritoryCapture 廣播 — 地盤戰 session 範圍廣播
   *   action: "capture" / "snapshot"
   *   payload: { pointId, teamId, capturedAt }
   *   server 端用 broadcastToSession（多隊共享 session）
   */
  const sendTerritorySync = useCallback(
    (action: string, payload: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
        wsRef.current.send(
          JSON.stringify({
            type: "territory_capture_sync",
            userId,
            action,
            payload,
          }),
        );
      }
    },
    [userId],
  );

  /**
   * 🆕 Phase 3.1 part 3 補完：ChoiceVerifyRace 玩家答題即時同步給同隊
   *   client send "race_answer" → server broadcast "race_answered" 給同隊全員
   */
  const sendRaceAnswer = useCallback(
    (record: {
      displayName: string;
      questionIndex: number;
      selectedOption: number;
      isCorrect: boolean;
      points: number;
    }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && userId) {
        wsRef.current.send(
          JSON.stringify({
            type: "race_answer",
            userId,
            displayName: record.displayName,
            questionIndex: record.questionIndex,
            selectedOption: record.selectedOption,
            isCorrect: record.isCorrect,
            points: record.points,
            answeredAt: new Date().toISOString(),
          }),
        );
      }
    },
    [userId],
  );

  /** 🆕 2026-05-05: 取連線統計 snapshot（給觀測 / 上報用） */
  const getConnectionStats = useCallback(() => ({
    ...statsRef.current,
    isConnected,
    isReconnecting,
    currentAttempts: reconnectAttemptsRef.current,
  }), [isConnected, isReconnecting]);

  return {
    isConnected,
    isReconnecting,  // 🆕 2026-05-05: UI 顯示「重連中」用
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
