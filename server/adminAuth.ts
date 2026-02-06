import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { adminAccounts, adminSessions, roles, rolePermissions, permissions, fields, auditLogs } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";

// 確保 JWT_SECRET 在啟動時已設定
function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET 環境變數必須設定，請在 .env 檔案中設定此變數");
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();
const TOKEN_EXPIRY = "24h";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface AdminPrincipal {
  id: string;
  accountId: string;
  fieldId: string;
  fieldCode: string;
  fieldName: string;
  username: string;
  displayName: string | null;
  roleId: string | null;
  systemRole: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPrincipal;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function adminLogin(
  fieldCode: string,
  username: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; token?: string; admin?: AdminPrincipal; error?: string }> {
  const field = await db.query.fields.findFirst({
    where: eq(fields.code, fieldCode.toUpperCase()),
  });

  if (!field) {
    return { success: false, error: "場域編號不存在" };
  }

  const account = await db.query.adminAccounts.findFirst({
    where: and(
      eq(adminAccounts.fieldId, field.id),
      eq(adminAccounts.username, username)
    ),
    with: {
      role: true,
    },
  });

  if (!account) {
    return { success: false, error: "帳號或密碼錯誤" };
  }

  if (account.status === "locked") {
    return { success: false, error: "帳號已被鎖定，請聯繫管理員" };
  }

  if (account.status === "inactive") {
    return { success: false, error: "帳號已停用" };
  }

  if ((account.failedLoginAttempts || 0) >= MAX_LOGIN_ATTEMPTS) {
    const lockoutUntil = new Date(account.updatedAt!);
    lockoutUntil.setMinutes(lockoutUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
    
    if (new Date() < lockoutUntil) {
      return { success: false, error: `帳號已鎖定，請於 ${LOCKOUT_DURATION_MINUTES} 分鐘後再試` };
    }
    
    await db
      .update(adminAccounts)
      .set({ failedLoginAttempts: 0 })
      .where(eq(adminAccounts.id, account.id));
  }

  if (!account.passwordHash) {
    return { success: false, error: "此帳號未設定密碼，請使用 Firebase 登入" };
  }

  const isValidPassword = await verifyPassword(password, account.passwordHash);
  
  if (!isValidPassword) {
    await db
      .update(adminAccounts)
      .set({ 
        failedLoginAttempts: (account.failedLoginAttempts || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(adminAccounts.id, account.id));
    
    return { success: false, error: "帳號或密碼錯誤" };
  }

  await db
    .update(adminAccounts)
    .set({ 
      failedLoginAttempts: 0,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
      updatedAt: new Date(),
    })
    .where(eq(adminAccounts.id, account.id));

  const adminPermissions = await getAdminPermissions(account.roleId);

  const adminPrincipal: AdminPrincipal = {
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
  };

  const token = generateToken({
    sub: account.id,
    fieldId: field.id,
    roleId: account.roleId,
    type: "admin",
  });

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  await db.insert(adminSessions).values({
    adminAccountId: account.id,
    token,
    ipAddress,
    userAgent,
    expiresAt,
  });

  await logAuditAction({
    actorAdminId: account.id,
    action: "admin:login",
    targetType: "admin_account",
    targetId: account.id,
    fieldId: field.id,
    metadata: { fieldCode },
    ipAddress,
    userAgent,
  });

  return { success: true, token, admin: adminPrincipal };
}

export async function getAdminPermissions(roleId: string | null): Promise<string[]> {
  if (!roleId) return [];

  const role = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
  });

  if (role?.systemRole === "super_admin") {
    const allPermissions = await db.query.permissions.findMany();
    return allPermissions.map(p => p.key);
  }

  const rolePerms = await db.query.rolePermissions.findMany({
    where: and(
      eq(rolePermissions.roleId, roleId),
      eq(rolePermissions.allow, true)
    ),
    with: {
      permission: true,
    },
  });

  return rolePerms.map(rp => rp.permission.key);
}

export async function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookieToken = req.cookies?.adminToken;
  const authHeader = req.headers.authorization;
  
  // Priority: cookie token first, then Authorization header
  // This prevents Firebase ID tokens from overriding admin JWT cookies
  let token: string | undefined;
  let decoded: any;
  
  // First try cookie token (admin-staff JWT)
  if (cookieToken) {
    decoded = verifyToken(cookieToken);
    if (decoded && decoded.type === "admin") {
      token = cookieToken;
    }
  }
  
  // Fall back to Authorization header only if cookie didn't validate
  if (!token && authHeader?.startsWith("Bearer ")) {
    const headerToken = authHeader.slice(7);
    decoded = verifyToken(headerToken);
    if (decoded && decoded.type === "admin") {
      token = headerToken;
    }
  }

  if (!token || !decoded) {
    next();
    return;
  }

  const session = await db.query.adminSessions.findFirst({
    where: and(
      eq(adminSessions.token, token),
      gt(adminSessions.expiresAt, new Date())
    ),
    with: {
      adminAccount: {
        with: {
          field: true,
          role: true,
        },
      },
    },
  });

  if (!session || !session.adminAccount) {
    next();
    return;
  }

  const account = session.adminAccount;
  const adminPermissions = await getAdminPermissions(account.roleId);

  req.admin = {
    id: account.id,
    accountId: account.id,
    fieldId: account.fieldId,
    fieldCode: account.field?.code || "",
    fieldName: account.field?.name || "",
    username: account.username || "",
    displayName: account.displayName,
    roleId: account.roleId,
    systemRole: account.role?.systemRole || "custom",
    permissions: adminPermissions,
  };

  next();
}

export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.admin) {
    res.status(401).json({ message: "請先登入管理後台" });
    return;
  }
  next();
}

