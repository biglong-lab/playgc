// 📊 LINE Bot Events — @chito Bot 使用紀錄表（W2 / 2026-05-14）
//
// 目的：
//   LINE Bot @chito 已交付（Phase 4 W15）— 但「對話量、成功建場次數、失敗原因」未報表化
//   本表記錄每次 webhook 收到的事件、admin metrics 可看趨勢
//
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (W2)

import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  jsonb,
  timestamp,
  integer,
  boolean,
  text,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// event 類型列舉
export type LineBotEventType =
  | "message_received"   // 收到 admin 訊息
  | "nlu_parsed"         // NLU 解析完成
  | "intent_create_game" // 意圖：建場
  | "intent_list_active" // 意圖：列出活動
  | "intent_end_session" // 意圖：結束 session
  | "intent_help"        // 意圖：求助
  | "intent_unknown"     // 意圖：無法理解
  | "action_success"     // 動作執行成功
  | "action_failed"      // 動作執行失敗
  | "reply_sent"         // 回覆已送出
  | "reminder_pushed";   // 過期 reminder 推送

export const lineBotEvents = pgTable(
  "line_bot_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    timestamp: timestamp("timestamp").defaultNow().notNull(),

    // 識別
    lineUserId: varchar("line_user_id", { length: 100 }),
    adminId: varchar("admin_id", { length: 100 }),
    fieldId: varchar("field_id", { length: 100 }),

    // 事件
    eventType: varchar("event_type", { length: 50 }).notNull(),
    intent: varchar("intent", { length: 50 }),

    // 結果
    success: boolean("success"),
    durationMs: integer("duration_ms"),
    errorReason: varchar("error_reason", { length: 200 }),

    // 訊息內容（敏感、可選）
    messageText: text("message_text"),  // 預設不存，opt-in
    replyText: text("reply_text"),       // 預設不存，opt-in

    // 結果關聯
    resultingGameId: varchar("resulting_game_id", { length: 100 }),

    // 額外 metadata
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_line_bot_events_time").on(table.timestamp),
    index("idx_line_bot_events_user_time").on(table.lineUserId, table.timestamp),
    index("idx_line_bot_events_type_time").on(table.eventType, table.timestamp),
    index("idx_line_bot_events_intent_time").on(table.intent, table.timestamp),
    index("idx_line_bot_events_field_time").on(table.fieldId, table.timestamp),
  ],
);

export const insertLineBotEventSchema = createInsertSchema(lineBotEvents).omit({
  id: true,
  timestamp: true,
});
export type LineBotEvent = typeof lineBotEvents.$inferSelect;
export type InsertLineBotEvent = z.infer<typeof insertLineBotEventSchema>;
