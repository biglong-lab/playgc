// 🏥 內容健康度監控（Phase 15）
//
// 目的：自動偵測平台上「不健康」的內容
//   - 殭屍變體（從沒被選中過）：占用 pool 配額但對玩家無價值
//   - 孤兒任務（沒玩家完成過）：可能太難 / 描述不清 / 入口缺失
//   - 死路 page（玩家進去就退出）：UI/銜接 / 設計問題
//
// 用途：
//   - cron 每天統計（admin 後台儀表板顯示）
//   - admin 主動點「健康檢查」立即查
//
// 範圍限制（不擴散）：
//   - 只回傳偵測結果，不做自動清理（讓 admin 決定）
//   - 不改 pool / 不改 page（純讀取分析）
//   - 不寫 metrics 表（統計結果 in-memory，由 caller 處理是否快取）

import { sql, and, eq, gt, gte, lte, isNotNull, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  pages,
  variantFeedback,
  playerEventLogs,
  type VariantPool,
} from "@shared/schema";

// ============================================================================
// 殭屍變體偵測（P15-1）
// ============================================================================

/**
 * 殭屍變體：在 variantPool 內存在，但從沒被任何玩家「看到」過（沒任何 feedback 紀錄）
 *
 * 判定：
 *   1. 從 pages.variantPool 取所有 (pageId, variantKey, variantIndex)
 *   2. 從 variant_feedback 找有事件的 (pageId, variantKey, variantIndex) 集合
 *   3. 不在集合中的變體 → 候選殭屍
 *   4. 候選變體的 generatedAt 距今 ≥ minDays → 確定殭屍（避免剛生成的誤判）
 */
export interface ZombieVariant {
  pageId: string;
  gameId: string | null;
  fieldId: string | null;
  variantKey: "success" | "fail" | "nearMiss" | "hint";
  variantIndex: number;
  variantText: string;
  daysOld: number; // pool generatedAt 距今天數（無 generatedAt 用 createdAt）
}

export interface DetectZombieOptions {
  /** 場域 ID 過濾 */
  fieldId?: string;
  /** 遊戲 ID 過濾 */
  gameId?: string;
  /** 變體存在多少天未被觸發才算殭屍（預設 14 天，避免剛生成的誤判） */
  minDays?: number;
  /** 上限（避免回傳太多） */
  limit?: number;
}

