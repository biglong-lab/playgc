// 🎨 變體池 admin API — 給 admin 編輯遊戲時使用
//
// 設計：
//   POST /api/admin/games/:gameId/pages/:pageId/generate-variants
//     用 DeepSeek 生成變體 → 寫入 pages.variant_pool
//
//   GET /api/admin/games/:gameId/pages/:pageId/variants
//     取得當前 pool（給 admin 預覽編輯）
//
//   PATCH /api/admin/games/:gameId/pages/:pageId/variants
//     手動編輯（admin 可改/刪 AI 生成的內容）
//
// 權限：所有 endpoint 需要 game:edit
import type { Express } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { db } from "../db";
import {
  pages,
  games,
  fields,
  parseFieldSettings,
  generateVariantsRequestSchema,
  variantPoolSchema,
  type VariantPool,
} from "@shared/schema";
import { generateVariantPool } from "../lib/variant-generator";
import { getVariantScores } from "../lib/feedback-aggregator";

export function registerVariantPoolRoutes(app: Express) {
  // ============================================================================
  // POST /api/admin/games/:gameId/pages/:pageId/generate-variants
  // 用 DeepSeek 為指定頁面生成變體池
  // ============================================================================
  app.post(
    "/api/admin/games/:gameId/pages/:pageId/generate-variants",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId, pageId } = req.params;

        // 驗證輸入
        const parsed = generateVariantsRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "輸入驗證失敗",
            details: parsed.error.errors,
          });
        }
        const { taskContext, count, fieldStyle, categories } = parsed.data;

        // 找 page + 檢查 gameId 對應
        const [page] = await db
          .select()
          .from(pages)
          .where(and(eq(pages.id, pageId), eq(pages.gameId, gameId)))
          .limit(1);
        if (!page) {
          return res.status(404).json({ error: "頁面不存在或不屬於該遊戲" });
        }

        // 取場域 OpenRouter / Gemini API key
        const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
        if (!game) {
          return res.status(404).json({ error: "遊戲不存在" });
        }
        if (!game.fieldId) {
          return res.status(400).json({ error: "遊戲未綁定場域，無法取得 API key" });
        }
        const [field] = await db
          .select()
          .from(fields)
          .where(eq(fields.id, game.fieldId))
          .limit(1);
        if (!field) {
          return res.status(404).json({ error: "場域不存在" });
        }
        const settings = parseFieldSettings(field.settings);
        const fieldApiKey = settings.geminiApiKey;
        if (!fieldApiKey) {
          return res.status(503).json({
            error: "此場域尚未設定 OpenRouter / Gemini API key",
            code: "FIELD_AI_NOT_CONFIGURED",
          });
        }

        // 解密 key
        const { decryptApiKey } = await import("../lib/crypto");
        let apiKey: string;
        try {
          apiKey = decryptApiKey(fieldApiKey);
        } catch {
          return res.status(500).json({ error: "場域 API key 解密失敗" });
        }

        // 只支援 OpenRouter（DeepSeek 在 OpenRouter 上）
        if (!apiKey.startsWith("sk-or-")) {
          return res.status(400).json({
            error: "變體生成功能僅支援 OpenRouter API key（場域目前用 Gemini）",
            code: "REQUIRES_OPENROUTER",
          });
        }

        // 呼叫 DeepSeek 生成
        const pool = await generateVariantPool({
          taskContext,
          count,
          fieldStyle,
          categories,
          apiKey,
        });

        // 寫入 DB（保留舊 pool 的 metadata，合併新生成的類別）
        const existing = (page.variantPool as VariantPool | null) || {};
        const merged: VariantPool = {
          ...existing,
          ...pool, // 新生成的覆蓋舊的同名類別
        };

        await db.update(pages).set({ variantPool: merged }).where(eq(pages.id, pageId));

        // 稽核
        await logAuditAction({
          actorAdminId: req.admin?.accountId ?? undefined,
          action: "variant_pool:generate",
          targetType: "page",
          targetId: pageId,
          metadata: { gameId, categories, count },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ success: true, pool: merged });
      } catch (error) {
        console.error("[variant-pool] 生成失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "生成變體失敗",
        });
      }
    },
  );

  // ============================================================================
  // GET /api/admin/games/:gameId/pages/:pageId/variants
  // 取得當前變體池（給 admin 預覽編輯）
  // ============================================================================
  app.get(
    "/api/admin/games/:gameId/pages/:pageId/variants",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const { gameId, pageId } = req.params;
        const [page] = await db
          .select()
          .from(pages)
          .where(and(eq(pages.id, pageId), eq(pages.gameId, gameId)))
          .limit(1);
        if (!page) {
          return res.status(404).json({ error: "頁面不存在或不屬於該遊戲" });
        }
        res.json({ pool: page.variantPool || null });
      } catch (error) {
        console.error("[variant-pool] GET 失敗:", error);
        res.status(500).json({ error: "取得變體池失敗" });
      }
    },
  );

  // ============================================================================
  // PATCH /api/admin/games/:gameId/pages/:pageId/variants
  // admin 手動編輯變體池（增刪改）
  // ============================================================================
  const patchSchema = z.object({
    pool: variantPoolSchema,
  });

  app.patch(
    "/api/admin/games/:gameId/pages/:pageId/variants",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId, pageId } = req.params;
        const parsed = patchSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "格式驗證失敗",
            details: parsed.error.errors,
          });
        }

        // 確認 page 存在
        const [page] = await db
          .select()
          .from(pages)
          .where(and(eq(pages.id, pageId), eq(pages.gameId, gameId)))
          .limit(1);
        if (!page) {
          return res.status(404).json({ error: "頁面不存在或不屬於該遊戲" });
        }

        await db.update(pages).set({ variantPool: parsed.data.pool }).where(eq(pages.id, pageId));

        await logAuditAction({
          actorAdminId: req.admin?.accountId ?? undefined,
          action: "variant_pool:edit",
          targetType: "page",
          targetId: pageId,
          metadata: { gameId },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ success: true, pool: parsed.data.pool });
      } catch (error) {
        console.error("[variant-pool] PATCH 失敗:", error);
        res.status(500).json({ error: "更新變體池失敗" });
      }
    },
  );
}
