// 角色權限 (Roles) - 角色、權限、管理帳號
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { fields } from "./fields";
import { users } from "./users";
import { games } from "./games";

// ============================================================================
// System Roles - Predefined role types
// ============================================================================
export const systemRoleEnum = ["super_admin", "field_manager", "field_director", "field_executor", "custom", "player"] as const;
export type SystemRole = typeof systemRoleEnum[number];

// ============================================================================
// Roles table - Role definitions (system and custom)
// ============================================================================
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldId: varchar("field_id").references(() => fields.id, { onDelete: "cascade" }), // null for system roles
  name: varchar("name", { length: 100 }).notNull(),
  systemRole: varchar("system_role", { length: 50 }).default("custom"), // super_admin, field_manager, field_director, field_executor, custom, player
  description: text("description"),
  isCustom: boolean("is_custom").default(true),
  isDefault: boolean("is_default").default(false), // Default role for new users in this field
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Permissions table - Available permissions
// ============================================================================
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).unique().notNull(), // e.g., "game:create", "game:edit", "device:manage"
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(), // game, session, device, analytics, user, field, system
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// Role Permissions table - Maps permissions to roles
// ============================================================================
export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    roleId: varchar("role_id")
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
    permissionId: varchar("permission_id")
      .references(() => permissions.id, { onDelete: "cascade" })
      .notNull(),
    allow: boolean("allow").default(true),
    scope: jsonb("scope").default({}), // Optional scope restrictions {fieldId?, gameId?}
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_role_permissions_role").on(table.roleId),
    index("idx_role_permissions_permission").on(table.permissionId),
  ]
);

// ============================================================================
// User Roles table - Assigns roles to users
// ============================================================================
export const userRoles = pgTable(
  "user_roles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    roleId: varchar("role_id")
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
    fieldId: varchar("field_id").references(() => fields.id, { onDelete: "cascade" }), // Scoped to specific field
    gameId: varchar("game_id").references(() => games.id, { onDelete: "cascade" }), // Scoped to specific game
    assignedBy: varchar("assigned_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_user_roles_user").on(table.userId),
    index("idx_user_roles_role").on(table.roleId),
    index("idx_user_roles_field").on(table.fieldId),
    index("idx_user_roles_game").on(table.gameId),
  ]
);

// ============================================================================
// Admin Accounts table - Field-specific admin login (Firebase-based or legacy password)
// ============================================================================
export const adminAccounts = pgTable(
  "admin_accounts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id")
      .references(() => fields.id, { onDelete: "cascade" })
      .notNull(),
    firebaseUserId: varchar("firebase_user_id", { length: 255 }), // Link to Firebase user for SSO login
    clerkUserId: varchar("clerk_user_id", { length: 255 }), // DEPRECATED: Legacy Clerk user link, kept for data migration only
    username: varchar("username", { length: 100 }), // Optional for legacy password auth
    passwordHash: varchar("password_hash", { length: 255 }), // Optional for legacy password auth
    displayName: varchar("display_name", { length: 100 }),
    email: varchar("email"),
    roleId: varchar("role_id").references(() => roles.id),
    status: varchar("status", { length: 20 }).default("active"), // active, inactive, locked
    failedLoginAttempts: integer("failed_login_attempts").default(0),
    lastLoginAt: timestamp("last_login_at"),
    lastLoginIp: varchar("last_login_ip", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_admin_accounts_field").on(table.fieldId),
    index("idx_admin_accounts_username").on(table.fieldId, table.username),
    index("idx_admin_accounts_clerk").on(table.clerkUserId),
    index("idx_admin_accounts_firebase").on(table.firebaseUserId),
  ]
);

// ============================================================================
// Admin Sessions table - JWT session tracking
// ============================================================================
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    adminAccountId: varchar("admin_account_id")
      .references(() => adminAccounts.id, { onDelete: "cascade" })
      .notNull(),
    token: varchar("token", { length: 500 }).unique().notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_admin_sessions_token").on(table.token),
    index("idx_admin_sessions_expires").on(table.expiresAt),
  ]
);

// ============================================================================
// Audit Logs table - Track admin actions
// ============================================================================
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    actorUserId: varchar("actor_user_id").references(() => users.id), // Firebase user
    actorAdminId: varchar("actor_admin_id").references(() => adminAccounts.id), // Admin account
    action: varchar("action", { length: 100 }).notNull(), // e.g., "game:create", "user:update_role"
    targetType: varchar("target_type", { length: 50 }), // game, user, device, session, field
    targetId: varchar("target_id"),
    fieldId: varchar("field_id").references(() => fields.id),
    metadata: jsonb("metadata").default({}), // Additional action details
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_audit_logs_actor_user").on(table.actorUserId),
    index("idx_audit_logs_actor_admin").on(table.actorAdminId),
    index("idx_audit_logs_action").on(table.action),
    index("idx_audit_logs_target").on(table.targetType, table.targetId),
    index("idx_audit_logs_field").on(table.fieldId),
    index("idx_audit_logs_created").on(table.createdAt),
  ]
);

// Role schemas
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// Permission schemas
export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;

// Role Permission schemas
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// User Role schemas
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

// Admin Account schemas
export const insertAdminAccountSchema = createInsertSchema(adminAccounts).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAdminAccount = z.infer<typeof insertAdminAccountSchema>;
export type AdminAccount = typeof adminAccounts.$inferSelect;

// Admin Session schemas
export const insertAdminSessionSchema = createInsertSchema(adminSessions).omit({
  id: true,
  createdAt: true,
});
export type InsertAdminSession = z.infer<typeof insertAdminSessionSchema>;
export type AdminSession = typeof adminSessions.$inferSelect;

// Audit Log schemas
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

