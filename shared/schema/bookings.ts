// 預約系統 (Bookings) — Phase δ W1 D1
//
// 範圍：
//   - booking_configs    每個場域的預約設定（時段模板、付費規則、取消政策）
//   - bookings           實際預約紀錄
//   - booking_blackouts  業主臨時關閉的時段
//   - notification_templates  通知訊息模板（業主可自訂內容）
//
// 設計決策：
//   - 不預先生成 booking_slots — 場次靠 schedule_template 動態算（一年也才 8000 個 slot、不需 ETL）
//   - schedule_template 用 jsonb — 業主可自訂彈性、未來不重做 schema
//   - line_user_id 直接放 bookings 表 — 玩家 PII 由我方管（呼應 coupon 整合的隱私分隔）
//   - payment 欄位都有但可空 — 第一期免費、未來收費不重工
//   - game_session_id 關聯 — 預約完成可關聯到實際遊戲 session

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  serial,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// schedule_template 結構（存於 booking_configs.schedule_template）
// ============================================================================

/**
 * 單一時段定義（一個 daily 區段）
 *
 * 例：賈村平日 14:00-18:00 每 30 分一梯每梯 12 人
 *   { startTime: "14:00", endTime: "18:00", intervalMinutes: 30,
 *     capacity: 12, gameDurationMinutes: 30 }
 *
 * endTime 表示「最後一梯結束時間」，因此最後一梯開始時間 = endTime − gameDurationMinutes
 */
export interface BookingSlotWindow {
  /** 24 小時格式 "HH:MM" */
  startTime: string;
  /** 24 小時格式 "HH:MM" */
  endTime: string;
  /** 兩梯次間隔（分鐘） */
  intervalMinutes: number;
  /** 每梯最大人數 */
  capacity: number;
  /** 單次遊戲時長（分鐘） */
  gameDurationMinutes: number;
}

/**
 * 場域預約時段模板
 *
 * - weekday/weekend：基本兩種模板
 * - customDays：特定日期覆寫（例如國定假日特殊安排）
 * - blackoutDates：完全關閉（休假日）
 */
export interface BookingScheduleTemplate {
  /** 平日時段（週一到週五） */
  weekday: BookingSlotWindow[];
  /** 假日時段（週六、週日） */
  weekend: BookingSlotWindow[];
  /** 國定假日視為假日（true）或平日（false） */
  treatHolidaysAsWeekend?: boolean;
  /** 特定日期專案安排：{ "2026-05-15": [...] } */
  customDays?: Record<string, BookingSlotWindow[]>;
  /** 完全關閉的日期 ["2026-05-10", ...] */
  blackoutDates?: string[];
  /** 賈村預設模組可附帶其他需求注記 */
  notes?: string;
}

// ============================================================================
// booking_configs — 場域預約設定（每場域一筆）
// ============================================================================

export const bookingConfigs = pgTable(
  "booking_configs",
  {
    id: serial("id").primaryKey(),
    fieldId: varchar("field_id", { length: 50 }).notNull().unique(), // → fields.id
    /** 是否啟用預約功能 */
    isEnabled: boolean("is_enabled").notNull().default(true),
    /** 是否需付費 */
    isPaid: boolean("is_paid").notNull().default(false),
    /** 單梯次費用（分為單位、TWD 表示 NT$ × 100） */
    pricePerSlotCents: integer("price_per_slot_cents").notNull().default(0),
    currency: varchar("currency", { length: 8 }).notNull().default("TWD"),
    /** 是否可取消 */
    cancellable: boolean("cancellable").notNull().default(true),
    /** 取消最晚時限（開始前 N 分鐘）；0 = 隨時可取消 */
    cancelBeforeMinutes: integer("cancel_before_minutes").notNull().default(0),
    /** LINE 提醒推播時機（開始前 N 分鐘）；0 = 不提醒 */
    reminderMinutesBefore: integer("reminder_minutes_before").notNull().default(30),
    /** 場次模板（彈性 JSON） */
    scheduleTemplate: jsonb("schedule_template")
      .$type<BookingScheduleTemplate>()
      .notNull(),
    /** 業主備註（私人筆記） */
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    fieldIdx: index("idx_booking_configs_field").on(t.fieldId),
  }),
);

