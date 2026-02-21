// 管理端兌換碼路由 - 兌換碼 CRUD、批次建立、使用紀錄
import type { Express } from "express";
import { storage } from "../storage";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { z } from "zod";
import {
  generateRedeemCode,
  generateRedeemCodes,
} from "../utils/redeem-code-generator";

// 建立兌換碼的驗證 schema
const createCodeSchema = z.object({
  scope: z.enum(["game", "chapter"]),
  chapterId: z.string().optional(),
  maxUses: z.number().int().min(1).max(10000).default(1),
  expiresAt: z.string().datetime().optional(),
  label: z.string().max(200).optional(),
});

// 批次建立的驗證 schema
const batchCreateSchema = createCodeSchema.extend({
  count: z.number().int().min(1).max(100),
});

// 更新兌換碼的驗證 schema
const updateCodeSchema = z.object({
  status: z.enum(["active", "used", "expired", "disabled"]).optional(),
  maxUses: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  label: z.string().max(200).optional(),
});

export function registerAdminRedeemCodeRoutes(app: Express) {
  // ========================================================================
  // 列出遊戲的兌換碼
  // ========================================================================
  app.get(
    "/api/admin/games/:gameId/redeem-codes",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const { gameId } = req.params;
        const game = await storage.getGame(gameId);
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }
        const codes = await storage.getRedeemCodes(gameId);
        res.json(codes);
      } catch (error) {
        res.status(500).json({ message: "無法取得兌換碼列表" });
      }
    }
  );

  // ========================================================================
  // 建立單一兌換碼
  // ========================================================================
  app.post(
    "/api/admin/games/:gameId/redeem-codes",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId } = req.params;
        const game = await storage.getGame(gameId);
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }

        const parsed = createCodeSchema.parse(req.body);

        if (!game.fieldId) {
          return res.status(400).json({ message: "遊戲未關聯場域" });
        }

        // scope=chapter 時 chapterId 必填
        if (parsed.scope === "chapter" && !parsed.chapterId) {
          return res.status(400).json({ message: "章節範圍需指定 chapterId" });
        }

        const code = await storage.createRedeemCode({
          code: generateRedeemCode(),
          fieldId: game.fieldId,
          gameId,
          chapterId: parsed.chapterId ?? null,
          scope: parsed.scope,
          maxUses: parsed.maxUses,
          expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
          label: parsed.label ?? null,
          status: "active",
          createdBy: req.admin?.accountId ?? null,
        });

        res.status(201).json(code);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "無法建立兌換碼" });
      }
    }
  );

  // ========================================================================
  // 批次建立兌換碼
  // ========================================================================
  app.post(
    "/api/admin/games/:gameId/redeem-codes/batch",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId } = req.params;
        const game = await storage.getGame(gameId);
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }

        const parsed = batchCreateSchema.parse(req.body);

        if (!game.fieldId) {
          return res.status(400).json({ message: "遊戲未關聯場域" });
        }

        if (parsed.scope === "chapter" && !parsed.chapterId) {
          return res.status(400).json({ message: "章節範圍需指定 chapterId" });
        }

        const { fieldId } = game;
        const generatedCodes = generateRedeemCodes(parsed.count);
        const codesData = generatedCodes.map((code) => ({
          code,
          fieldId,
          gameId,
          chapterId: parsed.chapterId ?? null,
          scope: parsed.scope,
          maxUses: parsed.maxUses,
          expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
          label: parsed.label ?? null,
          status: "active" as const,
          createdBy: req.admin?.accountId ?? null,
        }));

        const codes = await storage.createRedeemCodes(codesData);
        res.status(201).json({ count: codes.length, codes });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "無法批次建立兌換碼" });
      }
    }
  );

  // ========================================================================
  // 更新/停用兌換碼
  // ========================================================================
  app.patch(
    "/api/admin/redeem-codes/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const existing = await storage.getRedeemCode(id);
        if (!existing) {
          return res.status(404).json({ message: "兌換碼不存在" });
        }

        const parsed = updateCodeSchema.parse(req.body);
        const updated = await storage.updateRedeemCode(id, {
          ...parsed,
          expiresAt: parsed.expiresAt === null
            ? null
            : parsed.expiresAt
              ? new Date(parsed.expiresAt)
              : undefined,
        });

        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "無法更新兌換碼" });
      }
    }
  );

  // ========================================================================
  // 刪除兌換碼
  // ========================================================================
  app.delete(
    "/api/admin/redeem-codes/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const existing = await storage.getRedeemCode(id);
        if (!existing) {
          return res.status(404).json({ message: "兌換碼不存在" });
        }

        await storage.deleteRedeemCode(id);
        res.json({ message: "兌換碼已刪除" });
      } catch (error) {
        res.status(500).json({ message: "無法刪除兌換碼" });
      }
    }
  );

  // ========================================================================
  // 查看兌換碼使用紀錄
  // ========================================================================
  app.get(
    "/api/admin/redeem-codes/:id/uses",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const existing = await storage.getRedeemCode(id);
        if (!existing) {
          return res.status(404).json({ message: "兌換碼不存在" });
        }

        const uses = await storage.getCodeUses(id);
        res.json(uses);
      } catch (error) {
        res.status(500).json({ message: "無法取得使用紀錄" });
      }
    }
  );
}
