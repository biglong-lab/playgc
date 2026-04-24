// 📊 AI 服務用量日誌 — Google Vision OCR、MediaPipe 臉部追蹤等
//
// 目的：
//   - 追蹤 Google Cloud Vision API 呼叫次數（免費額度 1000/月）
//   - 80% 用量發 email 警告、95% 自動 fallback 到人工審核
//   - 作為計費依據（未來跨場域 SaaS 分攤）
//
// 清理策略：30 天自動清理成功日誌、保留失敗日誌 90 天方便除錯
// 隱私：不存圖片內容、不存辨識結果全文，只存結構化 metadata
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  jsonb,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { fields } from "./fields";
import { games } from "./games";

export const aiProviderEnum = [
  "google-vision",
  "gemini",
  "openrouter",
  "mediapipe",
] as const;
export type AiProvider = (typeof aiProviderEnum)[number];

export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    provider: varchar("provider", { length: 30 }).notNull(), // google-vision / gemini / openrouter / mediapipe
    endpoint: varchar("endpoint", { length: 100 }).notNull(), // ocr-detect / analyze-image 等
    success: boolean("success").default(true).notNull(),
    errorCode: varchar("error_code", { length: 100 }), // QUOTA_EXCEEDED / API_KEY_INVALID / NETWORK_ERROR
    errorMessage: text("error_message"), // 錯誤描述（不含敏感資訊）
    latencyMs: integer("latency_ms"), // API 回應時間
    gameId: varchar("game_id").references(() => games.id, {
      onDelete: "set null",
    }),
    fieldId: varchar("field_id").references(() => fields.id, {
      onDelete: "set null",
    }),
    userId: varchar("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    context: jsonb("context"), // 額外結構化 metadata（不存敏感資訊）
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_ai_usage_provider_time").on(table.provider, table.createdAt),
    index("idx_ai_usage_field_time").on(table.fieldId, table.createdAt),
    index("idx_ai_usage_success_time").on(table.success, table.createdAt),
  ],
);

export const insertAiUsageLogSchema = createInsertSchema(aiUsageLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;
export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
