// 🌐 WebSocketProvider — 全域單例 WebSocket connection（Phase 1 / 2026-05-08）
//
// 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md §4
//
// 設計：
//   - 整個 app 全域只有 1 條 ws connection（同一 user）
//   - 多個 hook（useTeamWebSocket / useHostScreenSync / useTeamShootingSync / ChatPanel）
//     都透過 useWebSocket() 從 Provider 拿同一條 connection
//   - 元件 mount/unmount 不會 close ws（Provider 一直保留）
//   - acquire(config) 提供 teamId/userId/userName，Provider 確保 ws 連到該 user
//   - subscribe(handler) 讓多個元件都收 message
//   - send(msg) 透過 current ws 發送
//
// 行為 = 原 use-team-websocket.ts 提取（不減少功能）：
//   - exp backoff reconnect (1s → 2s → 4s → 8s → 16s → max 30s + ±20% jitter)
//   - 25 秒 client keepalive（對抗 browser tab background throttle）
//   - visibilitychange 即時重連 / 主動 keepalive
//   - statsRef 追蹤 disconnect / reconnect success/fail count
//   - 連 3 次失敗 → reportClientEvent 上報

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { reportClientEvent } from "@/lib/event-report";

// ============== 訊息型別（與 use-team-websocket.ts 一致）==============

export interface TeamMessage {
  type: string;
  teamId?: string;
  userId?: string;
  userName?: string;
  message?: string;
  messageType?: string;
  timestamp?: string;
  isReady?: boolean;
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
  sessionId?: string;
  gameId?: string;
  maxPageIndex?: number;
  advancedBy?: string;
  autoLeaveInMs?: number;
  graceInMs?: number;
  action?: string;
  targetUserId?: string;
  leaderUserId?: string;
}

export interface AcquireConfig {
  teamId: string;
  userId: string;
  userName: string;
  alsoJoinSessionId?: string;
}

export interface ConnectionStats {
  connectAt: number;
  disconnectCount: number;
  reconnectSuccessCount: number;
  reconnectFailCount: number;
  isConnected: boolean;
  isReconnecting: boolean;
  currentAttempts: number;
}

interface WebSocketContextValue {
  isConnected: boolean;
  isReconnecting: boolean;
  /**
   * 確保 ws 已連到指定 user（給 useTeamWebSocket 用）
   * 回傳 release fn（unmount 時呼叫；目前是 no-op、ws 全期間保留）
   */
  acquire: (config: AcquireConfig) => () => void;
  /**
   * 🆕 Phase 2：確保 ws 已連線（不附 user info，給 ChatPanel / HostScreen 等用）
   * 回傳 release fn（ref counting 概念、未來可改成最後一個 release 才關 ws）
   */
  ensureConnected: () => () => void;
  /**
   * 🆕 Phase 2：註冊 on-connect handler（每次 ws 連到 OPEN 都會呼叫、reconnect 也會）
   * key 用來 dedupe（同 hook 重複註冊只保留最新）
   * 回傳 unregister fn
   */
  registerOnConnect: (key: string, handler: (ws: WebSocket) => void) => () => void;
  /** 訂閱所有 inbound 訊息。回傳 unsubscribe fn */
  subscribe: (handler: (msg: TeamMessage) => void) => () => void;
  /** 透過 current ws 發送訊息。回傳是否成功 */
  send: (msg: object) => boolean;
  /** 連線統計（給觀測 / 上報用）*/
  getConnectionStats: () => ConnectionStats;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used inside <WebSocketProvider>");
  }
  return ctx;
}

// ============== Provider ==============

