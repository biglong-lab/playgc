// 🎓 AI 訓練中心 — Platform 後端 API
//
// 3 個 endpoint：
//   GET  /api/platform/ai-center/usage   本月 AI 用量統計（按 endpoint / provider）
//   GET  /api/platform/ai-center/health  變體池健康度 / 快取 hit 率 / 素材庫總數
//   POST /api/platform/ai-center/batch-generate-variants  一鍵批次補變體池
//
// 權限：requirePlatformAdmin（super_admin only）
import type { Express } from "express";
import { z } from "zod";
import { sql, eq, gte, isNull, isNotNull, inArray, and } from "drizzle-orm";
import { requirePlatformAdmin } from "../platformAuth";
import { db } from "../db";
import {
  aiUsageLogs,
  aiResultCache,
  pages,
  fields,
  games,
  fieldExemplarPhotos,
  parseFieldSettings,
} from "@shared/schema";
import { generateVariantPool } from "../lib/variant-generator";
import { decryptApiKey } from "../lib/crypto";

// 模型 token 價格（粗估，用於 estimatedCost；單位：$ per 1M token）
const PRICE_PER_M_TOKENS: Record<string, number> = {
  "meta-llama/llama-4-scout": 0.08,
  "mistralai/mistral-small-3.2-24b-instruct": 0.075,
  "deepseek/deepseek-v3.2": 0.252,
  "google/gemma-3-12b-it:free": 0,
  "google/gemini-2.0-flash": 0.1, // 假設
};

const TASK_TYPES = [
  "photo_spot",
  "photo_compare",
  "photo_ocr",
  "photo_mission",
  "text_verify",
  "choice_verify",
  "conditional_verify",
];

