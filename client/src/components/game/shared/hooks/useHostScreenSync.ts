// 🆕 ADR-0004: useHostScreenSync — host 元件統一 WS 訂閱 hook
//
// 取代 PollLivePage / 各 host 元件容器頁原本各自管理 ws 的做法。
// 所有 host 元件用此 hook 即可：
//   - 自動連 ws + register（依路徑判斷 role）
//   - 訂閱 host_screen_state → 提供 state
//   - sendPulse(pulseType, payload) → 玩家送訊號
//   - broadcastState(newState) → 大螢幕廣播
//
// 路徑判斷：
//   - /host/:sessionId → role='host'，需 ?token=xxx
//   - /play/:sessionId → role='player'
//
// 🌐 Phase 3 (2026-05-08)：永遠走全域 WebSocketProvider
//   - 共用全域 ws connection（與 useTeamWebSocket / ChatPanel 等同條 ws）
//   - 自動 reconnect / keepalive / visibilitychange（Provider 統一管）

import { useEffect, useRef, useState, useCallback } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";

export interface HostScreenSyncResult<TState> {
  /** 當前 state（從 host_screen_state 廣播取得，初始 null） */
  state: TState | null;
  /** 是否已連線 + register 成功 */
  connected: boolean;
  /** 連線錯誤（hostToken 過期 / session 不存在） */
  error: string | null;
  /** 玩家端送訊號 */
  sendPulse: (pulseType: string, payload: unknown) => void;
  /** 大螢幕端廣播狀態 */
  broadcastState: (newState: TState) => void;
  /** 大螢幕端是否為 host（給容器判斷） */
  hostMode: boolean;
}

interface RouteParts {
  hostMode: boolean;
  sessionId: string;
  hostToken: string | null;
}

function parseRouteFromUrl(): RouteParts {
  const path = window.location.pathname;
  const hostMatch = path.match(/^\/host\/([^/]+)/);
  const playMatch = path.match(/^\/play\/([^/]+)/);
  if (hostMatch) {
    const token = new URLSearchParams(window.location.search).get("token");
    return { hostMode: true, sessionId: hostMatch[1], hostToken: token };
  }
  if (playMatch) {
    return { hostMode: false, sessionId: playMatch[1], hostToken: null };
  }
  return { hostMode: false, sessionId: "", hostToken: null };
}

// ====================================================================
// useHostScreenSync — 基本版（沒處理玩家 pulse 計算）
// ====================================================================
export function useHostScreenSync<TState = unknown>(): HostScreenSyncResult<TState> {
  const wsApi = useWebSocket();
  const [state, setState] = useState<TState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = useRef(parseRouteFromUrl()).current;

  useEffect(() => {
    if (!route.sessionId) return;

    const release = wsApi.ensureConnected();
    const releaseJoin = wsApi.registerOnConnect(
      `hostScreen:${route.sessionId}:${route.hostMode ? "host" : "player"}`,
      (ws) => {
        const registerMsg: Record<string, unknown> = {
          type: "host_screen_register",
          sessionId: route.sessionId,
          role: route.hostMode ? "host" : "player",
        };
        if (route.hostMode && route.hostToken) {
          registerMsg.hostToken = route.hostToken;
        }
        ws.send(JSON.stringify(registerMsg));
      },
    );
    const unsubscribe = wsApi.subscribe((data) => {
      const msg = data as {
        type?: string;
        message?: string;
        sessionId?: string;
        state?: unknown;
      };
      if (msg.type === "host_screen_error") {
        setError(msg.message ?? "host_screen_error");
        setConnected(false);
        return;
      }
      if (msg.type === "host_screen_state" && msg.sessionId === route.sessionId) {
        setState(msg.state as TState);
        setConnected(true);
      }
    });

    return () => {
      releaseJoin();
      unsubscribe();
      release();
    };
  }, [route.sessionId, route.hostMode, route.hostToken, wsApi]);

  const sendPulse = useCallback(
    (pulseType: string, payload: unknown) => {
      if (route.hostMode) return; // 只有玩家端能送 pulse
      wsApi.send({
        type: "host_screen_pulse",
        sessionId: route.sessionId,
        pulseType,
        payload,
      });
    },
    [route.sessionId, route.hostMode, wsApi],
  );

  const broadcastState = useCallback(
    (newState: TState) => {
      if (!route.hostMode) return; // 只有大螢幕端能廣播
      setState(newState); // 樂觀更新
      wsApi.send({
        type: "host_screen_state",
        sessionId: route.sessionId,
        state: newState,
      });
    },
    [route.sessionId, route.hostMode, wsApi],
  );

  return {
    state,
    connected,
    error,
    sendPulse,
    broadcastState,
    hostMode: route.hostMode,
  };
}

