// 🎯 自適應閾值計算器
//
// 用途：從歷史資料（ai_usage_logs / player_event_logs）算每個任務的最佳閾值
//
// 演算法（簡化版 control loop）：
//   1. 取最近 30 天該 task 的所有 events
//   2. 算「失敗率」= page_fail / (page_fail + page_complete)
//   3. 算「平均 AI confidence」= 從 ai_usage_logs.context 抽
//   4. 依失敗率區間調整閾值：
//      - 失敗率 > 60%：太難 → 放寬閾值（pHash +2 / fuzzy +1 / confidence -0.1）
//      - 失敗率 10-60%：合理區間 → 不動
//      - 失敗率 < 10%：太簡單 → 收緊閾值（pHash -1 / fuzzy -1 / confidence +0.05）
//   5. 加上 hard limits 保護（pHash 1-15 / fuzzy 0-5 / confidence 0.3-0.95）
//
// 設計重點：
//   - 樣本少時不調整（min 10 events 才動，避免噪音）
//   - 微調漸進（每次 ±10-20%），而非大幅跳變
//   - stats jsonb 記錄調整原因（給 admin 看）
import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  taskThresholds,
  playerEventLogs,
  aiUsageLogs,
  DEFAULT_THRESHOLDS,
  type TaskThreshold,
  type InsertTaskThreshold,
} from "@shared/schema";

const MIN_EVENTS_TO_ADJUST = 10;
const ANALYSIS_WINDOW_DAYS = 30;

const HARD_LIMITS = {
  pHashThreshold: { min: 1, max: 15 },
  fuzzyTolerance: { min: 0, max: 5 },
  aiConfidenceThreshold: { min: 0.3, max: 0.95 },
  similarityThreshold: { min: 0.3, max: 0.95 },
};

export interface ThresholdAnalysis {
  taskId: string;
  totalEvents: number;
  completeCount: number;
  failCount: number;
  retryCount: number;
  failureRate: number; // [0, 1]
  avgAiConfidence: number | null;
  recommendation: "loosen" | "maintain" | "tighten" | "insufficient-data";
  /** 算出來的建議閾值（若調整） */
  suggested?: {
    pHashThreshold?: number;
    fuzzyTolerance?: number;
    aiConfidenceThreshold?: number;
    similarityThreshold?: number;
  };
  /** 調整原因 */
  reason: string;
}

/**
 * 為單一任務計算最佳閾值
 *
 * @param taskId pages.id
 * @param gameId 對應 game id（寫入 task_thresholds 用）
 * @returns 分析結果 + 建議閾值
 */
