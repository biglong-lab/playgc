// ⏱️ Scheduler 執行歷史（2026-07-10）
//
// 背景：5 個 in-process scheduler（achievement/battle/dormancy/lifecycle/monthly-reset）
// 原本只有 console.log、重啟即消失，無法回答「上次跑是什麼時候、成功嗎、處理幾筆」。
// 本表持久化每輪執行摘要；retention 90 天（observability-cleanup cron 清）。

import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, integer, text, jsonb, index } from "drizzle-orm/pg-core";

export const schedulerRuns = pgTable(
  "scheduler_runs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    /** scheduler 名稱（achievement-scheduler / battle-scheduler / ...） */
    schedulerName: varchar("scheduler_name", { length: 60 }).notNull(),
    startedAt: timestamp("started_at").notNull(),
    finishedAt: timestamp("finished_at").defaultNow().notNull(),
    /** success / failed */
    status: varchar("status", { length: 20 }).notNull(),
    /** 本輪處理筆數（各 scheduler 自定義主要計數） */
    processedCount: integer("processed_count").default(0),
    /** 失敗時的錯誤訊息（截斷） */
    errorMessage: text("error_message"),
    /** 其他摘要（awarded / warned / tierUpgrades 數等） */
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_scheduler_runs_name_time").on(table.schedulerName, table.finishedAt),
    index("idx_scheduler_runs_time").on(table.finishedAt),
  ],
);

export type SchedulerRun = typeof schedulerRuns.$inferSelect;
