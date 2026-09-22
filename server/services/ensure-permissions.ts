// 🔑 權限鍵啟動同步（P2 底座，2026-09-23）
//
// 部署安全：deploy.sh 不跑遷移 → 新權限鍵要在啟動時冪等補齊（同 ensureGameColumns 的作法）。
// 只做兩件事，兩件都「只加不刪」：
//   1. permissions 表補上目錄裡還沒有的鍵
//   2. 依 PERMISSION_BACKFILL 把新鍵補發給既有角色（原本有 A 的角色補發 B）
//      → 之後把路由檢查從 game:edit 換成細鍵時，現有角色不會突然打不開
//
// 不做：刪除多餘的鍵、收回任何角色的權限（那要業主決定，不能悄悄改）
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { permissions, rolePermissions } from "@shared/schema";
import { PERMISSION_BACKFILL, PERMISSION_CATALOG } from "@shared/lib/permission-catalog";

/** 目錄裡有、DB 沒有的鍵 → 建立；回傳新增了幾個 */
async function insertMissingPermissions(): Promise<number> {
  const existing = await db.select({ key: permissions.key }).from(permissions);
  const have = new Set(existing.map((r) => r.key));
  const missing = PERMISSION_CATALOG.filter((p) => !have.has(p.key));
  if (missing.length === 0) return 0;
  await db.insert(permissions).values(
    missing.map((p) => ({ key: p.key, name: p.name, description: p.description, category: p.category })),
  ).onConflictDoNothing();
  return missing.length;
}

/** key → permission id（只查目錄內用得到的鍵） */
async function loadPermissionIds(keys: string[]): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const rows = await db
    .select({ id: permissions.id, key: permissions.key })
    .from(permissions)
    .where(inArray(permissions.key, keys));
  return new Map(rows.map((r) => [r.key, r.id]));
}

/** 依對照表補發新鍵給既有角色；回傳補發了幾筆 */
async function backfillRolePermissions(): Promise<number> {
  const keys = Array.from(new Set(PERMISSION_BACKFILL.flatMap((rule) => [rule.when, ...rule.grant])));
  const idByKey = await loadPermissionIds(keys);
  let granted = 0;

  for (const rule of PERMISSION_BACKFILL) {
    const sourceId = idByKey.get(rule.when);
    if (!sourceId) continue;
    const sourceRoles = await db
      .select({ roleId: rolePermissions.roleId })
      .from(rolePermissions)
      .where(and(eq(rolePermissions.permissionId, sourceId), eq(rolePermissions.allow, true)));
    if (sourceRoles.length === 0) continue;

    for (const grantKey of rule.grant) {
      const grantId = idByKey.get(grantKey);
      if (!grantId) continue;
      const already = await db
        .select({ roleId: rolePermissions.roleId })
        .from(rolePermissions)
        .where(eq(rolePermissions.permissionId, grantId));
      const alreadySet = new Set(already.map((r) => r.roleId));
      const rows = sourceRoles
        .filter((r) => !alreadySet.has(r.roleId))
        .map((r) => ({ roleId: r.roleId, permissionId: grantId, allow: true }));
      if (rows.length === 0) continue;
      await db.insert(rolePermissions).values(rows).onConflictDoNothing();
      granted += rows.length;
    }
  }
  return granted;
}

export async function ensurePermissionCatalog(): Promise<{ added: number; granted: number }> {
  const added = await insertMissingPermissions();
  const granted = await backfillRolePermissions();
  if (added || granted) {
    console.warn(`[permissions] 補齊權限鍵 ${added} 個、補發給角色 ${granted} 筆`);
  }
  return { added, granted };
}