export async function detectZombieVariants(
  options: DetectZombieOptions = {},
): Promise<ZombieVariant[]> {
  const minDays = options.minDays ?? 14;
  const limit = options.limit ?? 500;
  const now = Date.now();
  const minMs = minDays * 24 * 60 * 60 * 1000;

  // 1. 取所有有 variantPool 的 pages
  const filters = [isNotNull(pages.variantPool)];
  if (options.fieldId) {
    // pages 沒直接 fieldId，要透過 games join；但為簡化本次先不 join
    // P15-1 只做核心邏輯，fieldId 過濾留給 caller post-filter
  }
  if (options.gameId) {
    filters.push(eq(pages.gameId, options.gameId));
  }

  const allPages = await db
    .select({
      id: pages.id,
      gameId: pages.gameId,
      variantPool: pages.variantPool,
      createdAt: pages.createdAt,
    })
    .from(pages)
    .where(and(...filters));

  if (allPages.length === 0) {
    return [];
  }

  // 2. 一次性取所有 variantFeedback 的 (pageId, variantKey, variantIndex)
  //    用 SELECT DISTINCT 避免重複
  const pageIds = allPages.map((p) => p.id);
  const feedbackRows = await db
    .selectDistinct({
      pageId: variantFeedback.pageId,
      variantKey: variantFeedback.variantKey,
      variantIndex: variantFeedback.variantIndex,
    })
    .from(variantFeedback)
    .where(inArray(variantFeedback.pageId, pageIds));

  // 3. 建立「有 feedback」的 Set 快查
  const seenSet = new Set<string>();
  for (const r of feedbackRows) {
    seenSet.add(`${r.pageId}|${r.variantKey}|${r.variantIndex}`);
  }

  // 4. 遍歷每個 page 的 pool，找出不在 set 裡的
  const zombies: ZombieVariant[] = [];
  for (const page of allPages) {
    const pool = page.variantPool as VariantPool | null;
    if (!pool) continue;

    // 計算 daysOld
    const generatedTs = pool.generatedAt
      ? new Date(pool.generatedAt).getTime()
      : page.createdAt
        ? new Date(page.createdAt).getTime()
        : null;
    if (!generatedTs) continue;
    const ageMs = now - generatedTs;
    if (ageMs < minMs) continue; // 太新，不算殭屍

    const daysOld = Math.floor(ageMs / (24 * 60 * 60 * 1000));

    // 遍歷 4 種 variantKey
    const keys: Array<"success" | "fail" | "nearMiss" | "hint"> = [
      "success",
      "fail",
      "nearMiss",
      "hint",
    ];
    for (const key of keys) {
      const variants = pool[key];
      if (!variants || !Array.isArray(variants)) continue;

      for (let i = 0; i < variants.length; i++) {
        const seenKey = `${page.id}|${key}|${i}`;
        if (seenSet.has(seenKey)) continue;

        zombies.push({
          pageId: page.id,
          gameId: page.gameId,
          fieldId: null, // 留 caller 補（避免本層 join 增加負載）
          variantKey: key,
          variantIndex: i,
          variantText: variants[i],
          daysOld,
        });

        if (zombies.length >= limit) {
          return zombies;
        }
      }
    }
  }

  return zombies;
}

// ============================================================================
// 孤兒任務偵測（P15-2）
// ============================================================================

/**
 * 孤兒任務：page 上線一段時間後，從來沒有任何玩家完成過
 *
 * 判定：
 *   1. 取所有 pages（含 createdAt ≤ now - minDays 的，過濾剛上線的）
 *   2. 取所有出現過 page_complete 事件的 distinct pageId
 *   3. 不在 set 中的 page → 孤兒任務
 *
 * 可能原因：
 *   - 任務太難（玩家進去就 fail/exit）
 *   - 入口被其他 page 切斷（流程斷頭）
 *   - 描述不清楚，玩家看不懂
 *   - 該 page 從沒有人進入（page_enter 也是 0）
 */
export interface OrphanTask {
  pageId: string;
  gameId: string;
  pageType: string;
  customName: string | null;
  pageOrder: number;
  daysOld: number;
  /** 是否完全沒人進入過（true = 連 page_enter 都沒有） */
  neverEntered: boolean;
}

export interface DetectOrphanOptions {
  /** 遊戲 ID 過濾 */
  gameId?: string;
  /** page 上線多少天才算（預設 14 天，避免剛上線的誤判） */
  minDays?: number;
  /** 上限 */
  limit?: number;
}

