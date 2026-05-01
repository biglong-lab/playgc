import { useEffect, useRef, useCallback, useState } from "react";

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
  choice?: string;
  voteId?: string;
  pageId?: string;
  score?: number;
  change?: number;
  reason?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

interface UseTeamWebSocketOptions {
  teamId: string | undefined;
  userId: string | undefined;
  userName: string | undefined;
  onMessage?: (message: TeamMessage) => void;
  onMemberJoined?: (userId: string, userName: string) => void;
  onMemberLeft?: (userId: string, userName: string) => void;
  onLocationUpdate?: (location: TeamMemberLocation) => void;
  onVoteCast?: (voteId: string, pageId: string, userId: string, choice: string) => void;
  onScoreUpdate?: (score: number, change: number, reason: string) => void;
  onReadyUpdate?: (userId: string, isReady: boolean) => void;
}

export function useTeamWebSocket({
  teamId,
  userId,
  userName,
  onMessage,
  onMemberJoined,
  onMemberLeft,
  onLocationUpdate,
  onVoteCast,
  onScoreUpdate,
  onReadyUpdate,
}: UseTeamWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [memberLocations, setMemberLocations] = useState<Map<string, TeamMemberLocation>>(new Map());

  // 🔧 Fix（2026-05-02）：把 callback 放進 ref，避免父元件 re-render 時
  //   產生新 reference 觸發 useEffect 重跑 → WebSocket 重連 →
  //   server 又廣播 member_joined → toast 一直跳
  const callbacksRef = useRef({
    onMessage,
    onMemberJoined,
    onMemberLeft,
    onLocationUpdate,
    onVoteCast,
    onScoreUpdate,
    onReadyUpdate,
  });
  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onMemberJoined,
      onMemberLeft,
      onLocationUpdate,
      onVoteCast,
      onScoreUpdate,
      onReadyUpdate,
    };
  }, [onMessage, onMemberJoined, onMemberLeft, onLocationUpdate, onVoteCast, onScoreUpdate, onReadyUpdate]);

  useEffect(() => {
    if (!teamId || !userId || !userName) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(JSON.stringify({
          type: "team_join",
          teamId,
          userId,
          userName,
        }));
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
      };

      wsRef.current = ws;

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch {
      // WebSocket 連線建立失敗
    }
  }, [teamId, userId, userName]); // ⚠️ 不放 callback：用 callbacksRef.current 取代

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

  return {
    isConnected,
    memberLocations,
    sendChat,
    sendLocation,
    sendVote,
    sendReady,
  };
}
