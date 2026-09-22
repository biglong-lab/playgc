// 🔐 POS / 現場模式可進入頁面規則（單一來源）
//
// 「看不到就打不到」：ProtectedAdminRoute 的導回判斷、POS 首頁按鈕顯示共用同一份規則，
// 避免按鈕顯示了、點下去卻被導回（死按鈕）。

/** 場域執行者 = 純現場人員：登入直接進現場模式、不看後台設定 */
export const FIELD_STAFF_ROLE = "field_executor";

/** 現場人員允許停留的頁面前綴，其餘 /admin 一律導回 /pos */
const FIELD_STAFF_ALLOWED_PREFIXES = ["/pos", "/admin/troubleshoot", "/admin/scenario-qr-print"] as const;

/**
 * POS 首頁連到的後台頁 → 該頁主要動作的後端權限
 * （對照 server/routes：品項寫入 / 垃圾桶還原 = game:edit；報表 API = pos_cash_admin；排解中心 = game:view）
 */
export const POS_ADMIN_PAGE_PERMISSIONS = {
  "/admin/troubleshoot": "game:view",
  "/admin/pos-products": "game:edit",
  "/admin/pos-reports": "pos_cash_admin",
  "/admin/pos-trash": "game:edit",
} as const;

export interface AdminAccess {
  systemRole?: string | null;
  hasPermission: (permission: string) => boolean;
}

/** 現場人員是否可停留在此路徑 */
export function isFieldStaffAllowedPath(loc: string): boolean {
  return FIELD_STAFF_ALLOWED_PREFIXES.some((prefix) => loc.startsWith(prefix));
}

/** 能否進入某頁：現場人員先過路徑白名單，再看該頁實際要求的權限 */
export function canOpenPage(path: string, access: AdminAccess, requiredPermission?: string): boolean {
  if (access.systemRole === FIELD_STAFF_ROLE && !isFieldStaffAllowedPath(path)) return false;
  return !requiredPermission || access.hasPermission(requiredPermission);
}
