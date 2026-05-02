// 🔐 LINE Admin 認證（W15 D5）
//
// 用途：判斷 LINE userId 是否為 admin、取得對應 fieldId
//
// 環境變數（簡化版、避免 schema 變動）：
//   LINE_ADMIN_USER_IDS              - 逗號分隔 LINE userId（必須以 U 開頭、33 字元）
//   LINE_ADMIN_FIELD_<userIdShort>   - 該 admin 對應 fieldId（可選、未設則建場無 fieldId）
//
// 範例 .env：
//   LINE_ADMIN_USER_IDS=Uabc123def456,Uxyz789ghi012
//   LINE_ADMIN_FIELD_Uabc123def=field-uuid-1
//   LINE_ADMIN_FIELD_Uxyz789ghi=field-uuid-2
//
// 為什麼用環境變數而非 DB schema？
//   - 紅線：「Schema 只新增不刪除」、能不動 schema 就不動
//   - admin 數量極少（< 10）、用環境變數管理夠用
//   - W16 評估是否需 admin schema 補完整 mapping

/**
 * 檢查 LINE userId 是否為 admin
 *
 * @example
 *   if (isLineUserAdmin("Uabc123def456")) { ... }
 */
export function isLineUserAdmin(lineUserId: string | undefined): boolean {
  if (!lineUserId) return false;
  const adminIds = (process.env.LINE_ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(lineUserId);
}

/**
 * 取得 LINE admin 對應的 fieldId
 *
 * 取法：用 userId 前 10 字元（含 U）作為環境變數 key 後綴
 *   userId "Uabc123def456..." → key LINE_ADMIN_FIELD_Uabc123def
 *
 * 無設定 → 回 null（建場時 fieldId 也是 null）
 */
export function getAdminFieldId(lineUserId: string | undefined): string | null {
  if (!lineUserId) return null;
  const shortId = lineUserId.slice(0, 10); // 前 10 字元（U + 9）
  const fieldId = process.env[`LINE_ADMIN_FIELD_${shortId}`];
  return fieldId || null;
}

/**
 * 取得目前 admin 設定狀態（給 health 檢查用）
 */
export function getLineAdminStatus(): {
  configured: boolean;
  adminCount: number;
} {
  const adminIds = (process.env.LINE_ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    configured: adminIds.length > 0,
    adminCount: adminIds.length,
  };
}
