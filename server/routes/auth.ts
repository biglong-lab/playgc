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
import { eq, and, gt, or } from "drizzle-orm";
import { timingSafeEqual } from "crypto";

// 🔒 平台擁有者登入失敗計數（per-IP，記憶體）
// 5 次失敗 → 30 分鐘鎖定
const ownerLoginFailures = new Map<string, { count: number; resetAt: number }>();
const OWNER_LOGIN_MAX_FAILURES = 5;
const OWNER_LOGIN_LOCK_MS = 30 * 60_000; // 30 分鐘

// 定期清理過期計數
setInterval(() => {
  const now = Date.now();
  ownerLoginFailures.forEach((entry, ip) => {
    if (now > entry.resetAt) ownerLoginFailures.delete(ip);
  });
}, 60_000);

/** Timing-safe 字串比對（防止 timing attack 暴力破解 secret）*/
function timingSafeStringEqual(a: string, b: string): boolean {
  // 長度不同必為不等，但仍跑一次比對避免 length 洩漏
  const maxLen = Math.max(a.length, b.length);
  const aBuf = Buffer.alloc(maxLen, "0");
  const bBuf = Buffer.alloc(maxLen, "0");
  aBuf.write(a);
  bBuf.write(b);
  if (a.length !== b.length) {
    timingSafeEqual(aBuf, bBuf); // 跑一次拋掉
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

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

      // 🔐 2026-07-09 M3：型別/長度驗證（原本任意型別直用）
      const rawFieldCode = (req.body as { fieldCode?: unknown })?.fieldCode;
      const fieldCode =
        typeof rawFieldCode === "string" && rawFieldCode.length <= 50
          ? rawFieldCode
          : undefined;

      // super_admin 可不填場域碼 → 依 firebaseUserId 全域搜尋
      let field: typeof fields.$inferSelect | undefined;
      let adminAccount: Awaited<ReturnType<typeof db.query.adminAccounts.findFirst>>;

      if (!fieldCode || !fieldCode.trim()) {
        // 無場域碼：直接 join 篩「firebaseUserId + super_admin role + active」優先匹配
        // Bug fix（2026-05-03）：之前用 findFirst by firebaseUserId、若同 user 有多個 admin_accounts
        // （例如同時是某場域 super_admin + 其他場域 field_director），findFirst 隨機抓到
        // 非 super_admin 那筆 → 走 systemRole !== "super_admin" 分支 → 拒絕「非超級管理員請輸入場域編號」
        const superAdminMatch = await db
          .select({ admin: adminAccounts })
          .from(adminAccounts)
          .innerJoin(roles, eq(roles.id, adminAccounts.roleId))
          .where(
            and(
              eq(adminAccounts.firebaseUserId, firebaseUserId),
              eq(adminAccounts.status, "active"),
              eq(roles.systemRole, "super_admin"),
            ),
          )
          .limit(1);

        adminAccount = superAdminMatch[0]?.admin;

        // 若 firebaseUserId 找不到 super_admin 但有 email、用 email 補綁定（同樣篩 super_admin）
        if (!adminAccount && firebaseEmail) {
          const emailSuperAdmin = await db
            .select({ admin: adminAccounts })
            .from(adminAccounts)
            .innerJoin(roles, eq(roles.id, adminAccounts.roleId))
            .where(
              and(
                eq(adminAccounts.email, firebaseEmail),
                eq(adminAccounts.status, "active"),
                eq(roles.systemRole, "super_admin"),
              ),
            )
            .limit(1);

          const emailMatch = emailSuperAdmin[0]?.admin;
          if (emailMatch) {
            await db.update(adminAccounts)
              .set({ firebaseUserId, displayName: firebaseDisplayName || emailMatch.displayName })
              .where(eq(adminAccounts.id, emailMatch.id));
            adminAccount = { ...emailMatch, firebaseUserId };
          }
        }

        if (!adminAccount) {
          return res.status(404).json({ message: "找不到超級管理員帳號，請輸入場域編號或聯絡平台" });
        }

        // adminAccount 已透過 innerJoin role 確認是 super_admin、無需再次驗證
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

        // 🔒 篩 status='active' 避免 inactive 帳號擋住跨場域登入
        // 場景：super_admin 之前在某場域有 inactive field_director 帳號（軟刪後）
        //   findFirst 不篩 status 會抓到 inactive → 跳過下面 super_admin 跨場域守門
        //   最終回 403「您的帳號已被停用」、即使他本來是 super_admin 該能進
        adminAccount = await db.query.adminAccounts.findFirst({
          where: and(
            eq(adminAccounts.fieldId, field.id),
            eq(adminAccounts.firebaseUserId, firebaseUserId),
            eq(adminAccounts.status, "active"),
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
      // 🆕 2026-06-13：也比對 username == email（涵蓋 UI 把 email 填進 username、email 欄位空的帳號）
      //   防止「admin 已建帳號但 email 欄位空 → 登入找不到 → 又建一個 pending」的重複問題
      if (!adminAccount && firebaseEmail) {
        const emailMatch = await db.query.adminAccounts.findFirst({
          where: and(
            eq(adminAccounts.fieldId, field.id),
            or(eq(adminAccounts.email, firebaseEmail), eq(adminAccounts.username, firebaseEmail)),
          ),
        });
        if (emailMatch && emailMatch.status === "active") {
          // 即使已有 firebase_user_id 也允許更新（支援多裝置/多登入方式切換）
          // 🆕 順便補 email 欄位（若先前為空）→ 之後就能用 email 比對
          await db.update(adminAccounts)
            .set({
              firebaseUserId,
              displayName: firebaseDisplayName || emailMatch.displayName,
              email: emailMatch.email ?? firebaseEmail,
            })
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

  // ============================================================================
  // 🔄 POST /api/admin/switch-field — super_admin 跨場域切換（不用重登）
  // ============================================================================
  // 原理：用現有 admin session 驗證身分是 super_admin + active
  //       驗證通過後，對同一個 adminAccount 生成新 token，但 fieldId = 目標場域
  //       前端拿到新 admin 後 queryClient.clear() + 可直接繼續使用
  //
  // 安全：用 requireAdminAuth 統一 middleware（attachAdmin 已驗 cookie/JWT/session/active）
  //       避免之前手動驗章繞過 + 未來 requireAdminAuth 加新檢查時容易漏同步
  app.post("/api/admin/switch-field", requireAdminAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // attachAdmin 已驗：cookie/JWT/session/account.status === "active"
      // requireAdminAuth 已驗：req.admin 存在
      const admin = req.admin!;

      // super_admin 檢查（業務邏輯特定、attachAdmin 不做這個）
      if (admin.systemRole !== "super_admin") {
        return res.status(403).json({ message: "僅超級管理員可跨場域切換" });
      }

      // 驗證目標場域
      const { fieldCode } = req.body as { fieldCode?: string };
      if (!fieldCode) return res.status(400).json({ message: "需指定 fieldCode" });
      const targetField = await db.query.fields.findFirst({
        where: eq(fields.code, fieldCode.toUpperCase()),
      });
      if (!targetField) {
        return res.status(404).json({ message: "找不到此場域" });
      }

      const sessionSecret = process.env.SESSION_SECRET;
      if (!sessionSecret) {
        return res.status(500).json({ message: "伺服器設定錯誤" });
      }

      // 取得帳號 firebaseUserId（switch-field 仍需重簽 JWT、需要原 firebaseUserId）
      const currentAcct = await db.query.adminAccounts.findFirst({
        where: eq(adminAccounts.id, admin.id),
      });
      if (!currentAcct) {
        return res.status(404).json({ message: "帳號異常" });
      }

      // 權限確認完成：取 role / permissions
      const rolePerms = currentAcct.roleId
        ? await db.query.rolePermissions.findMany({
            where: eq(rolePermissions.roleId, currentAcct.roleId),
            with: { permission: true },
          })
        : [];
      const permissionKeys = rolePerms
        .filter((rp) => rp.allow)
        .map((rp) => rp.permission?.key)
        .filter((k): k is string => !!k);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // 生新 token（fieldId = 目標場域）
      const newToken = jwt.sign(
        {
          sub: currentAcct.id,
          fieldId: targetField.id,
          roleId: currentAcct.roleId,
          firebaseUserId: currentAcct.firebaseUserId,
          type: "admin",
        },
        sessionSecret,
        { expiresIn: "24h" },
      );

      await db.insert(adminSessions).values({
        adminAccountId: currentAcct.id,
        token: newToken,
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
        expiresAt,
      });

      await logAuditAction({
        actorAdminId: currentAcct.id,
        action: "admin:switch_field",
        targetType: "field",
        targetId: targetField.id,
        fieldId: targetField.id,
        metadata: { fromFieldId: currentAcct.fieldId, toFieldCode: fieldCode },
        ipAddress: req.ip || undefined,
        userAgent: req.headers["user-agent"],
      });

      res.cookie("adminToken", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        admin: {
          id: currentAcct.id,
          accountId: currentAcct.id,
          fieldId: targetField.id,
          fieldCode: targetField.code,
          fieldName: targetField.name,
          displayName: currentAcct.displayName,
          roleId: currentAcct.roleId,
          systemRole: "super_admin",
          permissions: permissionKeys,
        },
      });
    } catch (error) {
      console.error("[switch-field]", error);
      res.status(500).json({ message: "切換場域失敗" });
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
      // 🔒 暴力破解防護：per-IP 失敗計數
      const clientIp = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
      const nowMs = Date.now();
      const failure = ownerLoginFailures.get(clientIp);
      if (failure && nowMs < failure.resetAt && failure.count >= OWNER_LOGIN_MAX_FAILURES) {
        const remainMin = Math.ceil((failure.resetAt - nowMs) / 60_000);
        return res.status(429).json({
          message: `登入嘗試次數過多，請 ${remainMin} 分鐘後再試`,
        });
      }

      const secret = req.headers["x-platform-secret"] as string | undefined;
      const configuredSecret = process.env.PLATFORM_OWNER_SECRET;
      const ownerEmail = process.env.PLATFORM_OWNER_EMAIL;

      if (!configuredSecret || !ownerEmail) {
        return res.status(503).json({
          message: "平台擁有者登入未設定（需環境變數 PLATFORM_OWNER_SECRET + PLATFORM_OWNER_EMAIL）",
        });
      }

      // 🔒 timing-safe 比對 + 失敗計數
      if (!secret || !timingSafeStringEqual(secret, configuredSecret)) {
        const next = failure && nowMs < failure.resetAt
          ? { count: failure.count + 1, resetAt: failure.resetAt }
          : { count: 1, resetAt: nowMs + OWNER_LOGIN_LOCK_MS };
        ownerLoginFailures.set(clientIp, next);
        return res.status(403).json({ message: "密鑰錯誤" });
      }

      // 成功 → 清除該 IP 的失敗計數
      ownerLoginFailures.delete(clientIp);

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

      // 🔥 關鍵修復：token.fieldId 優先於 account.fieldId
      //    super_admin 切換場域時，token.fieldId = 目標場域（HPSPACE）
      //    但 account.fieldId 永遠是原始場域（JIACHUN）
      //    前端 Sidebar / Header 的 fieldName 從這個 API 讀，一定要用 token 的
      const effectiveFieldId = decoded.fieldId || account.fieldId;
      const field = await db.query.fields.findFirst({
        where: eq(fields.id, effectiveFieldId),
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
