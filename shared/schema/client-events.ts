// 📊 前端事件與錯誤日誌
//
// 收集內容：
//   - error: 前端錯誤（相機失敗、LiveKit 斷線、API 500、uncaught exception）
//   - milestone: 關鍵里程碑（建 walkie 群組、掃 QR 成功、PTT 按下）
//   - info: 一般資訊（頁面載入、功能開啟）
//
// 清理策略：7 天自動刪除（避免 DB 肥大）
// 隱私：不存密碼、不存 console 全文，只存結構化 metadata
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

export const clientEventTypeEnum = ["error", "info", "milestone"] as const;
export type ClientEventType = (typeof clientEventTypeEnum)[number];

export const clientEventSeverityEnum = [
  "critical",
  "error",
  "warning",
  "info",
  "debug",
] as const;
export type ClientEventSeverity = (typeof clientEventSeverityEnum)[number];

export const clientEvents = pgTable(
  "client_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    eventType: varchar("event_type", { length: 20 }).notNull(), // error / info / milestone
    category: varchar("category", { length: 50 }).notNull(),    // camera / walkie / api / game / uncaught / general
    code: varchar("code", { length: 100 }),                     // 精確事件碼（camera_start_failed / ptt_pressed 等）
    message: text("message"),                                   // 簡短訊息
    severity: varchar("severity", { length: 20 }).default("info"), // critical / error / warning / info / debug
    context: jsonb("context"),                                  // 結構化 metadata（userAgent/gameId/errorName/stack 等）
    userId: varchar("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    userAgent: varchar("user_agent", { length: 500 }),
    url: varchar("url", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_client_events_type_time").on(table.eventType, table.createdAt),
    index("idx_client_events_severity_time").on(table.severity, table.createdAt),
    index("idx_client_events_category_time").on(table.category, table.createdAt),
    index("idx_client_events_user_time").on(table.userId, table.createdAt),
  ],
);

export const insertClientEventSchema = createInsertSchema(clientEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertClientEvent = z.infer<typeof insertClientEventSchema>;
export type ClientEvent = typeof clientEvents.$inferSelect;
