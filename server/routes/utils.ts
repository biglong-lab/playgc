import { storage } from "../storage";
import type { AuthenticatedRequest } from "./types";
import type { User } from "@shared/schema";
import { z } from "zod";
import type { Response } from "express";

/**
 * 查詢 Firebase UID 對應的 admin_accounts（lazy import db 避免測試環境 eager load）。
 * 回傳可能的多筆（使用者可能在多個場域有 admin 身份）。
 */
async function getAdminAccountsByFirebaseUid(
  firebaseUid: string,
): Promise<Array<{ fieldId: string | null; systemRole: string | null }>> {
  try {
    const { db } = await import("../db");
    const { adminAccounts, roles } = await import("@shared/schema");
    const { and, eq } = await import("drizzle-orm");

    const rows = await db
      .select({
        fieldId: adminAccounts.fieldId,
        systemRole: roles.systemRole,
      })
      .from(adminAccounts)
      .leftJoin(roles, eq(roles.id, adminAccounts.roleId))
      .where(
        and(
          eq(adminAccounts.firebaseUserId, firebaseUid),
          eq(adminAccounts.status, "active"),
        ),
      )
      .limit(5);

    return rows;
  } catch {
    return [];
  }
}

/**
 * 取得該使用者可管理的場域。
 * legacy 全域 admin 與 super_admin 回 all=true（不限場域）。
 */
export async function getManageableFields(
  req: AuthenticatedRequest,
): Promise<{ all: boolean; fieldIds: string[] }> {
  const userId = req.user?.claims?.sub;
  if (!userId) return { all: false, fieldIds: [] };

  const user = await storage.getUser(userId);
  if (user?.role === "admin") return { all: true, fieldIds: [] };

  const rows = await getAdminAccountsByFirebaseUid(userId);
  if (rows.some((r) => r.systemRole === "super_admin")) {
    return { all: true, fieldIds: [] };
  }
  return {
    all: false,
    fieldIds: rows.map((r) => r.fieldId).filter((id): id is string => !!id),
  };
}

// UUID v4 格式驗證
const uuidSchema = z.string().uuid("無效的 ID 格式");

/** 驗證 ID 參數是否為合法 UUID，無效時自動回傳 400 */
export function validateId(id: string, res: Response): string | null {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    res.status(400).json({ error: "無效的 ID 格式" });
    return null;
  }
  return result.data;
}

export async function checkGameOwnership(req: AuthenticatedRequest, gameId: string): Promise<{ authorized: boolean; message?: string; user?: User; status?: number }> {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return { authorized: false, message: "Unauthorized", status: 401 };
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return { authorized: false, message: "User not found", status: 401 };
  }

  const game = await storage.getGame(gameId);
  if (!game) {
    return { authorized: false, message: "Game not found", status: 404 };
  }

  // 舊邏輯：users.role === "admin"（legacy 全域管理員）
  if (user.role === "admin") {
    return { authorized: true, user };
  }

  // 舊邏輯：遊戲建立者
  if (game.creatorId === userId) {
    return { authorized: true, user };
  }

  // 新邏輯：SaaS 多租戶 — 查 admin_accounts 確認是否為 super_admin 或場域管理員
  const adminRows = await getAdminAccountsByFirebaseUid(userId);

  for (const admin of adminRows) {
    // super_admin 可修改任何遊戲
    if (admin.systemRole === "super_admin") {
      return { authorized: true, user };
    }
    // 場域管理員 / 執行者可修改同場域的遊戲
    if (game.fieldId && admin.fieldId === game.fieldId) {
      return { authorized: true, user };
    }
  }

  return { authorized: false, message: "Unauthorized: You can only modify your own games", status: 403 };
}

export async function requireAdminRole(req: AuthenticatedRequest): Promise<{ authorized: boolean; message?: string; user?: User }> {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return { authorized: false, message: "Unauthorized" };
  }

  const user = await storage.getUser(userId);

  // 舊邏輯：users.role === "admin"（legacy 全域管理員）
  if (user?.role === "admin") {
    return { authorized: true, user };
  }

  // 新邏輯：SaaS 多租戶 — 查 admin_accounts（與 checkGameOwnership 同一套判定）
  // 🐛 2026-07-23：原本只認 users.role，導致以後台帳號登入的場域管理員
  //    （users.role 仍是 player）在 /admin/devices 全頁 403、無法新增設備。
  const adminRows = await getAdminAccountsByFirebaseUid(userId);
  if (adminRows.length > 0) {
    return { authorized: true, user: user ?? undefined };
  }

  return { authorized: false, message: "Unauthorized: Admin role required" };
}
