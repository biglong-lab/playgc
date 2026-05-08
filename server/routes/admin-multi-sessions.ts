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
import { games, gameSessions, teams, teamMembers, playerProgress, pages, users } from "@shared/schema";
import { sql, eq, and, isNull, gte, inArray } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

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

        // 4. batch 拉所有 player progress（看 online 狀態）
        const sessionIds = visibleSessions
          .map((s) => s.sessionId)
          .filter((id): id is string => id !== null);
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

        const onlineSetBySession = new Map<string, Set<string>>();
        for (const p of allProgress) {
          if (!onlineSetBySession.has(p.sessionId)) onlineSetBySession.set(p.sessionId, new Set());
          onlineSetBySession.get(p.sessionId)!.add(p.userId);
        }

        // 5. 組裝 lightweight session list
        const result = visibleSessions.map((s) => {
          const sessionTeams = teamsByGame.get(s.gameId) ?? [];
          const totalMembers = sessionTeams.reduce(
            (sum, t) => sum + (membersByTeam.get(t.id)?.length ?? 0),
            0,
          );
          const onlineSet = onlineSetBySession.get(s.sessionId) ?? new Set();
          const onlineMembers = sessionTeams.reduce((sum, t) => {
            const teamMems = membersByTeam.get(t.id) ?? [];
            return sum + teamMems.filter((m) => onlineSet.has(m.userId)).length;
          }, 0);

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
            offlineMembers: totalMembers - onlineMembers,
          };
        });

        res.json({
          sessions: result,
          totalActive: result.length,
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

        // 3. 每 session 的 teams + members + progress + persistence
        const result = [];
        const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);

        for (const s of sessions) {
          // teams 在這個 game（不是 session、teams 屬 game level）
          const teamRows = await db
            .select()
            .from(teams)
            .where(eq(teams.gameId, gameId));

          const teamsData = [];
          for (const t of teamRows) {
            // members（active）
            const members = await db
              .select({
                userId: teamMembers.userId,
                role: teamMembers.role,
                joinedAt: teamMembers.joinedAt,
                user: { firstName: users.firstName, lastName: users.lastName, email: users.email },
              })
              .from(teamMembers)
              .leftJoin(users, eq(users.id, teamMembers.userId))
              .where(and(eq(teamMembers.teamId, t.id), isNull(teamMembers.leftAt)));

            // 各員 progress（用 sessionId）
            const progressRows = await db
              .select()
              .from(playerProgress)
              .where(eq(playerProgress.sessionId, s.id));

            const memberStatus = members.map((m) => {
              const prog = progressRows.find((p) => p.userId === m.userId);
              const online =
                prog?.updatedAt instanceof Date && prog.updatedAt > cutoff;
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
                online,
                updatedAt: prog?.updatedAt?.toISOString?.() ?? null,
                currentPageId: prog?.currentPageId ?? null,
                currentPageOrder,
                progressPercent: totalPages > 0 ? Math.round((currentPageOrder / totalPages) * 100) : 0,
                score: prog?.score ?? 0,
              };
            });

            // 隊伍 game states（最近 5 條）
            const teamStates = await db.execute(sql`
              SELECT page_id, component_type, version, updated_at
              FROM team_game_states
              WHERE team_id=${t.id} AND session_id=${s.id}
              ORDER BY updated_at DESC LIMIT 5
            `);

            // 隊伍 lock states（如有）
            const lockStates = await db.execute(sql`
              SELECT page_id, shared_code, attempts, is_unlocked, is_failed, version, updated_at
              FROM team_lock_states
              WHERE team_id=${t.id} AND session_id=${s.id}
            `);

            teamsData.push({
              teamId: t.id,
              teamName: t.name,
              memberCount: members.length,
              members: memberStatus,
              recentStates: (teamStates as unknown as { rows?: unknown[] }).rows ?? [],
              lockStates: (lockStates as unknown as { rows?: unknown[] }).rows ?? [],
            });
          }

          result.push({
            sessionId: s.id,
            startedAt: s.startedAt,
            status: s.status,
            hostMode: s.hostMode,
            teamCount: teamsData.length,
            teams: teamsData,
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
}
