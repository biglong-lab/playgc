// 🏗️ 場域層級權限規則（2026-09-23，前後端共用）
//
// 建立新場域是平台級操作（防場域管理員無限增生場域 + 自動取得管理權）。
// 後端 POST /api/admin/fields 與前端「新增場域」按鈕共用同一份規則：看不到就打不到。

export const FIELD_CREATOR_ROLES: readonly string[] = ["super_admin", "platform_admin"];

/** 此系統角色能否建立新場域 */
export function canCreateField(systemRole: string | null | undefined): boolean {
  return !!systemRole && FIELD_CREATOR_ROLES.includes(systemRole);
}
