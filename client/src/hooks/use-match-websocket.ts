// 對戰 WebSocket Hook — 即時排名、倒數、傳棒事件
// 含指數退避重連 + 前端倒數計時
import { useEffect, useRef, useState, useCallback } from "react";
import { getIdToken } from "@/lib/firebase";

interface MatchRankingEntry {
  readonly userId: string;
  readonly score: number;
  readonly rank: number;
}

interface MatchWebSocketState {
  readonly isConnected: boolean;
  readonly ranking: readonly MatchRankingEntry[];
  readonly countdown: number | null;
  readonly matchStatus: string | null;
  readonly lastEvent: Record<string, unknown> | null;
}

// 重連設定
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const RECONNECT_MAX_ATTEMPTS = 10;

export function useMatchWebSocket(matchId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const [state, setState] = useState<MatchWebSocketState>({
    isConnected: false,
    ranking: [],
    countdown: null,
    matchStatus: null,
    lastEvent: null,
  });

  // 清理倒數計時器
  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // 啟動前端倒數計時
  const startCountdown = useCallback((seconds: number) => {
    clearCountdownTimer();

    let remaining = seconds;
    setState((prev) => ({
      ...prev,
      countdown: remaining,
      matchStatus: "countdown",
    }));

    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        clearCountdownTimer();
        setState((prev) => ({ ...prev, countdown: 0 }));

        // 倒數完成 → 通知後端
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "match_countdown_complete",
          }));
        }
      } else {
        setState((prev) => ({ ...prev, countdown: remaining }));
      }
    }, 1000);
  }, [clearCountdownTimer]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    if (!matchId) return;

    isMountedRef.current = true;
    let ws: WebSocket | null = null;

    const connect = async () => {
      if (!isMountedRef.current) return;

      try {
        const token = await getIdToken();
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const url = `${protocol}//${window.location.host}/ws${token ? `?token=${token}` : ""}`;
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMountedRef.current) return;
          reconnectAttemptRef.current = 0;
          setState((prev) => ({ ...prev, isConnected: true }));
          // 自動加入對戰房間
          ws?.send(JSON.stringify({
            type: "match_join",
            matchId,
          }));
        };

        ws.onmessage = (event) => {
          if (!isMountedRef.current) return;
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case "match_ranking":
                setState((prev) => ({
                  ...prev,
                  ranking: data.ranking ?? [],
                  lastEvent: data,
                }));
                break;

              case "match_countdown":
                startCountdown(data.seconds ?? 3);
                setState((prev) => ({ ...prev, lastEvent: data }));
                break;

              case "match_started":
                clearCountdownTimer();
                setState((prev) => ({
                  ...prev,
                  countdown: null,
                  matchStatus: "playing",
                  lastEvent: data,
                }));
                break;

              case "match_finished":
                clearCountdownTimer();
                setState((prev) => ({
                  ...prev,
                  ranking: data.ranking ?? prev.ranking,
                  matchStatus: "finished",
                  lastEvent: data,
                }));
                break;

              case "relay_handoff":
                setState((prev) => ({
                  ...prev,
                  lastEvent: data,
                }));
                break;

              default:
                setState((prev) => ({ ...prev, lastEvent: data }));
            }
          } catch {
            // 忽略無法解析的訊息
          }
        };

        ws.onclose = () => {
          if (!isMountedRef.current) return;
          setState((prev) => ({ ...prev, isConnected: false }));
          scheduleReconnect();
        };

        ws.onerror = () => {
          // onclose 會在 onerror 之後觸發，由 onclose 處理重連
        };
      } catch {
        if (isMountedRef.current) {
          scheduleReconnect();
        }
      }
    };

    // 指數退避重連
    const scheduleReconnect = () => {
      if (!isMountedRef.current) return;
      if (reconnectAttemptRef.current >= RECONNECT_MAX_ATTEMPTS) return;

      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(
        RECONNECT_BASE_DELAY * Math.pow(2, attempt),
        RECONNECT_MAX_DELAY,
      );
      reconnectAttemptRef.current = attempt + 1;

      reconnectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          connect();
        }
      }, delay);
    };

    connect();

    return () => {
      isMountedRef.current = false;
      clearCountdownTimer();

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      ws?.close();
      wsRef.current = null;
    };
  }, [matchId, startCountdown, clearCountdownTimer]);

  return { ...state, sendMessage };
}
