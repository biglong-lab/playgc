// 🪄 AI 遊戲腳本產生器 admin API
//
// 兩個 endpoint：
//   POST /api/admin/games/generate-from-script
//     輸入腳本 → DeepSeek 解析 → 回傳 page configs（admin 預覽用，不寫 DB）
//
//   POST /api/admin/games/:gameId/apply-generated
//     admin 確認後 → 把 page array 寫入 DB（INSERT 多筆 pages）
//
// 權限：game:create / game:edit
import type { Express } from "express";
import { z } from "zod";
import { eq, max } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { db } from "../db";
import { games, pages, fields, parseFieldSettings } from "@shared/schema";
import {
  generateGameFromScript,
  generatedPageSchema,
} from "../lib/game-script-generator";
import { decryptApiKey } from "../lib/crypto";

export function registerGameGeneratorRoutes(app: Express) {
  // ============================================================================
  // POST /api/admin/games/generate-from-script
  // 從腳本生成遊戲（純生成，不寫 DB）
  // ============================================================================
  const generateSchema = z.object({
    /** 自然語言腳本 */
    script: z.string().min(20, "腳本至少 20 字").max(2000),
    /** 用於取場域 API key（可選；沒給則需要 fieldId） */
    gameId: z.string().optional(),
    fieldId: z.string().optional(),
    /** 場域風格 */
    fieldStyle: z.string().max(100).optional(),
    /** 期望時長（分鐘） */
    targetMinutes: z.number().int().min(5).max(120).optional(),
    /** 難度 */
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  });

  app.post(
    "/api/admin/games/generate-from-script",
    requireAdminAuth,
    requirePermission("game:create"),
    async (req, res) => {
      try {
        const parsed = generateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "輸入驗證失敗",
            details: parsed.error.errors,
          });
        }
        const { script, gameId, fieldId, fieldStyle, targetMinutes, difficulty } = parsed.data;

        // 找場域 key（從 game 或 fieldId）
        let resolvedFieldId = fieldId;
        if (!resolvedFieldId && gameId) {
          const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
          if (!game?.fieldId) {
            return res.status(400).json({ error: "遊戲未綁定場域" });
          }
          resolvedFieldId = game.fieldId;
        }
        if (!resolvedFieldId) {
          return res.status(400).json({ error: "需提供 gameId 或 fieldId" });
        }

        const [field] = await db
          .select()
          .from(fields)
          .where(eq(fields.id, resolvedFieldId))
          .limit(1);
        if (!field) {
          return res.status(404).json({ error: "場域不存在" });
        }

        const settings = parseFieldSettings(field.settings);
        if (!settings.geminiApiKey) {
          return res.status(503).json({
            error: "場域尚未設定 OpenRouter API key",
            code: "FIELD_AI_NOT_CONFIGURED",
          });
        }

        const apiKey = decryptApiKey(settings.geminiApiKey);
        if (!apiKey.startsWith("sk-or-")) {
          return res.status(400).json({
            error: "遊戲產生器僅支援 OpenRouter（場域目前用 Gemini）",
            code: "REQUIRES_OPENROUTER",
          });
        }

        // 呼叫 DeepSeek 生成
        const generated = await generateGameFromScript({
          script,
          fieldStyle: fieldStyle ?? (settings.tagline as string | undefined),
          targetMinutes,
          difficulty,
          apiKey,
        });

        // 稽核（生成行為，未寫入 DB）
        await logAuditAction({
          actorAdminId: req.admin?.accountId ?? undefined,
          action: "game-generator:generate",
          targetType: "field",
          targetId: resolvedFieldId,
          metadata: {
            scriptLength: script.length,
            pageCount: generated.pages.length,
            difficulty: generated.difficulty,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({
          ...generated,
          fieldId: resolvedFieldId,
        });
      } catch (error) {
        console.error("[game-generator] generate 失敗:", error);
        // Zod 驗證失敗（AI 回傳格式不對）
        if (error instanceof z.ZodError) {
          return res.status(502).json({
            error: "AI 回傳格式驗證失敗，請重試",
            details: error.errors,
          });
        }
        res.status(500).json({
          error: error instanceof Error ? error.message : "生成失敗",
        });
      }
    },
  );

  // ============================================================================
  // POST /api/admin/games/:gameId/apply-generated
  // 把 AI 生成的 pages 寫入指定遊戲（INSERT 多筆）
  // ============================================================================
  const applySchema = z.object({
    pages: z.array(generatedPageSchema).min(1).max(20),
    /** 從哪個 pageOrder 開始 append（預設 = 既有最大 pageOrder + 1） */
    appendFromOrder: z.number().int().min(1).optional(),
    /** 是否清空既有 pages 後再寫入（預設 false） */
    replace: z.boolean().default(false),
  });

  app.post(
    "/api/admin/games/:gameId/apply-generated",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { gameId } = req.params;
        const parsed = applySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "格式驗證失敗",
            details: parsed.error.errors,
          });
        }

        // 確認遊戲存在
        const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
        if (!game) {
          return res.status(404).json({ error: "遊戲不存在" });
        }

        // 決定 append 起點
        let startOrder: number;
        if (parsed.data.replace) {
          // 清空既有 pages
          await db.delete(pages).where(eq(pages.gameId, gameId));
          startOrder = 1;
        } else if (parsed.data.appendFromOrder) {
          startOrder = parsed.data.appendFromOrder;
        } else {
          // 找既有最大 pageOrder
          const [{ maxOrder }] = await db
            .select({ maxOrder: max(pages.pageOrder) })
            .from(pages)
            .where(eq(pages.gameId, gameId));
          startOrder = (maxOrder ?? 0) + 1;
        }

        // 批次 INSERT
        const inserted = [];
        for (let i = 0; i < parsed.data.pages.length; i++) {
          const p = parsed.data.pages[i];
          const [created] = await db
            .insert(pages)
            .values({
              gameId,
              pageOrder: startOrder + i,
              pageType: p.pageType,
              customName: p.customName ?? null,
              config: p.config,
              variantPool: null,
              chapterId: null,
            })
            .returning();
          inserted.push(created);
        }

        // 稽核
        await logAuditAction({
          actorAdminId: req.admin?.accountId ?? undefined,
          action: "game-generator:apply",
          targetType: "game",
          targetId: gameId,
          metadata: {
            pagesAdded: inserted.length,
            replace: parsed.data.replace,
            startOrder,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({
          success: true,
          pagesAdded: inserted.length,
          startOrder,
          pages: inserted,
        });
      } catch (error) {
        console.error("[game-generator] apply 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "套用失敗",
        });
      }
    },
  );
}
