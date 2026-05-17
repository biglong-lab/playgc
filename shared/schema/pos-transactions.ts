// 💰 POS 交易紀錄 schema（2026-05-18）
//
// 統一紀錄所有 POS 收款：預約付款 / 散客現場 / 商品銷售 / 體驗加購
// 折抵紀錄：voucher_id + voucher_discount_cents

import { pgTable, varchar, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const posTransactions = pgTable(
  "pos_transactions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id").notNull(),
    /** 收款員 admin_id */
    staffId: varchar("staff_id").notNull(),
    /** 綁定的 booking（null = 散客現場購買）*/
    bookingId: integer("booking_id"),
    /** 對應的活動（散客也可以指定活動）*/
    activityId: varchar("activity_id"),
    /** 應收金額（分為單位）*/
    amountCents: integer("amount_cents").notNull(),
    /** 實收金額（折抵後）*/
    paidAmountCents: integer("paid_amount_cents").notNull(),
    /** 付款方式：cash | online_recur | online_stripe | linepay | voucher_full */
    paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
    /** 用了哪張券（折抵）*/
    voucherId: varchar("voucher_id"),
    voucherDiscountCents: integer("voucher_discount_cents").default(0),
    /** 散客可手填姓名 */
    customerName: varchar("customer_name", { length: 100 }),
    customerPhone: varchar("customer_phone", { length: 20 }),
    note: text("note"),
    /** 班次結算 id（結帳後不可改）*/
    shiftCloseId: varchar("shift_close_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pos_tx_field_date").on(table.fieldId, table.createdAt),
    index("idx_pos_tx_staff_date").on(table.staffId, table.createdAt),
    index("idx_pos_tx_booking").on(table.bookingId),
  ],
);

export type PosTransaction = typeof posTransactions.$inferSelect;
export type PosTransactionInsert = typeof posTransactions.$inferInsert;

export const POS_PAYMENT_METHODS = [
  "cash",
  "online_recur",
  "online_stripe",
  "linepay",
  "voucher_full",
] as const;
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];
