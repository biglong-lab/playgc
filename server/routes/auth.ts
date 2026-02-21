import type { Express } from "express";
import type { AuthenticatedRequest } from "./types";
import { storage } from "../storage";
import { isAuthenticated, verifyFirebaseToken } from "../firebaseAuth";
import {
  adminLogin,
  adminLogout,
  requireAdminAuth,
  logAuditAction,
  verifyToken,
  getAdminPermissions,
} from "../adminAuth";
import { db } from "../db";
import { fields, roles, rolePermissions, adminAccounts, adminSessions } from "@shared/schema";
import jwt from "jsonwebtoken";
import { eq, and, gt } from "drizzle-orm";

export function registerAuthRoutes(app: Express) {
  // 玩家認證
  app.get("/api/auth/user", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = req.user?.dbUser;
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ============================================================================
  // Admin Authentication Routes - 管理員認證
  // ============================================================================

  app.post("/api/admin/login", async (req, res) => {
    try {
      const { fieldCode, username, password } = req.body;

      if (!fieldCode || !username || !password) {
        return res.status(400).json({ message: "請填寫場域編號、帳號和密碼" });
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers["user-agent"];

      const result = await adminLogin(fieldCode, username, password, ipAddress, userAgent);

      if (!result.success) {
        return res.status(401).json({ message: result.error });
      }

      res.cookie("adminToken", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        token: result.token,
        admin: result.admin,
      });
    } catch (error) {
      res.status(500).json({ message: "登入失敗" });
    }
  });

  app.post("/api/admin/firebase-login", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "請先登入" });
      }

      const idToken = authHeader.split("Bearer ")[1];

      const decodedToken = await verifyFirebaseToken(idToken);

      if (!decodedToken) {
        return res.status(401).json({ message: "無效的登入令牌" });
      }

      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

      const firebaseUserId = decodedToken.uid;
      const firebaseEmail = decodedToken.email || null;
      const firebaseDisplayName = decodedToken.name || null;

      const { fieldCode } = req.body;

      // super_admin 可不填場域碼 → 依 firebaseUserId 全域搜尋
      let field: typeof fields.$inferSelect | undefined;
      let adminAccount: Awaited<ReturnType<typeof db.query.adminAccounts.findFirst>>;

      if (!fieldCode || !fieldCode.trim()) {
        // 無場域碼：搜尋 super_admin 帳號
        adminAccount = await db.query.adminAccounts.findFirst({
          where: eq(adminAccounts.firebaseUserId, firebaseUserId),
          with: { role: true },
        });

        if (!adminAccount) {
          return res.status(404).json({ message: "找不到管理員帳號，請輸入場域編號" });
        }

        const accountRole = adminAccount.role || (adminAccount.roleId
          ? await db.query.roles.findFirst({ where: eq(roles.id, adminAccount.roleId) })
          : null);

        if (accountRole?.systemRole !== "super_admin") {
          return res.status(400).json({ message: "非超級管理員請輸入場域編號" });
        }

        field = await db.query.fields.findFirst({
          where: eq(fields.id, adminAccount.fieldId),
        }) ?? undefined;

        if (!field) {
          return res.status(404).json({ message: "場域資料異常" });
        }
      } else {
        // 一般流程：依場域碼查場域 → 再依 firebaseUserId 查帳號
        field = await db.query.fields.findFirst({
          where: eq(fields.code, fieldCode.toUpperCase()),
        }) ?? undefined;

        if (!field) {
          return res.status(404).json({ message: "找不到此場域" });
        }

        adminAccount = await db.query.adminAccounts.findFirst({
          where: and(
            eq(adminAccounts.fieldId, field.id),
            eq(adminAccounts.firebaseUserId, firebaseUserId),
          ),
        });
      }

      if (!adminAccount) {
        await db.insert(adminAccounts).values({
          id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fieldId: field.id,
          firebaseUserId: firebaseUserId,
          email: firebaseEmail,
          displayName: firebaseDisplayName || firebaseEmail || "待授權用戶",
          status: "pending",
        });

        await logAuditAction({
          action: "admin:request_access",
          targetType: "admin_account",
          fieldId: field.id,
          metadata: { firebaseUserId, email: firebaseEmail },
          ipAddress: ipAddress || undefined,
          userAgent: req.headers["user-agent"],
        });

        return res.status(202).json({
          message: "已提交授權申請，請等待管理員審核",
          status: "pending"
        });
      }

      if (adminAccount.status === "pending") {
        return res.status(202).json({
          message: "您的授權申請正在審核中，請耐心等待",
          status: "pending"
        });
      }

      if (adminAccount.status !== "active") {
        return res.status(403).json({ message: "您的帳號已被停用或鎖定" });
      }

      const role = adminAccount.roleId
        ? await db.query.roles.findFirst({ where: eq(roles.id, adminAccount.roleId) })
        : null;

      const systemRole = role?.systemRole || "custom";

      let permissionKeys: string[] = [];
      if (role) {
        const rolePerms = await db.query.rolePermissions.findMany({
          where: eq(rolePermissions.roleId, role.id),
          with: { permission: true },
        });
        permissionKeys = rolePerms
          .filter(rp => rp.allow)
          .map(rp => rp.permission?.key)
          .filter((k): k is string => !!k);
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const sessionSecret = process.env.SESSION_SECRET;
      if (!sessionSecret) {
        return res.status(500).json({ message: "伺服器設定錯誤：SESSION_SECRET 未設定" });
      }

      const token = jwt.sign(
        {
          sub: adminAccount.id,
          fieldId: field.id,
          roleId: adminAccount.roleId,
          firebaseUserId: firebaseUserId,
          type: "admin",
        },
        sessionSecret,
        { expiresIn: "24h" }
      );

      await db.insert(adminSessions).values({
        adminAccountId: adminAccount.id,
        token,
        ipAddress: ipAddress || null,
        userAgent: req.headers["user-agent"] || null,
        expiresAt,
      });

      await db.update(adminAccounts)
        .set({ lastLoginAt: now, lastLoginIp: ipAddress })
        .where(eq(adminAccounts.id, adminAccount.id));

      await logAuditAction({
        actorAdminId: adminAccount.id,
        action: "admin:login",
        targetType: "admin",
        targetId: adminAccount.id,
        fieldId: field.id,
        metadata: { method: "firebase", firebaseUserId },
        ipAddress: ipAddress || undefined,
        userAgent: req.headers["user-agent"],
      });

      res.cookie("adminToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        admin: {
          id: adminAccount.id,
          accountId: adminAccount.id,
          fieldId: field.id,
          fieldCode: field.code,
          fieldName: field.name,
          displayName: adminAccount.displayName,
          roleId: adminAccount.roleId,
          systemRole,
          permissions: permissionKeys,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "登入失敗" });
    }
  });

  app.post("/api/admin/logout", requireAdminAuth, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = req.cookies?.adminToken || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);
      if (token) {
        await adminLogout(token);
      }
      res.clearCookie("adminToken");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "登出失敗" });
    }
  });

  app.get("/api/admin/me", requireAdminAuth, async (req, res) => {
    if (!req.admin) {
      return res.status(401).json({ message: "未認證" });
    }
    res.json(req.admin);
  });

  app.get("/api/admin/session", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = req.cookies?.adminToken || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

      if (!token) {
        return res.json({ authenticated: false });
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.sub) {
        return res.json({ authenticated: false });
      }

      const session = await db.query.adminSessions.findFirst({
        where: and(
          eq(adminSessions.token, token),
          gt(adminSessions.expiresAt, new Date())
        ),
      });

      if (!session) {
        return res.json({ authenticated: false });
      }

      const account = await db.query.adminAccounts.findFirst({
        where: eq(adminAccounts.id, decoded.sub),
        with: { role: true },
      });

      if (!account || account.status !== "active") {
        return res.json({ authenticated: false });
      }

      const field = await db.query.fields.findFirst({
        where: eq(fields.id, account.fieldId),
      });

      if (!field) {
        return res.json({ authenticated: false });
      }

      const adminPermissions = await getAdminPermissions(account.roleId);

      res.json({
        authenticated: true,
        admin: {
          id: account.id,
          accountId: account.id,
          fieldId: field.id,
          fieldCode: field.code,
          fieldName: field.name,
          username: account.username || "",
          displayName: account.displayName,
          roleId: account.roleId,
          systemRole: account.role?.systemRole || "custom",
          permissions: adminPermissions,
        },
      });
    } catch (error) {
      res.json({ authenticated: false });
    }
  });
}
