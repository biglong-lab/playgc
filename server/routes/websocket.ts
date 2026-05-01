import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { storage } from "../storage";
import { mqttService } from "../mqttService";
import { verifyFirebaseToken } from "../firebaseAuth";
import { db } from "../db";
import { gameMatches, teamMembers } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { WebSocketClient, RouteContext, WsBroadcastMessage } from "./types";

// 🆕 Phase 2c：寬限期常數（單位 ms）
//   30s = 短斷線寬限期（換頁/網路抖）
//   120s = 寬限期過後到自動 leave 的 buffer（給隊長決定的時間）
const GRACE_PERIOD_MS = 30_000;
const AUTO_LEAVE_AFTER_GRACE_MS = 120_000;

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
  const battleSlotClients: Map<string, Set<WebSocketClient>> = new Map();

  // 🆕 Phase 2a：記錄每個 team 曾經連過的 userId（用來區分「初次加入」vs「重連」）
  //   close 後 history 仍保留，再次 team_join 時 → reconnected 而非 joined。
  //   server 重啟會清空（接受限制 — 重啟後第一次連會被當「joined」廣播）。
  const teamMemberHistory: Map<string, Set<string>> = new Map();

  // 🆕 Phase 2c：斷線寬限期計時器
  //   key = `${teamId}:${userId}`
  //   close → start 30s grace timer
  //   30s 後 → 廣播 grace_expired + start 120s auto-leave timer
  //   重連 / leader 先繼續 → cancelDisconnectTimer 取消
  const disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  const autoLeaveTimers: Map<string, NodeJS.Timeout> = new Map();

  function timerKey(teamId: string, userId: string): string {
    return `${teamId}:${userId}`;
  }

  function cancelDisconnectTimer(teamId: string, userId: string) {
    const key = timerKey(teamId, userId);
    const grace = disconnectTimers.get(key);
    if (grace) {
      clearTimeout(grace);
      disconnectTimers.delete(key);
    }
    const autoLeave = autoLeaveTimers.get(key);
    if (autoLeave) {
      clearTimeout(autoLeave);
      autoLeaveTimers.delete(key);
    }
  }

  function isUserStillConnected(teamId: string, userId: string): boolean {
    const teamSet = teamClients.get(teamId);
    if (!teamSet) return false;
    return Array.from(teamSet).some(
      (c) => (c as WebSocketClient).userId === userId,
    );
  }

  function startGraceTimer(teamId: string, userId: string, userName: string) {
    cancelDisconnectTimer(teamId, userId); // 先 clear 殘留
    const key = timerKey(teamId, userId);
    const timer = setTimeout(() => {
      disconnectTimers.delete(key);
      // 寬限期到，再確認一次該 user 還沒回來
      if (isUserStillConnected(teamId, userId)) return;

      broadcastToTeam(teamId, {
        type: "team_member_grace_expired",
        userId,
        userName,
        autoLeaveInMs: AUTO_LEAVE_AFTER_GRACE_MS,
        timestamp: new Date().toISOString(),
      });

      // 啟動 auto-leave timer（120s 後若 user 仍未回 → DB 設 leftAt + 廣播 left）
      const autoLeaveTimer = setTimeout(async () => {
        autoLeaveTimers.delete(key);
        if (isUserStillConnected(teamId, userId)) return;

        try {
          await db
            .update(teamMembers)
            .set({ leftAt: new Date() })
            .where(
              and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, userId),
                isNull(teamMembers.leftAt),
              ),
            );
          broadcastToTeam(teamId, {
            type: "team_member_left",
            userId,
            userName,
            reason: "auto_leave_after_grace",
            timestamp: new Date().toISOString(),
          });
        } catch {
          // DB 寫入失敗不阻塞，下次再試（玩家手動回來也能處理）
        }
      }, AUTO_LEAVE_AFTER_GRACE_MS);
      autoLeaveTimers.set(key, autoLeaveTimer);
    }, GRACE_PERIOD_MS);
    disconnectTimers.set(key, timer);
  }

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
        // Token 驗證失敗，允許匿名連線（向後兼容）
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
            if (!teamMemberHistory.has(message.teamId)) {
              teamMemberHistory.set(message.teamId, new Set());
            }

            // 🔧 Fix（2026-05-02）：去重廣播 — 同 userId 已有 active socket 時
            //   重連不再廣播 member_joined（避免 toast 一直跳）
            // 🆕 Phase 2a（2026-05-02）：區分「初次加入」vs「重連回來」三狀態：
            //   - 已有 active socket → 同 user 多 socket，不廣播
            //   - 沒 active socket 但 history 有他 → 重連，廣播 reconnected
            //   - 沒 active socket 且 history 沒他 → 初次，廣播 joined
            const teamSetForJoin = teamClients.get(message.teamId)!;
            const memberHistory = teamMemberHistory.get(message.teamId)!;
            const userAlreadyConnected = Array.from(teamSetForJoin).some(
              (c) =>
                (c as WebSocketClient).userId === message.userId,
            );
            const hasReconnected = !userAlreadyConnected && memberHistory.has(message.userId);

            teamSetForJoin.add(ws);
            memberHistory.add(message.userId);

            if (userAlreadyConnected) {
              // 同 user 多 socket，不廣播
            } else if (hasReconnected) {
              // 🆕 Phase 2c：重連回來 → 取消寬限期計時器（grace + auto-leave）
              cancelDisconnectTimer(message.teamId, message.userId);
              broadcastToTeam(message.teamId, {
                type: "team_member_reconnected",
                userId: message.userId,
                userName: message.userName,
                timestamp: new Date().toISOString(),
              });
            } else {
              broadcastToTeam(message.teamId, {
                type: "team_member_joined",
                userId: message.userId,
                userName: message.userName,
                timestamp: new Date().toISOString(),
              });
            }
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

          // 🆕 Phase 3.2 LockCoop：協作解鎖共享輸入 + 嘗試 + 解鎖/失敗廣播
          //   action: "code" | "attempt" | "unlocked" | "failed"
          //   payload 結構依 action 而定（純廣播，client 端各自處理）
          //   排除自己（excludeClient=ws）避免送回觸發者
          case "team_lock_coop_sync":
            if (ws.teamId) {
              broadcastToTeam(
                ws.teamId,
                {
                  type: "team_lock_coop_sync",
                  action: message.action,
                  payload: message.payload,
                  userId: message.userId,
                  timestamp: new Date().toISOString(),
                },
                ws,
              );
            }
            break;

          // 🆕 Phase 3.3 RelayMission：接力任務段間切換廣播
          //   action: "segment_complete" | "all_complete"
          //   payload: { segmentIndex, completedBy, nextSegmentIndex? }
          case "team_relay_sync":
            if (ws.teamId) {
              broadcastToTeam(
                ws.teamId,
                {
                  type: "team_relay_sync",
                  action: message.action,
                  payload: message.payload,
                  userId: message.userId,
                  timestamp: new Date().toISOString(),
                },
                ws,
              );
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
              ws.matchId = matchId;
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
            const mId = ws.matchId;
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
            const relayMatchId = ws.matchId;
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

          // 水彈對戰 — 加入時段房間
          case "battle_slot_join": {
            const battleSlotId = message.slotId;
            if (battleSlotId) {
              ws.battleSlotId = battleSlotId;
              if (!battleSlotClients.has(battleSlotId)) {
                battleSlotClients.set(battleSlotId, new Set());
              }
              battleSlotClients.get(battleSlotId)?.add(ws);
              ws.send(JSON.stringify({
                type: "battle_slot_joined",
                slotId: battleSlotId,
                timestamp: new Date().toISOString(),
              }));
            }
            break;
          }

          // 前端倒數完成 → 切換對戰為 playing
          case "match_countdown_complete": {
            const countdownMatchId = ws.matchId;
            if (countdownMatchId) {
              const [match] = await db.select()
                .from(gameMatches)
                .where(eq(gameMatches.id, countdownMatchId));

              // 僅在 countdown 狀態才執行（防重複）
              if (match && match.status === "countdown") {
                await db.update(gameMatches)
                  .set({ status: "playing", startedAt: new Date(), updatedAt: new Date() })
                  .where(eq(gameMatches.id, countdownMatchId));

                broadcastToMatch(countdownMatchId, {
                  type: "match_started",
                  timestamp: new Date().toISOString(),
                });
              }
            }
            break;
          }
        }
      } catch {
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

        // 🔧 Fix（2026-05-02）：同 userId 是否還有其他 active socket
        //   有 → 不廣播（只是其中一個 socket 斷線）
        //   無 → 廣播 disconnected（暫時離線，可能會回來）
        // 🆕 Phase 2a：close 不再廣播 team_member_left（那代表「真的離開隊伍」）
        //   改廣播 team_member_disconnected（「暫時離線」）
        //   真正的 team_member_left 由 /api/teams/:teamId/leave route 廣播
        const teamSetForLeave = teamClients.get(ws.teamId);
        const userStillConnected = teamSetForLeave
          ? Array.from(teamSetForLeave).some(
              (c) => (c as WebSocketClient).userId === ws.userId,
            )
          : false;

        if (teamSetForLeave?.size === 0) {
          teamClients.delete(ws.teamId);
        }

        if (!userStillConnected) {
          broadcastToTeam(ws.teamId, {
            type: "team_member_disconnected",
            userId: ws.userId,
            userName: ws.userName,
            graceInMs: GRACE_PERIOD_MS,
            timestamp: new Date().toISOString(),
          });
          // 🆕 Phase 2c：啟動寬限期計時器（30s 後若仍未回 → 廣播 grace_expired）
          if (ws.userId && ws.userName) {
            startGraceTimer(ws.teamId, ws.userId, ws.userName);
          }
        }
      }

      // 清理水彈對戰時段客戶端
      if (ws.battleSlotId) {
        battleSlotClients.get(ws.battleSlotId)?.delete(ws);
        if (battleSlotClients.get(ws.battleSlotId)?.size === 0) {
          battleSlotClients.delete(ws.battleSlotId);
        }
      }

      // 清理對戰客戶端
      const matchId = ws.matchId;
      if (matchId) {
        matchClients.get(matchId)?.delete(ws);
        if (matchClients.get(matchId)?.size === 0) {
          matchClients.delete(matchId);
        }

        broadcastToMatch(matchId, {
          type: "match_participant_left",
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

  mqttService.setHitBroadcastHandler((sessionId: string, record: unknown) => {
    broadcastToSession(sessionId, {
      type: "shooting_hit",
      record,
    });
  });

  function broadcastToSession(sessionId: string, message: WsBroadcastMessage) {
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

  function broadcastToTeam(teamId: string, message: WsBroadcastMessage, excludeClient?: WebSocketClient) {
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

  function broadcastToMatch(matchId: string, message: WsBroadcastMessage) {
    const matchClientSet = matchClients.get(matchId);
    if (matchClientSet) {
      const payload = JSON.stringify(message);
      matchClientSet.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  }

  function broadcastToBattleSlot(slotId: string, message: WsBroadcastMessage) {
    const slotClientSet = battleSlotClients.get(slotId);
    if (slotClientSet) {
      const payload = JSON.stringify(message);
      slotClientSet.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  }

  return {
    broadcastToSession,
    broadcastToTeam,
    broadcastToMatch,
    broadcastToBattleSlot,
    cancelDisconnectTimer,
  };
}