export function registerPlatformAiCenterRoutes(app: Express) {
  // ============================================================================
  // GET /api/platform/ai-center/usage
  // 本月 AI 呼叫統計
  // ============================================================================
  app.get(
    "/api/platform/ai-center/usage",
    requirePlatformAdmin,
    async (_req, res) => {
      try {
        // 本月起點
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        // 全部本月 logs
        const rows = await db
          .select({
            provider: aiUsageLogs.provider,
            endpoint: aiUsageLogs.endpoint,
            count: sql<number>`count(*)::int`,
          })
          .from(aiUsageLogs)
          .where(gte(aiUsageLogs.createdAt, monthStart))
          .groupBy(aiUsageLogs.provider, aiUsageLogs.endpoint);

        const byEndpoint: Record<string, number> = {};
        const byProvider: Record<string, number> = {};
        let totalCalls = 0;
        let cachedCalls = 0;
        let localMatchCalls = 0;
        let realAiCalls = 0;

        for (const r of rows) {
          totalCalls += r.count;
          byEndpoint[r.endpoint] = (byEndpoint[r.endpoint] ?? 0) + r.count;
          byProvider[r.provider] = (byProvider[r.provider] ?? 0) + r.count;
          if (r.provider === "cache") cachedCalls += r.count;
          else if (r.provider === "local-match") localMatchCalls += r.count;
          else realAiCalls += r.count;
        }

        // Hit rates
        const cacheHitRate =
          totalCalls === 0 ? 0 : cachedCalls / Math.max(totalCalls, 1);
        const variantPoolHitRate = 0; // 變體池命中是前端行為，後端目前不記，先回 0
        // 為了給「節省效果」的概念，把 local-match 也視為「命中變體池/智慧分流」
        const smartLayerRate =
          totalCalls === 0 ? 0 : (cachedCalls + localMatchCalls) / Math.max(totalCalls, 1);

        // 估算成本（極簡化：每呼叫 ~2000 input + 200 output）
        const avgInTokens = 2000;
        const avgOutTokens = 200;
        // 真實 AI 平均單價：取主要模型（vision 用 llama-4-scout, text 用 mistral）
        const avgPriceIn = 0.08;
        const avgPriceOut = 0.3;
        const estimatedCost =
          (realAiCalls * (avgInTokens * avgPriceIn + avgOutTokens * avgPriceOut)) /
          1_000_000;

        res.json({
          totalCalls,
          byEndpoint,
          byProvider,
          cacheHitRate, // 嚴格意義：來自 cache provider 的比例
          variantPoolHitRate: smartLayerRate, // 用 smart layer rate 代替（含 local-match）
          estimatedCost,
          monthStart: monthStart.toISOString(),
        });
      } catch (error) {
        console.error("[ai-center] usage 失敗:", error);
        res.status(500).json({ error: "查詢用量失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/platform/ai-center/health
  // 變體池健康度 / cache 統計 / 素材庫總數
  // ============================================================================
  app.get(
    "/api/platform/ai-center/health",
    requirePlatformAdmin,
    async (_req, res) => {
      try {
        // 變體池健康度
        const [pageStats] = await db
          .select({
            totalPages: sql<number>`count(*)::int`,
            withVariantPool: sql<number>`sum(case when variant_pool is not null then 1 else 0 end)::int`,
          })
          .from(pages)
          .where(inArray(pages.pageType, TASK_TYPES));

        const totalPages = pageStats?.totalPages ?? 0;
        const pagesWithVariantPool = pageStats?.withVariantPool ?? 0;
        const pagesNeedingVariants = totalPages - pagesWithVariantPool;

        // Cache 統計
        const [cacheStats] = await db
          .select({
            totalCacheRows: sql<number>`count(*)::int`,
          })
          .from(aiResultCache);

        // 素材庫統計
        const [exemplarStats] = await db
          .select({
            totalExemplars: sql<number>`count(*)::int`,
            curatedExemplars: sql<number>`sum(case when is_curated = true then 1 else 0 end)::int`,
          })
          .from(fieldExemplarPhotos);

        res.json({
          totalPages,
          pagesWithVariantPool,
          pagesNeedingVariants,
          totalCacheRows: cacheStats?.totalCacheRows ?? 0,
          totalExemplars: exemplarStats?.totalExemplars ?? 0,
          curatedExemplars: exemplarStats?.curatedExemplars ?? 0,
        });
      } catch (error) {
        console.error("[ai-center] health 失敗:", error);
        res.status(500).json({ error: "查詢健康度失敗" });
      }
    },
  );

  // ============================================================================
  // POST /api/platform/ai-center/batch-generate-variants
  // 一鍵批次補變體池（與 cron task 1 相同邏輯，但 admin 主動觸發）
  // ============================================================================
  const batchSchema = z.object({
    limit: z.number().int().min(1).max(50).default(20),
  });

  app.post(
    "/api/platform/ai-center/batch-generate-variants",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const parsed = batchSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "輸入驗證失敗" });
        }
        const { limit } = parsed.data;

        // 找需要補的 pages（限 7 種 task type + 沒變體池）
        const candidates = await db
          .select({ id: pages.id, gameId: pages.gameId, config: pages.config })
          .from(pages)
          .where(and(isNull(pages.variantPool), inArray(pages.pageType, TASK_TYPES)))
          .limit(limit);

        let generated = 0;
        let skipped = 0;
        let failed = 0;

        for (const page of candidates) {
          try {
            const [game] = await db
              .select()
              .from(games)
              .where(eq(games.id, page.gameId))
              .limit(1);
            if (!game?.fieldId) {
              skipped++;
              continue;
            }
            const [field] = await db
              .select()
              .from(fields)
              .where(eq(fields.id, game.fieldId))
              .limit(1);
            if (!field) {
              skipped++;
              continue;
            }
            const settings = parseFieldSettings(field.settings);
            if (!settings.geminiApiKey) {
              skipped++;
              continue;
            }
            const apiKey = decryptApiKey(settings.geminiApiKey);
            if (!apiKey.startsWith("sk-or-")) {
              skipped++;
              continue;
            }

            const cfg = page.config as Record<string, unknown>;
            const taskContext =
              (cfg.title as string) ||
              (cfg.instruction as string) ||
              (cfg.question as string) ||
              "玩家任務";

            const pool = await generateVariantPool({
              taskContext,
              count: 8,
              fieldStyle: (settings.tagline as string) || undefined,
              categories: ["success", "fail"],
              apiKey,
            });

            await db.update(pages).set({ variantPool: pool }).where(eq(pages.id, page.id));
            generated++;
          } catch (err) {
            failed++;
            console.warn(`[ai-center] 補變體池失敗 page ${page.id}:`, err instanceof Error ? err.message : err);
          }
        }

        res.json({ generated, skipped, failed, total: candidates.length });
      } catch (error) {
        console.error("[ai-center] batch-generate 失敗:", error);
        res.status(500).json({ error: "批次生成失敗" });
      }
    },
  );
}
