// 管理端場次路由 — 批次清理卡住場次 + 全系統場次查詢 + 統計
import type { Express } from "express";
import { storage } from "../storage";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
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
        // 🔒 場域隔離：任何 admin（含 super_admin）只看自己登入場域
        if (req.admin.fieldId) {
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

        // 🔒 場域隔離：任何 admin 的儀表板只統計自己登入場域
        const fieldId = req.admin.fieldId;
        const gameFilter = sql`${games.fieldId} = ${fieldId}`;

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

  /** 批次放棄超時場次（🔒 場域隔離：field admin 只能清自己場域）*/
  app.post(
    "/api/admin/sessions/cleanup",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { thresholdHours } = cleanupSchema.parse(req.body);

        // 🔒 場域隔離
        const isPlatformAdmin = req.admin?.systemRole === "super_admin"
          || req.admin?.systemRole === "platform_admin";
        // field admin 強制傳自己 fieldId；platform admin 不限制（可清全平台）
        const fieldFilter = isPlatformAdmin ? undefined : req.admin?.fieldId;

        if (!isPlatformAdmin && !fieldFilter) {
          return res.status(403).json({
            message: "場域管理員需綁定場域才能清理 sessions",
          });
        }

        const abandoned = await storage.abandonStaleSessions(thresholdHours, fieldFilter);

        if (req.admin && abandoned.length > 0) {
          logAuditAction({
            actorAdminId: req.admin.id,
            action: "session:bulk_abandon",
            targetType: "game_session",
            targetId: String(abandoned.length),
            fieldId: fieldFilter,
            metadata: {
              thresholdHours,
              count: abandoned.length,
              isPlatformAdmin,
              sessionIds: abandoned.map((s) => s.id).slice(0, 50),
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        }

        res.json({
          message: `已清理 ${abandoned.length} 個卡住的場次` +
            (fieldFilter ? `（場域：${fieldFilter}）` : "（全平台）"),
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

  // ═══════════════════════════════════════════════════════════════
  // 🆕 2026-05-19 Phase C：遊戲重置（業主排解現場玩家狀況）
  // ═══════════════════════════════════════════════════════════════

  // GET /api/admin/sessions/:id/lookup — 查單一 session 含進度（給 reset UI 顯示）
  app.get(
    "/api/admin/sessions/:id/lookup",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        const [session] = await db
          .select({
            session: gameSessions,
            game: { id: games.id, name: games.title, fieldId: games.fieldId },
          })
          .from(gameSessions)
          .leftJoin(games, eq(gameSessions.gameId, games.id))
          .where(eq(gameSessions.id, req.params.id))
          .limit(1);

        if (!session) return res.status(404).json({ message: "場次不存在" });

        // 場域隔離（super_admin 可看全部）
        const isSuper = req.admin.systemRole === "super_admin";
        if (!isSuper && session.game?.fieldId !== req.admin.fieldId) {
          return res.status(403).json({ message: "無權檢視此場次" });
        }

        // 補玩家進度
        const players = await db
          .select({
            id: playerProgress.id,
            userId: playerProgress.userId,
            currentPageId: playerProgress.currentPageId,
            score: playerProgress.score,
            inventory: playerProgress.inventory,
            updatedAt: playerProgress.updatedAt,
          })
          .from(playerProgress)
          .where(eq(playerProgress.sessionId, req.params.id));

        res.json({
          session: session.session,
          game: session.game,
          players,
        });
      } catch (error) {
        console.error("[admin-sessions] lookup failed:", error);
        res.status(500).json({ message: "查詢場次失敗" });
      }
    },
  );

  // POST /api/admin/sessions/:id/reset — 重置遊戲場次
  // 必填 reason ≥ 10 字、所有玩家進度清空、回 status=playing、score=0
  // 寫入 reset_history（append-only）+ audit log
  const resetSchema = z.object({
    reason: z.string().min(10, "原因至少 10 字").max(500),
    notifyPlayers: z.boolean().default(false),
  });

  app.post(
    "/api/admin/sessions/:id/reset",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        const parsed = resetSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "validation",
            message: parsed.error.errors[0]?.message ?? "請填寫重置原因（≥ 10 字）",
          });
        }

        const [existing] = await db
          .select({
            session: gameSessions,
            game: { id: games.id, fieldId: games.fieldId, name: games.title },
          })
          .from(gameSessions)
          .leftJoin(games, eq(gameSessions.gameId, games.id))
          .where(eq(gameSessions.id, req.params.id))
          .limit(1);

        if (!existing) return res.status(404).json({ message: "場次不存在" });

        // 場域隔離
        const isSuper = req.admin.systemRole === "super_admin";
        if (!isSuper && existing.game?.fieldId !== req.admin.fieldId) {
          return res.status(403).json({ message: "無權重置此場次（不在本場域）" });
        }

        // 防呆：完成 / 放棄超過 24 小時的場次拒絕重置（避免改歷史資料）
        const completedAt = existing.session.completedAt;
        if (completedAt) {
          const hoursAgo = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60);
          if (hoursAgo > 24 && !isSuper) {
            return res.status(403).json({
              message: `此場次已結束超過 ${Math.floor(hoursAgo)} 小時、僅 super_admin 可重置`,
            });
          }
        }

        // 記錄重置前狀態
        const resetEntry = {
          at: new Date().toISOString(),
          byAdminId: req.admin.id,
          byAdminName: req.admin.displayName ?? req.admin.username ?? null,
          reason: parsed.data.reason,
          fromChapterId: existing.session.currentChapterId,
          fromScore: existing.session.score ?? 0,
          fromStatus: existing.session.status ?? "unknown",
        };

        // 取現有 history 並 append
        const currentHistory = Array.isArray(existing.session.resetHistory)
          ? (existing.session.resetHistory as unknown[])
          : [];
        const newHistory = [...currentHistory, resetEntry];

        // 重置場次：狀態 → playing、分數 → 0、currentChapterId → null、completedAt → null
        // 注意：teamName / gameId / hostMode / startedAt 保留
        await db
          .update(gameSessions)
          .set({
            status: "playing",
            score: 0,
            currentChapterId: null,
            completedAt: null,
            resetCount: (existing.session.resetCount ?? 0) + 1,
            resetHistory: newHistory,
          })
          .where(eq(gameSessions.id, req.params.id));

        // 清玩家進度（讓玩家從頭開始）
        await db.delete(playerProgress).where(eq(playerProgress.sessionId, req.params.id));

        logAuditAction({
          actorAdminId: req.admin.id,
          action: "session:reset",
          targetType: "game_session",
          targetId: req.params.id,
          fieldId: existing.game?.fieldId,
          metadata: {
            gameName: existing.game?.name,
            reason: parsed.data.reason,
            fromChapterId: existing.session.currentChapterId,
            fromScore: existing.session.score,
            fromStatus: existing.session.status,
            resetCount: (existing.session.resetCount ?? 0) + 1,
            notifyPlayers: parsed.data.notifyPlayers,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({
          ok: true,
          message: "場次已重置、玩家可重新開始",
          resetCount: (existing.session.resetCount ?? 0) + 1,
        });
      } catch (error) {
        console.error("[admin-sessions] reset failed:", error);
        res.status(500).json({ message: "重置場次失敗" });
      }
    },
  );
}
