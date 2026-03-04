// 水彈對戰 PK 擂台 — 通知系統 Schema
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { users } from "./users";
import { battleSlots } from "./battle-slots";

// ============================================================================
// 通知類型列舉
// ============================================================================
export const notificationTypeEnum = [
  "slot_confirmed",     // 時段已成局
  "reminder_24h",       // 活動前 24 小時提醒
  "reminder_2h",        // 活動前 2 小時提醒
  "confirm_request",    // 請求確認出席
  "team_assigned",      // 分隊結果通知
  "check_in_open",      // 報到開放通知
  "slot_cancelled",     // 時段取消通知
  "result_published",   // 對戰結果公布
  "clan_invite",        // 戰隊邀請
] as const;
export type NotificationType = typeof notificationTypeEnum[number];

export const notificationChannelEnum = ["in_app", "push", "email"] as const;
export type NotificationChannel = typeof notificationChannelEnum[number];

export const notificationStatusEnum = ["pending", "sent", "read", "failed"] as const;
export type NotificationStatus = typeof notificationStatusEnum[number];

/** 通知類型中文標籤 */
export const notificationTypeLabels: Record<NotificationType, string> = {
  slot_confirmed: "場次成局",
  reminder_24h: "明日提醒",
  reminder_2h: "即將開始",
  confirm_request: "確認出席",
  team_assigned: "分隊結果",
  check_in_open: "開放報到",
  slot_cancelled: "場次取消",
  result_published: "結果公布",
  clan_invite: "戰隊邀請",
};

// ============================================================================
// 通知內容介面
// ============================================================================
export interface NotificationContent {
  title: string;
  body: string;
  /** 點擊通知後跳轉的路徑 */
  actionUrl?: string;
  /** 額外資料（場地名稱、時段時間等） */
  meta?: Record<string, string | number>;
}

// ============================================================================
// 通知記錄表
// ============================================================================
export const battleNotifications = pgTable("battle_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: varchar("slot_id").references(() => battleSlots.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 30 }).notNull(),
  channel: varchar("channel", { length: 20 }).notNull().default("in_app"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  content: jsonb("content").$type<NotificationContent>().notNull(),
  isRead: boolean("is_read").notNull().default(false),
  scheduledAt: timestamp("scheduled_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_battle_notif_user_status").on(table.userId, table.status),
  index("idx_battle_notif_user_read").on(table.userId, table.isRead),
  index("idx_battle_notif_scheduled").on(table.scheduledAt, table.status),
  index("idx_battle_notif_slot").on(table.slotId),
]);

// ============================================================================
// Zod 驗證
// ============================================================================
export const notificationContentSchema = z.object({
  title: z.string().max(100),
  body: z.string().max(500),
  actionUrl: z.string().max(200).optional(),
  meta: z.record(z.union([z.string(), z.number()])).optional(),
});

// ============================================================================
// Type exports
// ============================================================================
export type BattleNotification = typeof battleNotifications.$inferSelect;
export type InsertBattleNotification = typeof battleNotifications.$inferInsert;
