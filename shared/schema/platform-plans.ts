// 平台訂閱方案 (Platform Plans) - SaaS 訂閱方案與場域訂閱狀態
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { fields } from "./fields";

// ============================================================================
// Enums
// ============================================================================

export const planCodeEnum = ["free", "pro", "enterprise", "revshare"] as const;
export type PlanCode = (typeof planCodeEnum)[number];

export const subscriptionStatusEnum = [
  "trial",       // 試用中
  "active",      // 正常訂閱
  "past_due",    // 逾期未繳
  "canceled",    // 已取消
  "suspended",   // 平台停權
] as const;
export type SubscriptionStatus = (typeof subscriptionStatusEnum)[number];

// ============================================================================
// Platform Plans 表 - 訂閱方案定義
// ============================================================================

export const platformPlans = pgTable(
  "platform_plans",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    code: varchar("code", { length: 50 }).notNull().unique(), // 'free' | 'pro' | 'enterprise' | 'revshare'
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // 計費
    monthlyPrice: integer("monthly_price").default(0), // NT$ 月費
    yearlyPrice: integer("yearly_price"),              // NT$ 年費（null = 不提供）
    transactionFeePercent: decimal("transaction_fee_percent", { precision: 5, scale: 2 }).default("0"), // 交易抽成 %

    // 限制 (JSON 儲存彈性欄位)
    // { maxGames: -1, maxCheckoutsPerMonth: 1000, maxAdmins: 5, maxStorageGb: 10 }
    limits: jsonb("limits").default({}),

    // 功能列表 (PostgreSQL 陣列)
    // ['battle_system', 'ai_key_byo', 'custom_brand', 'email_notify', ...]
    features: text("features").array().default([]),

    // 狀態
    status: varchar("status", { length: 20 }).default("active"), // 'active' | 'archived'
    sortOrder: integer("sort_order").default(0),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_platform_plans_code").on(table.code),
    index("idx_platform_plans_status").on(table.status),
  ]
);

// ============================================================================
// Field Subscriptions 表 - 場域訂閱狀態（每場域一筆）
// ============================================================================

export const fieldSubscriptions = pgTable(
  "field_subscriptions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id")
      .references(() => fields.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    planId: varchar("plan_id")
      .references(() => platformPlans.id)
      .notNull(),

    // 狀態
    status: varchar("status", { length: 20 }).notNull().default("trial"),

    // 時間
    startedAt: timestamp("started_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    trialEndsAt: timestamp("trial_ends_at"),
    canceledAt: timestamp("canceled_at"),

    // 帳務
    billingCycle: varchar("billing_cycle", { length: 20 }).default("monthly"), // 'monthly' | 'yearly'
    nextBillingAt: timestamp("next_billing_at"),
    lastPaidAt: timestamp("last_paid_at"),

    // 個別覆寫（特殊客戶可調整）
    customLimits: jsonb("custom_limits").default({}), // 覆寫 plan.limits
    customFeePercent: decimal("custom_fee_percent", { precision: 5, scale: 2 }), // 覆寫抽成 %

    // 備註
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_field_subscriptions_field").on(table.fieldId),
    index("idx_field_subscriptions_plan").on(table.planId),
    index("idx_field_subscriptions_status").on(table.status),
    index("idx_field_subscriptions_billing").on(table.nextBillingAt),
  ]
);

// ============================================================================
// Zod Schemas & Types
// ============================================================================

export const insertPlatformPlanSchema = createInsertSchema(platformPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlatformPlan = z.infer<typeof insertPlatformPlanSchema>;
export type PlatformPlan = typeof platformPlans.$inferSelect;

export const insertFieldSubscriptionSchema = createInsertSchema(fieldSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFieldSubscription = z.infer<typeof insertFieldSubscriptionSchema>;
export type FieldSubscription = typeof fieldSubscriptions.$inferSelect;

// ============================================================================
// 限制欄位 TypeScript 介面
// ============================================================================

export interface PlanLimits {
  maxGames?: number;                // -1 或 undefined = 無限
  maxCheckoutsPerMonth?: number;
  maxAdmins?: number;
  maxStorageGb?: number;
  maxBattleVenues?: number;
  maxBattleSlotsPerMonth?: number;
}

export function parsePlanLimits(raw: unknown): PlanLimits {
  if (!raw || typeof raw !== "object") return {};
  return raw as PlanLimits;
}
