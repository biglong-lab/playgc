// 🔐 LINE Login 全域設定 schema（2026-05-18）
//
// 用途：全平台共用一個 LINE Login channel（不是 Messaging API、不是 per-field）
// 表設計：singleton（永遠只有一筆，id='singleton'）
// 由 platform admin（super admin）在後台填入、不再依賴 env
//
// 為什麼不用 platform_settings key-value：
//   專屬表型別安全、查詢清楚；未來金流再開另一張專屬表（Phase 4-B）。
import { pgTable, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const lineLoginConfig = pgTable("line_login_config", {
  id: varchar("id", { length: 32 }).primaryKey(), // 固定 "singleton"
  channelId: text("channel_id"),                  // LINE Login channel ID
  channelSecret: text("channel_secret"),          // LINE Login channel secret
  callbackUrl: text("callback_url"),              // e.g. https://game.homi.cc/api/auth/line/callback
  enabled: boolean("enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedByAdminId: varchar("updated_by_admin_id"),
});

export type LineLoginConfig = typeof lineLoginConfig.$inferSelect;
