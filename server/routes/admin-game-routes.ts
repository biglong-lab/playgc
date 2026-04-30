// 🎮 多腳本路線（Game Routes）admin CRUD
//
// 一個 game 可以有多條 route，admin 用此頁面建立/編輯/啟用/停用
//
// 4 個 endpoint:
//   GET    /api/admin/games/:gameId/routes
//   POST   /api/admin/games/:gameId/routes
//   PATCH  /api/admin/games/:gameId/routes/:routeId
//   DELETE /api/admin/games/:gameId/routes/:routeId
import type { Express } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { db } from "../db";
import {
  gameRoutes,
  games,
  type InsertGameRoute,
} from "@shared/schema";
import { composeRoguelikeFlow } from "../lib/roguelike-composer";
import { isAuthenticated } from "../firebaseAuth";

const createSchema = z.object({
  routeName: z.string().min(1).max(50),
  startPageId: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  estimatedMinutes: z.number().int().min(1).max(600).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const updateSchema = createSchema.partial();

export function registerAdminGameRoutesRoutes(app: Express) {
  // ============================================================================
  // GET /api/admin/games/:gameId/routes — 列表
  // ============================================================================
  app.get(
    "/api/admin/games/:gameId/routes",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const { gameId } = req.params;
        const items = await db
          .select()
          .from(gameRoutes)
          .where(eq(gameRoutes.gameId, gameId))
          .orderBy(gameRoutes.sortOrder, desc(gameRoutes.createdAt));
        res.json({ total: items.length, items });
      } catch (error) {
        console.error("[game-routes] GET 失敗:", error);
        res.status(500).json({ error: "查詢路線失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/admin/games/:gameId/routes — 新增路線
  // ============================================================================
  app.post(
    "/api/admin/games/:gameId/routes",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId } = req.params;
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "格式驗證失敗",
            details: parsed.error.errors,
          });
        }

        // 確認 game 存在
        const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
        if (!game) {
          return res.status(404).json({ error: "遊戲不存在" });
        }

        const insert: InsertGameRoute = {
          gameId,
          routeName: parsed.data.routeName,
          startPageId: parsed.data.startPageId ?? null,
          description: parsed.data.description ?? null,
          difficulty: parsed.data.difficulty ?? null,
          estimatedMinutes: parsed.data.estimatedMinutes ?? null,
          isActive: parsed.data.isActive,
          sortOrder: parsed.data.sortOrder,
        };

        const [created] = await db.insert(gameRoutes).values(insert).returning();

        await logAuditAction({
          actorAdminId: req.admin?.accountId ?? undefined,
          action: "game-route:create",
          targetType: "game_route",
          targetId: created.id,
          metadata: { gameId, routeName: created.routeName },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.status(201).json(created);
      } catch (error) {
        console.error("[game-routes] POST 失敗:", error);
        res.status(500).json({ error: "建立路線失敗" });
      }
    },
  );

  // ============================================================================
  // PATCH /api/admin/games/:gameId/routes/:routeId — 更新
  // ============================================================================
  app.patch(
    "/api/admin/games/:gameId/routes/:routeId",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId, routeId } = req.params;
        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "格式驗證失敗",
            details: parsed.error.errors,
          });
        }

        const [exists] = await db
          .select()
          .from(gameRoutes)
          .where(and(eq(gameRoutes.id, routeId), eq(gameRoutes.gameId, gameId)))
          .limit(1);
        if (!exists) {
          return res.status(404).json({ error: "路線不存在或不屬於此遊戲" });
        }

        const updates: Partial<InsertGameRoute> = {};
        if (parsed.data.routeName !== undefined) updates.routeName = parsed.data.routeName;
        if (parsed.data.startPageId !== undefined) updates.startPageId = parsed.data.startPageId;
        if (parsed.data.description !== undefined) updates.description = parsed.data.description;
        if (parsed.data.difficulty !== undefined) updates.difficulty = parsed.data.difficulty;
        if (parsed.data.estimatedMinutes !== undefined) updates.estimatedMinutes = parsed.data.estimatedMinutes;
        if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
        if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;

        const [updated] = await db
          .update(gameRoutes)
          .set(updates)
          .where(eq(gameRoutes.id, routeId))
          .returning();

        await logAuditAction({
          actorAdminId: req.admin?.accountId ?? undefined,
          action: "game-route:update",
          targetType: "game_route",
          targetId: routeId,
          metadata: { gameId, changes: parsed.data },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json(updated);
      } catch (error) {
        console.error("[game-routes] PATCH 失敗:", error);
        res.status(500).json({ error: "更新路線失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/games/:gameId/start-roguelike — 為玩家產生個人化流程（公開 API）
  // 玩家可透過此 endpoint 獲得隨機抽選的 N 個 pages 組成的「個人化遊戲」
  // ============================================================================
  const startRoguelikeSchema = z.object({
    targetCount: z.number().int().min(3).max(15).default(6),
    seed: z.number().int().optional(),
    withIntroOutro: z.boolean().default(true),
  });

  app.post(
    "/api/games/:gameId/start-roguelike",
    isAuthenticated,
    async (req, res) => {
      try {
        const { gameId } = req.params;
        const parsed = startRoguelikeSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "格式驗證失敗",
            details: parsed.error.errors,
          });
        }

        // 確認 game 存在
        const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
        if (!game) {
          return res.status(404).json({ error: "遊戲不存在" });
        }

        const result = await composeRoguelikeFlow({
          gameId,
          targetCount: parsed.data.targetCount,
          seed: parsed.data.seed,
          withIntroOutro: parsed.data.withIntroOutro,
        });

        if (result.composedPages.length === 0) {
          return res.status(400).json({
            error: "此遊戲沒有可用於 roguelike 模式的 pages（需至少 3 個任務型 page）",
          });
        }

        res.json({
          gameId,
          totalSourcePages: result.totalSourcePages,
          composedCount: result.composedPages.length,
          pages: result.composedPages,
          rationale: result.rationale,
        });
      } catch (error) {
        console.error("[start-roguelike] 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "產生 roguelike 流程失敗",
        });
      }
    },
  );

  // ============================================================================
  // DELETE /api/admin/games/:gameId/routes/:routeId — 刪除
  // ============================================================================
  app.delete(
    "/api/admin/games/:gameId/routes/:routeId",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId, routeId } = req.params;
        const [deleted] = await db
          .delete(gameRoutes)
          .where(and(eq(gameRoutes.id, routeId), eq(gameRoutes.gameId, gameId)))
          .returning();
        if (!deleted) {
          return res.status(404).json({ error: "路線不存在" });
        }

        await logAuditAction({
          actorAdminId: req.admin?.accountId ?? undefined,
          action: "game-route:delete",
          targetType: "game_route",
          targetId: routeId,
          metadata: { gameId, routeName: deleted.routeName },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ success: true });
      } catch (error) {
        console.error("[game-routes] DELETE 失敗:", error);
        res.status(500).json({ error: "刪除路線失敗" });
      }
    },
  );
}
