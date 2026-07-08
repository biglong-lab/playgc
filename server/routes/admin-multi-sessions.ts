// 🔭 Admin Multi-Sessions Observability — admin 觀測活動中所有 multi sessions
// 2026-05-07：A5 解 R11（debug 真實活動用）
//
// 端點：
//   GET /api/admin/multi-sessions/:gameId/state
//     回傳該 game 所有 active session：
//     - session 基本資訊
//     - 每隊當前進度（currentPageId / 已完成頁數）
//     - 每員 online 狀態（playerProgress.updatedAt 5 分內視為 online）
//     - 每員 team_game_states snapshot（最近 update）
//     - 每隊 team_lock_states 狀態
//
// 用途：
//   - 真實活動現場跑時 admin 看 dashboard 偵測卡關
//   - 玩家反映 bug 時可立即看 server-side 真實狀態 + 持久化資料
//   - 未來改 LiveDashboard 即時更新

import type { Express } from "express";
import { db } from "../db";
import { games, gameSessions, teams, teamMembers, playerProgress, pages, users, wsEventLog } from "@shared/schema";
import { sql, eq, and, isNull, gte, inArray } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
// 🆕 P0-3 (2026-05-08)：真實 online 判斷依 ws_event_log
//   - 過去 30 秒內有 message 事件 → online (綠)
//   - 30 秒~5 分鐘有事件但近期無 → 暫離 (橘)
//   - 5 分鐘以上無事件 / 最後事件是 close → 離線 (紅)
const ONLINE_RECENT_MS = 30 * 1000;
const HEALTH_WINDOW_MS = 5 * 60 * 1000; // 健康指標統計窗（過去 5 分鐘）