export function WebSocketProvider({ children }: PropsWithChildren) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // 多 subscriber：所有 hook 都收到 message
  const handlersRef = useRef<Set<(msg: TeamMessage) => void>>(new Set());

  // 🆕 Phase 2：on-connect handlers（每次 ws 連到 OPEN 都呼叫、reconnect 也會）
  // 用 Map<key, handler> 達成 dedupe（同 hook 重複 register 只保留最新）
  const onConnectHandlersRef = useRef<Map<string, (ws: WebSocket) => void>>(new Map());

  // 🆕 Phase 2：ensureConnected ref counting
  const connectionRefCountRef = useRef(0);

  // 當前 connection 對應的 config（teamId/userId/userName）
  const configRef = useRef<AcquireConfig | null>(null);

  // 重連邏輯
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  // 統計
  const statsRef = useRef({
    connectAt: 0,
    disconnectCount: 0,
    reconnectSuccessCount: 0,
    reconnectFailCount: 0,
  });

  // exp backoff（首次立即重連 + 後續 exp backoff）
  // 🚀 2026-05-10: 首次 abnormal close 改 200ms（原 800-1200ms）→ 大幅降低 grace 觸發機率
  //   因 server grace=30s、首次重連快回來就不會被誤判離線
  //   後續嘗試仍 exp backoff 防 spam server（500ms / 1s / 2s / ... / 30s）
  const computeBackoff = useCallback((attempts: number): number => {
    if (attempts === 0) return 200; // 首次幾乎立即重連
    const base = 500;
    const ms = Math.min(base * Math.pow(2, attempts - 1), 30_000);
    const jitter = ms * 0.2 * (Math.random() * 2 - 1);
    return Math.max(500, Math.floor(ms + jitter));
  }, []);

  const connect = useCallback(() => {
    if (intentionalCloseRef.current) return;
    const config = configRef.current;
    // 🐛 2026-06-16 修復:host-screen 模式(ensureConnected,無 config)永遠連不上 →
    //   大螢幕↔手機互動全失效。改為:有 config(team) 或 有 ensureConnected 引用者(host-screen)就連。
    //   原本 `if (!config) return` 讓 ensureConnected 呼叫的 connect() 立即 return、ws 從不建立。
    if (!config && connectionRefCountRef.current === 0) return;
    // 已 OPEN 不重連
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsReconnecting(false);
        statsRef.current.connectAt = Date.now();
        if (reconnectAttemptsRef.current > 0) {
          statsRef.current.reconnectSuccessCount += 1;
        }
        reconnectAttemptsRef.current = 0;

        // legacy team config（給 useTeamWebSocketViaProvider 用）
        const c = configRef.current;
        if (c) {
          ws.send(
            JSON.stringify({
              type: "team_join",
              teamId: c.teamId,
              userId: c.userId,
              userName: c.userName,
            }),
          );
          if (c.alsoJoinSessionId) {
            ws.send(
              JSON.stringify({
                type: "join",
                sessionId: c.alsoJoinSessionId,
                userId: c.userId,
                userName: c.userName,
              }),
            );
          }
        }

        // 🆕 Phase 2：所有 onConnect handlers（ChatPanel / HostScreen 等發自己的 join）
        onConnectHandlersRef.current.forEach((handler) => {
          try {
            handler(ws);
          } catch {
            // handler error 不影響其他
          }
        });
      };

      ws.onmessage = (event) => {
        try {
          const data: TeamMessage = JSON.parse(event.data);
          // 廣播給所有 subscriber
          handlersRef.current.forEach((handler) => {
            try {
              handler(data);
            } catch {
              /* ignore handler error，避免影響其他 subscriber */
            }
          });
        } catch {
          /* parse error ignore */
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        statsRef.current.disconnectCount += 1;
        if (intentionalCloseRef.current) return;

        if (reconnectAttemptsRef.current >= 1) {
          statsRef.current.reconnectFailCount += 1;
        }
        if (reconnectAttemptsRef.current === 3) {
          reportClientEvent({
            event: "ws_reconnect_failed",
            message: `WS 重連失敗 ${reconnectAttemptsRef.current} 次`,
            context: {
              teamId: configRef.current?.teamId,
              userId: configRef.current?.userId,
              disconnectCount: statsRef.current.disconnectCount,
              reconnectFailCount: statsRef.current.reconnectFailCount,
            },
          });
        }

        // 排重連
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        const delay = computeBackoff(reconnectAttemptsRef.current);
        reconnectAttemptsRef.current += 1;
        setIsReconnecting(true);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    } catch {
      // connect throw → 排重連
      if (intentionalCloseRef.current) return;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      const delay = computeBackoff(reconnectAttemptsRef.current);
      reconnectAttemptsRef.current += 1;
      setIsReconnecting(true);
      reconnectTimerRef.current = setTimeout(connect, delay);
    }
  }, [computeBackoff]);

  // visibilitychange + keepalive（同原 hook）
  useEffect(() => {
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
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // 25 秒 client keepalive（對抗 browser tab background throttle）
    const keepaliveInterval = setInterval(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "keepalive" }));
        } catch {
          /* ignore */
        }
      }
    }, 25_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(keepaliveInterval);
    };
  }, [connect]);

  // unmount 全 app（極罕見）→ 主動關 ws
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // ============== Public API ==============

  const acquire = useCallback(
    (config: AcquireConfig): (() => void) => {
      const current = configRef.current;
      const sameUser =
        current &&
        current.teamId === config.teamId &&
        current.userId === config.userId &&
        current.userName === config.userName &&
        current.alsoJoinSessionId === config.alsoJoinSessionId;

      if (sameUser) {
        // 已連、不動
        return () => {
          // no-op：不主動關 ws、Provider 全期間保留
        };
      }

      // 🚀 2026-05-10 根因修復：只 alsoJoinSessionId 變動 → 保留 ws、send 新 join
      //   原 bug：玩家從 lobby 進 game page、alsoJoinSessionId 變動 → close ws "config_change"
      //   → server 5 秒 buffer + grace 30s + auto_leave 120s 流程 → 玩家被誤判離線
      //   生產 7 天統計：close.reason='config_change' 佔 67%、grace_start 78%、grace_expired 73%
      //   修法：teamId/userId/userName 不變、只 alsoJoinSessionId 變 → 保留 ws、補發 join
      const onlySessionChanged =
        current &&
        current.teamId === config.teamId &&
        current.userId === config.userId &&
        current.userName === config.userName &&
        current.alsoJoinSessionId !== config.alsoJoinSessionId;

      if (onlySessionChanged) {
        configRef.current = config;
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN && config.alsoJoinSessionId) {
          try {
            ws.send(
              JSON.stringify({
                type: "join",
                sessionId: config.alsoJoinSessionId,
                userId: config.userId,
                userName: config.userName,
              }),
            );
          } catch {
            /* ignore */
          }
        }
        return () => {
          // no-op：保留 ws
        };
      }

      // teamId/userId/userName 變動 → 真的要切 user/team、需重連
      configRef.current = config;
      const oldWs = wsRef.current;
      if (oldWs && oldWs.readyState === WebSocket.OPEN) {
        intentionalCloseRef.current = true;
        try {
          oldWs.close(1000, "user_change");
        } catch {
          /* ignore */
        }
        wsRef.current = null;
        setTimeout(() => {
          intentionalCloseRef.current = false;
          reconnectAttemptsRef.current = 0;
          connect();
        }, 50);
      } else {
        intentionalCloseRef.current = false;
        reconnectAttemptsRef.current = 0;
        connect();
      }

      return () => {
        // no-op：Provider 全期間保留 ws
      };
    },
    [connect],
  );

  const subscribe = useCallback((handler: (msg: TeamMessage) => void): (() => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  // 🆕 Phase 2：ensureConnected — ref counting
  // 第 1 個呼叫 → 觸發 connect（如尚未連）
  // 後續呼叫 → 計數 += 1、不重連
  // release → 計數 -= 1（目前不主動關 ws、Provider 全期間保留）
  const ensureConnected = useCallback((): (() => void) => {
    connectionRefCountRef.current += 1;
    // 沒 active ws 且沒 config → 嘗試連（無 team_join、靠 onConnect handler 發 join）
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      // 用 dummy config 觸發 connect（onopen 內 c 為 null 時不發 team_join）
      // 直接呼 connect()
      intentionalCloseRef.current = false;
      reconnectAttemptsRef.current = 0;
      connect();
    }
    return () => {
      connectionRefCountRef.current = Math.max(0, connectionRefCountRef.current - 1);
      // 不主動關 ws（避免換頁 close-reopen）、Provider 全期間保留
    };
  }, [connect]);

  // 🆕 Phase 2：registerOnConnect — 註冊 ws 連到 OPEN 時要發的 join 訊息
  const registerOnConnect = useCallback(
    (key: string, handler: (ws: WebSocket) => void): (() => void) => {
      onConnectHandlersRef.current.set(key, handler);
      // 若 ws 已連、立即執行一次（補上 reconnect 場景）
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          handler(ws);
        } catch {
          /* ignore */
        }
      }
      return () => {
        onConnectHandlersRef.current.delete(key);
      };
    },
    [],
  );

  const send = useCallback((msg: object): boolean => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(msg));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const getConnectionStats = useCallback(
    (): ConnectionStats => ({
      ...statsRef.current,
      isConnected,
      isReconnecting,
      currentAttempts: reconnectAttemptsRef.current,
    }),
    [isConnected, isReconnecting],
  );

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        isReconnecting,
        acquire,
        ensureConnected,
        registerOnConnect,
        subscribe,
        send,
        getConnectionStats,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}