export async function detectOrphanTasks(
  options: DetectOrphanOptions = {},
): Promise<OrphanTask[]> {
  const minDays = options.minDays ?? 14;
  const limit = options.limit ?? 500;
  const cutoff = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000);

  // 1. 取所有 createdAt ≤ cutoff 的 pages
  const filters = [lte(pages.createdAt, cutoff)];
  if (options.gameId) {
    filters.push(eq(pages.gameId, options.gameId));
  }

  const allPages = await db
    .select({
      id: pages.id,
      gameId: pages.gameId,
      pageType: pages.pageType,
      customName: pages.customName,
      pageOrder: pages.pageOrder,
      createdAt: pages.createdAt,
    })
    .from(pages)
    .where(and(...filters));

  if (allPages.length === 0) {
    return [];
  }

  const pageIds = allPages.map((p) => p.id);

  // 2. 取所有 page_complete 的 distinct pageId
  const completedRows = await db
    .selectDistinct({ pageId: playerEventLogs.pageId })
    .from(playerEventLogs)
    .where(
      and(
        eq(playerEventLogs.eventType, "page_complete"),
        sql`${playerEventLogs.pageId} = ANY(${pageIds})`,
      ),
    );
  const completedSet = new Set<string>();
  for (const r of completedRows) {
    if (r.pageId) completedSet.add(r.pageId);
  }

  // 3. 取 page_enter 的 distinct pageId（用來判斷 neverEntered）
  const enteredRows = await db
    .selectDistinct({ pageId: playerEventLogs.pageId })
    .from(playerEventLogs)
    .where(
      and(
        eq(playerEventLogs.eventType, "page_enter"),
        sql`${playerEventLogs.pageId} = ANY(${pageIds})`,
      ),
    );
  const enteredSet = new Set<string>();
  for (const r of enteredRows) {
    if (r.pageId) enteredSet.add(r.pageId);
  }

  // 4. 找孤兒
  const now = Date.now();
  const orphans: OrphanTask[] = [];
  for (const page of allPages) {
    if (completedSet.has(page.id)) continue; // 有人完成過 → 不是孤兒
    const ageMs = page.createdAt
      ? now - new Date(page.createdAt).getTime()
      : 0;
    orphans.push({
      pageId: page.id,
      gameId: page.gameId,
      pageType: page.pageType,
      customName: page.customName,
      pageOrder: page.pageOrder,
      daysOld: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
      neverEntered: !enteredSet.has(page.id),
    });

    if (orphans.length >= limit) break;
  }

  return orphans;
}

// ============================================================================
// 死路 page 偵測（P15-3）
// ============================================================================

/**
 * 死路 page：玩家進去（page_enter）但大多數人沒完成（page_complete）就退出
 *
 * 判定（從 player_event_logs 算）：
 *   1. 取最近 days 天的 page_enter / page_complete / page_exit / page_fail 統計
 *   2. enterCount ≥ minSamples（避免樣本太少誤判）
 *   3. exitRate = (exit + fail) / enter ≥ threshold（預設 0.7）
 *   4. completionRate = complete / enter < (1 - threshold)
 *
 * 用途：
 *   - 找出玩家「卡關」的 page → admin 可以調 hint / 降難度 / 改變體
 *   - 與 detectOrphanTasks 不同：orphan 是「沒人完成」；deadEnd 是「進去的人都沒完成」
 */
export interface DeadEndPage {
  pageId: string;
  gameId: string | null;
  enterCount: number;
  completeCount: number;
  exitCount: number;
  failCount: number;
  retryCount: number;
  exitRate: number; // (exit + fail) / enter
  completionRate: number; // complete / enter
  /** 嚴重度：completionRate 越低 + enterCount 越大 = 越嚴重 */
  severity: "high" | "medium" | "low";
}

export interface DetectDeadEndOptions {
  /** 遊戲 ID 過濾 */
  gameId?: string;
  /** 統計窗口（最近幾天，預設 30） */
  days?: number;
  /** 最少需要多少 page_enter 才參與分析（預設 10，避免樣本不足誤判） */
  minSamples?: number;
  /** 退出率閾值（預設 0.7） */
  exitThreshold?: number;
  /** 上限 */
  limit?: number;
}

