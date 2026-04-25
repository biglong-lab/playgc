// 獎勵轉換節點 schema — 把遊戲結果轉成實際獎勵
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26
//
// 設計核心：節點化解耦
//   遊戲端只送結果 → 規則引擎評估 → 多管道發放（內部 / 外部 / 未來）
//
import { pgTable, varchar, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// ============================================================================
// 1. reward_conversion_rules — 轉換規則（場域 admin 自助設定）
// ============================================================================
export const rewardConversionRules = pgTable("reward_conversion_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  fieldId: varchar("field_id"),                            // null = 全平台
  isActive: boolean("is_active").default(true).notNull(),

  triggers: jsonb("triggers").notNull(),
  rewards: jsonb("rewards").notNull(),
  quota: jsonb("quota").default(sql`'{}'::jsonb`),

  priority: integer("priority").default(0),
  hitsCount: integer("hits_count").default(0).notNull(),

  /** 🆕 A/B Testing — Phase 16.6 */
  abTestGroup: varchar("ab_test_group", { length: 20 }),  // 'A' / 'B' / null
  abTestTraffic: integer("ab_test_traffic").default(100).notNull(), // 0-100 %

  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  validUntil: timestamp("valid_until"),
}, (table) => [
  index("idx_rules_active").on(table.isActive, table.fieldId, table.priority),
  index("idx_rules_ab_group").on(table.abTestGroup, table.isActive),
]);

export const insertRewardConversionRuleSchema = createInsertSchema(rewardConversionRules).omit({
  id: true,
  hitsCount: true,
  createdAt: true,
});

export type RewardConversionRule = typeof rewardConversionRules.$inferSelect;
export type InsertRewardConversionRule = typeof rewardConversionRules.$inferInsert;

// ============================================================================
// 2. reward_conversion_events — 事件流（可重放、可追溯）
// ============================================================================
export const rewardConversionEvents = pgTable("reward_conversion_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: varchar("source_type", { length: 50 }).notNull(),
  sourceId: varchar("source_id").notNull(),
  squadId: varchar("squad_id"),
  userId: varchar("user_id"),

  eventPayload: jsonb("event_payload").notNull(),
  rulesEvaluated: jsonb("rules_evaluated").default(sql`'[]'::jsonb`),
  rewardsIssued: jsonb("rewards_issued").default(sql`'[]'::jsonb`),

  status: varchar("status", { length: 20 }).default("processed").notNull(),
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_events_source").on(table.sourceType, table.sourceId),
  index("idx_events_squad").on(table.squadId, table.createdAt.desc()),
  index("idx_events_status").on(table.status),
]);

export const insertRewardConversionEventSchema = createInsertSchema(rewardConversionEvents).omit({
  id: true,
  createdAt: true,
});

export type RewardConversionEvent = typeof rewardConversionEvents.$inferSelect;
export type InsertRewardConversionEvent = typeof rewardConversionEvents.$inferInsert;

// ============================================================================
// 3. coupon_templates — 平台券模板
// ============================================================================
export const couponTemplates = pgTable("coupon_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),

  discountType: varchar("discount_type", { length: 20 }).notNull(),
  discountValue: integer("discount_value"),
  minPurchase: integer("min_purchase").default(0),

  applicableScope: jsonb("applicable_scope").default(sql`'{}'::jsonb`),

  validityDays: integer("validity_days").default(30),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCouponTemplateSchema = createInsertSchema(couponTemplates).omit({
  id: true,
  createdAt: true,
});

export type CouponTemplate = typeof couponTemplates.$inferSelect;
export type InsertCouponTemplate = typeof couponTemplates.$inferInsert;

// ============================================================================
// 4. platform_coupons — 平台自有券（已發行的）
// ============================================================================
export const platformCoupons = pgTable("platform_coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 32 }).notNull().unique(),

  templateId: varchar("template_id").notNull(),
  issuedToSquadId: varchar("issued_to_squad_id"),
  issuedToUserId: varchar("issued_to_user_id"),

  status: varchar("status", { length: 20 }).default("unused").notNull(),
  // 'unused' / 'used' / 'expired' / 'revoked'

  sourceEventId: varchar("source_event_id"),

  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),

  redemptionContext: jsonb("redemption_context"),
}, (table) => [
  index("idx_coupons_user").on(table.issuedToUserId, table.status),
  index("idx_coupons_squad").on(table.issuedToSquadId, table.status),
  index("idx_coupons_status_expires").on(table.status, table.expiresAt),
]);

