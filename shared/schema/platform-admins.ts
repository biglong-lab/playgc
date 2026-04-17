// 平台管理員 (Platform Admins) - SaaS 平台層管理員
// 注意：與場域級 adminAccounts 不同，平台管理員不屬於任何場域
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

// ============================================================================
// Enums
// ============================================================================

export const platformRoleEnum = [
  "platform_owner",    // 平台擁有者（最高權限）
  "platform_admin",    // 平台運營
  "platform_support",  // 客服
  "platform_finance",  // 財務
] as const;
export type PlatformRole = (typeof platformRoleEnum)[number];

// ============================================================================
// Platform Admins 表 - 平台層管理員
// ============================================================================

export const platformAdmins = pgTable(
  "platform_admins",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    // 角色
    role: varchar("role", { length: 30 }).notNull(),

    // 權限（細粒度，可覆寫角色預設）
    // ['platform:fields:*', 'platform:revenue:read', ...]
    permissions: text("permissions").array().default([]),

    // 狀態
    status: varchar("status", { length: 20 }).default("active"), // 'active' | 'inactive'

    // 審計
    lastLoginAt: timestamp("last_login_at"),
    lastLoginIp: varchar("last_login_ip", { length: 45 }),
    notes: text("notes"),

    // 時間
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_platform_admins_user").on(table.userId),
    index("idx_platform_admins_role").on(table.role),
    index("idx_platform_admins_status").on(table.status),
  ]
);

// ============================================================================
// Zod Schemas & Types
// ============================================================================

export const insertPlatformAdminSchema = createInsertSchema(platformAdmins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlatformAdmin = z.infer<typeof insertPlatformAdminSchema>;
export type PlatformAdmin = typeof platformAdmins.$inferSelect;
