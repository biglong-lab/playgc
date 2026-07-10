// ⏱️ Scheduler 執行歷史記錄器（2026-07-10）
//
// 用法：把 scheduler 的一輪 cycle 包進 withSchedulerRun：
//   const result = await withSchedulerRun("battle-scheduler", runCycleInner, (r) => r.processed);
//
// 特性：
// - 執行前後各取時間、單筆 INSERT（cycle 中途 crash 也會留 failed 紀錄）
// - 記錄失敗不影響 scheduler 主流程（console.error 後放行）
// - 啟動時 ensureSchedulerRunsSchema() 動態建表（沿用 team-* 模組 pattern、生產零手動遷移）

import { db } from "../db";
import { sql } from "drizzle-orm";
import { schedulerRuns } from "@shared/schema";

export async function ensureSchedulerRunsSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS scheduler_runs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      scheduler_name VARCHAR(60) NOT NULL,
      started_at TIMESTAMP NOT NULL,
      finished_at TIMESTAMP NOT NULL DEFAULT NOW(),
      status VARCHAR(20) NOT NULL,
      processed_count INTEGER DEFAULT 0,
      error_message TEXT,
      metadata JSONB
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_scheduler_runs_name_time
    ON scheduler_runs (scheduler_name, finished_at)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_scheduler_runs_time
    ON scheduler_runs (finished_at)
  `);
}

async function insertRun(row: {
  schedulerName: string;
  startedAt: Date;
  status: "success" | "failed";
  processedCount: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(schedulerRuns).values({
      schedulerName: row.schedulerName,
      startedAt: row.startedAt,
      finishedAt: new Date(),
      status: row.status,
      processedCount: row.processedCount,
      errorMessage: row.errorMessage?.slice(0, 2000),
      metadata: row.metadata ?? null,
    });
  } catch (err) {
    console.error("[scheduler-run-recorder] 寫入執行紀錄失敗:", row.schedulerName, err);
  }
}

/**
 * 包一輪 scheduler cycle、成功/失敗都留執行紀錄
 *
 * @param name         scheduler 名稱
 * @param fn           一輪 cycle
 * @param extractCount 從結果取主要處理筆數（省略 = 0）
 * @param extractMeta  從結果取摘要 metadata（省略 = 不記）
 */
export async function withSchedulerRun<T>(
  name: string,
  fn: () => Promise<T>,
  extractCount?: (result: T) => number,
  extractMeta?: (result: T) => Record<string, unknown>,
): Promise<T> {
  const startedAt = new Date();
  try {
    const result = await fn();
    await insertRun({
      schedulerName: name,
      startedAt,
      status: "success",
      processedCount: extractCount ? extractCount(result) : 0,
      metadata: extractMeta ? extractMeta(result) : undefined,
    });
    return result;
  } catch (err) {
    await insertRun({
      schedulerName: name,
      startedAt,
      status: "failed",
      processedCount: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
