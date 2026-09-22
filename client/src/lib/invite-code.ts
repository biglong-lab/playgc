// 🔗 分享連結上的 ?code= 邀請碼（組隊大廳 / 賽事大廳共用）
/**
 * 從 URL search string 解出 ?code= 邀請碼
 * 例如 ?code=ABC123 → "ABC123"
 *      不存在或為空 → ""
 */
export function parseInviteCode(search: string): string {
  try {
    const params = new URLSearchParams(search);
    const code = params.get("code") ?? "";
    // 限定 4-8 位英數（防注入用，Server 端再次驗證）
    return /^[A-Z0-9]{4,8}$/i.test(code) ? code.toUpperCase() : "";
  } catch {
    return "";
  }
}
