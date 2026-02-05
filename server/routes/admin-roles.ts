import type { Express } from "express";
import {
  requireAdminAuth,
  requirePermission,
  createAdminAccount,
  updateAdminPassword,
  logAuditAction,
} from "../adminAuth";
import { db } from "../db";
import {
  roles,
  permissions,
  rolePermissions,
  adminAccounts,
  auditLogs,
  users,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export function registerAdminRoleRoutes(app: Express) {
  // ============================================================================
  // Role & Permission Management Routes - 角色權限管理
  // ============================================================================

  app.get("/api/admin/roles", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const rolesList = await db.query.roles.findMany({
        where: req.admin.systemRole === "super_admin"
          ? undefined
          : eq(roles.fieldId, req.admin.fieldId),
        with: {
          rolePermissions: {
            with: { permission: true },
          },
        },
        orderBy: [desc(roles.createdAt)],
      });
      res.json(rolesList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get("/api/admin/permissions", requireAdminAuth, async (req, res) => {
    try {
      const permissionsList = await db.query.permissions.findMany({
        orderBy: [permissions.category, permissions.key],
      });
      res.json(permissionsList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.post("/api/admin/roles", requireAdminAuth, requirePermission("user:manage_roles"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const { name, description, systemRole, permissionIds } = req.body;

      const fieldId = req.admin.systemRole === "super_admin"
        ? req.body.fieldId
        : req.admin.fieldId;

      const [role] = await db.insert(roles).values({
        name,
        description,
        systemRole: systemRole || "custom",
        fieldId,
        isCustom: true,
      }).returning();

      if (permissionIds && permissionIds.length > 0) {
        await db.insert(rolePermissions).values(
          permissionIds.map((permId: string) => ({
            roleId: role.id,
            permissionId: permId,
            allow: true,
          }))
        );
      }

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "role:create",
        targetType: "role",
        targetId: role.id,
        fieldId,
        metadata: { name, permissionIds },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.patch("/api/admin/roles/:id", requireAdminAuth, requirePermission("user:manage_roles"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const { name, description, permissionIds } = req.body;

      const [role] = await db.update(roles)
        .set({ name, description, updatedAt: new Date() })
        .where(eq(roles.id, req.params.id))
        .returning();

      if (!role) {
        return res.status(404).json({ message: "角色不存在" });
      }

      if (permissionIds !== undefined) {
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
        if (permissionIds.length > 0) {
          await db.insert(rolePermissions).values(
            permissionIds.map((permId: string) => ({
              roleId: role.id,
              permissionId: permId,
              allow: true,
            }))
          );
        }
      }

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "role:update",
        targetType: "role",
        targetId: role.id,
        fieldId: role.fieldId || undefined,
        metadata: { name, permissionIds },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/admin/roles/:id", requireAdminAuth, requirePermission("user:manage_roles"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const role = await db.query.roles.findFirst({
        where: eq(roles.id, req.params.id),
      });

      if (!role) {
        return res.status(404).json({ message: "角色不存在" });
      }

      if (!role.isCustom) {
        return res.status(400).json({ message: "系統角色無法刪除" });
      }

      await db.delete(roles).where(eq(roles.id, req.params.id));

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "role:delete",
        targetType: "role",
        targetId: req.params.id,
        fieldId: role.fieldId || undefined,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // ============================================================================
  // Admin Account Management Routes - 管理員帳號管理
  // ============================================================================

  app.get("/api/admin/accounts", requireAdminAuth, requirePermission("admin:manage_accounts"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const accounts = await db.query.adminAccounts.findMany({
        where: req.admin.systemRole === "super_admin"
          ? undefined
          : eq(adminAccounts.fieldId, req.admin.fieldId),
        with: {
          role: true,
          field: true,
        },
        orderBy: [desc(adminAccounts.createdAt)],
      });

      const safeAccounts = accounts.map(acc => ({
        ...acc,
        passwordHash: undefined,
      }));

      res.json(safeAccounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch admin accounts" });
    }
  });

  app.post("/api/admin/accounts", requireAdminAuth, requirePermission("admin:manage_accounts"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const { username, password, displayName, email, roleId, fieldId } = req.body;

      const targetFieldId = req.admin.systemRole === "super_admin"
        ? fieldId
        : req.admin.fieldId;

      if (!targetFieldId) {
        return res.status(400).json({ message: "請指定場域" });
      }

      const result = await createAdminAccount({
        fieldId: targetFieldId,
        username,
        password,
        displayName,
        email,
        roleId,
      });

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "admin:create_account",
        targetType: "admin_account",
        targetId: result.accountId,
        fieldId: targetFieldId,
        metadata: { username, displayName },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json({ success: true, accountId: result.accountId });
    } catch (error) {
      res.status(500).json({ message: "Failed to create admin account" });
    }
  });

  app.patch("/api/admin/accounts/:id", requireAdminAuth, requirePermission("admin:manage_accounts"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const { displayName, email, roleId, status } = req.body;

      const [account] = await db.update(adminAccounts)
        .set({ displayName, email, roleId, status, updatedAt: new Date() })
        .where(eq(adminAccounts.id, req.params.id))
        .returning();

      if (!account) {
        return res.status(404).json({ message: "帳號不存在" });
      }

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "admin:update_account",
        targetType: "admin_account",
        targetId: account.id,
        fieldId: account.fieldId,
        metadata: { displayName, status },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ ...account, passwordHash: undefined });
    } catch (error) {
      res.status(500).json({ message: "Failed to update admin account" });
    }
  });

  app.post("/api/admin/accounts/:id/reset-password", requireAdminAuth, requirePermission("admin:manage_accounts"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "密碼長度至少 6 個字元" });
      }

      await updateAdminPassword(req.params.id, newPassword);

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "admin:reset_password",
        targetType: "admin_account",
        targetId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post("/api/admin/accounts/:id/approve", requireAdminAuth, requirePermission("admin:manage_accounts"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const { roleId } = req.body;

      const account = await db.query.adminAccounts.findFirst({
        where: eq(adminAccounts.id, req.params.id),
      });

      if (!account) {
        return res.status(404).json({ message: "帳號不存在" });
      }

      if (account.status !== "pending") {
        return res.status(400).json({ message: "此帳號不需要授權" });
      }

      if (req.admin.systemRole !== "super_admin" && account.fieldId !== req.admin.fieldId) {
        return res.status(403).json({ message: "您無權授權此帳號" });
      }

      let validRoleId: string | null = null;
      if (roleId) {
        const role = await db.query.roles.findFirst({
          where: eq(roles.id, roleId),
        });
        if (!role) {
          return res.status(400).json({ message: "指定的角色不存在" });
        }
        if (req.admin.systemRole !== "super_admin" && role.fieldId !== null && role.fieldId !== account.fieldId) {
          return res.status(400).json({ message: "角色與帳號所屬場地不符" });
        }
        validRoleId = roleId;
      }

      const [updatedAccount] = await db.update(adminAccounts)
        .set({
          status: "active",
          roleId: validRoleId,
          updatedAt: new Date()
        })
        .where(eq(adminAccounts.id, req.params.id))
        .returning();

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "admin:approve_account",
        targetType: "admin_account",
        targetId: req.params.id,
        fieldId: account.fieldId,
        metadata: { roleId, email: account.email },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ success: true, account: { ...updatedAccount, passwordHash: undefined } });
    } catch (error) {
      res.status(500).json({ message: "授權失敗" });
    }
  });

  // ============================================================================
  // Audit Log Routes - 審計日誌
  // ============================================================================

  app.get("/api/admin/audit-logs", requireAdminAuth, requirePermission("admin:view_audit"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const { limit = 100, offset = 0 } = req.query;

      const whereClause = req.admin.systemRole === "super_admin"
        ? undefined
        : eq(auditLogs.fieldId, req.admin.fieldId);

      const logs = await db.query.auditLogs.findMany({
        where: whereClause,
        with: {
          actorAdmin: true,
          field: true,
        },
        orderBy: [desc(auditLogs.createdAt)],
        limit: Number(limit),
        offset: Number(offset),
      });

      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ============================================================================
  // Admin User Management Routes - 玩家管理
  // ============================================================================

  app.get("/api/admin/users", requireAdminAuth, requirePermission("user:view"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const allUsers = await db.query.users.findMany({
        orderBy: [desc(users.createdAt)],
      });

      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
}
