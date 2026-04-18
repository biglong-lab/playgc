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
  if (!user || user.role !== "admin") {
    return { authorized: false, message: "Unauthorized: Admin role required" };
  }

  return { authorized: true, user };
}