export const insertBookingConfigSchema = createInsertSchema(bookingConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BookingConfig = typeof bookingConfigs.$inferSelect;
export type InsertBookingConfig = z.infer<typeof insertBookingConfigSchema>;

// ============================================================================
// bookings — 實際預約紀錄
// ============================================================================

export const bookingStatusEnum = [
  "pending",      // 已建立、待確認 / 待付款
  "confirmed",    // 已確認、進行中
  "cancelled",    // 已取消
  "completed",    // 已完成（可能與 game_session 關聯）
  "no_show",      // 沒到場
] as const;
export type BookingStatus = (typeof bookingStatusEnum)[number];

export const paymentStatusEnum = [
  "none",         // 不需付款
  "pending",      // 待付款
  "paid",         // 已付款
  "refunded",     // 已退款
  "failed",       // 付款失敗
] as const;
export type PaymentStatus = (typeof paymentStatusEnum)[number];

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    /** 玩家可見的短碼（如 BK7K3M）— 6 字元、code-friendly */
    bookingCode: varchar("booking_code", { length: 12 }).notNull().unique(),
    fieldId: varchar("field_id", { length: 50 }).notNull(),
    // ── 玩家身份（PII） ──────────────────────────────
    lineUserId: varchar("line_user_id", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    // ── 預約時段 ───────────────────────────────────
    slotStart: timestamp("slot_start", { withTimezone: true }).notNull(),
    slotEnd: timestamp("slot_end", { withTimezone: true }).notNull(),
    /** 此預約佔用的人數（一個 slot 容量 12、可由家庭一次預 4 人） */
    partySize: integer("party_size").notNull().default(1),
    // ── 狀態 ─────────────────────────────────────
    status: varchar("status", { length: 20 }).notNull().default("confirmed"),
    // ── 付費 ─────────────────────────────────────
    paymentRequired: boolean("payment_required").notNull().default(false),
    paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("none"),
    paymentMethod: varchar("payment_method", { length: 20 }), // recur_tw / stripe
    paymentId: varchar("payment_id", { length: 80 }),
    amountCents: integer("amount_cents").notNull().default(0),
    // ── LINE 通知 trace ────────────────────────────
    /** 預約成功通知已寄出 */
    confirmNotifiedAt: timestamp("confirm_notified_at", { withTimezone: true }),
    /** 30 分鐘前提醒已寄出 */
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    /** 遊戲完成通知已寄出 */
    completedNotifiedAt: timestamp("completed_notified_at", { withTimezone: true }),
    // ── 取消 ─────────────────────────────────────
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    cancelledByAdmin: boolean("cancelled_by_admin").notNull().default(false),
    // ── 留言 ─────────────────────────────────────
    /** 玩家在預約時填的特殊需求 */
    customerNote: text("customer_note"),
    /** 業主處理紀錄（私人） */
    adminNote: text("admin_note"),
    // ── 整合遊戲 ──────────────────────────────────
    /** 預約對應的實際遊戲 session（玩家現場進場後關聯） */
    gameSessionId: integer("game_session_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    fieldSlotIdx: index("idx_bookings_field_slot").on(t.fieldId, t.slotStart),
    userIdx: index("idx_bookings_line_user").on(t.lineUserId),
    statusIdx: index("idx_bookings_status").on(t.status),
    codeIdx: index("idx_bookings_code").on(t.bookingCode),
  }),
);

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  bookingCode: true, // 後端產
  createdAt: true,
  updatedAt: true,
});
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

// ============================================================================
// booking_blackouts — 業主臨時關閉時段
// ============================================================================

export const bookingBlackouts = pgTable(
  "booking_blackouts",
  {
    id: serial("id").primaryKey(),
    fieldId: varchar("field_id", { length: 50 }).notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    fieldStartIdx: index("idx_blackouts_field_start").on(t.fieldId, t.startAt),
  }),
);

export const insertBookingBlackoutSchema = createInsertSchema(bookingBlackouts).omit({
  id: true,
  createdAt: true,
});
export type BookingBlackout = typeof bookingBlackouts.$inferSelect;
export type InsertBookingBlackout = z.infer<typeof insertBookingBlackoutSchema>;

// ============================================================================
// booking_notification_templates — 預約通知訊息模板（業主可自訂內容）
//   獨立於 notifications.ts 的平台通用 notification_templates、避免命名衝突
// ============================================================================

export const bookingNotificationTemplateKeyEnum = [
  "booking_confirmed",     // 預約成功
  "reminder_30min",        // 開始前 N 分鐘提醒
  "game_start_keyword",    // 「現場引導客人傳關鍵字」對應的回覆
  "game_completed",        // 遊戲結束送訊息（連結 / 圖片 / 優惠券）
  "booking_cancelled",     // 取消通知
] as const;
export type BookingNotificationTemplateKey = (typeof bookingNotificationTemplateKeyEnum)[number];

export const bookingBookingNotificationTemplates = pgTable(
  "booking_notification_templates",
  {
    id: serial("id").primaryKey(),
    fieldId: varchar("field_id", { length: 50 }).notNull(),
    /** 模板鍵值（見 bookingNotificationTemplateKeyEnum） */
    templateKey: varchar("template_key", { length: 40 }).notNull(),
    /** 純文字訊息（含變數 placeholder：{playerName} {slotTime} {bookingCode}） */
    messageText: text("message_text").notNull(),
    /** 可選：LINE Flex Message JSON（覆蓋純文字） */
    flexMessageJson: jsonb("flex_message_json").$type<Record<string, unknown>>(),
    /** 可選：附帶連結（活動連結、優惠券連結） */
    actionUrl: text("action_url"),
    /** 可選：附帶圖片 URL */
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    fieldKeyIdx: index("idx_notif_templates_field_key").on(t.fieldId, t.templateKey),
  }),
);

export const insertBookingNotificationTemplateSchema = createInsertSchema(bookingBookingNotificationTemplates).omit({
  id: true,
  updatedAt: true,
});
export type BookingNotificationTemplate = typeof bookingBookingNotificationTemplates.$inferSelect;
export type InsertBookingNotificationTemplate = z.infer<typeof insertBookingNotificationTemplateSchema>;

// ============================================================================
// 賈村預設配置（種子資料用）
// ============================================================================

/**
 * 賈村模組一預設預約設定：
 *   - 平日 14:00-18:00 / 假日 10:00-18:00
 *   - 每 30 分鐘一梯次、每梯 12 人
 *   - 預設免費、可隨時取消、開始前 30 分鐘提醒
 */
export const JIACUN_DEFAULT_SCHEDULE: BookingScheduleTemplate = {
  weekday: [
    {
      startTime: "14:00",
      endTime: "18:00",
      intervalMinutes: 30,
      capacity: 12,
      gameDurationMinutes: 30,
    },
  ],
  weekend: [
    {
      startTime: "10:00",
      endTime: "18:00",
      intervalMinutes: 30,
      capacity: 12,
      gameDurationMinutes: 30,
    },
  ],
  treatHolidaysAsWeekend: true,
  notes: "其他需求請在預約備註留言、業主將討論專案處理",
};
