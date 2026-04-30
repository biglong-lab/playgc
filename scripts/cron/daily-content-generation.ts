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
import { sql, isNull, eq, gt, gte, inArray, and, isNotNull, desc } from "drizzle-orm";
import { db } from "../../server/db";
import { pages, games, fields, parseFieldSettings, aiResultCache, fieldExemplarPhotos } from "@shared/schema";
import { generateVariantPool } from "../../server/lib/variant-generator";
import { decryptApiKey } from "../../server/lib/crypto";
import { archiveExpired } from "../../server/lib/ai-cache";
import {
  calculateOptimalThreshold,
  applyThresholdRecommendation,
  invalidateThresholdCache,
} from "../../server/lib/threshold-adapter";
import { calculateSignificance } from "../../server/lib/ab-stats";
import { calculateHealthScore } from "../../server/lib/content-health";
import { trainTransitionMatrix } from "../../server/lib/markov-trainer";
import { invalidateMarkovCache } from "../../server/lib/markov-sampler";

interface CronStats {
  variantsGenerated: number;
  variantsSkipped: number;
  variantsFailed: number;
  // P5+P6 修正：cache 不再直接刪除，改為歸檔
  cacheArchived: number;
  cacheExemplarsAdded: number;
  cacheRowsDeleted: number;
  exemplarsCollected: number;
  // P13: 自適應閾值
  thresholdsAdjusted: number;
  thresholdsMaintained: number;
  thresholdsInsufficient: number;
  // P14: A/B 實驗自動結論
  abExperimentsConcluded: number;
  abExperimentsPending: number;
  abExperimentsFailed: number;
  // P15: 內容健康度
  healthScore: number;
  healthLevel: string;
  healthZombies: number;
  healthOrphans: number;
  healthDeadEnds: number;
  // P16: Markov 訓練（僅週一跑）
  markovSkipped: boolean;
  markovFieldsTrained: number;
  markovTransitionsUpserted: number;
  markovSessionsAnalyzed: number;
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
    .where(and(isNull(pages.variantPool), inArray(pages.pageType, TASK_TYPES)))
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
 * 任務 2：歸檔過期快取（不再「直接刪除」，改成收納堆疊）
 *
 * 流程：
 *   1. 高 confidence ≥ 0.85 + 有 imageUrl → 升級到 field_exemplar_photos（去重）
 *   2. 統計累積到 ai_cache_archive（task × endpoint UNIQUE，每次 archive 累加）
 *   3. 最後刪除原 row（資料已被消化）
 *
 * 結果：場域累積「某任務歷史 N 次成功 / 平均信心 X」資產，平台越用越聰明。
 */
async function task2_archiveCache(): Promise<{
  archived: number;
  exemplarsAdded: number;
  deletedRows: number;
}> {
  console.log("[cron] 任務 2：歸檔過期快取（升級素材 + 統計累積 + 刪除原 row）");
  const result = await archiveExpired();
  console.log(
    `[cron] ✅ 歸檔 ${result.archived} 個 task/endpoint，` +
      `升級 ${result.exemplarsAdded} 張素材，刪除 ${result.deletedRows} 筆原 row`,
  );
  return result;
}

/**
 * 任務 3：策展素材庫（P6 自動策展）
 *
 * 邏輯：
 *   1. 從 ai_result_cache 找 endpoint=verify-photo + result.confidence ≥ 0.85 的記錄
 *   2. 過濾掉已存在於 field_exemplar_photos 的 photoUrl（去重）
 *   3. 寫入 field_exemplar_photos（source='cron_collected'）
 *
 * 限制：
 *   - 每次最多策展 50 張（避免一次太多）
 *   - 只看最近 7 天的 cache（更早的當「歷史」不算）
 */
async function task3_curateExemplars(): Promise<number> {
  console.log("[cron] 任務 3：策展素材庫（自動策展）");

  // 取近 7 天 cache 中有 imageUrl 的 verify-photo 記錄
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const candidates = await db
    .select()
    .from(aiResultCache)
    .where(
      and(
        eq(aiResultCache.endpoint, "verify-photo"),
        isNotNull(aiResultCache.imageUrl),
        gte(aiResultCache.createdAt, sevenDaysAgo),
      ),
    )
    .orderBy(desc(aiResultCache.createdAt))
    .limit(200);

  let collected = 0;
  for (const c of candidates) {
    if (!c.imageUrl || !c.fieldId) continue;
    const result = c.result as { confidence?: number; verified?: boolean } | null;
    const confidence = result?.confidence;
    if (typeof confidence !== "number" || confidence < 0.85) continue;
    if (result?.verified === false) continue;

    // 去重：同 photo_url + page_id 已存在則跳過
    const existing = await db
      .select({ id: fieldExemplarPhotos.id })
      .from(fieldExemplarPhotos)
      .where(
        and(
          eq(fieldExemplarPhotos.photoUrl, c.imageUrl),
          c.taskId ? eq(fieldExemplarPhotos.pageId, c.taskId) : isNull(fieldExemplarPhotos.pageId),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;

    try {
      await db.insert(fieldExemplarPhotos).values({
        fieldId: c.fieldId,
        gameId: c.gameId ?? null,
        pageId: c.taskId ?? null,
        photoUrl: c.imageUrl,
        confidence: confidence.toFixed(2),
        source: "cron_collected",
        isCurated: false,
      });
      collected++;
      if (collected >= 50) break; // 每次最多 50 張
    } catch (err) {
      console.warn(`[cron] 策展失敗（photo ${c.imageUrl.substring(0, 50)}）:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[cron] ✅ 策展 ${collected} 張新素材`);
  return collected;
}

/**
 * 任務 4（P13）：自適應閾值重算
 *
 * 流程：
 *   1. 找最近 30 天內有 player_event_logs 紀錄的 page（候選任務）
 *   2. 對每個候選跑 calculateOptimalThreshold
 *   3. recommendation 為 'loosen'/'tighten' 時 upsert task_thresholds
 *   4. invalidate cache（讓下次玩家請求拿到新值）
 *
 * 限制：每次最多分析 100 個 task（控制 DB 負載）
 */
async function task4_adjustThresholds(): Promise<{
  adjusted: number;
  maintained: number;
  insufficient: number;
}> {
  console.log("[cron] 任務 4：自適應閾值重算");

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 用原生 SQL 找近 30 天有事件的 distinct page_id（避免另外 import playerEventLogs）
  const { playerEventLogs } = await import("@shared/schema");
  const candidatePages = await db
    .selectDistinct({
      pageId: playerEventLogs.pageId,
      gameId: playerEventLogs.gameId,
    })
    .from(playerEventLogs)
    .where(
      and(
        isNotNull(playerEventLogs.pageId),
        gte(playerEventLogs.createdAt, since),
      ),
    )
    .limit(100);

  let adjusted = 0;
  let maintained = 0;
  let insufficient = 0;

  for (const c of candidatePages) {
    if (!c.pageId) continue;
    try {
      const analysis = await calculateOptimalThreshold(c.pageId, c.gameId ?? undefined);
      if (analysis.recommendation === "insufficient-data") {
        insufficient++;
        continue;
      }
      if (analysis.recommendation === "maintain") {
        maintained++;
        continue;
      }
      // loosen / tighten → 套用
      await applyThresholdRecommendation(c.pageId, c.gameId ?? null, analysis);
      invalidateThresholdCache(c.pageId);
      adjusted++;
      console.log(
        `[cron] 🎯 ${c.pageId.substring(0, 8)} ${analysis.recommendation}: ${analysis.reason}`,
      );
    } catch (err) {
      console.warn(
        `[cron] 閾值重算失敗 page ${c.pageId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[cron] ✅ 閾值重算完成：${adjusted} 調整 / ${maintained} 維持 / ${insufficient} 樣本不足`,
  );
  return { adjusted, maintained, insufficient };
}

/**
 * 任務 5：A/B 實驗自動結論（P14-9）
 *
 * 流程：
 *   1. 找所有 status='running' 的實驗
 *   2. 對每個跑 calculateSignificance
 *   3. conclusion 為 a_wins / b_wins → status='completed' + 寫回 conclusion + endedAt
 *   4. conclusion 為 no_difference → 仍寫回 conclusion，但保持 running（讓 admin 自行決定是否中止）
 *   5. conclusion 為 insufficient_data → 不更新（資料還不夠）
 */
async function task5_concludeAbExperiments(): Promise<{
  concluded: number;
  pending: number;
  failed: number;
}> {
  console.log("[cron] 任務 5：A/B 實驗自動結論");

  const { abExperiments } = await import("@shared/schema");
  const running = await db
    .select({ id: abExperiments.id, name: abExperiments.name })
    .from(abExperiments)
    .where(eq(abExperiments.status, "running"));

  let concluded = 0;
  let pending = 0;
  let failed = 0;

  for (const exp of running) {
    try {
      const stats = await calculateSignificance(exp.id);

      if (stats.conclusion === "insufficient_data") {
        pending++;
        continue;
      }

      const isWinner =
        stats.conclusion === "a_wins" || stats.conclusion === "b_wins";

      const setData: Record<string, unknown> = {
        conclusion: stats.conclusion,
        conclusionStats: {
          pValue: stats.pValue,
          zStatistic: stats.zStatistic,
          effectSize: stats.effectSize,
          totalAssignments: stats.totalAssignments,
          groupA: stats.groupA,
          groupB: stats.groupB,
          conclusionReason: stats.conclusionReason,
          calculatedAt: new Date().toISOString(),
        },
      };

      // 有勝負 → 自動完成；no_difference → 保持 running 讓 admin 決定
      if (isWinner) {
        setData.status = "completed";
        setData.endedAt = new Date();
      }

      await db
        .update(abExperiments)
        .set(setData)
        .where(eq(abExperiments.id, exp.id));

      if (isWinner) {
        concluded++;
        console.log(
          `[cron] 🔬 ${exp.name}: ${stats.conclusion} (${stats.conclusionReason})`,
        );
      } else {
        pending++;
      }
    } catch (err) {
      failed++;
      console.warn(
        `[cron] 實驗 ${exp.id} 結論失敗:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[cron] ✅ A/B 結論完成：${concluded} 自動完成 / ${pending} 待續 / ${failed} 失敗`,
  );
  return { concluded, pending, failed };
}

/**
 * 任務 6：內容健康度分析（P15-7）
 *
 * 流程：
 *   1. 跑 calculateHealthScore() 取整體健康度
 *   2. log 統計（分數 / 等級 / 殭屍 / 孤兒 / 死路 數量）
 *   3. 不寫 metrics 表（caller 透過 stats 拿，需要持久化由後續迭代再加）
 *
 * 用途：日報級可見性 + 趨勢追蹤底盤
 */
async function task6_analyzeContentHealth(): Promise<{
  score: number;
  level: string;
  zombies: number;
  orphans: number;
  deadEnds: number;
}> {
  console.log("[cron] 任務 6：內容健康度分析");

  const result = await calculateHealthScore({});
  const { score, level, breakdown, penalties } = result;

  console.log(
    `[cron] 🏥 健康度 ${score}/100 (${level}) — 殭屍 ${breakdown.zombieCount} / 孤兒 ${breakdown.orphanCount} / 死路 ${breakdown.deadEndCount}（H:${breakdown.deadEndHigh} M:${breakdown.deadEndMedium} L:${breakdown.deadEndLow}）`,
  );
  console.log(
    `[cron] 🏥 扣分：殭屍 -${penalties.zombie} / 孤兒 -${penalties.orphan} / 死路 -${penalties.deadEnd}`,
  );

  return {
    score,
    level,
    zombies: breakdown.zombieCount,
    orphans: breakdown.orphanCount,
    deadEnds: breakdown.deadEndCount,
  };
}

/**
 * 主入口
 */
export async function runDailyCron(): Promise<CronStats> {
  const stats: CronStats = {
    variantsGenerated: 0,
    variantsSkipped: 0,
    variantsFailed: 0,
    cacheArchived: 0,
    cacheExemplarsAdded: 0,
    cacheRowsDeleted: 0,
    exemplarsCollected: 0,
    thresholdsAdjusted: 0,
    thresholdsMaintained: 0,
    thresholdsInsufficient: 0,
    abExperimentsConcluded: 0,
    abExperimentsPending: 0,
    abExperimentsFailed: 0,
    healthScore: 0,
    healthLevel: "unknown",
    healthZombies: 0,
    healthOrphans: 0,
    healthDeadEnds: 0,
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
    const t2 = await task2_archiveCache();
    stats.cacheArchived = t2.archived;
    stats.cacheExemplarsAdded = t2.exemplarsAdded;
    stats.cacheRowsDeleted = t2.deletedRows;
  } catch (err) {
    console.error("[cron] 任務 2 整體失敗:", err);
  }

  try {
    stats.exemplarsCollected = await task3_curateExemplars();
  } catch (err) {
    console.error("[cron] 任務 3 整體失敗:", err);
  }

  try {
    const t4 = await task4_adjustThresholds();
    stats.thresholdsAdjusted = t4.adjusted;
    stats.thresholdsMaintained = t4.maintained;
    stats.thresholdsInsufficient = t4.insufficient;
  } catch (err) {
    console.error("[cron] 任務 4 整體失敗:", err);
  }

  try {
    const t5 = await task5_concludeAbExperiments();
    stats.abExperimentsConcluded = t5.concluded;
    stats.abExperimentsPending = t5.pending;
    stats.abExperimentsFailed = t5.failed;
  } catch (err) {
    console.error("[cron] 任務 5 整體失敗:", err);
  }

  try {
    const t6 = await task6_analyzeContentHealth();
    stats.healthScore = t6.score;
    stats.healthLevel = t6.level;
    stats.healthZombies = t6.zombies;
    stats.healthOrphans = t6.orphans;
    stats.healthDeadEnds = t6.deadEnds;
  } catch (err) {
    console.error("[cron] 任務 6 整體失敗:", err);
  }

  stats.durationMs = Date.now() - stats.startedAt.getTime();

  console.log("=" .repeat(60));
  console.log("📊 每日 cron 完成");
  console.log(`  變體池生成：${stats.variantsGenerated}`);
  console.log(`  變體池跳過：${stats.variantsSkipped}（無 OpenRouter key）`);
  console.log(`  變體池失敗：${stats.variantsFailed}`);
  console.log(`  快取歸檔：${stats.cacheArchived} 個 task × endpoint`);
  console.log(`  快取升級素材：${stats.cacheExemplarsAdded} 張高分照片`);
  console.log(`  快取刪原 row：${stats.cacheRowsDeleted}（已被消化進歸檔/素材庫）`);
  console.log(`  task3 策展：${stats.exemplarsCollected}（從近 7 天 cache）`);
  console.log(`  task4 閾值：${stats.thresholdsAdjusted} 調整 / ${stats.thresholdsMaintained} 維持 / ${stats.thresholdsInsufficient} 樣本不足`);
  console.log(`  task5 A/B：${stats.abExperimentsConcluded} 自動完成 / ${stats.abExperimentsPending} 待續 / ${stats.abExperimentsFailed} 失敗`);
  console.log(`  task6 健康度：${stats.healthScore}/100 (${stats.healthLevel}) — 殭屍 ${stats.healthZombies} / 孤兒 ${stats.healthOrphans} / 死路 ${stats.healthDeadEnds}`);
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
