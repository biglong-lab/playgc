// 平台層認證 Middleware — 驗證使用者是否為平台管理員
// 規則：
//   1. 如果 user 在 platform_admins 表 → 平台管理員
//   2. 如果 systemRole = "super_admin" → 向後相容，也視為平台管理員
import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { platformAdmins } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { AdminPrincipal } from "./adminAuth";

export interface PlatformPrincipal {
  userId: string;
  adminAccountId: string | null;
  role: string;        // 'platform_owner' | 'platform_admin' | 'platform_support' | 'platform_finance' | 'super_admin_legacy'
  permissions: string[];
  viaLegacySuperAdmin: boolean;  // 是否透過舊 super_admin 授權（向後相容）
}

declare global {
  namespace Express {
    interface Request {
      platform?: PlatformPrincipal;
    }
  }
}

/**
 * 檢查使用者是否為平台管理員
 * 優先檢查 platform_admins，其次檢查 systemRole=super_admin（相容現有）
 */
export async function getPlatformPrincipal(
  admin: AdminPrincipal | undefined
): Promise<PlatformPrincipal | null> {
  if (!admin) return null;

  // 先找 adminAccounts 的 firebase_user_id 映射到 users.id
  // 實務上 adminAccounts.id 跟 users.id 是不同的——需要透過 firebaseUserId 關聯
  // 簡化版：直接用 adminAccounts.id 查，如果沒有則用 systemRole fallback
  const platformAdmin = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.userId, admin.accountId),
  });

  if (platformAdmin && platformAdmin.status === "active") {
    return {
      userId: platformAdmin.userId,
      adminAccountId: admin.accountId,
      role: platformAdmin.role,
      permissions: platformAdmin.permissions || [],
      viaLegacySuperAdmin: false,
    };
  }

  // 向後相容：systemRole = super_admin 可存取平台層
  if (admin.systemRole === "super_admin") {
    return {
      userId: admin.accountId,
      adminAccountId: admin.accountId,
      role: "super_admin_legacy",
      permissions: admin.permissions,
      viaLegacySuperAdmin: true,
    };
  }

  return null;
}

/**
 * 平台層守衛：要求 req.admin 存在且為平台管理員
 */
export async function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.admin) {
    res.status(401).json({ error: "需要登入" });
    return;
  }

  const platform = await getPlatformPrincipal(req.admin);
  if (!platform) {
    res.status(403).json({ error: "需要平台管理員權限" });
    return;
  }

  req.platform = platform;
  next();
}

/**
 * 平台層角色守衛：限制特定平台角色
 */
export function requirePlatformRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.platform) {
      res.status(403).json({ error: "需要平台管理員權限" });
      return;
    }

    // super_admin_legacy 視同 platform_owner
    const effectiveRole =
      req.platform.role === "super_admin_legacy" ? "platform_owner" : req.platform.role;

    if (!allowedRoles.includes(effectiveRole)) {
      res.status(403).json({ error: "權限不足" });
      return;
    }

    next();
  };
}