export async function detectDeadEndPages(
  options: DetectDeadEndOptions = {},
): Promise<DeadEndPage[]> {
  const days = options.days ?? 30;
  const minSamples = options.minSamples ?? 10;
  const exitThreshold = options.exitThreshold ?? 0.7;
  const limit = options.limit ?? 500;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 一次性聚合：對每個 (pageId, eventType) 統計 count
  // 用 Drizzle GROUP BY
  const filters = [
    isNotNull(playerEventLogs.pageId),
    gte(playerEventLogs.createdAt, since),
  ];
  if (options.gameId) {
    filters.push(eq(playerEventLogs.gameId, options.gameId));
  }

  const rows = await db
    .select({
      pageId: playerEventLogs.pageId,
      gameId: playerEventLogs.gameId,
      eventType: playerEventLogs.eventType,
      cnt: sql<number>`count(*)::int`,
    })
    .from(playerEventLogs)
    .where(and(...filters))
    .groupBy(
      playerEventLogs.pageId,
      playerEventLogs.gameId,
      playerEventLogs.eventType,
    );

  // 聚合到 pageId 維度
  const statsByPage = new Map<
    string,
    {
      gameId: string | null;
      enter: number;
      complete: number;
      exit: number;
      fail: number;
      retry: number;
    }
  >();

  for (const r of rows) {
    if (!r.pageId) continue;
    const existing = statsByPage.get(r.pageId) ?? {
      gameId: r.gameId,
      enter: 0,
      complete: 0,
      exit: 0,
      fail: 0,
      retry: 0,
    };
    switch (r.eventType) {
      case "page_enter":
        existing.enter = r.cnt;
        break;
      case "page_complete":
        existing.complete = r.cnt;
        break;
      case "page_exit":
        existing.exit = r.cnt;
        break;
      case "page_fail":
        existing.fail = r.cnt;
        break;
      case "page_retry":
        existing.retry = r.cnt;
        break;
    }
    statsByPage.set(r.pageId, existing);
  }

  // 過濾出死路 page
  const deadEnds: DeadEndPage[] = [];
  for (const [pageId, s] of Array.from(statsByPage.entries())) {
    if (s.enter < minSamples) continue; // 樣本不足

    const exitRate = (s.exit + s.fail) / s.enter;
    if (exitRate < exitThreshold) continue; // 退出率不夠高

    const completionRate = s.complete / s.enter;

    // 嚴重度判定：低完成率 × 大樣本 = 高嚴重度
    let severity: "high" | "medium" | "low" = "low";
    if (completionRate < 0.1 && s.enter >= 50) {
      severity = "high";
    } else if (completionRate < 0.3 && s.enter >= 20) {
      severity = "medium";
    }

    deadEnds.push({
      pageId,
      gameId: s.gameId,
      enterCount: s.enter,
      completeCount: s.complete,
      exitCount: s.exit,
      failCount: s.fail,
      retryCount: s.retry,
      exitRate,
      completionRate,
      severity,
    });

    if (deadEnds.length >= limit) break;
  }

  // 依嚴重度排序（high → medium → low），相同嚴重度依 exitRate 降序
  const severityRank = { high: 0, medium: 1, low: 2 };
  deadEnds.sort((a, b) => {
    const r = severityRank[a.severity] - severityRank[b.severity];
    return r !== 0 ? r : b.exitRate - a.exitRate;
  });

  return deadEnds;
}

// ============================================================================
// 綜合健康度分數（P15-4）
// ============================================================================

/**
 * 計算平台/場域/遊戲整體內容健康度（0-100）
 *
 * 計分公式（線性扣分）：
 *   baseScore = 100
 *   zombiePenalty   = zombieRatio   × 30   （殭屍變體比例）
 *   orphanPenalty   = orphanRatio   × 35   （孤兒任務比例）
 *   deadEndPenalty  = deadEndScore  × 35   （依嚴重度加權：high=1, medium=0.5, low=0.2）
 *
 *   finalScore = max(0, baseScore - 三項 penalty 總和)
 *
 * 分級：
 *   90-100  excellent  完美
 *   75-89   good       健康
 *   60-74   fair       可接受
 *   40-59   poor       需改善
 *   0-39    critical   嚴重
 */
export interface HealthScore {
  score: number; // 0-100
  level: "excellent" | "good" | "fair" | "poor" | "critical";
  /** 細項統計（用於 UI 顯示 + admin 行動）*/
  breakdown: {
    totalPages: number;
    totalVariants: number;
    zombieCount: number;
    orphanCount: number;
    deadEndCount: number;
    deadEndHigh: number;
    deadEndMedium: number;
    deadEndLow: number;
    zombieRatio: number;
    orphanRatio: number;
    deadEndScore: number;
  };
  /** 各 penalty 細節（透明度） */
  penalties: {
    zombie: number;
    orphan: number;
    deadEnd: number;
  };
}

