// 🤖 Admin AI 副駕駛 API
//
// 3 個 endpoint：
//   POST /api/admin/copilot/suggest-next   推薦下一個 page type
//   POST /api/admin/copilot/diagnose       流程診斷（純規則，不耗 AI）
//   POST /api/admin/copilot/polish-copy    文案優化（DeepSeek 3 個變體）
//
// 權限：game:edit
import type { Express } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { db } from "../db";
import { games, fields, parseFieldSettings } from "@shared/schema";
import { decryptApiKey } from "../lib/crypto";
import {
  suggestNextModule,
  diagnoseFlow,
  polishCopy,
  type CopyStyle,
} from "../lib/admin-copilot";

const COPY_STYLES: CopyStyle[] = [
  "tactical",
  "literary",
  "playful",
  "formal",
  "cute",
  "heroic",
  "mystery",
];

/**
 * 取場域 OpenRouter API key（共用 helper）
 * 回傳：[apiKey | null, errorResponseTuple | null]
 */
async function getFieldOpenRouterKey(
  gameId: string | undefined,
  fieldId: string | undefined,
): Promise<{ apiKey: string } | { error: string; status: number; code?: string }> {
  let resolvedFieldId = fieldId;
  if (!resolvedFieldId && gameId) {
    const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
    if (!game?.fieldId) return { error: "遊戲未綁定場域", status: 400 };
    resolvedFieldId = game.fieldId;
  }
  if (!resolvedFieldId) return { error: "需提供 gameId 或 fieldId", status: 400 };

  const [field] = await db
    .select()
    .from(fields)
    .where(eq(fields.id, resolvedFieldId))
    .limit(1);
  if (!field) return { error: "場域不存在", status: 404 };

  const settings = parseFieldSettings(field.settings);
  if (!settings.geminiApiKey) {
    return {
      error: "場域尚未設定 OpenRouter API key",
      status: 503,
      code: "FIELD_AI_NOT_CONFIGURED",
    };
  }

  const apiKey = decryptApiKey(settings.geminiApiKey);
  if (!apiKey.startsWith("sk-or-")) {
    return {
      error: "副駕駛功能僅支援 OpenRouter（場域目前用 Gemini）",
      status: 400,
      code: "REQUIRES_OPENROUTER",
    };
  }

  return { apiKey };
}

export function registerAdminCopilotRoutes(app: Express) {
  // ============================================================================
  // POST /api/admin/copilot/suggest-next
  // 推薦下一個 page type
  // ============================================================================
  const suggestSchema = z.object({
    gameId: z.string().optional(),
    fieldId: z.string().optional(),
    currentPages: z
      .array(
        z.object({
          pageOrder: z.number().int(),
          pageType: z.string(),
          customName: z.string().nullable().optional(),
          hint: z.string().optional(),
        }),
      )
      .max(50),
  });

  app.post(
    "/api/admin/copilot/suggest-next",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const parsed = suggestSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "輸入驗證失敗",
            details: parsed.error.errors,
          });
        }

        const keyResult = await getFieldOpenRouterKey(parsed.data.gameId, parsed.data.fieldId);
        if ("error" in keyResult) {
          return res.status(keyResult.status).json({
            error: keyResult.error,
            code: keyResult.code,
          });
        }

        const suggestions = await suggestNextModule(
          parsed.data.currentPages,
          keyResult.apiKey,
        );

        res.json({ suggestions });
      } catch (error) {
        console.error("[copilot] suggest-next 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "推薦失敗",
        });
      }
    },
  );

  // ============================================================================
  // POST /api/admin/copilot/diagnose
  // 流程診斷（純規則，不耗 AI）
  // ============================================================================
  const diagnoseSchema = z.object({
    pages: z.array(
      z.object({
        id: z.string(),
        pageOrder: z.number().int(),
        pageType: z.string(),
        customName: z.string().nullable().optional(),
        config: z.record(z.unknown()),
      }),
    ),
  });

  app.post(
    "/api/admin/copilot/diagnose",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const parsed = diagnoseSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "輸入驗證失敗",
            details: parsed.error.errors,
          });
        }

        // diagnoseFlow 是純規則引擎，不需 API key
        const issues = diagnoseFlow(
          parsed.data.pages.map((p) => ({
            id: p.id,
            pageOrder: p.pageOrder,
            pageType: p.pageType,
            customName: p.customName,
            config: p.config,
          })),
        );

        // 統計
        const summary = {
          total: issues.length,
          errors: issues.filter((i) => i.severity === "error").length,
          warnings: issues.filter((i) => i.severity === "warning").length,
          infos: issues.filter((i) => i.severity === "info").length,
        };

        res.json({ issues, summary });
      } catch (error) {
        console.error("[copilot] diagnose 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "診斷失敗",
        });
      }
    },
  );

  // ============================================================================
  // POST /api/admin/copilot/polish-copy
  // 文案優化（DeepSeek）
  // ============================================================================
  const polishSchema = z.object({
    gameId: z.string().optional(),
    fieldId: z.string().optional(),
    original: z.string().min(2, "原文至少 2 字").max(500),
    style: z.enum([
      "tactical",
      "literary",
      "playful",
      "formal",
      "cute",
      "heroic",
      "mystery",
    ]),
  });

  app.post(
    "/api/admin/copilot/polish-copy",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const parsed = polishSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: "輸入驗證失敗",
            details: parsed.error.errors,
          });
        }

        const keyResult = await getFieldOpenRouterKey(parsed.data.gameId, parsed.data.fieldId);
        if ("error" in keyResult) {
          return res.status(keyResult.status).json({
            error: keyResult.error,
            code: keyResult.code,
          });
        }

        const result = await polishCopy(
          parsed.data.original,
          parsed.data.style,
          keyResult.apiKey,
        );

        res.json(result);
      } catch (error) {
        console.error("[copilot] polish-copy 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "文案優化失敗",
        });
      }
    },
  );

  // 提供前端取得可用風格清單
  app.get("/api/admin/copilot/copy-styles", requireAdminAuth, (_req, res) => {
    res.json({ styles: COPY_STYLES });
  });
}
