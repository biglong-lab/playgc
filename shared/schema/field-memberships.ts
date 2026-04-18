// 🎫 場域會員身份（Field Memberships）— SaaS 多租戶核心表
// 每個玩家在每個場域有一筆會員記錄
// is_admin 為開關：true 代表此玩家同時為該場域管理員
// 撤銷授權只需 is_admin=false，玩家身份仍保留
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { fields } from "./fields";
import { users } from "./users";
import { roles } from "./roles";

// ============================================================================
// Field Memberships — 場域會員卡（玩家身份 + 可選管理員能力）
// ============================================================================
export const fieldMemberships = pgTable(
  "field_memberships",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    // 關聯
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    fieldId: varchar("field_id")
      .references(() => fields.id, { onDelete: "cascade" })
      .notNull(),

    // 玩家身份（永遠存在）
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at").defaultNow(),
    playerStatus: varchar("player_status", { length: 20 }).default("active").notNull(),
    // active: 正常參與 / suspended: 場域暫停此玩家 / banned: 永久禁止

    // 管理員能力（開關 + 授權紀錄）
    isAdmin: boolean("is_admin").default(false).notNull(),
    adminRoleId: varchar("admin_role_id").references(() => roles.id, {
      onDelete: "set null",
    }),
    adminGrantedAt: timestamp("admin_granted_at"),
    adminGrantedBy: varchar("admin_granted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    adminRevokedAt: timestamp("admin_revoked_at"),
    adminRevokedBy: varchar("admin_revoked_by").references(() => users.id, {
      onDelete: "set null",
    }),

    // 備註
    notes: varchar("notes", { length: 500 }),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // 關鍵：同一玩家在同一場域只能有一筆
    uniqueIndex("uniq_field_memberships_user_field").on(table.userId, table.fieldId),
    index("idx_field_memberships_field").on(table.fieldId),
    index("idx_field_memberships_user").on(table.userId),
    index("idx_field_memberships_admin").on(table.fieldId, table.isAdmin),
  ]
);

// ============================================================================
// Zod schemas
// ============================================================================
export const insertFieldMembershipSchema = createInsertSchema(fieldMemberships, {
  playerStatus: z.enum(["active", "suspended", "banned"]).default("active"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type FieldMembership = typeof fieldMemberships.$inferSelect;
export type InsertFieldMembership = z.infer<typeof insertFieldMembershipSchema>;
