// 🎟️ 訪客帳號判斷（2026-09-22，前後端共用、給「非請求當下」判斷用）
//
// 請求當下優先用 token 的 signInProvider === "anonymous"（最準）。
// 事後要判斷某個 uid（例如隊長）是不是訪客時，只能看 users 資料：
//   - Firebase 匿名登入：users.email 是 user-<uid>@firebase.local 假信箱
//   - LINE 登入（custom token）：DB 也是假信箱，但 uid 固定是 line:<LINE userId>
//   → 假信箱且 uid 不是 line: 開頭 = 訪客

export const GUEST_EMAIL_DOMAIN = "@firebase.local";
const LINE_UID_PREFIX = "line:";

export function isGuestAccount(user: { id: string; email?: string | null } | null | undefined): boolean {
  if (!user) return false;
  const fakeEmail = !user.email || user.email.toLowerCase().endsWith(GUEST_EMAIL_DOMAIN);
  return fakeEmail && !user.id.startsWith(LINE_UID_PREFIX);
}
