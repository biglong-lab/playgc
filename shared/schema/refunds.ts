// 退款記錄 (Refunds) — 2026-05-19 Phase D
//
// 範圍：
//   - cash 退款（業主現場退錢、系統只記錄）← 本期實作
//   - 線上退款（Recur.tw / Stripe）← 等業主商戶帳號後接 API
//
// 設計：
//   - 一筆 booking / pos_transaction 可能有 多次部分退款 → 用 amount_cents 累計
//   - status 預設 pending、cash 可立即標 completed、線上等 API callback
//   - 必填 reason、留 audit trail（processed_by_staff_id + processed_at）

import { sql } from "drizzle-orm";
import { pgTable, serial, varchar, integer, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const refundMethodEnum = ["cash", "recur", "stripe", "linepay", "manual_adjust"] as const;
export type RefundMethod = (typeof refundMethodEnum)[number];

export const refundStatusEnum = ["pending", "completed", "failed", "cancelled"] as const;
export type RefundStatus = (typeof refundStatusEnum)[number];

export const refunds = pgTable(
  "refunds",
  {
    id: serial("id").primaryKey(),
    fieldId: varchar("field_id", { length: 50 }).notNull(),
    /** 來源交易（必填、可關聯 pos_transactions.id 或 bookings.bookingCode）*/
    sourceType: varchar("source_type", { length: 20 }).notNull(), // pos_transaction / booking
    sourceId: varchar("source_id", { length: 100 }).notNull(),
    /** 連動 booking（可選）*/
    bookingId: integer("booking_id"),
    /** 退款金額（cents）*/
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("TWD"),
    /** 必填原因 */
    reason: text("reason").notNull(),
    /** 退款方式 */
    refundMethod: varchar("refund_method", { length: 20 }).notNull(),
    /** 狀態 */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** 處理員 admin id */
    processedByStaffId: varchar("processed_by_staff_id").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    /** 客戶資訊（給 cash 退款表單記） */
    customerName: varchar("customer_name", { length: 100 }),
    customerPhone: varchar("customer_phone", { length: 20 }),
    /** 線上金流 callback metadata 用 */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    fieldIdx: index("idx_refunds_field").on(t.fieldId),
    bookingIdx: index("idx_refunds_booking").on(t.bookingId),
    sourceIdx: index("idx_refunds_source").on(t.sourceType, t.sourceId),
    statusIdx: index("idx_refunds_status").on(t.status),
  }),
);

export const insertRefundSchema = createInsertSchema(refunds).omit({
  id: true,
  createdAt: true,
});
export type Refund = typeof refunds.$inferSelect;
export type InsertRefund = z.infer<typeof insertRefundSchema>;
