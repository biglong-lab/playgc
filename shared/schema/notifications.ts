// 📬 通訊中心 schema
//
// 統一管理：通知模板 + 發送紀錄
// 通道：email / fcm / line / telegram / webpush
import { pgTable, varchar, text, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const platformNotificationChannelEnum = ["email", "fcm", "line", "telegram", "webpush"] as const;
export type PlatformNotificationChannel = (typeof platformNotificationChannelEnum)[number];

export const platformNotificationStatusEnum = ["pending", "sent", "failed", "skipped"] as const;
export type PlatformNotificationStatus = (typeof platformNotificationStatusEnum)[number];

// ============================================================================
// notification_templates — 訊息模板
// ============================================================================
export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    templateKey: varchar("template_key", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 50 }).default("general"), // billing/security/support/general
    channels: jsonb("channels").default([]), // ["email", "line"...]
    subject: varchar("subject", { length: 500 }), // email/title 用
    body: text("body").notNull(), // 訊息本體（支援 {{variable}} 替換）
    variables: jsonb("variables").default([]), // 可用變數列表
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_notification_templates_key").on(table.templateKey),
    index("idx_notification_templates_category").on(table.category),
  ]
);

// ============================================================================
// notification_logs — 發送紀錄
// ============================================================================
export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    templateKey: varchar("template_key", { length: 100 }),
    channel: varchar("channel", { length: 20 }).notNull(),
    recipient: varchar("recipient", { length: 500 }).notNull(), // email / token / chat_id
    subject: varchar("subject", { length: 500 }),
    body: text("body"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    error: text("error"),
    metadata: jsonb("metadata").default({}),
    triggeredBy: varchar("triggered_by"), // admin id / system / api
    relatedTargetType: varchar("related_target_type", { length: 50 }),
    relatedTargetId: varchar("related_target_id"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_notification_logs_status_created").on(table.status, table.createdAt),
    index("idx_notification_logs_channel").on(table.channel),
    index("idx_notification_logs_recipient").on(table.recipient),
    index("idx_notification_logs_template").on(table.templateKey),
  ]
);

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NotificationLog = typeof notificationLogs.$inferSelect;