export const insertPlatformCouponSchema = createInsertSchema(platformCoupons).omit({
  id: true,
  issuedAt: true,
});

export type PlatformCoupon = typeof platformCoupons.$inferSelect;
export type InsertPlatformCoupon = typeof platformCoupons.$inferInsert;

// ============================================================================
// 5. external_reward_integrations — 外部獎勵對接設定（aihomi 等）
// ============================================================================
export const externalRewardIntegrations = pgTable("external_reward_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: varchar("provider", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  apiCredentialsEncrypted: text("api_credentials_encrypted"),
  webhookSecret: varchar("webhook_secret", { length: 100 }),

  isActive: boolean("is_active").default(false).notNull(),
  rateLimitPerMinute: integer("rate_limit_per_minute").default(60),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExternalRewardIntegrationSchema = createInsertSchema(externalRewardIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ExternalRewardIntegration = typeof externalRewardIntegrations.$inferSelect;
export type InsertExternalRewardIntegration = typeof externalRewardIntegrations.$inferInsert;

// ============================================================================
// 6. squad_external_rewards — 外部獎勵紀錄（aihomi 發給玩家的券）
// ============================================================================
export const squadExternalRewards = pgTable("squad_external_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  squadId: varchar("squad_id"),
  userId: varchar("user_id"),
  provider: varchar("provider", { length: 50 }).notNull(),

  externalCouponCode: varchar("external_coupon_code", { length: 100 }),
  externalCouponUrl: varchar("external_coupon_url", { length: 500 }),

  displayName: varchar("display_name", { length: 200 }),
  valueDescription: varchar("value_description", { length: 200 }),
  merchantName: varchar("merchant_name", { length: 100 }),
  merchantAddress: text("merchant_address"),

  status: varchar("status", { length: 20 }).default("pending").notNull(),
  sourceEventId: varchar("source_event_id"),
  requestId: varchar("request_id"),

  issuedAt: timestamp("issued_at"),
  redeemedAt: timestamp("redeemed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ext_rewards_user").on(table.userId, table.status),
  index("idx_ext_rewards_request").on(table.requestId),
  index("idx_ext_rewards_provider").on(table.provider, table.status),
]);

export const insertSquadExternalRewardSchema = createInsertSchema(squadExternalRewards).omit({
  id: true,
  createdAt: true,
});

export type SquadExternalReward = typeof squadExternalRewards.$inferSelect;
export type InsertSquadExternalReward = typeof squadExternalRewards.$inferInsert;

// ============================================================================
// Enums
// ============================================================================
export const rewardTypeEnum = [
  "exp_points",          // 體驗點數（內部累積）
  "rating_bonus",        // 額外 rating（特殊活動）
  "badge",               // 徽章
  "platform_coupon",     // 平台券
  "external_coupon",     // 外部券（aihomi）
  "physical_reward",     // 實體獎品
  "virtual_item",        // 虛擬寶物（未來）
  "cash_back",           // 現金回饋（未來）
] as const;
export type RewardType = typeof rewardTypeEnum[number];

export const rewardEventTypeEnum = [
  "game_complete",
  "milestone",
  "recruit",
  "season_end",
  "field_milestone",
  "experience_milestone",
  "cross_field_milestone",
  "monthly_recruit_milestone",
  "manual_admin",
] as const;
export type RewardEventType = typeof rewardEventTypeEnum[number];

export const rewardTargetEnum = ["squad", "leader", "all_members"] as const;
export type RewardTarget = typeof rewardTargetEnum[number];