export interface CalculateHealthOptions {
  gameId?: string;
  /** 死路偵測窗口（同 detectDeadEndPages） */
  days?: number;
}

export async function calculateHealthScore(
  options: CalculateHealthOptions = {},
): Promise<HealthScore> {
  // 1. 並行抓三個偵測結果 + 全部 pages 計數
  const [zombies, orphans, deadEnds, pageCountRow] = await Promise.all([
    detectZombieVariants({ gameId: options.gameId, limit: 10000 }),
    detectOrphanTasks({ gameId: options.gameId, limit: 10000 }),
    detectDeadEndPages({
      gameId: options.gameId,
      days: options.days,
      limit: 10000,
    }),
    db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(pages)
      .where(options.gameId ? eq(pages.gameId, options.gameId) : sql`true`),
  ]);

  const totalPages = pageCountRow[0]?.cnt ?? 0;

  // 2. 算總變體數（用 jsonb 函數，但這裡簡單處理：取一次 pool 後加總）
  // 注意：detectZombieVariants 已遍歷過 pool，這裡為了 totalVariants 再算一次
  const allPagesWithPool = await db
    .select({ variantPool: pages.variantPool })
    .from(pages)
    .where(
      and(
        isNotNull(pages.variantPool),
        options.gameId ? eq(pages.gameId, options.gameId) : sql`true`,
      ),
    );

  let totalVariants = 0;
  for (const p of allPagesWithPool) {
    const pool = p.variantPool as VariantPool | null;
    if (!pool) continue;
    for (const key of ["success", "fail", "nearMiss", "hint"] as const) {
      const arr = pool[key];
      if (Array.isArray(arr)) totalVariants += arr.length;
    }
  }

  // 3. 計算比例（避免除以 0）
  const zombieRatio =
    totalVariants > 0 ? zombies.length / totalVariants : 0;
  const orphanRatio = totalPages > 0 ? orphans.length / totalPages : 0;

  // 死路嚴重度加權分數
  let deadEndHigh = 0,
    deadEndMedium = 0,
    deadEndLow = 0;
  for (const d of deadEnds) {
    if (d.severity === "high") deadEndHigh++;
    else if (d.severity === "medium") deadEndMedium++;
    else deadEndLow++;
  }
  const weightedDeadEnd =
    deadEndHigh * 1.0 + deadEndMedium * 0.5 + deadEndLow * 0.2;
  const deadEndScore =
    totalPages > 0 ? Math.min(1, weightedDeadEnd / totalPages) : 0;

  // 4. 計算 penalty
  const zombiePenalty = zombieRatio * 30;
  const orphanPenalty = orphanRatio * 35;
  const deadEndPenalty = deadEndScore * 35;

  const score = Math.max(
    0,
    Math.round(100 - zombiePenalty - orphanPenalty - deadEndPenalty),
  );

  // 5. 分級
  let level: HealthScore["level"];
  if (score >= 90) level = "excellent";
  else if (score >= 75) level = "good";
  else if (score >= 60) level = "fair";
  else if (score >= 40) level = "poor";
  else level = "critical";

  return {
    score,
    level,
    breakdown: {
      totalPages,
      totalVariants,
      zombieCount: zombies.length,
      orphanCount: orphans.length,
      deadEndCount: deadEnds.length,
      deadEndHigh,
      deadEndMedium,
      deadEndLow,
      zombieRatio,
      orphanRatio,
      deadEndScore,
    },
    penalties: {
      zombie: Math.round(zombiePenalty * 10) / 10,
      orphan: Math.round(orphanPenalty * 10) / 10,
      deadEnd: Math.round(deadEndPenalty * 10) / 10,
    },
  };
}