export function registerAdminMultiSessionsRoutes(app: Express) {
  // 🆕 Phase 0.1（2026-05-08）：列所有 active multi sessions（admin 場域內、不限 gameId）
  // 用於 admin/multi-sessions 主頁、5 秒 refresh
  app.get(
    "/api/admin/multi-sessions",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);
        const isSuperAdmin = req.admin.systemRole === "super_admin";

        // 1. 取 active sessions（依場域權限過濾）
        const sessionsRaw = await db
          .select({
            sessionId: gameSessions.id,
            gameId: gameSessions.gameId,
            startedAt: gameSessions.startedAt,
            status: gameSessions.status,
            hostMode: gameSessions.hostMode,
            gameTitle: games.title,
            fieldId: games.fieldId,
          })
          .from(gameSessions)
          .leftJoin(games, eq(games.id, gameSessions.gameId))
          .where(eq(gameSessions.status, "playing"));

        const visibleSessions = isSuperAdmin
          ? sessionsRaw
          : sessionsRaw.filter((s) => s.fieldId === req.admin!.fieldId);

        if (visibleSessions.length === 0) {
          return res.json({
            sessions: [],
            totalActive: 0,
            generatedAt: new Date().toISOString(),
          });
        }

        // 2. batch 拉所有相關 game 的 teams（避免 N+1 query）
        // gameSessions.gameId 雖在 schema 是 nullable join 結果、實務必有值（過濾 null 安全）
        const gameIds = Array.from(
          new Set(visibleSessions.map((s) => s.gameId).filter((id): id is string => id !== null)),
        );
        const allTeams = gameIds.length > 0
          ? await db
              .select({ id: teams.id, gameId: teams.gameId })
              .from(teams)
              .where(inArray(teams.gameId, gameIds))
          : [];

        const teamsByGame = new Map<string, typeof allTeams>();
        for (const t of allTeams) {
          if (!teamsByGame.has(t.gameId)) teamsByGame.set(t.gameId, []);
          teamsByGame.get(t.gameId)!.push(t);
        }

        // 3. batch 拉所有 active members
        const allTeamIds = allTeams.map((t) => t.id);
        const allMembers = allTeamIds.length > 0
          ? await db
              .select({ userId: teamMembers.userId, teamId: teamMembers.teamId })
              .from(teamMembers)
              .where(and(inArray(teamMembers.teamId, allTeamIds), isNull(teamMembers.leftAt)))
          : [];

        const membersByTeam = new Map<string, typeof allMembers>();
        for (const m of allMembers) {
          if (!membersByTeam.has(m.teamId)) membersByTeam.set(m.teamId, []);
          membersByTeam.get(m.teamId)!.push(m);
        }

        // 4. 🆕 P0-3 (2026-05-08)：用 ws_event_log 算真實 online 狀態
        //    每個 user 取最後一個事件、判斷是否仍 online
        const sessionIds = visibleSessions
          .map((s) => s.sessionId)
          .filter((id): id is string => id !== null);
        const healthCutoff = new Date(Date.now() - HEALTH_WINDOW_MS);
        const recentCutoff = new Date(Date.now() - ONLINE_RECENT_MS);

        // 過去 5 分鐘的所有 ws 事件（用於 online 判斷 + 健康指標聚合）
        const wsEvents = sessionIds.length > 0
          ? await db
              .select({
                sessionId: wsEventLog.sessionId,
                userId: wsEventLog.userId,
                eventType: wsEventLog.eventType,
                timestamp: wsEventLog.timestamp,
              })
              .from(wsEventLog)
              .where(
                and(
                  inArray(wsEventLog.sessionId, sessionIds),
                  gte(wsEventLog.timestamp, healthCutoff),
                ),
              )
          : [];

        // 4a. 計算每個 (sessionId, userId) 的最後事件
        type LastEvent = { eventType: string; timestamp: Date };
        const lastEventMap = new Map<string, LastEvent>(); // key = sessionId|userId
        for (const e of wsEvents) {
          if (!e.sessionId || !e.userId || !e.timestamp) continue;
          const key = `${e.sessionId}|${e.userId}`;
          const existing = lastEventMap.get(key);
          if (!existing || e.timestamp > existing.timestamp) {
            lastEventMap.set(key, { eventType: e.eventType, timestamp: e.timestamp });
          }
        }

        // 4b. 健康指標聚合（per session）
        type SessionHealth = {
          graceCount: number;
          autoLeaveCount: number;
          kickCount: number;
          reconnectCount: number;
          errorCount: number;
        };
        const healthBySession = new Map<string, SessionHealth>();
        for (const e of wsEvents) {
          if (!e.sessionId) continue;
          const h = healthBySession.get(e.sessionId) ?? {
            graceCount: 0,
            autoLeaveCount: 0,
            kickCount: 0,
            reconnectCount: 0,
            errorCount: 0,
          };
          if (e.eventType === "grace_expired") h.graceCount += 1;
          else if (e.eventType === "auto_leave") h.autoLeaveCount += 1;
          else if (e.eventType === "kick") h.kickCount += 1;
          else if (e.eventType === "reconnect") h.reconnectCount += 1;
          else if (e.eventType === "error") h.errorCount += 1;
          healthBySession.set(e.sessionId, h);
        }

        // 4c. fallback：若 ws_event_log 沒事件（可能 event log 還沒啟用）→ 用舊的 player_progress 邏輯
        const allProgress = sessionIds.length > 0
          ? await db
              .select({
                userId: playerProgress.userId,
                sessionId: playerProgress.sessionId,
                updatedAt: playerProgress.updatedAt,
              })
              .from(playerProgress)
              .where(
                and(
                  inArray(playerProgress.sessionId, sessionIds),
                  gte(playerProgress.updatedAt, cutoff),
                ),
              )
          : [];
        const fallbackOnlineSet = new Map<string, Set<string>>();
        for (const p of allProgress) {
          if (!p.sessionId || !p.userId) continue;
          if (!fallbackOnlineSet.has(p.sessionId)) fallbackOnlineSet.set(p.sessionId, new Set());
          fallbackOnlineSet.get(p.sessionId)!.add(p.userId);
        }

        // 5. 組裝 lightweight session list
        const result = visibleSessions.map((s) => {
          const sessionTeams = s.gameId ? (teamsByGame.get(s.gameId) ?? []) : [];
          const totalMembers = sessionTeams.reduce(
            (sum, t) => sum + (membersByTeam.get(t.id)?.length ?? 0),
            0,
          );

          // 🆕 真實 online：依 ws_event_log 最後事件
          let onlineMembers = 0;
          let recentMembers = 0;       // 30s 內活動 = 真 online
          let awayMembers = 0;          // 暫離（30s~5min 內活動）
          for (const t of sessionTeams) {
            const teamMems = membersByTeam.get(t.id) ?? [];
            for (const m of teamMems) {
              const last = lastEventMap.get(`${s.sessionId}|${m.userId}`);
              if (last && last.eventType !== "close" && last.eventType !== "auto_leave") {
                onlineMembers += 1;
                if (last.timestamp >= recentCutoff) {
                  recentMembers += 1;
                } else {
                  awayMembers += 1;
                }
              }
            }
          }

          // fallback：若 ws_event_log 完全沒事件、退回 player_progress 5 分鐘判斷
          const hasWsEvents = wsEvents.some((e) => e.sessionId === s.sessionId);
          if (!hasWsEvents) {
            const fbSet = fallbackOnlineSet.get(s.sessionId ?? "") ?? new Set();
            onlineMembers = sessionTeams.reduce((sum, t) => {
              const teamMems = membersByTeam.get(t.id) ?? [];
              return sum + teamMems.filter((m) => fbSet.has(m.userId)).length;
            }, 0);
            recentMembers = onlineMembers;
            awayMembers = 0;
          }

          const health = healthBySession.get(s.sessionId ?? "") ?? {
            graceCount: 0,
            autoLeaveCount: 0,
            kickCount: 0,
            reconnectCount: 0,
            errorCount: 0,
          };

          // 異常分數（給前端排序用、越高越異常）
          const anomalyScore =
            health.graceCount * 5 +
            health.autoLeaveCount * 10 +
            health.errorCount * 8 +
            health.kickCount * 3 +
            (totalMembers > 0 ? Math.round(((totalMembers - onlineMembers) / totalMembers) * 5) : 0);

          return {
            sessionId: s.sessionId,
            gameId: s.gameId,
            gameTitle: s.gameTitle ?? "(未命名)",
            fieldId: s.fieldId,
            startedAt: s.startedAt,
            hostMode: s.hostMode,
            teamCount: sessionTeams.length,
            totalMembers,
            onlineMembers,
            recentMembers,        // 🆕 真 online（30s 內）
            awayMembers,          // 🆕 暫離（30s~5min）
            offlineMembers: totalMembers - onlineMembers,
            // 🆕 P0-4 ws 健康指標（過去 5 分鐘）
            health,
            anomalyScore,
            usingRealtimeData: hasWsEvents, // 給前端標示「資料來源」
          };
        });

        // 🆕 P0-5 異常排序到頂
        result.sort((a, b) => b.anomalyScore - a.anomalyScore);

        res.json({
          sessions: result,
          totalActive: result.length,
          healthWindowMinutes: Math.round(HEALTH_WINDOW_MS / 60_000),
          generatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[admin-multi-sessions list] failed:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "查詢失敗" });
      }
    },
  );

  app.get(
    "/api/admin/multi-sessions/:gameId/state",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        const { gameId } = req.params;

        // 場域權限檢查
        const [game] = await db.select().from(games).where(eq(games.id, gameId));
        if (!game) return res.status(404).json({ error: "遊戲不存在" });
        if (req.admin.systemRole !== "super_admin" && game.fieldId !== req.admin.fieldId) {
          return res.status(403).json({ error: "無權限" });
        }

        // 1. active sessions（status='playing'）
        const sessions = await db
          .select()
          .from(gameSessions)
          .where(and(eq(gameSessions.gameId, gameId), eq(gameSessions.status, "playing")));

        // 2. game pages（給後面算進度比例）
        const allPages = await db
          .select({ id: pages.id, pageOrder: pages.pageOrder })
          .from(pages)
          .where(eq(pages.gameId, gameId));
        const totalPages = allPages.length;
        const pageOrderMap = new Map(allPages.map((p) => [p.id, p.pageOrder]));

        // 🆕 P1-7 (2026-05-08)：拉過去 5 分鐘 ws_event_log（detail 用、含 client_ip / user_agent）
        const sessionIds = sessions.map((s) => s.id);
        const detailHealthCutoff = new Date(Date.now() - HEALTH_WINDOW_MS);
        const detailWsEvents = sessionIds.length > 0
          ? await db
              .select({
                sessionId: wsEventLog.sessionId,
                userId: wsEventLog.userId,
                eventType: wsEventLog.eventType,
                timestamp: wsEventLog.timestamp,
                clientIp: wsEventLog.clientIp,
                userAgent: wsEventLog.userAgent,
                reason: wsEventLog.reason,
              })
              .from(wsEventLog)
              .where(
                and(
                  inArray(wsEventLog.sessionId, sessionIds),
                  gte(wsEventLog.timestamp, detailHealthCutoff),
                ),
              )
          : [];

        // 玩家連線統計：(sessionId, userId) → { firstConnect, lastEvent, connectCount, closeCount, lastIp, lastUA }
        type PlayerConn = {
          firstConnectAt: Date | null;
          lastEventAt: Date | null;
          lastEventType: string | null;
          connectCount: number;
          closeCount: number;
          messageCount: number;
          lastIp: string | null;
          lastUserAgent: string | null;
          lastReason: string | null;
        };
        const playerConnMap = new Map<string, PlayerConn>();
        for (const e of detailWsEvents) {
          if (!e.sessionId || !e.userId || !e.timestamp) continue;
          const key = `${e.sessionId}|${e.userId}`;
          const c = playerConnMap.get(key) ?? {
            firstConnectAt: null,
            lastEventAt: null,
            lastEventType: null,
            connectCount: 0,
            closeCount: 0,
            messageCount: 0,
            lastIp: null,
            lastUserAgent: null,
            lastReason: null,
          };
          if (e.eventType === "connect") {
            c.connectCount += 1;
            if (!c.firstConnectAt || e.timestamp < c.firstConnectAt) c.firstConnectAt = e.timestamp;
          } else if (e.eventType === "close") {
            c.closeCount += 1;
          } else if (e.eventType === "message") {
            c.messageCount += 1;
          }
          if (!c.lastEventAt || e.timestamp > c.lastEventAt) {
            c.lastEventAt = e.timestamp;
            c.lastEventType = e.eventType;
            if (e.clientIp) c.lastIp = e.clientIp;
            if (e.userAgent) c.lastUserAgent = e.userAgent;
            if (e.reason) c.lastReason = e.reason;
          }
          playerConnMap.set(key, c);
        }

        // 3. 每 session 的 teams + members + progress + persistence
        // 🚀 2026-07-09 M2（全站優化盤點）：批次查詢消 N+1 —
        //   原本 for(sessions)×for(teams) 內各查 members/progress/states
        //   = S×T×4 次 DB 往返（10 隊 5 場 = 200 次）→ 改 4 次總查詢 + JS 分組
        const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);
        const detailRecentCutoff = new Date(Date.now() - ONLINE_RECENT_MS);

        // teams 屬 game level（原本竟在 sessions 迴圈內重查 S 次）
        const teamRows = await db
          .select()
          .from(teams)
          .where(eq(teams.gameId, gameId));
        const teamIds = teamRows.map((t) => t.id);

        // 全部 active members 一次查、依 teamId 分組
        const allMembers = teamIds.length > 0
          ? await db
              .select({
                teamId: teamMembers.teamId,
                userId: teamMembers.userId,
                role: teamMembers.role,
                joinedAt: teamMembers.joinedAt,
                user: { firstName: users.firstName, lastName: users.lastName, email: users.email },
              })
              .from(teamMembers)
              .leftJoin(users, eq(users.id, teamMembers.userId))
              .where(and(inArray(teamMembers.teamId, teamIds), isNull(teamMembers.leftAt)))
          : [];
        const membersByTeam = new Map<string, typeof allMembers>();
        for (const m of allMembers) {
          const arr = membersByTeam.get(m.teamId) ?? [];
          arr.push(m);
          membersByTeam.set(m.teamId, arr);
        }

        // 全部 sessions 的 progress 一次查、依 sessionId 分組
        const allProgress = sessionIds.length > 0
          ? await db
              .select()
              .from(playerProgress)
              .where(inArray(playerProgress.sessionId, sessionIds))
          : [];
        const progressBySession = new Map<string, typeof allProgress>();
        for (const p of allProgress) {
          const arr = progressBySession.get(p.sessionId) ?? [];
          arr.push(p);
          progressBySession.set(p.sessionId, arr);
        }

        // team_game_states / team_lock_states 一次查、依 team|session 分組
        type StateRowLoose = Record<string, unknown> & { team_id: string; session_id: string };
        const groupByTeamSession = (rows: StateRowLoose[]) => {
          const map = new Map<string, StateRowLoose[]>();
          for (const r of rows) {
            const key = `${r.team_id}|${r.session_id}`;
            const arr = map.get(key) ?? [];
            arr.push(r);
            map.set(key, arr);
          }
          return map;
        };
        const teamStatesRes = sessionIds.length > 0
          ? await db.execute(sql`
              SELECT team_id, session_id, page_id, component_type, version, updated_at
              FROM team_game_states
              WHERE session_id = ANY(${sessionIds})
              ORDER BY updated_at DESC
            `)
          : { rows: [] };
        const teamStatesByKey = groupByTeamSession(
          ((teamStatesRes as unknown as { rows?: StateRowLoose[] }).rows ?? []),
        );
        const lockStatesRes = sessionIds.length > 0
          ? await db.execute(sql`
              SELECT team_id, session_id, page_id, shared_code, attempts, is_unlocked, is_failed, version, updated_at
              FROM team_lock_states
              WHERE session_id = ANY(${sessionIds})
            `)
          : { rows: [] };
        const lockStatesByKey = groupByTeamSession(
          ((lockStatesRes as unknown as { rows?: StateRowLoose[] }).rows ?? []),
        );

        const result = [];

        for (const s of sessions) {
          const teamsData = [];
          for (const t of teamRows) {
            const members = membersByTeam.get(t.id) ?? [];
            const progressRows = progressBySession.get(s.id) ?? [];

            const memberStatus = members.map((m) => {
              const prog = progressRows.find((p) => p.userId === m.userId);
              const conn = playerConnMap.get(`${s.id}|${m.userId}`);

              // 🆕 真實 online：依 ws_event_log 最後事件
              let connectionStatus: "online" | "away" | "offline" = "offline";
              if (conn && conn.lastEventAt && conn.lastEventType !== "close" && conn.lastEventType !== "auto_leave") {
                connectionStatus = conn.lastEventAt >= detailRecentCutoff ? "online" : "away";
              }
              // fallback：若無 ws 事件、用 player_progress 5 分鐘
              const fallbackOnline = prog?.updatedAt instanceof Date && prog.updatedAt > cutoff;
              if (!conn?.lastEventAt && fallbackOnline) connectionStatus = "online";

              const currentPageOrder = prog?.currentPageId
                ? (pageOrderMap.get(prog.currentPageId) ?? 0)
                : 0;
              return {
                userId: m.userId,
                role: m.role,
                name:
                  [m.user?.firstName, m.user?.lastName].filter(Boolean).join(" ").trim() ||
                  m.user?.email?.split("@")[0] ||
                  m.userId.slice(0, 8),
                online: connectionStatus !== "offline", // 向後相容
                connectionStatus,
                updatedAt: prog?.updatedAt?.toISOString?.() ?? null,
                currentPageId: prog?.currentPageId ?? null,
                currentPageOrder,
                progressPercent: totalPages > 0 ? Math.round((currentPageOrder / totalPages) * 100) : 0,
                score: prog?.score ?? 0,
                // 🆕 P1-7 真實 ws 狀態
                wsConn: conn ? {
                  firstConnectAt: conn.firstConnectAt?.toISOString() ?? null,
                  lastEventAt: conn.lastEventAt?.toISOString() ?? null,
                  lastEventType: conn.lastEventType,
                  connectCount: conn.connectCount,
                  closeCount: conn.closeCount,
                  messageCount: conn.messageCount,
                  reconnectCount: Math.max(0, conn.connectCount - 1),
                  clientIp: conn.lastIp,
                  userAgent: conn.lastUserAgent ? conn.lastUserAgent.slice(0, 80) : null,
                  lastReason: conn.lastReason,
                } : null,
              };
            });

            // 隊伍 game states（最近 5 條）/ lock states — 批次結果查表
            const recentStates = (teamStatesByKey.get(`${t.id}|${s.id}`) ?? []).slice(0, 5);
            const lockStates = lockStatesByKey.get(`${t.id}|${s.id}`) ?? [];

            teamsData.push({
              teamId: t.id,
              teamName: t.name,
              memberCount: members.length,
              members: memberStatus,
              recentStates,
              lockStates,
            });
          }

          // 🆕 P1-8 (2026-05-08)：本 session 的時間軸事件（過去 5 分鐘、給迷你 timeline 用）
          const sessionTimelineEvents = detailWsEvents
            .filter((e) => e.sessionId === s.id)
            .map((e) => ({
              userId: e.userId,
              eventType: e.eventType,
              timestamp: e.timestamp?.toISOString() ?? null,
            }))
            .sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));

          // 🆕 P0-4 health 聚合（per session、本 session）
          const sessionHealth = {
            graceCount: 0,
            autoLeaveCount: 0,
            kickCount: 0,
            errorCount: 0,
            messageCount: 0,
            broadcastCount: 0,
          };
          for (const e of detailWsEvents) {
            if (e.sessionId !== s.id) continue;
            if (e.eventType === "grace_expired") sessionHealth.graceCount += 1;
            else if (e.eventType === "auto_leave") sessionHealth.autoLeaveCount += 1;
            else if (e.eventType === "kick") sessionHealth.kickCount += 1;
            else if (e.eventType === "error") sessionHealth.errorCount += 1;
            else if (e.eventType === "message") sessionHealth.messageCount += 1;
            else if (e.eventType === "broadcast") sessionHealth.broadcastCount += 1;
          }

          // 🆕 P2-10 平均隊伍進度（已通過頁 / 總頁數）
          const allMemberProgress = teamsData.flatMap((t) => t.members);
          const avgPageOrder = allMemberProgress.length > 0
            ? allMemberProgress.reduce((sum, m) => sum + m.currentPageOrder, 0) / allMemberProgress.length
            : 0;
          const avgProgressPercent = totalPages > 0 ? Math.round((avgPageOrder / totalPages) * 100) : 0;

          result.push({
            sessionId: s.id,
            startedAt: s.startedAt,
            status: s.status,
            hostMode: s.hostMode,
            teamCount: teamsData.length,
            teams: teamsData,
            // 🆕 P1-8 時間軸
            timelineEvents: sessionTimelineEvents,
            timelineWindowMinutes: Math.round(HEALTH_WINDOW_MS / 60_000),
            // 🆕 P0-4 health
            health: sessionHealth,
            // 🆕 P2-10 game 進度
            avgProgressPercent,
            totalPages,
          });
        }

        res.json({
          gameId,
          gameTitle: game.title,
          totalPages,
          activeSessions: result.length,
          sessions: result,
          generatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[admin-multi-sessions] failed:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "查詢失敗" });
      }
    },
  );

  // 🆕 P3-14 (2026-05-08)：玩家 cross-session 連線歷史
  //   GET /api/admin/players/:userId/connection-history?days=7
  //   回傳：過去 N 天該 userId 的所有 session 連線統計
  app.get(
    "/api/admin/players/:userId/connection-history",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        const { userId } = req.params;
        const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // 該 userId 過去 N 天所有 ws 事件
        const events = await db
          .select({
            sessionId: wsEventLog.sessionId,
            eventType: wsEventLog.eventType,
            timestamp: wsEventLog.timestamp,
            clientIp: wsEventLog.clientIp,
            reason: wsEventLog.reason,
          })
          .from(wsEventLog)
          .where(
            and(
              eq(wsEventLog.userId, userId),
              gte(wsEventLog.timestamp, cutoff),
            ),
          );

        if (events.length === 0) {
          return res.json({
            userId,
            windowDays: days,
            totalSessions: 0,
            totalConnects: 0,
            totalReconnects: 0,
            totalGraceExpired: 0,
            totalAutoLeaves: 0,
            totalErrors: 0,
            sessions: [],
            generatedAt: new Date().toISOString(),
          });
        }

        // 場域權限過濾（super_admin 看全部、其他 admin 限自己場域）
        const sessionIds = Array.from(new Set(events.map((e) => e.sessionId).filter((s): s is string => s !== null)));
        const sessionGameMap = sessionIds.length > 0
          ? await db
              .select({
                sessionId: gameSessions.id,
                gameId: gameSessions.gameId,
                gameTitle: games.title,
                fieldId: games.fieldId,
                startedAt: gameSessions.startedAt,
                status: gameSessions.status,
              })
              .from(gameSessions)
              .leftJoin(games, eq(games.id, gameSessions.gameId))
              .where(inArray(gameSessions.id, sessionIds))
          : [];

        const isSuperAdmin = req.admin.systemRole === "super_admin";
        const visibleSessionIds = new Set(
          sessionGameMap
            .filter((s) => isSuperAdmin || s.fieldId === req.admin!.fieldId)
            .map((s) => s.sessionId),
        );

        // per session 聚合
        type SessionStat = {
          sessionId: string;
          gameTitle: string;
          startedAt: Date | null;
          status: string | null;
          connectCount: number;
          closeCount: number;
          graceExpired: number;
          autoLeave: number;
          error: number;
          firstEventAt: Date | null;
          lastEventAt: Date | null;
          uniqueIps: Set<string>;
        };
        const statBySession = new Map<string, SessionStat>();
        const sessionMetaMap = new Map(sessionGameMap.map((s) => [s.sessionId, s]));

        for (const e of events) {
          if (!e.sessionId || !visibleSessionIds.has(e.sessionId)) continue;
          const meta = sessionMetaMap.get(e.sessionId);
          const stat = statBySession.get(e.sessionId) ?? {
            sessionId: e.sessionId,
            gameTitle: meta?.gameTitle ?? "(unknown)",
            startedAt: meta?.startedAt ?? null,
            status: meta?.status ?? null,
            connectCount: 0,
            closeCount: 0,
            graceExpired: 0,
            autoLeave: 0,
            error: 0,
            firstEventAt: null,
            lastEventAt: null,
            uniqueIps: new Set<string>(),
          };
          if (e.eventType === "connect") stat.connectCount += 1;
          else if (e.eventType === "close") stat.closeCount += 1;
          else if (e.eventType === "grace_expired") stat.graceExpired += 1;
          else if (e.eventType === "auto_leave") stat.autoLeave += 1;
          else if (e.eventType === "error") stat.error += 1;
          if (e.timestamp) {
            if (!stat.firstEventAt || e.timestamp < stat.firstEventAt) stat.firstEventAt = e.timestamp;
            if (!stat.lastEventAt || e.timestamp > stat.lastEventAt) stat.lastEventAt = e.timestamp;
          }
          if (e.clientIp) stat.uniqueIps.add(e.clientIp);
          statBySession.set(e.sessionId, stat);
        }

        // 總計
        const sessionsArr = Array.from(statBySession.values()).map((s) => ({
          sessionId: s.sessionId,
          gameTitle: s.gameTitle,
          startedAt: s.startedAt?.toISOString() ?? null,
          status: s.status,
          connectCount: s.connectCount,
          closeCount: s.closeCount,
          reconnectCount: Math.max(0, s.connectCount - 1),
          graceExpired: s.graceExpired,
          autoLeave: s.autoLeave,
          error: s.error,
          firstEventAt: s.firstEventAt?.toISOString() ?? null,
          lastEventAt: s.lastEventAt?.toISOString() ?? null,
          uniqueIps: Array.from(s.uniqueIps),
        }));
        sessionsArr.sort((a, b) => (b.firstEventAt ?? "").localeCompare(a.firstEventAt ?? ""));

        const totals = sessionsArr.reduce(
          (acc, s) => ({
            totalConnects: acc.totalConnects + s.connectCount,
            totalReconnects: acc.totalReconnects + s.reconnectCount,
            totalGraceExpired: acc.totalGraceExpired + s.graceExpired,
            totalAutoLeaves: acc.totalAutoLeaves + s.autoLeave,
            totalErrors: acc.totalErrors + s.error,
          }),
          { totalConnects: 0, totalReconnects: 0, totalGraceExpired: 0, totalAutoLeaves: 0, totalErrors: 0 },
        );

        res.json({
          userId,
          windowDays: days,
          totalSessions: sessionsArr.length,
          ...totals,
          sessions: sessionsArr,
          generatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[admin-player-history] failed:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "查詢失敗" });
      }
    },
  );
}
