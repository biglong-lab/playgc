// 平台計費 (Platform Billing) - 平台對場域的交易記錄
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { fields } from "./fields";
import { fieldSubscriptions } from "./platform-plans";

// ============================================================================
// Enums
// ============================================================================

export const platformTxTypeEnum = [
  "subscription",       // 訂閱費（月/年）
  "transaction_fee",    // 交易抽成
  "addon",              // 加購功能
  "setup_fee",          // 開通費
  "refund",             // 退款
  "credit",             // 平台贈送點數
  "adjustment",         // 手動調整
] as const;
export type PlatformTxType = (typeof platformTxTypeEnum)[number];

export const platformTxStatusEnum = [
  "pending",   // 待付款
  "paid",      // 已付款
  "failed",    // 扣款失敗
  "refunded",  // 已退款
  "waived",    // 免除（贈送）
] as const;
export type PlatformTxStatus = (typeof platformTxStatusEnum)[number];

// ============================================================================
// Platform Transactions 表 - 平台對場域的收費交易
// ============================================================================

export const platformTransactions = pgTable(
  "platform_transactions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id")
      .references(() => fields.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 30 }).notNull(),

    // 金額
    amount: integer("amount").notNull(),     // NT$（可為負數 = 退款）
    currency: varchar("currency", { length: 10 }).default("TWD"),

    // 關聯
    subscriptionId: varchar("subscription_id").references(() => fieldSubscriptions.id),
    sourceTransactionId: varchar("source_transaction_id"), // 來源交易 ID（抽成時指向 purchases.id）
    invoiceNumber: varchar("invoice_number", { length: 50 }),

    // 狀態
    status: varchar("status", { length: 20 }).notNull().default("pending"),

    // 計費週期（訂閱費用）
    billingPeriodStart: timestamp("billing_period_start"),
    billingPeriodEnd: timestamp("billing_period_end"),

    // 說明
    description: text("description"),
    metadata: jsonb("metadata").default({}),

    // 時間
    paidAt: timestamp("paid_at"),
    dueAt: timestamp("due_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_platform_transactions_field").on(table.fieldId),
    index("idx_platform_transactions_type").on(table.type),
    index("idx_platform_transactions_status").on(table.status),
    index("idx_platform_transactions_sub").on(table.subscriptionId),
    index("idx_platform_transactions_source").on(table.sourceTransactionId),
    index("idx_platform_transactions_due").on(table.dueAt),
    index("idx_platform_transactions_created").on(table.createdAt),
  ]
);

// ============================================================================
// Zod Schemas & Types
// ============================================================================

export const insertPlatformTransactionSchema = createInsertSchema(platformTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlatformTransaction = z.infer<typeof insertPlatformTransactionSchema>;
export type PlatformTransaction = typeof platformTransactions.$inferSelect;