export async function calculateOptimalThreshold(
  taskId: string,
  gameId?: string,
): Promise<ThresholdAnalysis> {
  const since = new Date(Date.now() - ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // 取此 task 的事件統計
  const eventStats = await db
    .select({
      eventType: playerEventLogs.eventType,
      cnt: sql<number>`count(*)::int`,
    })
    .from(playerEventLogs)
    .where(
      and(
        eq(playerEventLogs.pageId, taskId),
        gte(playerEventLogs.createdAt, since),
      ),
    )
    .groupBy(playerEventLogs.eventType);

  const counts: Record<string, number> = {};
  for (const r of eventStats) counts[r.eventType] = r.cnt;
  const completeCount = counts["page_complete"] ?? 0;
  const failCount = counts["page_fail"] ?? 0;
  const retryCount = counts["page_retry"] ?? 0;
  const totalEvents = completeCount + failCount + retryCount;

  // 取此 task 的 AI confidence 分布
  const aiStats = await db
    .select({
      ctx: aiUsageLogs.context,
    })
    .from(aiUsageLogs)
    .where(
      and(
        eq(aiUsageLogs.gameId, gameId ?? ""),
        gte(aiUsageLogs.createdAt, since),
      ),
    )
    .limit(500);

  let avgAiConfidence: number | null = null;
  if (aiStats.length > 0) {
    const confidences: number[] = [];
    for (const r of aiStats) {
      const ctx = r.ctx as { confidence?: number; similarity?: number } | null;
      const c = ctx?.confidence ?? ctx?.similarity;
      if (typeof c === "number") confidences.push(c);
    }
    if (confidences.length > 0) {
      avgAiConfidence =
        confidences.reduce((a, b) => a + b, 0) / confidences.length;
    }
  }

  // 樣本不足
  if (totalEvents < MIN_EVENTS_TO_ADJUST) {
    return {
      taskId,
      totalEvents,
      completeCount,
      failCount,
      retryCount,
      failureRate: 0,
      avgAiConfidence,
      recommendation: "insufficient-data",
      reason: `樣本不足（${totalEvents} < ${MIN_EVENTS_TO_ADJUST}）`,
    };
  }

  const failureRate = failCount / Math.max(totalEvents, 1);

  // 取得當前閾值（沒設過 → 用 DEFAULT）
  const [current] = await db
    .select()
    .from(taskThresholds)
    .where(eq(taskThresholds.taskId, taskId))
    .limit(1);

  const currentPHash = current?.pHashThreshold ?? DEFAULT_THRESHOLDS.pHashThreshold;
  const currentFuzzy = current?.fuzzyTolerance ?? DEFAULT_THRESHOLDS.fuzzyTolerance;
  const currentConf =
    current?.aiConfidenceThreshold !== null && current?.aiConfidenceThreshold !== undefined
      ? Number(current.aiConfidenceThreshold)
      : DEFAULT_THRESHOLDS.aiConfidenceThreshold;
  const currentSim =
    current?.similarityThreshold !== null && current?.similarityThreshold !== undefined
      ? Number(current.similarityThreshold)
      : DEFAULT_THRESHOLDS.similarityThreshold;

  // 失敗率區間判斷
  if (failureRate > 0.6) {
    // 太難 → 放寬
    return {
      taskId,
      totalEvents,
      completeCount,
      failCount,
      retryCount,
      failureRate,
      avgAiConfidence,
      recommendation: "loosen",
      suggested: {
        pHashThreshold: clamp(
          currentPHash + 2,
          HARD_LIMITS.pHashThreshold.min,
          HARD_LIMITS.pHashThreshold.max,
        ),
        fuzzyTolerance: clamp(
          currentFuzzy + 1,
          HARD_LIMITS.fuzzyTolerance.min,
          HARD_LIMITS.fuzzyTolerance.max,
        ),
        aiConfidenceThreshold: clamp(
          currentConf - 0.1,
          HARD_LIMITS.aiConfidenceThreshold.min,
          HARD_LIMITS.aiConfidenceThreshold.max,
        ),
        similarityThreshold: clamp(
          currentSim - 0.1,
          HARD_LIMITS.similarityThreshold.min,
          HARD_LIMITS.similarityThreshold.max,
        ),
      },
      reason: `失敗率 ${(failureRate * 100).toFixed(0)}% 過高（>60%），放寬閾值讓更多玩家通過`,
    };
  }

  if (failureRate < 0.1) {
    // 太簡單 → 收緊
    return {
      taskId,
      totalEvents,
      completeCount,
      failCount,
      retryCount,
      failureRate,
      avgAiConfidence,
      recommendation: "tighten",
      suggested: {
        pHashThreshold: clamp(
          currentPHash - 1,
          HARD_LIMITS.pHashThreshold.min,
          HARD_LIMITS.pHashThreshold.max,
        ),
        fuzzyTolerance: clamp(
          currentFuzzy - 1,
          HARD_LIMITS.fuzzyTolerance.min,
          HARD_LIMITS.fuzzyTolerance.max,
        ),
        aiConfidenceThreshold: clamp(
          currentConf + 0.05,
          HARD_LIMITS.aiConfidenceThreshold.min,
          HARD_LIMITS.aiConfidenceThreshold.max,
        ),
        similarityThreshold: clamp(
          currentSim + 0.05,
          HARD_LIMITS.similarityThreshold.min,
          HARD_LIMITS.similarityThreshold.max,
        ),
      },
      reason: `失敗率 ${(failureRate * 100).toFixed(0)}% 過低（<10%），收緊閾值保持挑戰感`,
    };
  }

  // 合理區間
  return {
    taskId,
    totalEvents,
    completeCount,
    failCount,
    retryCount,
    failureRate,
    avgAiConfidence,
    recommendation: "maintain",
    reason: `失敗率 ${(failureRate * 100).toFixed(0)}% 在合理區間（10-60%），維持當前閾值`,
  };
}

/**
 * 套用建議閾值到 task_thresholds 表（upsert）
 */
export async function applyThresholdRecommendation(
  taskId: string,
  gameId: string | null,
  analysis: ThresholdAnalysis,
): Promise<void> {
  if (!analysis.suggested) return; // maintain / insufficient-data 不寫入

  const insert: InsertTaskThreshold = {
    taskId,
    gameId,
    pHashThreshold: analysis.suggested.pHashThreshold,
    fuzzyTolerance: analysis.suggested.fuzzyTolerance,
    aiConfidenceThreshold:
      analysis.suggested.aiConfidenceThreshold !== undefined
        ? analysis.suggested.aiConfidenceThreshold.toFixed(2)
        : null,
    similarityThreshold:
      analysis.suggested.similarityThreshold !== undefined
        ? analysis.suggested.similarityThreshold.toFixed(2)
        : null,
    stats: {
      totalEvents: analysis.totalEvents,
      failureRate: analysis.failureRate,
      avgAiConfidence: analysis.avgAiConfidence,
      recommendation: analysis.recommendation,
      reason: analysis.reason,
      analyzedAt: new Date().toISOString(),
    },
    updatedAt: new Date(),
  };

  await db
    .insert(taskThresholds)
    .values(insert)
    .onConflictDoUpdate({
      target: taskThresholds.taskId,
      set: {
        pHashThreshold: insert.pHashThreshold,
        fuzzyTolerance: insert.fuzzyTolerance,
        aiConfidenceThreshold: insert.aiConfidenceThreshold,
        similarityThreshold: insert.similarityThreshold,
        stats: insert.stats,
        updatedAt: new Date(),
      },
    });
}

/**
 * 取得任務的當前生效閾值（沒設定回 DEFAULT）
 */
export async function getEffectiveThresholds(
  taskId: string,
): Promise<{
  pHashThreshold: number;
  fuzzyTolerance: number;
  aiConfidenceThreshold: number;
  similarityThreshold: number;
}> {
  const [row] = await db
    .select()
    .from(taskThresholds)
    .where(eq(taskThresholds.taskId, taskId))
    .limit(1);

  if (!row) {
    return { ...DEFAULT_THRESHOLDS };
  }

  return {
    pHashThreshold: row.pHashThreshold ?? DEFAULT_THRESHOLDS.pHashThreshold,
    fuzzyTolerance: row.fuzzyTolerance ?? DEFAULT_THRESHOLDS.fuzzyTolerance,
    aiConfidenceThreshold:
      row.aiConfidenceThreshold !== null
        ? Number(row.aiConfidenceThreshold)
        : DEFAULT_THRESHOLDS.aiConfidenceThreshold,
    similarityThreshold:
      row.similarityThreshold !== null
        ? Number(row.similarityThreshold)
        : DEFAULT_THRESHOLDS.similarityThreshold,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
