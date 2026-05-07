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
import { sql, eq, and, isNull, gte } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export function registerAdminMultiSessionsRoutes(app: Express) {
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
