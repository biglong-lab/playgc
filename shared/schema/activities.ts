// 🎯 多活動商品 schema（2026-05-18）
//
// 一館多活動：射擊體驗 / 水彈對戰 / 實境闖關 / 文化導覽…
// 每個活動有獨立的封面、定價、時段、capacity、付款模式
//
// 與既有 booking_configs 共存：
//   - bookings.activityId nullable → 既有預約 activityId=null
//   - 場域有 activities → 玩家走多活動分流
//   - 場域沒 activities → fallback 既有單一 booking_configs

import { pgTable, varchar, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const activities = pgTable(
  "activities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id").notNull(),
    /** URL slug（/book/JIACHUN/shooting）*/
    slug: varchar("slug", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    /** 卡片摘要（列表顯示） */
    shortDesc: varchar("short_desc", { length: 200 }),
    /** 詳細頁說明（Markdown / plain text）*/
    description: text("description"),
    /** Cloudinary URL — LINE Flex hero + 預約頁 hero */
    coverUrl: text("cover_url"),
    /** 集合地點說明 */
    locationNote: text("location_note"),
    /** 單人單梯費用（分為單位、避免浮點）*/
    priceCents: integer("price_cents").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("TWD"),
    /** 活動時長（分鐘）*/
    durationMinutes: integer("duration_minutes").notNull().default(60),
    /** 單梯次最大人數 */
    capacityPerSlot: integer("capacity_per_slot").notNull().default(1),
    /** 付款模式：online | onsite | both */
    paymentMode: varchar("payment_mode", { length: 20 }).notNull().default("onsite"),
    /** 是否啟用（前台顯示）*/
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_activities_field_slug").on(table.fieldId, table.slug),
    index("idx_activities_field_active").on(table.fieldId, table.isActive),
  ],
);

export const activitySchedules = pgTable("activity_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: varchar("activity_id").notNull(),
  /** 時段模板（同 booking_configs.scheduleTemplate 結構）*/
  scheduleTemplate: jsonb("schedule_template").notNull(),
  cancellable: boolean("cancellable").default(true),
  cancelBeforeMinutes: integer("cancel_before_minutes").default(120),
  reminderMinutesBefore: integer("reminder_minutes_before").default(30),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Activity = typeof activities.$inferSelect;
export type ActivityInsert = typeof activities.$inferInsert;
export type ActivitySchedule = typeof activitySchedules.$inferSelect;

/** payment mode 列舉（型別輔助） */
export const ACTIVITY_PAYMENT_MODES = ["online", "onsite", "both"] as const;
export type ActivityPaymentMode = (typeof ACTIVITY_PAYMENT_MODES)[number];
