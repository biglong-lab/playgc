// 💰 財務中心 API Facade — 聚合現有 purchases / redeem_codes / battle_slots 等
// Phase 3：統一入口，底層仍查現有表，Phase 4+ 再重構資料模型
import type { Express } from "express";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { db } from "../db";
import {
  games,
  purchases,
  redeemCodes,
  battleVenues,
  battleSlots,
  battleRegistrations,
} from "@shared/schema";
import { eq, sql, and, desc } from "drizzle-orm";

export function registerRevenueRoutes(app: Express): void {
  // ============================================================================
  // GET /api/revenue/overview — 營收總覽（遊戲+對戰統合）
  // ============================================================================
  app.get(
    "/api/revenue/overview",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        const fieldId =
          req.admin.systemRole === "super_admin"
            ? ((req.query.fieldId as string) || req.admin.fieldId)
            : req.admin.fieldId;

        // 本月起始
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // 🎮 遊戲收入
        const [gameRevenue] = await db
          .select({
            totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${purchases.status} = 'completed' THEN ${purchases.amount} ELSE 0 END), 0)::int`,
            monthlyRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${purchases.status} = 'completed' AND ${purchases.createdAt} >= ${monthStart} THEN ${purchases.amount} ELSE 0 END), 0)::int`,
            purchaseCount: sql<number>`COUNT(CASE WHEN ${purchases.status} = 'completed' THEN 1 END)::int`,
          })
          .from(purchases)
          .innerJoin(games, eq(purchases.gameId, games.id))
          .where(eq(games.fieldId, fieldId));

        // ⚔️ 對戰收入（paid = depositPaid，金額 = slot.pricePerPerson 或 venue.settings.pricePerPerson）
        const [battleRevenue] = await db
          .select({
            totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${battleRegistrations.depositPaid} THEN COALESCE(${battleSlots.pricePerPerson}, CAST(${battleVenues.settings}->>'pricePerPerson' AS INTEGER), 0) ELSE 0 END), 0)::int`,
            monthlyRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${battleRegistrations.depositPaid} AND ${battleRegistrations.registeredAt} >= ${monthStart} THEN COALESCE(${battleSlots.pricePerPerson}, CAST(${battleVenues.settings}->>'pricePerPerson' AS INTEGER), 0) ELSE 0 END), 0)::int`,
            registrationCount: sql<number>`COUNT(CASE WHEN ${battleRegistrations.depositPaid} THEN 1 END)::int`,
          })
          .from(battleRegistrations)
          .innerJoin(battleSlots, eq(battleRegistrations.slotId, battleSlots.id))
          .innerJoin(battleVenues, eq(battleSlots.venueId, battleVenues.id))
          .where(eq(battleVenues.fieldId, fieldId));

        // 兌換碼統計
        const [codeStats] = await db
          .select({
            total: sql<number>`COUNT(*)::int`,
            active: sql<number>`COUNT(CASE WHEN ${redeemCodes.status} = 'active' THEN 1 END)::int`,
            used: sql<number>`COUNT(CASE WHEN ${redeemCodes.status} = 'used' THEN 1 END)::int`,
          })
          .from(redeemCodes)
          .where(eq(redeemCodes.fieldId, fieldId));

        res.json({
          totalRevenue:
            (gameRevenue?.totalRevenue ?? 0) + (battleRevenue?.totalRevenue ?? 0),
          monthlyRevenue:
            (gameRevenue?.monthlyRevenue ?? 0) + (battleRevenue?.monthlyRevenue ?? 0),
          breakdown: {
            games: {
              totalRevenue: gameRevenue?.totalRevenue ?? 0,
              monthlyRevenue: gameRevenue?.monthlyRevenue ?? 0,
              purchaseCount: gameRevenue?.purchaseCount ?? 0,
            },
            battles: {
              totalRevenue: battleRevenue?.totalRevenue ?? 0,
              monthlyRevenue: battleRevenue?.monthlyRevenue ?? 0,
              registrationCount: battleRevenue?.registrationCount ?? 0,
            },
          },
          codes: codeStats,
        });
      } catch (err) {
        console.error("[revenue/overview]", err);
        res.status(500).json({ message: "取得營收總覽失敗" });
      }
    }
  );

  // ============================================================================
  // GET /api/revenue/products — 統一商品列表（遊戲 + 對戰場地）
  // ============================================================================
  app.get(
    "/api/revenue/products",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        const fieldId =
          req.admin.systemRole === "super_admin"
            ? ((req.query.fieldId as string) || req.admin.fieldId)
            : req.admin.fieldId;
        const category = req.query.category as string | undefined;

        const products: Array<{
          id: string;
          category: "game" | "battle";
          sourceId: string;
          name: string;
          pricingMode: string;
          price: number;
          status: string;
          metadata: Record<string, unknown>;
        }> = [];

        // 🎮 遊戲商品
        if (!category || category === "game") {
          const gameRows = await db
            .select()
            .from(games)
            .where(eq(games.fieldId, fieldId));

          for (const g of gameRows) {
            products.push({
              id: `game:${g.id}`,
              category: "game",
              sourceId: g.id,
              name: g.title,
              pricingMode: g.pricingType || "free",
              price: g.price ?? 0,
              status: g.status || "draft",
              metadata: {
                gameMode: g.gameMode,
                recurProductId: g.recurProductId,
              },
            });
          }
        }

        // ⚔️ 對戰場地商品
        if (!category || category === "battle") {
          const venues = await db
            .select()
            .from(battleVenues)
            .where(eq(battleVenues.fieldId, fieldId));

          for (const v of venues) {
            const settings = (v.settings ?? {}) as Record<string, unknown>;
            products.push({
              id: `battle-venue:${v.id}`,
              category: "battle",
              sourceId: v.id,
              name: v.name,
              pricingMode: "per_person",
              price: (settings.pricePerPerson as number) ?? 0,
              status: "active",
              metadata: {
                depositAmount: settings.depositAmount,
                equipmentOptions: settings.equipmentOptions,
              },
            });
          }
        }

        res.json({ products, total: products.length });
      } catch (err) {
        console.error("[revenue/products]", err);
        res.status(500).json({ message: "取得商品列表失敗" });
      }
    }
  );

  // ============================================================================
  // GET /api/revenue/codes — 跨遊戲兌換碼（升級自 /api/admin/redeem-codes）
  // ============================================================================
  app.get(
    "/api/revenue/codes",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        const fieldId =
          req.admin.systemRole === "super_admin"
            ? ((req.query.fieldId as string) || req.admin.fieldId)
            : req.admin.fieldId;

        const codes = await db
          .select({
            code: redeemCodes,
            game: {
              id: games.id,
              title: games.title,
            },
          })
          .from(redeemCodes)
          .leftJoin(games, eq(redeemCodes.gameId, games.id))
          .where(eq(redeemCodes.fieldId, fieldId))
          .orderBy(desc(redeemCodes.createdAt))
          .limit(500);

        res.json({ codes });
      } catch (err) {
        console.error("[revenue/codes]", err);
        res.status(500).json({ message: "取得兌換碼失敗" });
      }
    }
  );

  // ============================================================================
  // GET /api/revenue/transactions — 跨類型交易記錄
  // ============================================================================
  app.get(
    "/api/revenue/transactions",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });
        const fieldId =
          req.admin.systemRole === "super_admin"
            ? ((req.query.fieldId as string) || req.admin.fieldId)
            : req.admin.fieldId;

        const type = req.query.type as string | undefined;
        const limit = Math.min(Number(req.query.limit) || 100, 500);

        const transactions: Array<{
          id: string;
          type: "game_purchase" | "battle_registration";
          productId: string;
          productName: string;
          playerId: string | null;
          amount: number;
          status: string;
          createdAt: Date | null;
        }> = [];

        // 🎮 遊戲購買
        if (!type || type === "game_purchase") {
          const purchaseRows = await db
            .select({
              purchase: purchases,
              game: { id: games.id, title: games.title },
            })
            .from(purchases)
            .innerJoin(games, eq(purchases.gameId, games.id))
            .where(eq(games.fieldId, fieldId))
            .orderBy(desc(purchases.createdAt))
            .limit(limit);

          for (const row of purchaseRows) {
            transactions.push({
              id: `purchase:${row.purchase.id}`,
              type: "game_purchase",
              productId: row.game.id,
              productName: row.game.title,
              playerId: row.purchase.userId,
              amount: row.purchase.amount ?? 0,
              status: row.purchase.status || "pending",
              createdAt: row.purchase.createdAt,
            });
          }
        }

        // ⚔️ 對戰報名
        if (!type || type === "battle_registration") {
          const regRows = await db
            .select({
              reg: battleRegistrations,
              slot: battleSlots,
              venue: battleVenues,
            })
            .from(battleRegistrations)
            .innerJoin(battleSlots, eq(battleRegistrations.slotId, battleSlots.id))
            .innerJoin(battleVenues, eq(battleSlots.venueId, battleVenues.id))
            .where(eq(battleVenues.fieldId, fieldId))
            .orderBy(desc(battleRegistrations.registeredAt))
            .limit(limit);

          for (const row of regRows) {
            const settings = (row.venue.settings ?? {}) as Record<string, unknown>;
            const venuePrice = (settings.pricePerPerson as number) ?? 0;
            const amount = row.slot.pricePerPerson ?? venuePrice;
            transactions.push({
              id: `battle-reg:${row.reg.id}`,
              type: "battle_registration",
              productId: row.venue.id,
              productName: row.venue.name,
              playerId: row.reg.userId,
              amount,
              status: row.reg.depositPaid ? "paid" : "pending",
              createdAt: row.reg.registeredAt,
            });
          }
        }

        // 依時間排序
        transactions.sort(
          (a, b) =>
            (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
        );

        res.json({
          transactions: transactions.slice(0, limit),
          total: transactions.length,
        });
      } catch (err) {
        console.error("[revenue/transactions]", err);
        res.status(500).json({ message: "取得交易記錄失敗" });
      }
    }
  );
}
