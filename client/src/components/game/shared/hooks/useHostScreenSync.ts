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

import { useEffect, useRef, useState, useCallback } from "react";

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

export function useHostScreenSync<TState = unknown>(): HostScreenSyncResult<TState> {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<TState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = useRef(parseRouteFromUrl()).current;

  useEffect(() => {
    if (!route.sessionId) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      const registerMsg: Record<string, unknown> = {
        type: "host_screen_register",
        sessionId: route.sessionId,
        role: route.hostMode ? "host" : "player",
      };
      if (route.hostMode && route.hostToken) {
        registerMsg.hostToken = route.hostToken;
      }
      ws.send(JSON.stringify(registerMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "host_screen_error") {
          setError(msg.message);
          setConnected(false);
          return;
        }
        if (msg.type === "host_screen_state" && msg.sessionId === route.sessionId) {
          setState(msg.state as TState);
          setConnected(true);
        }
        // host_screen_pulse 會送給大螢幕端 — 元件層自己處理（透過後續加的 onPulseReceived）
      } catch {
        /* ignore parse error */
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("WebSocket 連線失敗");

    return () => {
      ws.close();
    };
  }, [route.sessionId, route.hostMode, route.hostToken]);

  const sendPulse = useCallback((pulseType: string, payload: unknown) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (route.hostMode) return; // 只有玩家端能送 pulse
    wsRef.current.send(JSON.stringify({
      type: "host_screen_pulse",
      sessionId: route.sessionId,
      pulseType,
      payload,
    }));
  }, [route.sessionId, route.hostMode]);

  const broadcastState = useCallback((newState: TState) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!route.hostMode) return; // 只有大螢幕端能廣播
    setState(newState); // 樂觀更新
    wsRef.current.send(JSON.stringify({
      type: "host_screen_state",
      sessionId: route.sessionId,
      state: newState,
    }));
  }, [route.sessionId, route.hostMode]);

  return {
    state,
    connected,
    error,
    sendPulse,
    broadcastState,
    hostMode: route.hostMode,
  };
}

/**
 * 大螢幕端進階版：除了 broadcastState 外，提供「處理玩家 pulse」的 callback。
 * 元件層用此計票 / 累計 emoji / 排行等。
 */
export function useHostScreenSyncWithPulse<TState>(opts: {
  /** 大螢幕端收到玩家 pulse 時的處理（須回傳新 state，hook 自動 broadcast） */
  onPulse?: (pulseType: string, payload: unknown, currentState: TState | null) => TState | null;
}): HostScreenSyncResult<TState> {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<TState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = useRef(parseRouteFromUrl()).current;
  const stateRef = useRef<TState | null>(null);
  stateRef.current = state;

  // 用 ref 存最新 onPulse、避免 effect 依賴整個 opts 物件
  // 呼叫端通常用 inline `{ onPulse: handlePulse }`，opts 物件 identity 每次 render 都是新的
  // 若 effect 直接依賴 opts → 會反覆 teardown + reconnect WebSocket（重複註冊 + cache snapshot 抖動）
  const onPulseRef = useRef(opts.onPulse);
  useEffect(() => {
    onPulseRef.current = opts.onPulse;
  }, [opts.onPulse]);

  useEffect(() => {
    if (!route.sessionId) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      const registerMsg: Record<string, unknown> = {
        type: "host_screen_register",
        sessionId: route.sessionId,
        role: route.hostMode ? "host" : "player",
      };
      if (route.hostMode && route.hostToken) {
        registerMsg.hostToken = route.hostToken;
      }
      ws.send(JSON.stringify(registerMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "host_screen_error") {
          setError(msg.message);
          setConnected(false);
          return;
        }
        if (msg.type === "host_screen_state" && msg.sessionId === route.sessionId) {
          setState(msg.state as TState);
          setConnected(true);
        }
        // 大螢幕端：收到玩家 pulse → 用 onPulse 計算新 state → broadcast
        const onPulse = onPulseRef.current;
        if (msg.type === "host_screen_pulse" && route.hostMode && onPulse) {
          const newState = onPulse(msg.pulseType, msg.payload, stateRef.current);
          if (newState !== null) {
            setState(newState);
            ws.send(JSON.stringify({
              type: "host_screen_state",
              sessionId: route.sessionId,
              state: newState,
            }));
          }
        }
      } catch {
        /* ignore parse error */
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("WebSocket 連線失敗");

    return () => {
      ws.close();
    };
  }, [route.sessionId, route.hostMode, route.hostToken]);

  const sendPulse = useCallback((pulseType: string, payload: unknown) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (route.hostMode) return;
    wsRef.current.send(JSON.stringify({
      type: "host_screen_pulse",
      sessionId: route.sessionId,
      pulseType,
      payload,
    }));
  }, [route.sessionId, route.hostMode]);

  const broadcastState = useCallback((newState: TState) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!route.hostMode) return;
    setState(newState);
    wsRef.current.send(JSON.stringify({
      type: "host_screen_state",
      sessionId: route.sessionId,
      state: newState,
    }));
  }, [route.sessionId, route.hostMode]);

  return {
    state,
    connected,
    error,
    sendPulse,
    broadcastState,
    hostMode: route.hostMode,
  };
}
