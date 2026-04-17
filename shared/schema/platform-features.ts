// 平台功能旗標 (Platform Features) - 功能開關與用量計量
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  bigint,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { fields } from "./fields";

// ============================================================================
// Enums
// ============================================================================

export const featureCategoryEnum = [
  "game",         // 遊戲類功能
  "battle",       // 對戰類功能
  "payment",      // 金流類功能
  "branding",     // 品牌客製
  "integration",  // 整合類（AI、Email、LINE）
  "experimental", // 實驗性功能
] as const;
export type FeatureCategory = (typeof featureCategoryEnum)[number];

export const usageMeterKeyEnum = [
  "games",                // 遊戲總數
  "checkouts",            // 月結帳次數
  "admins",               // 管理員人數
  "storage_bytes",        // 儲存空間
  "battle_slots",         // 月對戰時段數
  "ai_tokens",            // AI 使用量
] as const;
export type UsageMeterKey = (typeof usageMeterKeyEnum)[number];

// ============================================================================
// Platform Feature Flags 表 - 功能旗標定義（平台層）
// ============================================================================

export const platformFeatureFlags = pgTable(
  "platform_feature_flags",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    flagKey: varchar("flag_key", { length: 100 }).notNull().unique(), // 'battle_system' | 'ai_game_generation'
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 50 }).default("experimental"),

    // 預設行為
    defaultEnabled: boolean("default_enabled").default(false),
    requiredPlan: varchar("required_plan", { length: 50 }), // 'pro' | 'enterprise' | null

    // 版本控制
    status: varchar("status", { length: 20 }).default("active"), // 'active' | 'deprecated' | 'removed'
    rolloutPercent: varchar("rollout_percent", { length: 10 }).default("100"), // 漸進式 rollout

    // 元資料
    metadata: jsonb("metadata").default({}),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_platform_feature_flags_key").on(table.flagKey),
    index("idx_platform_feature_flags_category").on(table.category),
  ]
);

// ============================================================================
// Field Feature Overrides 表 - 場域個別功能覆寫
// ============================================================================

export const fieldFeatureOverrides = pgTable(
  "field_feature_overrides",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id")
      .references(() => fields.id, { onDelete: "cascade" })
      .notNull(),
    flagKey: varchar("flag_key", { length: 100 }).notNull(),

    // 覆寫
    enabled: boolean("enabled").notNull(),
    reason: text("reason"), // 「Beta 測試」「合約約定」

    // 時間窗
    startsAt: timestamp("starts_at"),
    expiresAt: timestamp("expires_at"),

    // 審計
    createdBy: varchar("created_by"), // admin_account_id 或 platform_admin_id
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_field_feature_override").on(table.fieldId, table.flagKey),
    index("idx_field_feature_overrides_field").on(table.fieldId),
    index("idx_field_feature_overrides_flag").on(table.flagKey),
  ]
);

// ============================================================================
// Field Usage Meters 表 - 用量計量（配額追蹤）
// ============================================================================

export const fieldUsageMeters = pgTable(
  "field_usage_meters",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id")
      .references(() => fields.id, { onDelete: "cascade" })
      .notNull(),
    meterKey: varchar("meter_key", { length: 50 }).notNull(),

    // 計量週期
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    // 數值
    currentValue: bigint("current_value", { mode: "number" }).default(0),
    limitValue: bigint("limit_value", { mode: "number" }), // null = 無限

    // 超額記錄
    overageCount: bigint("overage_count", { mode: "number" }).default(0),
    lastOverageAt: timestamp("last_overage_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_field_usage_meter").on(table.fieldId, table.meterKey, table.periodStart),
    index("idx_field_usage_meters_field").on(table.fieldId),
    index("idx_field_usage_meters_key").on(table.meterKey),
    index("idx_field_usage_meters_period").on(table.periodEnd),
  ]
);

// ============================================================================
// Zod Schemas & Types
// ============================================================================

export const insertPlatformFeatureFlagSchema = createInsertSchema(platformFeatureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlatformFeatureFlag = z.infer<typeof insertPlatformFeatureFlagSchema>;
export type PlatformFeatureFlag = typeof platformFeatureFlags.$inferSelect;

export const insertFieldFeatureOverrideSchema = createInsertSchema(fieldFeatureOverrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFieldFeatureOverride = z.infer<typeof insertFieldFeatureOverrideSchema>;
export type FieldFeatureOverride = typeof fieldFeatureOverrides.$inferSelect;

export const insertFieldUsageMeterSchema = createInsertSchema(fieldUsageMeters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFieldUsageMeter = z.infer<typeof insertFieldUsageMeterSchema>;
export type FieldUsageMeter = typeof fieldUsageMeters.$inferSelect;
