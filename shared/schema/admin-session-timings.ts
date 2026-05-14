// 📊 Admin Session Timings — admin 30 分鐘建場 SLA 埋點表（W2 / 2026-05-14）
//
// 目的：
//   「30 分鐘現場可玩」是設計目標、但缺驗證資料 — admin 從進後台到 QR 印出真的 30 分鐘嗎？
//   本表記錄每次 admin 建場流程的關鍵 milestone 時間戳、算 p50/p90/p95
//
// 一筆紀錄 = 一次 admin 建場 funnel run
// milestones 用 jsonb 彈性結構：{ enteredAdminAt, selectedScenarioAt, instantiatedAt, qrPrintedAt, ... }
//
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (W2)

import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  jsonb,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// milestone key 列舉（前端 + 後端共用）
export type AdminTimingMilestone =
  | "entered_admin"          // 進入後台 dashboard
  | "opened_scenario_picker" // 開情境挑選頁
  | "selected_scenario"      // 選定情境
  | "instantiated_game"      // 一鍵建場 endpoint 回應
  | "opened_qr_print"        // 打開 QR 列印頁
  | "qr_printed"             // 列印完成（玩家可掃）
  | "abandoned";             // 中途離開（未完成）

export const adminSessionTimings = pgTable(
  "admin_session_timings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    adminId: varchar("admin_id", { length: 100 }).notNull(),
    fieldId: varchar("field_id", { length: 100 }),

    // funnel 識別 — 一次完整建場流程
    funnelId: varchar("funnel_id", { length: 100 }).notNull(),

    // milestone 時間戳（jsonb 結構彈性、新增 milestone 不需 migrate）
    // 範例: { entered_admin: "2026-05-14T19:00:00Z", selected_scenario: "...", ... }
    milestones: jsonb("milestones").notNull().default({}),

    // 結算
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    abandonedAt: timestamp("abandoned_at"),
    totalDurationMs: integer("total_duration_ms"), // qr_printed - entered_admin

    // 結果關聯
    resultingGameId: varchar("resulting_game_id", { length: 100 }), // 建場成功後的 game.id
    scenarioId: varchar("scenario_id", { length: 100 }),
    useAi: varchar("use_ai", { length: 5 }), // "true" / "false" / null（AI 採用率追蹤）

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_admin_timings_admin").on(table.adminId, table.startedAt),
    index("idx_admin_timings_field").on(table.fieldId, table.startedAt),
    index("idx_admin_timings_completed").on(table.completedAt),
    index("idx_admin_timings_funnel").on(table.funnelId),
    index("idx_admin_timings_cleanup").on(table.createdAt),
  ],
);

export const insertAdminSessionTimingSchema = createInsertSchema(adminSessionTimings).omit({
  id: true,
  createdAt: true,
});
export type AdminSessionTiming = typeof adminSessionTimings.$inferSelect;
export type InsertAdminSessionTiming = z.infer<typeof insertAdminSessionTimingSchema>;

// SLA 閾值（紅燈條件）
export const ADMIN_SLA_TARGET_MS = 30 * 60 * 1000; // 30 分鐘
export const ADMIN_SLA_WARNING_MS = 45 * 60 * 1000; // 45 分鐘 → warning
export const ADMIN_SLA_CRITICAL_MS = 60 * 60 * 1000; // 60 分鐘 → critical
