// 🧑 玩家顯示名稱統一邏輯（shared — 前後端通用）
//
// 需求背景：
// - 玩家可用 Google 帳號登入（有 firstName/email）
// - 也可用 Firebase 匿名登入（email 是 user-xxx@firebase.local，沒 firstName）
// - 匿名玩家可在 session.playerName 自訂暱稱
//
// 顯示優先序：
// 1. users.firstName + users.lastName（真實姓名）
// 2. users.email 前綴（但非 @firebase.local 偽 email）
// 3. session.playerName（匿名自訂暱稱）
// 4. "玩家" 最終 fallback

/** 匿名登入時 upsertUser 產生的假 email domain */
export const ANONYMOUS_EMAIL_DOMAIN = "@firebase.local";

export interface PlayerDisplaySource {
  /** session.playerName — 匿名玩家自訂暱稱 */
  playerName?: string | null;
  /** users.firstName */
  firstName?: string | null;
  /** users.lastName */
  lastName?: string | null;
  /** users.email（非 firebase.local 才有意義） */
  email?: string | null;
}

/**
 * 取得最佳顯示名稱
 * 呼叫點：管理端場次卡、AdminLive、Leaderboard、場次詳情 Dialog 等
 */
export function getPlayerDisplayName(src: PlayerDisplaySource): string {
  // 1. 真實姓名（firstName + lastName 組合）
  const fullName = [src.firstName, src.lastName]
    .map((n) => n?.trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;

  // 2. email 前綴（非 firebase.local 偽 email）
  if (src.email && !src.email.toLowerCase().endsWith(ANONYMOUS_EMAIL_DOMAIN)) {
    const prefix = src.email.split("@")[0];
    if (prefix) return prefix;
  }

  // 3. session.playerName — 匿名玩家自訂
  const trimmed = src.playerName?.trim();
  if (trimmed) return trimmed;

  // 4. 最終 fallback
  return "玩家";
}

/**
 * 判斷此玩家是否為匿名（Firebase 匿名登入，無 Google 資訊）
 * 用於決定是否顯示「匿名不累積積分」警示、是否觸發命名 Dialog
 */
export function isAnonymousPlayer(src: PlayerDisplaySource): boolean {
  // 有 firstName / lastName 即非匿名
  if (src.firstName?.trim() || src.lastName?.trim()) return false;
  // 有真實 email（非 firebase.local）即非匿名
  if (src.email && !src.email.toLowerCase().endsWith(ANONYMOUS_EMAIL_DOMAIN)) {
    return false;
  }
  return true;
}

/**
 * 產生玩家頭像文字（2 字內）
 * 若有名字取首字；匿名時用 "👤" 或 playerName 首字
 */
export function getPlayerInitials(src: PlayerDisplaySource): string {
  const fullName = [src.firstName, src.lastName]
    .map((n) => n?.trim())
    .filter(Boolean)
    .join("");
  if (fullName) return fullName.slice(0, 2).toUpperCase();

  if (src.email && !src.email.toLowerCase().endsWith(ANONYMOUS_EMAIL_DOMAIN)) {
    return src.email[0].toUpperCase();
  }

  if (src.playerName?.trim()) {
    return src.playerName.trim().slice(0, 2);
  }

  return "👤";
}

/**
 * 檢查使用者輸入的自訂暱稱是否合法
 * 2-20 字，不允許純空白
 */
export function validatePlayerName(
  input: string,
): { valid: true; value: string } | { valid: false; message: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, message: "暱稱不能為空" };
  }
  if (trimmed.length < 2) {
    return { valid: false, message: "暱稱至少 2 個字" };
  }
  if (trimmed.length > 20) {
    return { valid: false, message: "暱稱最多 20 個字" };
  }
  // 防範跨站腳本 / HTML 注入基礎
  if (/[<>"'&]/.test(trimmed)) {
    return { valid: false, message: "暱稱不可包含特殊字元（< > \" ' &）" };
  }
  return { valid: true, value: trimmed };
}
