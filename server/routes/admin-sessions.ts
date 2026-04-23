// 管理端場次路由 — 批次清理卡住場次 + 全系統場次查詢 + 統計
import type { Express } from "express";
import { storage } from "../storage";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { z } from "zod";
import { db } from "../db";
import { gameSessions, games, users, playerProgress } from "@shared/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

const cleanupSchema = z.object({
  thresholdHours: z.number().min(1).max(720).default(24),
});

export function registerAdminSessionRoutes(app: Express) {
  /**
   * 📋 管理員查詢所有場次（含玩家資訊 + 遊戲資訊）
   * Query: ?status=playing&gameId=xxx&limit=100
   */
  app.get(
    "/api/admin/sessions",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        const limit = Math.min(parseInt(String(req.query.limit)) || 200, 500);
        const status = req.query.status ? String(req.query.status) : undefined;
        const gameId = req.query.gameId ? String(req.query.gameId) : undefined;

        const conditions = [];
        if (status) conditions.push(eq(gameSessions.status, status));
        if (gameId) conditions.push(eq(gameSessions.gameId, gameId));
        // 非 super_admin 只看自己場域的遊戲
        if (req.admin.systemRole !== "super_admin" && req.admin.fieldId) {
          conditions.push(eq(games.fieldId, req.admin.fieldId));
        }

        const rows = await db
          .select({
            session: gameSessions,
            game: {
              id: games.id,
              title: games.title,
              fieldId: games.fieldId,
            },
            // 用 leftJoin users 取 creator；session 可能沒有明確 user（舊資料）
            user: {
              id: users.id,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
              profileImageUrl: users.profileImageUrl,
            },
          })
          .from(gameSessions)
          .leftJoin(games, eq(gameSessions.gameId, games.id))
          .leftJoin(
            playerProgress,
            eq(playerProgress.sessionId, gameSessions.id),
          )
          .leftJoin(users, eq(users.id, playerProgress.userId))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(gameSessions.startedAt))
          .limit(limit);

        // 去重（同 session 可能有多個 playerProgress JOIN 出多筆）
        const seen = new Set<string>();
        const deduped = rows.filter((r) => {
          if (!r.session?.id || seen.has(r.session.id)) return false;
          seen.add(r.session.id);
          return true;
        });

        res.json(deduped);
      } catch (error) {
        console.error("[admin-sessions] list failed:", error);
        res.status(500).json({ message: "查詢場次失敗" });
      }
    },
  );

  /**
   * 📊 平台總覽統計（24h / 7d / 累計）
   */
  app.get(
    "/api/admin/stats/overview",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        const isSuperAdmin = req.admin.systemRole === "super_admin";
        const fieldId = req.admin.fieldId;

        const gameFilter = isSuperAdmin
          ? sql`TRUE`
          : sql`${games.fieldId} = ${fieldId}`;

        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 3600 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

        // 1. 場次總覽
        const [sessionsTotal] = await db
          .select({
            total: sql<number>`count(*)::int`,
            playing: sql<number>`count(*) filter (where ${gameSessions.status} = 'playing')::int`,
            completed: sql<number>`count(*) filter (where ${gameSessions.status} = 'completed')::int`,
            abandoned: sql<number>`count(*) filter (where ${gameSessions.status} = 'abandoned')::int`,
          })
          .from(gameSessions)
          .innerJoin(games, eq(gameSessions.gameId, games.id))
          .where(gameFilter);

        const [sessions24h] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(gameSessions)
          .innerJoin(games, eq(gameSessions.gameId, games.id))
          .where(and(gameFilter, gte(gameSessions.startedAt, last24h)));

        const [sessions7d] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(gameSessions)
          .innerJoin(games, eq(gameSessions.gameId, games.id))
          .where(and(gameFilter, gte(gameSessions.startedAt, last7d)));

        // 2. 熱門遊戲 top 10（按累計場次）
        const popularGames = await db
          .select({
            gameId: games.id,
            title: games.title,
            plays: sql<number>`count(${gameSessions.id})::int`,
            uniquePlayers: sql<number>`count(distinct ${playerProgress.userId})::int`,
          })
          .from(games)
          .leftJoin(gameSessions, eq(gameSessions.gameId, games.id))
          .leftJoin(
            playerProgress,
            eq(playerProgress.sessionId, gameSessions.id),
          )
          .where(gameFilter)
          .groupBy(games.id, games.title)
          .orderBy(desc(sql`count(${gameSessions.id})`))
          .limit(10);

        // 3. 近 7 天每日場次（趨勢圖用）
        const dailyTrend = await db
          .select({
            date: sql<string>`to_char(${gameSessions.startedAt}, 'YYYY-MM-DD')`,
            count: sql<number>`count(*)::int`,
          })
          .from(gameSessions)
          .innerJoin(games, eq(gameSessions.gameId, games.id))
          .where(and(gameFilter, gte(gameSessions.startedAt, last7d)))
          .groupBy(sql`to_char(${gameSessions.startedAt}, 'YYYY-MM-DD')`)
          .orderBy(sql`to_char(${gameSessions.startedAt}, 'YYYY-MM-DD')`);

        // 4. 累計不重複玩家數
        const [uniquePlayers] = await db
          .select({ count: sql<number>`count(distinct ${playerProgress.userId})::int` })
          .from(playerProgress)
          .innerJoin(gameSessions, eq(playerProgress.sessionId, gameSessions.id))
          .innerJoin(games, eq(gameSessions.gameId, games.id))
          .where(gameFilter);

        res.json({
          sessions: {
            total: sessionsTotal?.total ?? 0,
            playing: sessionsTotal?.playing ?? 0,
            completed: sessionsTotal?.completed ?? 0,
            abandoned: sessionsTotal?.abandoned ?? 0,
            last24h: sessions24h?.count ?? 0,
            last7d: sessions7d?.count ?? 0,
          },
          uniquePlayers: uniquePlayers?.count ?? 0,
          popularGames,
          dailyTrend,
          generatedAt: now.toISOString(),
        });
      } catch (error) {
        console.error("[admin-stats] overview failed:", error);
        res.status(500).json({ message: "統計查詢失敗" });
      }
    },
  );

  /** 批次放棄超時場次 */
  app.post(
    "/api/admin/sessions/cleanup",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { thresholdHours } = cleanupSchema.parse(req.body);
        const abandoned = await storage.abandonStaleSessions(thresholdHours);

        res.json({
          message: `已清理 ${abandoned.length} 個卡住的場次`,
          count: abandoned.length,
          sessions: abandoned.map((s) => ({
            id: s.id,
            gameId: s.gameId,
            teamName: s.teamName,
            startedAt: s.startedAt,
          })),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "參數錯誤", errors: error.errors });
        }
        res.status(500).json({ message: "清理場次失敗" });
      }
    },
  );
}
