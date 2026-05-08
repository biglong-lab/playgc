import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { storage } from "../storage";
import { mqttService } from "../mqttService";
import { verifyFirebaseToken } from "../firebaseAuth";
import { db } from "../db";
import { gameMatches, matchParticipants, teamMembers } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { WebSocketClient, RouteContext, WsBroadcastMessage } from "./types";
// 🔭 Phase 0.2 (2026-05-08)：完整事件 log（fire-and-forget、不阻塞 ws）
import { logWsEvent } from "../lib/ws-event-logger";

// 🆕 Phase 2c：寬限期常數（單位 ms）
//   30s = 短斷線寬限期（換頁/網路抖）
//   120s = 寬限期過後到自動 leave 的 buffer（給隊長決定的時間）
//
// 🔧 Phase 4.4：支援環境變數覆寫（admin UI 完成前的過渡方案）
//   - DISCONNECT_GRACE_MS：寬限期毫秒（10000-300000 合理範圍）
//   - AUTO_LEAVE_AFTER_GRACE_MS：寬限期過後到 auto leave 的毫秒
//   未設或無效值 → 用預設
function parseEnvMs(v: string | undefined, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1000 || n > 600_000) return fallback;
  return n;
}
const GRACE_PERIOD_MS = parseEnvMs(process.env.DISCONNECT_GRACE_MS, 30_000);
const AUTO_LEAVE_AFTER_GRACE_MS = parseEnvMs(
  process.env.AUTO_LEAVE_AFTER_GRACE_MS,
  120_000,
);

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

  // 🆕 ADR-0004 (2026-05-02)：HostScreen 主控大螢幕模式
  //   每個 host session 維護兩組 client：
  //     hostScreenClients[sessionId]：大螢幕端（無登入，唯讀觀看 state 廣播）
  //     hostPlayerClients[sessionId]：玩家手機端（送 pulse、收 state 廣播）
  //   廣播時 broadcastToHostSession 會送給兩組所有 client
  //
  //   注意：與既有 broadcastToSession 不衝突（hostScreen sessions 也是 game_sessions
  //   只是 host_mode=true，但 WS 訊息 type prefix 為 host_screen_* 區分契約）
  const hostScreenClients: Map<string, Set<WebSocketClient>> = new Map();
  const hostPlayerClients: Map<string, Set<WebSocketClient>> = new Map();
  // server-side last state cache（給後加入的玩家拿目前狀態）
  const hostSessionStateCache: Map<string, Record<string, unknown>> = new Map();

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

  // 🛡️ 2026-05-05: disconnect 延遲廣播計時器（key=`${teamId}:${userId}`）
  //   原問題：ws.close 立即廣播 team_member_disconnected → toast + 語音「XXX 暫時離線」
  //   但 client 端 keepalive + reconnect 通常 < 5s 內就接回 → 卻已驚動全隊
  //   修法：close 後延遲 5s 再廣播；若 user 在這 5s 內重連（team_join）→ 取消廣播
  const DISCONNECT_BROADCAST_DELAY_MS = 5_000;
  const pendingDisconnectBroadcast: Map<string, NodeJS.Timeout> = new Map();
  function cancelPendingDisconnectBroadcast(teamId: string, userId: string) {
    const key = timerKey(teamId, userId);
    const t = pendingDisconnectBroadcast.get(key);
    if (t) {
      clearTimeout(t);
      pendingDisconnectBroadcast.delete(key);
    }
  }

  // 🆕 Phase 3 WS Reconnect 狀態恢復（依 docs §7.4）
  //   maintain per-team last-state cache：每個 team 的每種 sync 訊息保留最新 payload
  //   team_*_sync 廣播時 cache.set(teamId, type, payload)
  //   team_join 時把 cache 內所有 type 送給新連線（snapshot）
  //   server 重啟會 reset（接受限制；元件自身應 graceful 處理空狀態）
  type CachedState = Record<string, unknown>;
  const teamStateCache: Map<string, Map<string, CachedState>> = new Map();

  function cachePerTeamState(teamId: string, msgType: string, payload: CachedState) {
    if (!teamStateCache.has(teamId)) {
      teamStateCache.set(teamId, new Map());
    }
    teamStateCache.get(teamId)!.set(msgType, payload);
  }

  function snapshotPerTeamState(teamId: string): Array<{ type: string; payload: CachedState }> {
    const cache = teamStateCache.get(teamId);
    if (!cache) return [];
    return Array.from(cache.entries()).map(([type, payload]) => ({ type, payload }));
  }

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
    // 🔭 Phase 0.2：log grace_start
    logWsEvent({
      eventType: "grace_start",
      direction: "system",
      teamId,
      userId,
      userName,
      reason: `grace=${GRACE_PERIOD_MS}ms`,
    });
    const key = timerKey(teamId, userId);
    const timer = setTimeout(() => {
      disconnectTimers.delete(key);
      // 寬限期到，再確認一次該 user 還沒回來
      if (isUserStillConnected(teamId, userId)) return;

      // 🔭 Phase 0.2：log grace_expired
      logWsEvent({
        eventType: "grace_expired",
        direction: "system",
        teamId,
        userId,
        userName,
        reason: `auto_leave_in=${AUTO_LEAVE_AFTER_GRACE_MS}ms`,
      });

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
          // 🔭 Phase 0.2：log auto_leave
          logWsEvent({
            eventType: "auto_leave",
            direction: "system",
            teamId,
            userId,
            userName,
            reason: "auto_leave_after_grace",
          });
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

    // 🔭 Phase 0.2：取連線 metadata 給 log 用
    const clientIp = (
      (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      request.socket.remoteAddress ||
      ""
    ).slice(0, 50);
    const userAgent = (request.headers["user-agent"] as string) || "";
    (ws as WebSocketClient & { __clientIp?: string; __userAgent?: string }).__clientIp = clientIp;
    (ws as WebSocketClient & { __clientIp?: string; __userAgent?: string }).__userAgent = userAgent;

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

    // 🔭 Phase 0.2：log connect 事件
    logWsEvent({
      eventType: "connect",
      direction: "system",
      userId: authenticatedUserId,
      clientIp,
      userAgent,
    });

    ws.on("pong", () => {
      ws.isAlive = true;
      ws.missedPings = 0; // 🛡️ 2026-05-05: pong 收到 → 重置 missed 計數
    });

    ws.on("message", async (data) => {
      try {
        // 🛡️ 2026-05-05: 任何 message 收到 → 視為 client 還活著（重置 missedPings）
        // 即使 browser 沒及時回 pong、只要 client 主動送任何 message（含 keepalive）
        // 就避免被 terminate
        ws.missedPings = 0;

        // 🔒 ADR-0015 WS-level rate limit：每 ws 每秒 10 個訊息（防腳本灌、防 abuse）
        // 正常玩家頻率：1-3 訊息/秒（位置上報、互動）；10/秒留充足 buffer
        // 超過 → silent drop（不斷連、不報錯、不洩漏限制細節）
        const now = Date.now();
        if (!ws.rateWindowStart || now - ws.rateWindowStart >= 1000) {
          ws.rateWindowStart = now;
          ws.rateMsgCount = 1;
        } else {
          ws.rateMsgCount = (ws.rateMsgCount ?? 0) + 1;
          if (ws.rateMsgCount > 10) return; // silent drop
        }


        const message = JSON.parse(data.toString());
        // 🆕 2026-05-05: keepalive — 純「還活著」訊號（missedPings 已在最上方重置）
        if (message.type === "keepalive") return;

        // 🔭 Phase 0.2：log inbound message（除 keepalive 外、避免 log 噪音）
        logWsEvent({
          eventType: "message",
          direction: "inbound",
          messageType: message.type,
          payload: message,
          sessionId: ws.sessionId ?? message.sessionId ?? null,
          teamId: ws.teamId ?? message.teamId ?? null,
          userId: ws.userId ?? message.userId ?? null,
          userName: ws.userName ?? message.userName ?? null,
        });

        switch (message.type) {
          case "join": {
            // 驗證：如果有認證的 userId，確保訊息中的 userId 匹配
            if (ws.authenticatedUserId && message.userId !== ws.authenticatedUserId) {
              ws.send(JSON.stringify({
                type: "error",
                message: "userId 與認證身份不符",
              }));
              return;
            }

            // 🔒 安全（Codex 第 5 輪 P0 #3）：優先用 server 端認證身份、防偽造
            // 沒認證仍允許 join（兼容 LIFF 匿名玩家流程）、但 broadcast 用 effectiveUserId
            // 認證 client 永遠用 server 端身份（不論 client 傳什麼）
            const sessionEffectiveUserId = ws.authenticatedUserId || message.userId;

            ws.sessionId = message.sessionId;
            ws.userId = sessionEffectiveUserId;
            ws.userName = message.userName;

            if (!clients.has(message.sessionId)) {
              clients.set(message.sessionId, new Set());
            }
            clients.get(message.sessionId)?.add(ws);

            broadcastToSession(message.sessionId, {
              type: "user_joined",
              userId: sessionEffectiveUserId,
              userName: message.userName,
            });
            break;
          }

          case "team_join": {
            // 驗證：如果有認證的 userId，確保訊息中的 userId 匹配
            if (ws.authenticatedUserId && message.userId !== ws.authenticatedUserId) {
              ws.send(JSON.stringify({
                type: "error",
                message: "userId 與認證身份不符",
              }));
              return;
            }

            // 🔒 安全（Codex 第 5 輪 P0 #3）：優先用 server 端認證身份、防偽造
            // 沒認證仍允許加入（兼容既有 client、LIFF 玩家流程）、但廣播時用 effectiveUserId
            // 攻擊者偽造 message.userId 只能影響 UI 顯示「假名字加入」、不影響後續寫入決策
            // （後續寫入事件已在第 3 輪修法用 ws.authenticatedUserId 強制）
            const effectiveUserId = ws.authenticatedUserId || message.userId;

            ws.teamId = message.teamId;
            ws.userId = effectiveUserId;
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
                (c as WebSocketClient).userId === effectiveUserId,
            );
            const hasReconnected = !userAlreadyConnected && memberHistory.has(effectiveUserId);

            teamSetForJoin.add(ws);
            memberHistory.add(effectiveUserId);

            if (userAlreadyConnected) {
              // 同 user 多 socket，不廣播
              // 🛡️ 2026-05-05: 仍要取消 pending disconnected 廣播
              //   情境：A socket close → 5s 延遲廣播啟動 → 同 user B socket join → 此分支
              cancelPendingDisconnectBroadcast(message.teamId, effectiveUserId);
            } else if (hasReconnected) {
              // 🆕 Phase 2c：重連回來 → 取消寬限期計時器（grace + auto-leave）
              cancelDisconnectTimer(message.teamId, effectiveUserId);
              // 🛡️ 2026-05-05: 取消 pending disconnected 廣播
              //   若 < 5s 內重連 → disconnected 從未廣播 → 對應 reconnected 也不該廣播（無感重連）
              //   若 ≥ 5s → disconnected 已廣播 + grace timer 走 → 此處仍廣播 reconnected 通知大家
              const hadPending = pendingDisconnectBroadcast.has(timerKey(message.teamId, effectiveUserId));
              cancelPendingDisconnectBroadcast(message.teamId, effectiveUserId);
              if (!hadPending) {
                broadcastToTeam(message.teamId, {
                  type: "team_member_reconnected",
                  userId: effectiveUserId,
                  userName: message.userName,
                  timestamp: new Date().toISOString(),
                });
              }
            } else {
              broadcastToTeam(message.teamId, {
                type: "team_member_joined",
                userId: effectiveUserId,
                userName: message.userName,
                timestamp: new Date().toISOString(),
              });
            }

            // 🆕 Phase 3 WS Reconnect：把該 team 已快取的 state 送給新連線
            //   讓 reconnect / 後加入的玩家看到當前狀態（不需等下次廣播）
            //   只送給此 ws 不廣播（用 ws.send 直接送）
            const snapshot = snapshotPerTeamState(message.teamId);
            for (const item of snapshot) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    ...item.payload,
                    type: item.type,
                    _isSnapshot: true,
                  }),
                );
              }
            }
            break;
          }

          case "team_chat":
            // 強制 authenticatedUserId 防偽造他人聊天訊息（純廣播、不寫 DB）
            if (!ws.authenticatedUserId) break;
            if (ws.teamId) {
              broadcastToTeam(ws.teamId, {
                type: "team_chat",
                teamId: ws.teamId,
                userId: ws.authenticatedUserId,
                userName: ws.userName,
                message: message.message,
                messageType: message.messageType || "text",
                timestamp: new Date().toISOString(),
              });
            }
            break;

          // 🔒 安全（2026-05-03 Codex 第 3 輪 P1 修）：強制 authenticatedUserId 防腳本繞過 client
          // team_location/vote/ready 都是「能影響其他隊員看到的訊息」、必須認證才能廣播
          // client 端 useTeamWebSocket 本來就要求 userId、強制這個對正常使用者透明
          case "team_location":
            if (!ws.authenticatedUserId) break; // silent drop（client 反正都登入才送）
            if (ws.teamId) {
              broadcastToTeam(ws.teamId, {
                type: "team_location",
                userId: ws.authenticatedUserId, // 用 server 端認證身份、防偽造
                userName: ws.userName,
                latitude: message.latitude,
                longitude: message.longitude,
                accuracy: message.accuracy,
                timestamp: new Date().toISOString(),
              }, ws);
            }
            break;

          case "team_vote":
            if (!ws.authenticatedUserId) break;
            if (ws.teamId && message.voteId) {
              broadcastToTeam(ws.teamId, {
                type: "team_vote_cast",
                voteId: message.voteId,
                pageId: message.pageId,
                userId: ws.authenticatedUserId, // 用 server 端認證身份、防偽造投票他人
                userName: ws.userName,
                choice: message.choice,
                timestamp: new Date().toISOString(),
              });
            }
            break;

          // case "team_score" 已移除（2026-05-03 P1 修）：
          //   依 Codex 第 2 輪資安審查：WS 端無 ownership 驗證、可被偽造分數廣播
          //   且 grep client 確認從未送此事件、是 dead WS path
          //   分數變更請走 REST POST /api/teams/:teamId/score（已有 isAuthenticated + 成員驗證 + hotPathLimiter + broadcastToTeam team_score_update）
          //   單一資料流原則（同 chat case 移除模式）

          case "team_ready":
            if (!ws.authenticatedUserId) break;
            if (ws.teamId) {
              broadcastToTeam(ws.teamId, {
                type: "team_ready_update",
                userId: ws.authenticatedUserId, // 用 server 端認證身份、防偽造他人 ready 狀態
                userName: ws.userName,
                isReady: message.isReady,
                timestamp: new Date().toISOString(),
              });
            }
            break;

          // ChoiceVerifyRace：玩家答題即時同步（純廣播 client → server → 同隊）
          //   注意：本版本由 client 各自跑 currentQIndex（不同步、不公平、可玩）
          //   未來若需 server 統一推進進度需重新設計（不可恢復先前 race-state.ts 整合 — 該整合曾因 ws.sessionId 永遠 undefined 導致整體掛掉）
          case "race_answer":
            if (ws.teamId && ws.userId) {
              const userId = ws.userId; // 強制用認證身份、防偽造
              broadcastToTeam(ws.teamId, {
                type: "race_answered",
                userId,
                displayName: message.displayName ?? ws.userName ?? "玩家",
                questionIndex: message.questionIndex,
                selectedOption: message.selectedOption,
                isCorrect: message.isCorrect,
                points: message.points,
                answeredAt: new Date().toISOString(),
              });
            }
            break;

          // 🆕 Phase 3.2 LockCoop：協作解鎖共享輸入 + 嘗試 + 解鎖/失敗廣播
          //   action: "code" | "attempt" | "unlocked" | "failed"
          //   payload 結構依 action 而定（純廣播，client 端各自處理）
          //   排除自己（excludeClient=ws）避免送回觸發者
          case "team_lock_coop_sync":
            if (ws.teamId) {
              const lockCoopMsg = {
                type: "team_lock_coop_sync",
                action: message.action,
                payload: message.payload,
                userId: message.userId,
                timestamp: new Date().toISOString(),
              };
              broadcastToTeam(ws.teamId, lockCoopMsg, ws);
              // 🆕 Phase 3 WS Reconnect：cache 最新 state（key 用 type+action 區分）
              cachePerTeamState(
                ws.teamId,
                `team_lock_coop_sync:${message.action}`,
                lockCoopMsg as CachedState,
              );
            }
            break;

          // 🆕 Phase 3.3 RelayMission：接力任務段間切換廣播
          //   action: "segment_complete" | "all_complete"
          //   payload: { segmentIndex, completedBy, nextSegmentIndex? }
          case "team_relay_sync":
            if (ws.teamId) {
              const relayMsg = {
                type: "team_relay_sync",
                action: message.action,
                payload: message.payload,
                userId: message.userId,
                timestamp: new Date().toISOString(),
              };
              broadcastToTeam(ws.teamId, relayMsg, ws);
              // 🆕 Phase 3 WS Reconnect：cache 最新 state
              cachePerTeamState(
                ws.teamId,
                `team_relay_sync:${message.action}`,
                relayMsg as CachedState,
              );
            }
            break;

          // 🆕 Phase 4 TerritoryCapture：地盤戰用 session 範圍廣播（多隊共享）
          //   action: "capture"（佔領 / 奪回）/ "snapshot"（重連時 echo）
          //   payload: { pointId, teamId, capturedAt }
          //   ws 必須先 send "join" 訊息（useTeamWebSocket alsoJoinSessionId=true 自動觸發）
          //   才會被加進 clients[sessionId]
          case "territory_capture_sync":
            if (ws.sessionId) {
              broadcastToSession(ws.sessionId, {
                type: "territory_capture_sync",
                action: message.action,
                payload: message.payload,
                userId: message.userId,
                timestamp: new Date().toISOString(),
              });
            }
            break;

          // case "chat" 已移除（2026-05-03 P0 修）：
          // 之前 client 同時送 WS + REST、兩邊都 createChatMessage 造成同一則訊息雙寫 DB；
          // 且 WS 路徑無 isAuthenticated / chatLimiter，存在權限與限流繞過風險。
          // 改為單一資料流：client 只送 REST POST /api/chat/:sessionId，server 寫 DB 後 broadcast 給 WS clients。

          case "game_update":
            if (ws.sessionId) {
              broadcastToSession(ws.sessionId, {
                type: "game_update",
                ...message,
              });
            }
            break;

          // ════════════════════════════════════════════════════════════
          // 🆕 ADR-0004 HostScreen 主控大螢幕事件（2026-05-02）
          // ════════════════════════════════════════════════════════════
          case "host_screen_register": {
            // 大螢幕端註冊頻道（含 hostToken 驗證）
            // 訊息：{ type, sessionId, hostToken, role: 'host' | 'player' }
            const hostSessionId = message.sessionId;
            if (!hostSessionId) break;

            // 驗 hostToken 是 hostScreen 模式的關鍵安全點
            // role='host' 的訊息必須帶有效 token；role='player' 不需 token
            if (message.role === "host") {
              const session = await storage.getSession(hostSessionId).catch(() => null);
              if (!session?.hostMode || session.hostToken !== message.hostToken) {
                ws.send(JSON.stringify({
                  type: "host_screen_error",
                  message: "host token 無效或已過期",
                }));
                break;
              }
              if (session.hostTokenExpiresAt && new Date(session.hostTokenExpiresAt) < new Date()) {
                ws.send(JSON.stringify({
                  type: "host_screen_error",
                  message: "host token 已過期，請重新從 admin 取得網址",
                }));
                break;
              }
              // 加入大螢幕群
              ws.hostSessionId = hostSessionId;
              ws.hostRole = "host";
              if (!hostScreenClients.has(hostSessionId)) {
                hostScreenClients.set(hostSessionId, new Set());
              }
              hostScreenClients.get(hostSessionId)!.add(ws);
            } else {
              // 玩家端：不需 token，只要 session 存在 + host_mode=true
              const session = await storage.getSession(hostSessionId).catch(() => null);
              if (!session?.hostMode) {
                ws.send(JSON.stringify({
                  type: "host_screen_error",
                  message: "此 session 不是 HostScreen 模式",
                }));
                break;
              }
              ws.hostSessionId = hostSessionId;
              ws.hostRole = "player";
              if (!hostPlayerClients.has(hostSessionId)) {
                hostPlayerClients.set(hostSessionId, new Set());
              }
              hostPlayerClients.get(hostSessionId)!.add(ws);
            }

            // 註冊成功 → 送目前 state cache 給新連線（snapshot）
            const cached = hostSessionStateCache.get(hostSessionId);
            if (cached) {
              ws.send(JSON.stringify({
                type: "host_screen_state",
                sessionId: hostSessionId,
                state: cached,
                cached: true,
              }));
            }
            break;
          }

          case "host_screen_pulse": {
            // 玩家端送訊號（投票、emoji、按鈕觸發）→ 廣播給大螢幕端
            // 訊息：{ type, sessionId, pulseType, payload }
            if (!ws.hostSessionId || ws.hostRole !== "player") break;
            broadcastToHostSession(ws.hostSessionId, {
              type: "host_screen_pulse",
              sessionId: ws.hostSessionId,
              pulseType: message.pulseType,
              payload: message.payload,
              fromUserId: ws.userId,  // 可選 — 玩家有登入才有
            }, /* hostOnly */ true);  // pulse 只送大螢幕端，不擾其他玩家
            break;
          }

          case "host_screen_state": {
            // 大螢幕端廣播當前狀態 → 所有玩家 + 大螢幕端共用看到
            // 訊息：{ type, sessionId, state }
            if (!ws.hostSessionId || ws.hostRole !== "host") break;
            // 寫進 cache（給後加入的玩家用）
            hostSessionStateCache.set(ws.hostSessionId, message.state ?? {});
            // 廣播給兩組
            broadcastToHostSession(ws.hostSessionId, {
              type: "host_screen_state",
              sessionId: ws.hostSessionId,
              state: message.state,
            });
            break;
          }
          // ════════════════════════════════════════════════════════════

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
          // 🔒 安全（2026-05-03 修）：違反 ADR-0015「禁 WS 路徑做 DB write」紅線
          //   之前任何匿名 ws 連線送 match_join + match_countdown_complete 即可
          //   觸發 update(gameMatches).set({ status: "playing" }) → 任意提早比賽
          //   修法：強制 ws.authenticatedUserId + 驗 match 參與者
          case "match_countdown_complete": {
            const countdownMatchId = ws.matchId;
            if (!countdownMatchId) break;

            // 必須認證
            if (!ws.authenticatedUserId) {
              ws.send(JSON.stringify({
                type: "error",
                message: "倒數完成需要登入身份",
              }));
              break;
            }

            // 驗證是 match 參與者（防非參與者觸發倒數）
            const [participant] = await db
              .select({ id: matchParticipants.id })
              .from(matchParticipants)
              .where(and(
                eq(matchParticipants.matchId, countdownMatchId),
                eq(matchParticipants.userId, ws.authenticatedUserId),
              ))
              .limit(1);

            if (!participant) {
              ws.send(JSON.stringify({
                type: "error",
                message: "非比賽參與者",
              }));
              break;
            }

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

    ws.on("close", (closeCode?: number, reasonBuffer?: Buffer) => {
      // 🔭 Phase 0.2：log close 事件
      const reasonStr = reasonBuffer?.toString().slice(0, 200) ?? null;
      logWsEvent({
        eventType: "close",
        direction: "system",
        sessionId: ws.sessionId ?? null,
        teamId: ws.teamId ?? null,
        userId: ws.userId ?? null,
        userName: ws.userName ?? null,
        closeCode: closeCode ?? null,
        reason: reasonStr,
        clientIp: (ws as WebSocketClient & { __clientIp?: string }).__clientIp ?? null,
      });

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

        if (!userStillConnected && ws.userId && ws.userName && ws.teamId) {
          // 🛡️ 2026-05-05: 延遲 5s 廣播 disconnected（避免短暫 reconnect 驚動全隊）
          //   若 user 在 5s 內 team_join 回來 → cancelPendingDisconnectBroadcast 取消
          //   若沒回來 → 廣播 disconnected + startGraceTimer 走 30s 寬限期流程
          const teamId = ws.teamId;
          const userId = ws.userId;
          const userName = ws.userName;
          const key = timerKey(teamId, userId);
          // 清掉舊的（罕見：connection close 二次觸發）
          cancelPendingDisconnectBroadcast(teamId, userId);
          const t = setTimeout(() => {
            pendingDisconnectBroadcast.delete(key);
            // 5s 到再確認一次：仍未重連才廣播
            if (isUserStillConnected(teamId, userId)) return;
            broadcastToTeam(teamId, {
              type: "team_member_disconnected",
              userId,
              userName,
              graceInMs: GRACE_PERIOD_MS,
              timestamp: new Date().toISOString(),
            });
            startGraceTimer(teamId, userId, userName);
          }, DISCONNECT_BROADCAST_DELAY_MS);
          pendingDisconnectBroadcast.set(key, t);
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

      // 🆕 ADR-0004：清理 HostScreen 客戶端
      if (ws.hostSessionId) {
        if (ws.hostRole === "host") {
          hostScreenClients.get(ws.hostSessionId)?.delete(ws);
          if (hostScreenClients.get(ws.hostSessionId)?.size === 0) {
            hostScreenClients.delete(ws.hostSessionId);
          }
        } else if (ws.hostRole === "player") {
          hostPlayerClients.get(ws.hostSessionId)?.delete(ws);
          if (hostPlayerClients.get(ws.hostSessionId)?.size === 0) {
            hostPlayerClients.delete(ws.hostSessionId);
          }
        }
      }
    });
  });

  // 🛡️ 2026-05-05 改寬容：原 30s 沒回 pong 直接 terminate、太敏感
  //   - Browser background tab 被 throttle、可能 30s 內來不及回 pong
  //   - 玩家看 tab 還開、卻收到 grace_expired → 體驗很差
  //   - 改：missedPings 計數、連續 2 次（90 秒）才 terminate（更寬容）
  //   - Heartbeat 仍 30s 一次、accept message / pong / 自定義 keepalive 都重置
  const MISSED_PING_THRESHOLD = 2;
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocketClient) => {
      const missed = (ws.missedPings ?? 0) + 1;
      if (missed > MISSED_PING_THRESHOLD) {
        return ws.terminate();
      }
      ws.missedPings = missed;
      try {
        ws.ping();
      } catch {
        /* ws may be closing */
      }
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
      let sentCount = 0;
      sessionClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
          sentCount += 1;
        }
      });
      // 🔭 Phase 0.2：log broadcast 事件
      logWsEvent({
        eventType: "broadcast",
        direction: "outbound",
        messageType: (message as { type?: string }).type ?? null,
        sessionId,
        recipientCount: sentCount,
        payload: message,
      });
    }
  }

  function broadcastToTeam(teamId: string, message: WsBroadcastMessage, excludeClient?: WebSocketClient) {
    const teamClientSet = teamClients.get(teamId);
    if (teamClientSet) {
      const payload = JSON.stringify(message);
      let sentCount = 0;
      teamClientSet.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== excludeClient) {
          client.send(payload);
          sentCount += 1;
        }
      });
      // 🔭 Phase 0.2：log broadcast 事件
      logWsEvent({
        eventType: "broadcast",
        direction: "outbound",
        messageType: (message as { type?: string }).type ?? null,
        teamId,
        recipientCount: sentCount,
        payload: message,
      });
    }
  }

  // 🆕 2026-05-07 A4：把指定 user 從某 team 的 ws connections 中踢掉
  // 用途：玩家被踢出隊伍（leaveTeam / removeMember）後立即斷 ws、避免幽靈占位
  // 流程：
  //   1. 找該 team 中該 userId 的所有 ws clients（一個 user 可能多裝置）
  //   2. 先送 team_kicked 訊息（client 收後跳「你已被移出隊伍」）
  //   3. 短延遲後 close ws（讓訊息來得及送）
  //   4. 從 teamClients / clients map 移除
  function kickUserFromTeam(teamId: string, userId: string, reason: string = "leave") {
    const teamClientSet = teamClients.get(teamId);
    if (!teamClientSet) return;
    const targets: WebSocketClient[] = [];
    teamClientSet.forEach((c) => {
      if ((c as WebSocketClient).userId === userId) targets.push(c as WebSocketClient);
    });
    if (targets.length === 0) return;

    const payload = JSON.stringify({
      type: "team_kicked",
      teamId,
      userId,
      reason,
      message: "你已被移出隊伍",
      timestamp: new Date().toISOString(),
    });

    targets.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(payload); } catch { /* ignore */ }
      }
      teamClientSet.delete(client);
      // 短延遲後 close（讓 send 完成）
      setTimeout(() => {
        try { client.close(4000, reason); } catch { /* ignore */ }
      }, 200);
    });

    if (teamClientSet.size === 0) {
      teamClients.delete(teamId);
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

  /**
   * 🆕 ADR-0004：HostScreen 廣播
   *
   * @param sessionId host session id
   * @param message WS 訊息
   * @param hostOnly 是否只送大螢幕端（true: pulse 用；false: state 廣播給雙方）
   */
  function broadcastToHostSession(
    sessionId: string,
    message: WsBroadcastMessage,
    hostOnly = false,
  ) {
    const payload = JSON.stringify(message);
    const send = (set: Set<WebSocketClient> | undefined) => {
      if (!set) return;
      set.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      });
    };
    send(hostScreenClients.get(sessionId));
    if (!hostOnly) send(hostPlayerClients.get(sessionId));
  }

  return {
    broadcastToSession,
    broadcastToTeam,
    broadcastToMatch,
    broadcastToBattleSlot,
    broadcastToHostSession,
    cancelDisconnectTimer,
    kickUserFromTeam,
  };
}
