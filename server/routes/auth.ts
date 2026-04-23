import type { Express } from "express";
import type { AuthenticatedRequest } from "./types";
import { isAuthenticated, verifyFirebaseToken } from "../firebaseAuth";
import {
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

  // 密碼登入已停用 — 統一使用 Firebase 認證
  app.post("/api/admin/login", (_req, res) => {
    res.status(410).json({
      message: "密碼登入已停用，請使用 Google 帳號登入",
      migration: "請前往登入頁面使用 Firebase Google 登入",
    });
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
        });

        // 若找不到但有 email 匹配，自動綁定或重新綁定（Firebase 已驗證 email）
        if (!adminAccount && firebaseEmail) {
          const emailMatch = await db.query.adminAccounts.findFirst({
            where: eq(adminAccounts.email, firebaseEmail),
          });
          if (emailMatch && emailMatch.status === "active") {
            // 即使已有 firebase_user_id 也允許更新（支援多裝置/多登入方式切換）
            await db.update(adminAccounts)
              .set({ firebaseUserId, displayName: firebaseDisplayName || emailMatch.displayName })
              .where(eq(adminAccounts.id, emailMatch.id));
            adminAccount = { ...emailMatch, firebaseUserId };
          }
        }

        if (!adminAccount) {
          return res.status(404).json({ message: "找不到管理員帳號，請輸入場域編號" });
        }

        // 查角色確認 super_admin
        const accountRole = adminAccount.roleId
          ? await db.query.roles.findFirst({ where: eq(roles.id, adminAccount.roleId) })
          : null;

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

        // 🆕 super_admin 跨場域登入：若在 target field 找不到帳號，
        //   檢查此 firebaseUser 是否在任何場域是 super_admin（平台級身分）
        //   若是 → 借用 super_admin 身分，token 仍指向 target field（可看該場域資料）
        //   這避免了「super_admin 切換場域時被當新申請者要求審核」的問題
        if (!adminAccount) {
          const candidate = await db.query.adminAccounts.findFirst({
            where: eq(adminAccounts.firebaseUserId, firebaseUserId),
          });
          if (candidate?.roleId && candidate.status === "active") {
            const candidateRole = await db.query.roles.findFirst({
              where: eq(roles.id, candidate.roleId),
            });
            if (candidateRole?.systemRole === "super_admin") {
              // 是 super_admin → 允許跨場域登入
              adminAccount = candidate;
            }
          }
        }
      }

      // 若找不到帳號但有 email 匹配，自動綁定或重新綁定（Firebase 已驗證 email）
      if (!adminAccount && firebaseEmail) {
        const emailMatch = await db.query.adminAccounts.findFirst({
          where: and(
            eq(adminAccounts.email, firebaseEmail),
            eq(adminAccounts.fieldId, field.id),
          ),
        });
        if (emailMatch && emailMatch.status === "active") {
          // 即使已有 firebase_user_id 也允許更新（支援多裝置/多登入方式切換）
          await db.update(adminAccounts)
            .set({ firebaseUserId, displayName: firebaseDisplayName || emailMatch.displayName })
            .where(eq(adminAccounts.id, emailMatch.id));
          adminAccount = { ...emailMatch, firebaseUserId };
        }
      }

      // 🆕 super_admin 跨場域守門（優先於 pending / insert 邏輯）
      //   情境：super_admin 先前用非自己場域登入時被誤建 pending 帳號，
      //   之後再登入就匹配到 pending 帳號被卡住。
      //   對策：不論目前 adminAccount 是什麼，只要此 firebaseUser / email
      //   在任何場域是 active super_admin，就切換到他的 super_admin 帳號，
      //   並清掉殘留的 pending 紀錄。
      const needSuperAdminRescue =
        !adminAccount ||
        adminAccount.status === "pending" ||
        adminAccount.status !== "active";

      if (needSuperAdminRescue) {
        // 先用 firebaseUserId 找
        let rescueAcct = await db.query.adminAccounts.findFirst({
          where: eq(adminAccounts.firebaseUserId, firebaseUserId),
          with: { role: true },
        });
        // 沒綁 firebase_user_id 但 email 匹配也算
        if (!rescueAcct && firebaseEmail) {
          rescueAcct = await db.query.adminAccounts.findFirst({
            where: eq(adminAccounts.email, firebaseEmail),
            with: { role: true },
          });
        }
        if (
          rescueAcct?.status === "active" &&
          rescueAcct.role?.systemRole === "super_admin"
        ) {
          // 若 email 匹配到但沒綁 firebaseUserId → 順手補綁
          if (!rescueAcct.firebaseUserId) {
            await db.update(adminAccounts)
              .set({ firebaseUserId })
              .where(eq(adminAccounts.id, rescueAcct.id));
          }
          // 清掉誤建的 pending 殘留
          if (
            adminAccount &&
            adminAccount.status === "pending" &&
            adminAccount.id !== rescueAcct.id
          ) {
            try {
              await db.delete(adminAccounts).where(eq(adminAccounts.id, adminAccount.id));
            } catch (e) {
              console.warn("[auth] 清除 pending 殘留失敗:", e);
            }
          }
          adminAccount = rescueAcct;
        }
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

  // 開發環境專用：產生 custom token 跳過 Google popup
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/dev/custom-token", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({ message: "需要 email" });
        }
        // 先觸發一次 verifyFirebaseToken 確保 Firebase Admin 已初始化
        await verifyFirebaseToken("init").catch(() => {});
        const { getAuth: getAdminAuth } = await import("firebase-admin/auth");
        const { getApps: getAdminApps } = await import("firebase-admin/app");
        const adminApp = getAdminApps()[0];
        if (!adminApp) {
          return res.status(500).json({ message: "Firebase Admin 未初始化" });
        }
        const adminAuth = getAdminAuth(adminApp);
        const userRecord = await adminAuth.getUserByEmail(email);
        const customToken = await adminAuth.createCustomToken(userRecord.uid);
        res.json({ customToken, uid: userRecord.uid, displayName: userRecord.displayName });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "產生 token 失敗";
        res.status(500).json({ message: msg });
      }
    });
  }

  // 🔑 平台擁有者緊急登入（生產環境可用）
  // 用途：當 Google OAuth 網域未配置時，平台擁有者仍能登入
  // 安全：需帶 X-Platform-Secret header（設定於環境變數 PLATFORM_OWNER_SECRET），且限定 email
  app.post("/api/auth/platform-owner-login", async (req, res) => {
    try {
      const secret = req.headers["x-platform-secret"] as string | undefined;
      const configuredSecret = process.env.PLATFORM_OWNER_SECRET;
      const ownerEmail = process.env.PLATFORM_OWNER_EMAIL;

      if (!configuredSecret || !ownerEmail) {
        return res.status(503).json({
          message: "平台擁有者登入未設定（需環境變數 PLATFORM_OWNER_SECRET + PLATFORM_OWNER_EMAIL）",
        });
      }
      if (!secret || secret !== configuredSecret) {
        return res.status(403).json({ message: "密鑰錯誤" });
      }

      // 找平台擁有者帳號（以 email + super_admin 為條件）
      const ownerAccount = await db.query.adminAccounts.findFirst({
        where: eq(adminAccounts.email, ownerEmail),
      });
      if (!ownerAccount) {
        return res.status(404).json({ message: `找不到平台擁有者帳號 ${ownerEmail}` });
      }

      const ownerRole = ownerAccount.roleId
        ? await db.query.roles.findFirst({ where: eq(roles.id, ownerAccount.roleId) })
        : null;

      if (ownerRole?.systemRole !== "super_admin") {
        return res.status(403).json({ message: "該帳號非 super_admin" });
      }

      const field = await db.query.fields.findFirst({
        where: eq(fields.id, ownerAccount.fieldId),
      });
      if (!field) {
        return res.status(404).json({ message: "場域資料異常" });
      }

      // 取得權限（super_admin 有全權限）
      const permissionKeys = await getAdminPermissions(ownerAccount.roleId);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const sessionSecret = process.env.SESSION_SECRET;
      if (!sessionSecret) {
        return res.status(500).json({ message: "伺服器設定錯誤" });
      }

      const token = jwt.sign(
        {
          sub: ownerAccount.id,
          fieldId: field.id,
          roleId: ownerAccount.roleId,
          type: "admin",
        },
        sessionSecret,
        { expiresIn: "24h" }
      );

      await db.insert(adminSessions).values({
        adminAccountId: ownerAccount.id,
        token,
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
        expiresAt,
      });

      await db
        .update(adminAccounts)
        .set({ lastLoginAt: now, lastLoginIp: req.ip })
        .where(eq(adminAccounts.id, ownerAccount.id));

      await logAuditAction({
        actorAdminId: ownerAccount.id,
        action: "admin:platform_owner_login",
        targetType: "admin",
        targetId: ownerAccount.id,
        fieldId: field.id,
        metadata: { method: "owner-secret" },
        ipAddress: req.ip || undefined,
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
          id: ownerAccount.id,
          accountId: ownerAccount.id,
          fieldId: field.id,
          fieldCode: field.code,
          fieldName: field.name,
          displayName: ownerAccount.displayName,
          roleId: ownerAccount.roleId,
          systemRole: "super_admin",
          permissions: permissionKeys,
        },
      });
    } catch (error) {
      console.error("[platform-owner-login]", error);
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
