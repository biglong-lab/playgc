// 🌙 每日內容生成 cron job
//
// 三個任務（每天凌晨 03:00 跑一次）：
//   1. 補變體池：找熱門但沒變體池的任務 → DeepSeek 生成
//   2. 清過期快取：DELETE ai_result_cache WHERE expires_at < NOW()
//   3. 策展素材庫（P6 用）：confidence > 0.85 的玩家照 → 加入 field_exemplar_photos
//
// 用法：
//   npm run cron:daily       # 跑一次
//   crontab: 0 3 * * * cd /www/wwwroot/game.homi.cc && docker exec gamehomicc-app-1 npm run cron:daily
import { sql, isNull, eq, gt, gte } from "drizzle-orm";
import { db } from "../../server/db";
import { pages, games, fields, parseFieldSettings } from "@shared/schema";
import { generateVariantPool } from "../../server/lib/variant-generator";
import { decryptApiKey } from "../../server/lib/crypto";
import { cleanupExpired as cleanupCacheExpired } from "../../server/lib/ai-cache";

interface CronStats {
  variantsGenerated: number;
  variantsSkipped: number;
  variantsFailed: number;
  cacheRowsDeleted: number;
  exemplarsCollected: number;
  startedAt: Date;
  durationMs: number;
}

/**
 * 任務 1：補變體池
 * 找符合條件的任務（沒變體池 + 是會給訊息回饋的 page type），用 DeepSeek 補生成
 */
async function task1_generateVariants(): Promise<{
  generated: number;
  skipped: number;
  failed: number;
}> {
  const TASK_TYPES = [
    "photo_spot",
    "photo_compare",
    "photo_ocr",
    "photo_mission",
    "text_verify",
    "choice_verify",
    "conditional_verify",
  ];

  console.log("[cron] 任務 1：補變體池");

  // 找需要補的 pages
  const candidates = await db
    .select({ id: pages.id, gameId: pages.gameId, config: pages.config })
    .from(pages)
    .where(
      sql`variant_pool IS NULL AND page_type = ANY(${TASK_TYPES}::text[])`,
    )
    .limit(20); // 每次最多 20 個（控制 AI 成本）

  console.log(`[cron] 發現 ${candidates.length} 個任務需要補變體池`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const page of candidates) {
    try {
      // 找場域 + 解密 API key
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
        skipped++; // 只支援 OpenRouter（DeepSeek）
        continue;
      }

      // 從 page.config 取 task context
      const cfg = page.config as Record<string, unknown>;
      const taskContext =
        (cfg.title as string) ||
        (cfg.instruction as string) ||
        (cfg.question as string) ||
        "玩家任務";
      const fieldStyle = (settings.tagline as string) || undefined;

      // 生成
      const pool = await generateVariantPool({
        taskContext,
        count: 8,
        fieldStyle,
        categories: ["success", "fail"],
        apiKey,
      });

      // 寫入
      await db
        .update(pages)
        .set({ variantPool: pool })
        .where(eq(pages.id, page.id));
      generated++;
      console.log(`[cron] ✅ 已補變體池：page ${page.id}（${taskContext.substring(0, 30)}）`);
    } catch (err) {
      failed++;
      console.error(`[cron] ❌ 補變體池失敗 page ${page.id}:`, err instanceof Error ? err.message : err);
    }
  }

  return { generated, skipped, failed };
}

/**
 * 任務 2：清過期快取
 */
async function task2_cleanupCache(): Promise<number> {
  console.log("[cron] 任務 2：清過期快取");
  const deleted = await cleanupCacheExpired();
  console.log(`[cron] ✅ 已清 ${deleted} 筆過期 cache`);
  return deleted;
}

/**
 * 任務 3：策展素材庫（P6 預留）
 * 待 P6 場域素材庫表建立後啟用
 */
async function task3_curateExemplars(): Promise<number> {
  console.log("[cron] 任務 3：策展素材庫（P6 待啟用）");
  // TODO: P6 完成後啟用
  // 邏輯：
  //   SELECT page_id, player_photo_url, ai_confidence
  //   FROM plays
  //   WHERE verified = true AND ai_confidence > 0.85
  //     AND created_at > NOW() - INTERVAL '1 day'
  //   ORDER BY ai_confidence DESC LIMIT 50
  // INSERT INTO field_exemplar_photos (...)
  return 0;
}

/**
 * 主入口
 */
export async function runDailyCron(): Promise<CronStats> {
  const stats: CronStats = {
    variantsGenerated: 0,
    variantsSkipped: 0,
    variantsFailed: 0,
    cacheRowsDeleted: 0,
    exemplarsCollected: 0,
    startedAt: new Date(),
    durationMs: 0,
  };

  console.log("=" .repeat(60));
  console.log(`🌙 每日 cron 開始 ${stats.startedAt.toISOString()}`);
  console.log("=" .repeat(60));

  try {
    const t1 = await task1_generateVariants();
    stats.variantsGenerated = t1.generated;
    stats.variantsSkipped = t1.skipped;
    stats.variantsFailed = t1.failed;
  } catch (err) {
    console.error("[cron] 任務 1 整體失敗:", err);
  }

  try {
    stats.cacheRowsDeleted = await task2_cleanupCache();
  } catch (err) {
    console.error("[cron] 任務 2 整體失敗:", err);
  }

  try {
    stats.exemplarsCollected = await task3_curateExemplars();
  } catch (err) {
    console.error("[cron] 任務 3 整體失敗:", err);
  }

  stats.durationMs = Date.now() - stats.startedAt.getTime();

  console.log("=" .repeat(60));
  console.log("📊 每日 cron 完成");
  console.log(`  變體池生成：${stats.variantsGenerated}`);
  console.log(`  變體池跳過：${stats.variantsSkipped}（無 OpenRouter key）`);
  console.log(`  變體池失敗：${stats.variantsFailed}`);
  console.log(`  cache 清理：${stats.cacheRowsDeleted}`);
  console.log(`  素材策展：${stats.exemplarsCollected}（P6 待啟用）`);
  console.log(`  耗時：${(stats.durationMs / 1000).toFixed(1)}s`);
  console.log("=" .repeat(60));

  return stats;
}

// 直接執行（npm run cron:daily）— CJS bundle 後直接呼叫
runDailyCron()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[cron] 嚴重錯誤:", err);
    process.exit(1);
  });
