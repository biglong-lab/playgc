// 場域行銷與留存設定 — 全部可設定，admin 可調整
//
// 設計目標（按使用者明確需求）：
//   - 超級隊長條件：自動計算 + admin 手動指定
//   - 歡迎隊伍：自動 top N + admin 手動指定（兩種都要）
//   - 通知頻率：每場域可設定（站內 / email / LINE Notify / 社團 webhook）
//   - 休眠規則：可調整（不同場域有不同節奏）
//
import { pgTable, varchar, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// ============================================================================
// 1. field_engagement_settings — 場域行銷設定（每場域一筆）
// ============================================================================
export const fieldEngagementSettings = pgTable("field_engagement_settings", {
  fieldId: varchar("field_id").primaryKey(),

  // === 超級隊長自動條件（admin 可調，默認保守值）===
  superLeaderMinGames: integer("super_leader_min_games").default(100),         // 累計場次門檻
  superLeaderMinRecruits: integer("super_leader_min_recruits").default(10),    // 招募人數
  superLeaderMinFields: integer("super_leader_min_fields").default(2),         // 跨場域數
  superLeaderMinWinRate: integer("super_leader_min_win_rate").default(50),     // 勝率 % (50%)
  superLeaderAutoEnabled: boolean("super_leader_auto_enabled").default(true),  // 自動計算開關

  // === 手動指定的超級隊長 squadIds 清單 ===
  superLeaderManualIds: jsonb("super_leader_manual_ids").default(sql`'[]'::jsonb`), // string[]

  // === 歡迎隊伍設定 ===
  welcomeMode: varchar("welcome_mode", { length: 20 }).default("auto").notNull(),
  // 'auto' (取 top N) / 'manual' (用 manualIds) / 'hybrid' (兩者並用)
  welcomeAutoTopN: integer("welcome_auto_top_n").default(5),
  welcomeAutoCriteria: varchar("welcome_auto_criteria", { length: 30 }).default("total_games"),
  // 'total_games' / 'rating' / 'recent_active'
  welcomeManualIds: jsonb("welcome_manual_ids").default(sql`'[]'::jsonb`),     // string[]

  // === 通知設定 ===
  notificationChannels: jsonb("notification_channels").default(sql`'["in_app"]'::jsonb`),
  // ["in_app"] / ["in_app", "email"] / ["in_app", "email", "line_notify"] / ...

  // 各事件是否要通知（細粒度開關）
  notifyOnFirstGame: boolean("notify_on_first_game").default(true),            // 第 1 場後即時
  notifyOnRankChange: boolean("notify_on_rank_change").default(true),          // 排名變動
  notifyOnRewardIssued: boolean("notify_on_reward_issued").default(true),      // 獎勵發放
  notifyOnTierUpgrade: boolean("notify_on_tier_upgrade").default(true),        // 段位升級
  notifyOnDormancyWarning: boolean("notify_on_dormancy_warning").default(true), // 休眠警告

  // 通知冷卻（避免 spam）
  notificationCooldownHours: integer("notification_cooldown_hours").default(24),
  // 同類型通知至少間隔幾小時

  // === 休眠規則 ===
  dormancyDaysThreshold: integer("dormancy_days_threshold").default(30),        // 多少天無活動視為休眠
  dormancyWarningDays: jsonb("dormancy_warning_days").default(sql`'[3, 7, 14]'::jsonb`),
  // 休眠前 N 天送召回（[3, 7, 14] = 第 3、7、14 天送）

  // === 升級門檻（可覆蓋預設）===
  tierGamesThresholds: jsonb("tier_games_thresholds").default(sql`'{"newbie": 1, "active": 10, "veteran": 50, "legend": 100}'::jsonb`),

  // 元資訊
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFieldEngagementSettingsSchema = createInsertSchema(fieldEngagementSettings).omit({
  createdAt: true,
  updatedAt: true,
});

export type FieldEngagementSettings = typeof fieldEngagementSettings.$inferSelect;
export type InsertFieldEngagementSettings = typeof fieldEngagementSettings.$inferInsert;

// ============================================================================
// 2. notification_channels — 場域的通知管道設定（多管道）
// ============================================================================
export const notificationChannels = pgTable("notification_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldId: varchar("field_id").notNull(),

  channelType: varchar("channel_type", { length: 30 }).notNull(),
  // 'email' / 'line_notify' / 'line_oa' / 'discord_webhook' / 'social_webhook' / ...

  isActive: boolean("is_active").default(false).notNull(),

  // === 設定 (各 channel 不同)===
  config: jsonb("config").notNull(),
  // email: { fromAddress, smtpHost, smtpPort, ... }
  // line_notify: { token, displayName }
  // line_oa: { channelAccessToken, channelSecret, targetGroupId }
  // discord_webhook: { url }
  // social_webhook: { url, headers, payloadTemplate }

  // 統計
  sentCount: integer("sent_count").default(0),
  failedCount: integer("failed_count").default(0),
  lastSentAt: timestamp("last_sent_at"),
  lastErrorMessage: text("last_error_message"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_notify_field_active").on(table.fieldId, table.isActive),
]);

export const insertNotificationChannelSchema = createInsertSchema(notificationChannels).omit({
  id: true,
  sentCount: true,
  failedCount: true,
  createdAt: true,
  updatedAt: true,
});

// 注意：NotificationChannel type 命名衝突 → 用 EngagementChannel 區分
// （battle-notifications.ts 已有 NotificationChannel 為 enum 字串）
export type EngagementChannel = typeof notificationChannels.$inferSelect;
export type InsertEngagementChannel = typeof notificationChannels.$inferInsert;

// ============================================================================
// 3. notification_events — 已發出的通知紀錄（追蹤 + 防重複）
// ============================================================================
export const notificationEvents = pgTable("notification_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  fieldId: varchar("field_id"),
  squadId: varchar("squad_id"),
  userId: varchar("user_id"),

  eventType: varchar("event_type", { length: 50 }).notNull(),
  // 'first_game' / 'rank_change' / 'reward_issued' / 'tier_upgrade' / 'dormancy_warning' / ...

  channelType: varchar("channel_type", { length: 30 }).notNull(),

  status: varchar("status", { length: 20 }).default("pending").notNull(),
  // 'pending' / 'sent' / 'failed' / 'skipped'

  payload: jsonb("payload"),                    // 通知內容（標題、正文、深連結）
  errorMessage: text("error_message"),

  // 防重複（同類型 + 同 squad/user 在 cooldown 內不重發）
  dedupeKey: varchar("dedupe_key", { length: 200 }),

  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_notify_dedupe").on(table.dedupeKey),
  index("idx_notify_event_user").on(table.eventType, table.userId, table.sentAt.desc()),
  index("idx_notify_squad").on(table.squadId, table.createdAt.desc()),
]);

export const insertNotificationEventSchema = createInsertSchema(notificationEvents).omit({
  id: true,
  createdAt: true,
});

export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type InsertNotificationEvent = typeof notificationEvents.$inferInsert;

// ============================================================================
// Enums
// ============================================================================
export const channelTypeEnum = [
  "in_app",         // 站內通知（玩家中心）
  "email",          // Email
  "line_notify",    // LINE Notify（個人或群組）
  "line_oa",        // LINE Official Account（OA bot）
  "discord_webhook",
  "social_webhook", // 通用 webhook（社團、Slack 等）
] as const;
export type ChannelType = typeof channelTypeEnum[number];

export const welcomeModeEnum = ["auto", "manual", "hybrid"] as const;
export type WelcomeMode = typeof welcomeModeEnum[number];

export const welcomeCriteriaEnum = ["total_games", "rating", "recent_active"] as const;
export type WelcomeCriteria = typeof welcomeCriteriaEnum[number];

export const notificationEventTypeEnum = [
  "first_game",
  "rank_change",
  "reward_issued",
  "tier_upgrade",
  "dormancy_warning",
  "super_leader_promoted",
  "welcome_squad_assigned",
] as const;
export type NotificationEventType = typeof notificationEventTypeEnum[number];