export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ message: "請先登入管理後台" });
      return;
    }

    if (req.admin.systemRole === "super_admin") {
      next();
      return;
    }

    const hasPermission = requiredPermissions.some(
      perm => req.admin!.permissions.includes(perm)
    );

    if (!hasPermission) {
      res.status(403).json({ message: "權限不足" });
      return;
    }

    next();
  };
}

export function requireFieldAccess(fieldIdParam: string = "fieldId") {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ message: "請先登入管理後台" });
      return;
    }

    if (req.admin.systemRole === "super_admin") {
      next();
      return;
    }

    const requestedFieldId = req.params[fieldIdParam] || req.body[fieldIdParam] || req.query[fieldIdParam];
    
    if (requestedFieldId && requestedFieldId !== req.admin.fieldId) {
      res.status(403).json({ message: "無權存取此場域" });
      return;
    }

    next();
  };
}

export async function logAuditAction(data: {
  actorUserId?: string;
  actorAdminId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  fieldId?: string;
  metadata?: object;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: data.actorUserId,
      actorAdminId: data.actorAdminId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      fieldId: data.fieldId,
      metadata: data.metadata || {},
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  } catch {
    // 審計日誌寫入失敗不影響主流程
  }
}

export async function adminLogout(token: string): Promise<void> {
  await db
    .delete(adminSessions)
    .where(eq(adminSessions.token, token));
}

export async function createAdminAccount(data: {
  fieldId: string;
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  roleId?: string;
}): Promise<{ success: boolean; accountId?: string; error?: string }> {
  const existing = await db.query.adminAccounts.findFirst({
    where: and(
      eq(adminAccounts.fieldId, data.fieldId),
      eq(adminAccounts.username, data.username)
    ),
  });

  if (existing) {
    return { success: false, error: "此場域已存在相同帳號名稱" };
  }

  const passwordHash = await hashPassword(data.password);
  
  const [account] = await db.insert(adminAccounts).values({
    fieldId: data.fieldId,
    username: data.username,
    passwordHash,
    displayName: data.displayName,
    email: data.email,
    roleId: data.roleId,
    status: "active",
  }).returning();

  return { success: true, accountId: account.id };
}

export async function updateAdminPassword(
  accountId: string,
  newPassword: string
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(adminAccounts)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(adminAccounts.id, accountId));
}

// Unified admin context that supports both JWT admin and Firebase user authentication
export interface UnifiedAdminContext {
  source: "jwt" | "firebase";
  userId?: string;
  adminId?: string;
  fieldId: string | null;
  systemRole: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      unifiedAdmin?: UnifiedAdminContext;
    }
  }
}

// Middleware to resolve admin context from either JWT or Firebase authentication
export function resolveUnifiedAdminContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // First check for JWT admin (admin-staff system)
  if (req.admin) {
    req.unifiedAdmin = {
      source: "jwt",
      adminId: req.admin.id,
      fieldId: req.admin.fieldId,
      systemRole: req.admin.systemRole,
      permissions: req.admin.permissions,
      isSuperAdmin: req.admin.systemRole === "super_admin",
    };
    next();
    return;
  }

  // Then check for Firebase user (field admin system)
  const user = (req as any).user;
  if (user) {
    req.unifiedAdmin = {
      source: "firebase",
      userId: user.id,
      fieldId: user.defaultFieldId,
      systemRole: user.role === "admin" ? "field_manager" : "player",
      permissions: user.role === "admin" ? ["game:view", "game:edit", "page:view", "page:edit", "item:view", "item:edit"] : [],
      isSuperAdmin: false, // Firebase users are never super admins
    };
    next();
    return;
  }

  // No authentication found
  next();
}

// Middleware that requires unified admin authentication (works with both JWT and Firebase)
export function requireUnifiedAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.unifiedAdmin) {
    res.status(401).json({ message: "請先登入" });
    return;
  }
  next();
}

// Unified permission check that works with both authentication systems
export function requireUnifiedPermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.unifiedAdmin) {
      res.status(401).json({ message: "請先登入" });
      return;
    }

    // Super admins bypass all permission checks
    if (req.unifiedAdmin.isSuperAdmin) {
      next();
      return;
    }

    const hasPermission = requiredPermissions.some(
      perm => req.unifiedAdmin!.permissions.includes(perm)
    );

    if (!hasPermission) {
      res.status(403).json({ message: "權限不足" });
      return;
    }

    next();
  };
}
