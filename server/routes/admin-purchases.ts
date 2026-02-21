// 管理端購買路由 - 購買記錄、現金收款授權、票券統計
import type { Express } from "express";
import { storage } from "../storage";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { db } from "../db";
import { games, purchases, redeemCodes, redeemCodeUses } from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { z } from "zod";

// 現金收款授權的驗證 schema
const grantAccessSchema = z.object({
  userId: z.string().min(1, "需指定玩家 ID"),
  chapterId: z.string().optional(),
  amount: z.number().int().min(0).default(0),
  note: z.string().max(500).optional(),
});

export function registerAdminPurchaseRoutes(app: Express) {
  // ========================================================================
  // 遊戲購買記錄列表
  // ========================================================================
  app.get(
    "/api/admin/games/:gameId/purchases",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const { gameId } = req.params;
        const game = await storage.getGame(gameId);
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }

        const purchaseList = await storage.getPurchasesByGame(gameId);
        res.json(purchaseList);
      } catch (error) {
        res.status(500).json({ message: "無法取得購買記錄" });
      }
    }
  );

  // ========================================================================
  // 現金收款後手動授權存取
  // ========================================================================
  app.post(
    "/api/admin/games/:gameId/grant-access",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId } = req.params;
        const game = await storage.getGame(gameId);
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }

        const parsed = grantAccessSchema.parse(req.body);

        // 確認玩家存在
        const player = await storage.getUser(parsed.userId);
        if (!player) {
          return res.status(404).json({ message: "玩家不存在" });
        }

        // 檢查是否已有相同購買
        if (parsed.chapterId) {
          const existing = await storage.getUserChapterPurchase(
            parsed.userId,
            parsed.chapterId
          );
          if (existing) {
            return res.status(409).json({ message: "此玩家已擁有此章節存取權" });
          }
        } else {
          const existing = await storage.getUserGamePurchase(
            parsed.userId,
            gameId
          );
          if (existing) {
            return res.status(409).json({ message: "此玩家已擁有此遊戲存取權" });
          }
        }

        // 建立購買記錄
        const purchase = await storage.createPurchase({
          userId: parsed.userId,
          gameId,
          chapterId: parsed.chapterId ?? null,
          purchaseType: "cash_payment",
          amount: parsed.amount,
          currency: "TWD",
          status: "completed",
          grantedBy: req.admin?.accountId ?? null,
          note: parsed.note ?? null,
          completedAt: new Date(),
        });

        res.status(201).json(purchase);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "無法授權存取" });
      }
    }
  );

  // ========================================================================
  // 撤銷購買（退款）
  // ========================================================================
  app.delete(
    "/api/admin/purchases/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const purchase = await storage.getPurchase(id);
        if (!purchase) {
          return res.status(404).json({ message: "購買記錄不存在" });
        }

        // 標記為退款而非直接刪除
        const updated = await storage.updatePurchase(id, {
          status: "refunded",
        });

        res.json(updated);
      } catch (error) {
        res.status(500).json({ message: "無法撤銷購買" });
      }
    }
  );
}
