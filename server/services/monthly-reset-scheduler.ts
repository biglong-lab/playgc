// 月度重置 cron — Phase 14.5
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §8.4 上升星榜
//
// 每月 1 號 00:00 重置：
//   - squadStats.monthlyGames = 0
//   - squadStats.monthlyRecruits = 0
//
// 設計考量：
//   - 用「每天 0:00 檢查日期」的方式避免錯過月初
//   - 跨日後若日期是 1 號 → 執行重置
//   - 用 dedupe 機制（記錄最後重置月份）避免一日跑多次
//
import { withSchedulerRun } from "../lib/scheduler-run-recorder";
import { db } from "../db";
import { squadStats } from "@shared/schema";
import { sql } from "drizzle-orm";

let schedulerInterval: NodeJS.Timeout | null = null;
let lastResetMonth: string | null = null; // "2026-04"

const ONE_HOUR_MS = 60 * 60 * 1000;
const INITIAL_DELAY_MS = 5 * 60 * 1000; // 啟動 5 分鐘後跑首次

function currentMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 重置 monthlyGames + monthlyRecruits 到 0
 * 不影響 totalGames / totalGamesRaw / totalExpPoints / recruitsCount
 */
async function resetMonthlyStatsInner(): Promise<{ rowsAffected: number }> {
  const result = await db
    .update(squadStats)
    .set({
      monthlyGames: 0,
      monthlyRecruits: 0,
      updatedAt: new Date(),
    })
    .returning({ squadId: squadStats.squadId });

  return { rowsAffected: result.length };
}

/**
 * 檢查是否該重置（月份變了 + 還沒重置過這月）
 */
async function checkAndReset(): Promise<void> {
  const today = new Date();
  const isFirstOfMonth = today.getDate() === 1;
  const monthKey = currentMonthKey(today);

  // 只在月初執行 + 該月還沒重置過
  if (!isFirstOfMonth) return;
  if (lastResetMonth === monthKey) return;

  console.log(`[monthly-reset] ${monthKey} 開始重置月度統計...`);
  try {
    const result = await resetMonthlyStats();
    lastResetMonth = monthKey;
    console.log(
      `[monthly-reset] ${monthKey} 已重置 ${result.rowsAffected} 隊`,
    );
  } catch (err) {
    console.error("[monthly-reset] 重置失敗:", err);
  }
}

export async function resetMonthlyStats(): Promise<{ rowsAffected: number }> {
  return withSchedulerRun("monthly-reset-scheduler", resetMonthlyStatsInner, (r) => r.rowsAffected);
}

export function startMonthlyResetScheduler(): void {
  if (schedulerInterval) {
    console.warn("[monthly-reset-scheduler] 已在運行");
    return;
  }

  console.log("[monthly-reset-scheduler] 已啟動（每小時檢查一次月初）");

  // 🔒 cluster lock 包裹（多 container 安全）
  const tick = async () => {
    const { withClusterLock } = await import("../lib/cluster-lock");
    return withClusterLock("scheduler:monthly-reset", async () => {
      await checkAndReset();
    });
  };

  // 啟動延遲，避免和其他 scheduler 同時跑
  setTimeout(async () => {
    await tick();

    // 之後每小時檢查一次
    schedulerInterval = setInterval(async () => {
      await tick();
    }, ONE_HOUR_MS);
  }, INITIAL_DELAY_MS);
}

export function stopMonthlyResetScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[monthly-reset-scheduler] 已停止");
  }
}

// Export for tests
export const __testing__ = {
  currentMonthKey,
  setLastResetMonth: (month: string | null) => {
    lastResetMonth = month;
  },
};