// ====================================================================
// useHostScreenSyncWithPulse — 進階版（大螢幕端含 onPulse 處理）
// 大螢幕端收到玩家 pulse → 用 onPulse 計算新 state → 自動 broadcast
// （TriviaShowdown 猜謎用）
// ====================================================================
export function useHostScreenSyncWithPulse<TState>(opts: {
  /** 大螢幕端收到玩家 pulse 時的處理（須回傳新 state，hook 自動 broadcast） */
  onPulse?: (pulseType: string, payload: unknown, currentState: TState | null) => TState | null;
}): HostScreenSyncResult<TState> {
  const wsApi = useWebSocket();
  const [state, setState] = useState<TState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = useRef(parseRouteFromUrl()).current;
  const stateRef = useRef<TState | null>(null);
  stateRef.current = state;

  // 用 ref 存最新 onPulse、避免 effect 依賴整個 opts 物件
  const onPulseRef = useRef(opts.onPulse);
  useEffect(() => {
    onPulseRef.current = opts.onPulse;
  }, [opts.onPulse]);

  useEffect(() => {
    if (!route.sessionId) return;

    const release = wsApi.ensureConnected();
    const releaseJoin = wsApi.registerOnConnect(
      `hostScreen:${route.sessionId}:${route.hostMode ? "host" : "player"}`,
      (ws) => {
        const registerMsg: Record<string, unknown> = {
          type: "host_screen_register",
          sessionId: route.sessionId,
          role: route.hostMode ? "host" : "player",
        };
        if (route.hostMode && route.hostToken) {
          registerMsg.hostToken = route.hostToken;
        }
        ws.send(JSON.stringify(registerMsg));
      },
    );
    const unsubscribe = wsApi.subscribe((data) => {
      const msg = data as {
        type?: string;
        message?: string;
        sessionId?: string;
        state?: unknown;
        pulseType?: string;
        payload?: unknown;
      };
      if (msg.type === "host_screen_error") {
        setError(msg.message ?? "host_screen_error");
        setConnected(false);
        return;
      }
      if (msg.type === "host_screen_state" && msg.sessionId === route.sessionId) {
        setState(msg.state as TState);
        setConnected(true);
      }
      // 大螢幕端：收到玩家 pulse → 計算新 state → broadcast
      const onPulse = onPulseRef.current;
      if (msg.type === "host_screen_pulse" && route.hostMode && onPulse) {
        const newState = onPulse(
          msg.pulseType ?? "",
          msg.payload,
          stateRef.current,
        );
        if (newState !== null) {
          setState(newState);
          wsApi.send({
            type: "host_screen_state",
            sessionId: route.sessionId,
            state: newState,
          });
        }
      }
    });

    return () => {
      releaseJoin();
      unsubscribe();
      release();
    };
  }, [route.sessionId, route.hostMode, route.hostToken, wsApi]);

  const sendPulse = useCallback(
    (pulseType: string, payload: unknown) => {
      if (route.hostMode) return;
      wsApi.send({
        type: "host_screen_pulse",
        sessionId: route.sessionId,
        pulseType,
        payload,
      });
    },
    [route.sessionId, route.hostMode, wsApi],
  );

  const broadcastState = useCallback(
    (newState: TState) => {
      if (!route.hostMode) return;
      setState(newState);
      wsApi.send({
        type: "host_screen_state",
        sessionId: route.sessionId,
        state: newState,
      });
    },
    [route.sessionId, route.hostMode, wsApi],
  );

  return {
    state,
    connected,
    error,
    sendPulse,
    broadcastState,
    hostMode: route.hostMode,
  };
}
