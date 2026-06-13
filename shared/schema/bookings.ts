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
 * 規則適用範圍 — 哪些日期 match 此規則
 *
 * 多個 condition 同時設定時、屬於 OR 關係（任一 match 即套用）
 *
 * 範例：
 *   - "週一到週五同樣時段" → { weekdays: [1,2,3,4,5] }
 *   - "六日同樣時段"        → { weekdays: [0, 6] }
 *   - "暑假特別時段"        → { dateRanges: [{ from: "2026-07-01", to: "2026-08-31" }] }
 *   - "週三+特定幾天"       → { weekdays: [3], specificDates: ["2026-05-15", "2026-06-01"] }
 *   - "整個 5 月"           → { dateRanges: [{ from: "2026-05-01", to: "2026-05-31" }] }
 */
export interface BookingApplyRange {
  /** 個別週天：0=週日, 1=週一, ..., 6=週六 */
  weekdays?: number[];
  /** 日期區間（YYYY-MM-DD）*/
  dateRanges?: { from: string; to: string }[];
  /** 特定日期（YYYY-MM-DD）— 用於日曆勾選的多日選擇 */
  specificDates?: string[];
  /** 國定假日是否視為週六日的範疇（影響 weekdays:[0,6] 判定）*/
  treatHolidaysAsWeekend?: boolean;
}

/**
 * 單一預約規則
 *
 * 業主可建多條規則、用 priority 解決衝突。
 * 例：
 *   - rule A: 平日 14-18 / 12 人 / NT$300（priority 0、預設）
 *   - rule B: 假日 10-18 / 12 人 / NT$500（priority 0、預設）
 *   - rule C: 暑假 (7/1-8/31) 全天 9-21 / 16 人 / NT$700（priority 50、覆蓋）
 *   - rule D: 老闆生日 8/15 完全關閉（priority 100）
 *
 * 同一天多條規則 match 時、取 priority 最高者。
 */
export interface BookingRule {
  /** 規則唯一 ID（UI 用、可隨機產）*/
  id: string;
  /** 規則名稱（業主自取、UI 顯示用）*/
  name: string;
  /** 優先級（數字越大越優先；同優先級依新 → 舊）*/
  priority: number;
  /** 是否啟用（暫關此規則但不刪）*/
  enabled: boolean;
  /** 適用範圍 */
  applyTo: BookingApplyRange;
  /** 此規則的時段安排（空陣列 = 此天完全關閉、不開放預約）*/
  slots: BookingSlotWindow[];
  /** 此規則的單梯費用（覆蓋 booking_configs.pricePerSlotCents；undefined = 用 config 預設）*/
  pricePerSlotCentsOverride?: number;
  /** 此規則的容量（覆蓋 slots 內的 capacity；undefined = 用 slots 各自設定）*/
  capacityOverride?: number;
  /** 業主備註（私人）*/
  adminNotes?: string;
}

/**
 * 場域預約時段模板（rule-based）
 *
 * 設計目的：支援業主彈性自訂、UI 對應日曆勾選 + 批次設定
 *
 * 解析優先序（給定日期 X）：
 *   1. blackoutDates 包含 X → 關閉
 *   2. 過濾 enabled rules 中 applyTo match X 的
 *   3. 取 priority 最高者（同 priority 取最後新增）
 *   4. 若無任何 rule match → 此天無時段（不開放）
 *   5. 若 match rule 的 slots 為空 → 此天關閉（rule 主動標記休假日）
 */
export interface BookingScheduleTemplate {
  /** 規則陣列（業主在 admin 後台用日曆勾選 + 批次設定產生）*/
  rules: BookingRule[];
  /** 完全關閉的特定日期（休假、突發狀況、優先度最高）*/
  blackoutDates?: string[];
  /** 全域備註（顯示於預約頁底部）*/
  notes?: string;
  /** schema 版本 — 未來擴充時 backward-compat 標記 */
  version?: number;
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
    /**
     * 🆕 2026-06-13 預約來源：
     *   line_direct   = 顧客自己在 LINE 直訂
     *   manual        = 現場人工建單（電話/信箱/現場），未綁 LINE
     *   manual_linked = 人工建單後，顧客已透過短連結綁定 LINE
     */
    source: varchar("source", { length: 20 }).default("line_direct"),
    // ── 整合遊戲 ──────────────────────────────────
    /** 預約對應的實際遊戲 session（玩家現場進場後關聯） */
    gameSessionId: integer("game_session_id"),
    // ── 🆕 2026-05-18 多活動 + POS 整合 ──────────────
    /** 對應 activities.id（null = 舊版單一預約配置）*/
    activityId: varchar("activity_id"),
    /** 付款模式：online | onsite | both（同 activities.paymentMode）*/
    paymentMode: varchar("payment_mode", { length: 20 }).default("onsite"),
    /** 線下收款員 admin id */
    paidByStaffId: varchar("paid_by_staff_id"),
    /** 實際收款時間（onsite 收款後填）*/
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** 實收金額（用券折抵後的金額）*/
    paidAmountCents: integer("paid_amount_cents"),
    /** POS 掃描專用 token（不只是 bookingCode、加 random suffix 防猜）*/
    qrToken: varchar("qr_token", { length: 64 }),
    /** 玩家到場時間 */
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    /** 報到員 admin id */
    checkedInByStaffId: varchar("checked_in_by_staff_id"),
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

export const bookingNotificationTemplates = pgTable(
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

export const insertBookingNotificationTemplateSchema = createInsertSchema(bookingNotificationTemplates).omit({
  id: true,
  updatedAt: true,
});
export type BookingNotificationTemplate = typeof bookingNotificationTemplates.$inferSelect;
export type InsertBookingNotificationTemplate = z.infer<typeof insertBookingNotificationTemplateSchema>;

// ============================================================================
// 賈村預設配置（種子資料用、示範 rule-based 用法）
// ============================================================================

/**
 * 賈村模組一預設預約設定（rule-based 表達）：
 *   - rule A: 平日（一二三四五）14-18 / 30 分一梯 / 12 人
 *   - rule B: 假日（六日）10-18 / 30 分一梯 / 12 人
 *   - 國定假日視為假日
 *   - 預設免費、可隨時取消、開始前 30 分鐘提醒
 */
export const JIACUN_DEFAULT_SCHEDULE: BookingScheduleTemplate = {
  version: 1,
  rules: [
    {
      id: "default-weekday",
      name: "平日（一到五）",
      priority: 0,
      enabled: true,
      applyTo: { weekdays: [1, 2, 3, 4, 5] },
      slots: [
        {
          startTime: "14:00",
          endTime: "18:00",
          intervalMinutes: 30,
          capacity: 12,
          gameDurationMinutes: 30,
        },
      ],
    },
    {
      id: "default-weekend",
      name: "假日（六日）",
      priority: 0,
      enabled: true,
      applyTo: { weekdays: [0, 6], treatHolidaysAsWeekend: true },
      slots: [
        {
          startTime: "10:00",
          endTime: "18:00",
          intervalMinutes: 30,
          capacity: 12,
          gameDurationMinutes: 30,
        },
      ],
    },
  ],
  notes: "其他需求請在預約備註留言、業主將討論專案處理",
};
