// 對戰 WebSocket Hook — 即時排名、倒數、傳棒事件
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

export function useMatchWebSocket(matchId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<MatchWebSocketState>({
    isConnected: false,
    ranking: [],
    countdown: null,
    matchStatus: null,
    lastEvent: null,
  });

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    if (!matchId) return;

    let ws: WebSocket | null = null;

    const connect = async () => {
      try {
        const token = await getIdToken();
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const url = `${protocol}//${window.location.host}/ws${token ? `?token=${token}` : ""}`;
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setState((prev) => ({ ...prev, isConnected: true }));
          // 自動加入對戰房間
          ws?.send(JSON.stringify({
            type: "match_join",
            matchId,
          }));
        };

        ws.onmessage = (event) => {
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
                setState((prev) => ({
                  ...prev,
                  countdown: data.seconds,
                  matchStatus: "countdown",
                  lastEvent: data,
                }));
                break;

              case "match_started":
                setState((prev) => ({
                  ...prev,
                  countdown: null,
                  matchStatus: "playing",
                  lastEvent: data,
                }));
                break;

              case "match_finished":
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
          setState((prev) => ({ ...prev, isConnected: false }));
        };
      } catch {
        // 連線失敗
      }
    };

    connect();

    return () => {
      ws?.close();
      wsRef.current = null;
    };
  }, [matchId]);

  return { ...state, sendMessage };
}
