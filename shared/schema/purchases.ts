// 購買/票券系統 (Purchases) - 兌換碼、購買記錄、金流交易
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { games } from "./games";
import { gameChapters } from "./chapters";
import { fields } from "./fields";

// ============================================================================
// Enums
// ============================================================================

export const redeemCodeStatusEnum = [
  "active",
  "used",
  "expired",
  "disabled",
] as const;
export type RedeemCodeStatus = (typeof redeemCodeStatusEnum)[number];

export const redeemCodeScopeEnum = ["game", "chapter"] as const;
export type RedeemCodeScope = (typeof redeemCodeScopeEnum)[number];

export const purchaseTypeEnum = [
  "redeem_code",
  "cash_payment",
  "online_payment",
  "in_game_points",
] as const;
export type PurchaseType = (typeof purchaseTypeEnum)[number];

export const purchaseStatusEnum = [
  "pending",
  "completed",
  "failed",
  "refunded",
] as const;
export type PurchaseStatus = (typeof purchaseStatusEnum)[number];

// ============================================================================
// Redeem Codes 表 - 兌換碼
// ============================================================================

export const redeemCodes = pgTable(
  "redeem_codes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    code: varchar("code", { length: 20 }).notNull().unique(),
    fieldId: varchar("field_id")
      .references(() => fields.id)
      .notNull(),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    chapterId: varchar("chapter_id").references(() => gameChapters.id, {
      onDelete: "cascade",
    }),
    scope: varchar("scope", { length: 20 }).notNull(),
    maxUses: integer("max_uses").default(1),
    usedCount: integer("used_count").default(0),
    expiresAt: timestamp("expires_at"),
    status: varchar("status", { length: 20 }).default("active"),
    label: varchar("label", { length: 200 }),
    createdBy: varchar("created_by"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_redeem_codes_game").on(table.gameId),
    index("idx_redeem_codes_field").on(table.fieldId),
    index("idx_redeem_codes_status").on(table.status),
  ]
);

// ============================================================================
// Redeem Code Uses 表 - 兌換碼使用紀錄
// ============================================================================

export const redeemCodeUses = pgTable(
  "redeem_code_uses",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    codeId: varchar("code_id")
      .references(() => redeemCodes.id)
      .notNull(),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    redeemedAt: timestamp("redeemed_at").defaultNow(),
  },
  (table) => [
    index("idx_code_uses_code").on(table.codeId),
    index("idx_code_uses_user").on(table.userId),
    uniqueIndex("idx_code_uses_unique").on(table.codeId, table.userId),
  ]
);

// ============================================================================
// Purchases 表 - 購買記錄（兌換碼 + 現金 + 線上付費統一紀錄）
// ============================================================================

export const purchases = pgTable(
  "purchases",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    chapterId: varchar("chapter_id").references(() => gameChapters.id, {
      onDelete: "cascade",
    }),
    purchaseType: varchar("purchase_type", { length: 20 }).notNull(),
    amount: integer("amount").default(0),
    currency: varchar("currency", { length: 10 }).default("TWD"),
    status: varchar("status", { length: 20 }).default("pending"),
    redeemCodeId: varchar("redeem_code_id").references(() => redeemCodes.id),
    transactionId: varchar("transaction_id"),
    grantedBy: varchar("granted_by"),
    note: text("note"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_purchases_user").on(table.userId),
    index("idx_purchases_game").on(table.gameId),
    index("idx_purchases_status").on(table.status),
  ]
);

// ============================================================================
// Payment Transactions 表 - 金流交易記錄（Phase B: Recur.tw）
// ============================================================================

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    recurCheckoutSessionId: varchar("recur_checkout_session_id", {
      length: 200,
    }),
    recurPaymentId: varchar("recur_payment_id", { length: 200 }),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    gameId: varchar("game_id")
      .references(() => games.id)
      .notNull(),
    chapterId: varchar("chapter_id").references(() => gameChapters.id),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 10 }).default("TWD"),
    status: varchar("status", { length: 20 }).default("pending"),
    recurRawResponse: jsonb("recur_raw_response"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_transactions_user").on(table.userId),
    index("idx_transactions_recur_session").on(table.recurCheckoutSessionId),
    index("idx_transactions_status").on(table.status),
  ]
);

// ============================================================================
// Schemas & Types
// ============================================================================

export const insertRedeemCodeSchema = createInsertSchema(redeemCodes).omit({
  id: true,
  usedCount: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRedeemCode = z.infer<typeof insertRedeemCodeSchema>;
export type RedeemCode = typeof redeemCodes.$inferSelect;

export const insertRedeemCodeUseSchema = createInsertSchema(
  redeemCodeUses
).omit({
  id: true,
  redeemedAt: true,
});
export type InsertRedeemCodeUse = z.infer<typeof insertRedeemCodeUseSchema>;
export type RedeemCodeUse = typeof redeemCodeUses.$inferSelect;

export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
  createdAt: true,
});
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;

export const insertPaymentTransactionSchema = createInsertSchema(
  paymentTransactions
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentTransaction = z.infer<
  typeof insertPaymentTransactionSchema
>;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
