// 🔒 場域擁有權檢查 — 多租戶安全核心
//
// 目的：統一所有 admin 端點的「跨場域隔離」邏輯
//
// 規則：
//   - super_admin / platform_admin：通過所有檢查（可跨場域）
//   - field admin：只能存取 admin.fieldId 的資源
//   - 未綁定場域的 admin：拒絕（403）
//
// 用法（路由內）：
//   const ownership = checkFieldOwnership(req.admin, targetFieldId);
//   if (!ownership.ok) {
//     return res.status(ownership.status).json({ error: ownership.error });
//   }
//
import type { Response } from "express";

export interface AdminLike {
  fieldId?: string | null;
  systemRole?: string | null;
}

export type FieldOwnershipResult =
  | { ok: true; isPlatformAdmin: boolean }
  | { ok: false; status: number; error: string };

/**
 * 檢查 admin 是否有權存取指定 fieldId 的資源
 *
 * @param admin requireAdminAuth 注入的 admin object
 * @param targetFieldId 要存取的資源所屬 fieldId
 */
export function checkFieldOwnership(
  admin: AdminLike | undefined | null,
  targetFieldId: string | null | undefined,
): FieldOwnershipResult {
  if (!admin) {
    return { ok: false, status: 401, error: "未認證" };
  }

  const isPlatformAdmin = admin.systemRole === "super_admin"
    || admin.systemRole === "platform_admin";

  if (isPlatformAdmin) {
    return { ok: true, isPlatformAdmin: true };
  }

  if (!admin.fieldId) {
    return { ok: false, status: 403, error: "管理員未綁定場域" };
  }

  if (!targetFieldId) {
    return { ok: false, status: 400, error: "缺少 fieldId" };
  }

  if (admin.fieldId !== targetFieldId) {
    return { ok: false, status: 403, error: "無權存取其他場域的資源" };
  }

  return { ok: true, isPlatformAdmin: false };
}

/**
 * 簡化版：直接寫入 res 並回 boolean（true = 通過）
 * 適合在路由 handler 內快速使用：
 *   if (!assertFieldOwnership(req.admin, fieldId, res)) return;
 */
export function assertFieldOwnership(
  admin: AdminLike | undefined | null,
  targetFieldId: string | null | undefined,
  res: Response,
): boolean {
  const result = checkFieldOwnership(admin, targetFieldId);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return false;
  }
  return true;
}
