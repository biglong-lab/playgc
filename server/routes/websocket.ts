import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { storage } from "../storage";
import { mqttService } from "../mqttService";
import { verifyFirebaseToken } from "../firebaseAuth";
import type { WebSocketClient, RouteContext } from "./types";

// 從 URL 解析 query 參數
function parseQueryParams(url: string | undefined): Record<string, string> {
  if (!url) return {};
  const queryString = url.split("?")[1];
  if (!queryString) return {};

  const params: Record<string, string> = {};
  queryString.split("&").forEach((pair) => {
    const [key, value] = pair.split("=");
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  });
  return params;
}

export function setupWebSocket(httpServer: Server): RouteContext {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients: Map<string, Set<WebSocketClient>> = new Map();
  const teamClients: Map<string, Set<WebSocketClient>> = new Map();
  const matchClients: Map<string, Set<WebSocketClient>> = new Map();

  wss.on("connection", async (ws: WebSocketClient, request: IncomingMessage) => {
    ws.isAlive = true;

    // 解析 URL 中的 token 參數進行認證
    const params = parseQueryParams(request.url);
    const token = params.token;

    // 如果沒有提供 token，記錄警告但允許連線（向後兼容）
    // 後續版本可改為強制要求 token
    let authenticatedUserId: string | null = null;

    if (token) {
      try {
        const decodedToken = await verifyFirebaseToken(token);
        if (decodedToken) {
          authenticatedUserId = decodedToken.uid;
          ws.authenticatedUserId = authenticatedUserId;
        }
      } catch {
        console.warn("WebSocket 連線 token 驗證失敗");
      }
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case "join":
            // 驗證：如果有認證的 userId，確保訊息中的 userId 匹配
            if (ws.authenticatedUserId && message.userId !== ws.authenticatedUserId) {
              ws.send(JSON.stringify({
                type: "error",
                message: "userId 與認證身份不符",
              }));
              return;
            }

            ws.sessionId = message.sessionId;
            ws.userId = message.userId;
            ws.userName = message.userName;

            if (!clients.has(message.sessionId)) {
              clients.set(message.sessionId, new Set());
            }
            clients.get(message.sessionId)?.add(ws);

            broadcastToSession(message.sessionId, {
              type: "user_joined",
              userId: message.userId,
              userName: message.userName,
            });
            break;

          case "team_join":
            // 驗證：如果有認證的 userId，確保訊息中的 userId 匹配
            if (ws.authenticatedUserId && message.userId !== ws.authenticatedUserId) {
              ws.send(JSON.stringify({
                type: "error",
                message: "userId 與認證身份不符",
              }));
              return;
            }

            ws.teamId = message.teamId;
            ws.userId = message.userId;
            ws.userName = message.userName;

            if (!teamClients.has(message.teamId)) {
              teamClients.set(message.teamId, new Set());
            }
            teamClients.get(message.teamId)?.add(ws);

            broadcastToTeam(message.teamId, {
              type: "team_member_joined",
              userId: message.userId,
              userName: message.userName,
              timestamp: new Date().toISOString(),
            });
            break;

          case "team_chat":
            if (ws.teamId) {
              broadcastToTeam(ws.teamId, {
                type: "team_chat",
                teamId: ws.teamId,
                userId: message.userId,
                userName: message.userName,
                message: message.message,
                messageType: message.messageType || "text",
                timestamp: new Date().toISOString(),
              });
            }
            break;

          case "team_location":
            if (ws.teamId) {
              broadcastToTeam(ws.teamId, {
                type: "team_location",
                userId: message.userId,
                userName: message.userName,
                latitude: message.latitude,
                longitude: message.longitude,
                accuracy: message.accuracy,
                timestamp: new Date().toISOString(),
              }, ws);
            }
            break;

          case "team_vote":
            if (ws.teamId && message.voteId) {
              broadcastToTeam(ws.teamId, {
                type: "team_vote_cast",
                voteId: message.voteId,
                pageId: message.pageId,
                userId: message.userId,
                userName: message.userName,
                choice: message.choice,
                timestamp: new Date().toISOString(),
              });
            }
            break;

          case "team_score":
            if (ws.teamId) {
              broadcastToTeam(ws.teamId, {
                type: "team_score_update",
                teamId: ws.teamId,
                score: message.score,
                change: message.change,
                reason: message.reason,
                timestamp: new Date().toISOString(),
              });
            }
            break;

          case "team_ready":
            if (ws.teamId) {
              broadcastToTeam(ws.teamId, {
                type: "team_ready_update",
                userId: message.userId,
                userName: message.userName,
                isReady: message.isReady,
                timestamp: new Date().toISOString(),
              });
            }
            break;

          case "chat":
            if (ws.sessionId) {
              await storage.createChatMessage({
                sessionId: ws.sessionId,
                userId: message.userId,
                message: message.message,
              });

              broadcastToSession(ws.sessionId, {
                type: "chat",
                sessionId: ws.sessionId,
                userId: message.userId,
                userName: message.userName,
                message: message.message,
                timestamp: new Date().toISOString(),
              });
            }
            break;

          case "game_update":
            if (ws.sessionId) {
              broadcastToSession(ws.sessionId, {
                type: "game_update",
                ...message,
              });
            }
            break;

          // 對戰系統事件
          case "match_join": {
            const matchId = message.matchId;
            if (matchId) {
              (ws as any).matchId = matchId;
              if (!matchClients.has(matchId)) {
                matchClients.set(matchId, new Set());
              }
              matchClients.get(matchId)?.add(ws);
              broadcastToMatch(matchId, {
                type: "match_participant_joined",
                userId: message.userId,
                userName: message.userName,
                timestamp: new Date().toISOString(),
              });
            }
            break;
          }

          case "match_score_update": {
            const mId = (ws as any).matchId;
            if (mId) {
              broadcastToMatch(mId, {
                type: "match_ranking",
                userId: message.userId,
                score: message.score,
                timestamp: new Date().toISOString(),
              });
            }
            break;
          }

          case "relay_handoff": {
            const relayMatchId = (ws as any).matchId;
            if (relayMatchId) {
              broadcastToMatch(relayMatchId, {
                type: "relay_handoff",
                fromUserId: message.fromUserId,
                toUserId: message.toUserId,
                segment: message.segment,
                timestamp: new Date().toISOString(),
              });
            }
            break;
          }
        }
      } catch (error) {
        console.error("WebSocket 訊息處理錯誤:", error);
        // 發送錯誤回應給客戶端
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "error",
            message: "訊息處理失敗",
          }));
        }
      }
    });

    ws.on("close", () => {
      if (ws.sessionId) {
        clients.get(ws.sessionId)?.delete(ws);
        if (clients.get(ws.sessionId)?.size === 0) {
          clients.delete(ws.sessionId);
        }

        broadcastToSession(ws.sessionId, {
          type: "user_left",
          userId: ws.userId,
          userName: ws.userName,
        });
      }

      if (ws.teamId) {
        teamClients.get(ws.teamId)?.delete(ws);
        if (teamClients.get(ws.teamId)?.size === 0) {
          teamClients.delete(ws.teamId);
        }

        broadcastToTeam(ws.teamId, {
          type: "team_member_left",
          userId: ws.userId,
          userName: ws.userName,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocketClient) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  mqttService.setHitBroadcastHandler((sessionId: string, record: any) => {
    broadcastToSession(sessionId, {
      type: "shooting_hit",
      record,
    });
  });

  function broadcastToSession(sessionId: string, message: any) {
    const sessionClients = clients.get(sessionId);
    if (sessionClients) {
      const payload = JSON.stringify(message);
      sessionClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  }

  function broadcastToTeam(teamId: string, message: any, excludeClient?: WebSocketClient) {
    const teamClientSet = teamClients.get(teamId);
    if (teamClientSet) {
      const payload = JSON.stringify(message);
      teamClientSet.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== excludeClient) {
          client.send(payload);
        }
      });
    }
  }

  return { broadcastToSession, broadcastToTeam };
}
