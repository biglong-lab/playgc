// 隊名改名規則 — 純函式（可單元測試）
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §17.3 §17.4
//
// 規則：
//   1. 建立後 7 天內可改 1 次（防錯字）
//   2. 之後每次改名間隔 30 天
//   3. 解散後鎖名 180 天
//   4. 改名歷史保留（不可刪）

const FIRST_RENAME_GRACE_DAYS = 7;
const RENAME_COOLDOWN_DAYS = 30;
const DISSOLVE_LOCK_DAYS = 180;

/** 隊名規則檢查（同步）*/
export interface NameValidationOptions {
  forbiddenWords?: string[]; // 系統保留字
  minLen?: number;
  maxLen?: number;
}

export interface NameValidationResult {
  valid: boolean;
  reason?: string;
}

const DEFAULT_FORBIDDEN = [
  "官方",
  "admin",
  "Admin",
  "ADMIN",
  "平台",
  "system",
  "System",
  "管理員",
  "moderator",
  "Moderator",
];

export function validateSquadName(
  name: string,
  options: NameValidationOptions = {},
): NameValidationResult {
  const minLen = options.minLen ?? 2;
  const maxLen = options.maxLen ?? 50;
  const forbidden = options.forbiddenWords ?? DEFAULT_FORBIDDEN;

  if (typeof name !== "string") {
    return { valid: false, reason: "格式錯誤" };
  }
  const trimmed = name.trim();
  if (trimmed.length < minLen) {
    return { valid: false, reason: `名稱至少 ${minLen} 個字元` };
  }
  if (trimmed.length > maxLen) {
    return { valid: false, reason: `名稱不可超過 ${maxLen} 個字元` };
  }

  const lower = trimmed.toLowerCase();
  for (const word of forbidden) {
    if (lower.includes(word.toLowerCase())) {
      return { valid: false, reason: `名稱不可包含「${word}」` };
    }
  }

  return { valid: true };
}

/** 改名冷卻檢查 */
export interface RenameCooldownInput {
  /** 隊伍建立時間 */
  createdAt: Date | string;
  /** 上次改名時間（null 表示從未改過）*/
  nameChangedAt?: Date | string | null;
  /** 現在時間（測試用） */
  now?: Date;
}

export interface RenameCooldownResult {
  allowed: boolean;
  reason?: string;
  /** 還需要等多久才能改（毫秒，0 表示已可改）*/
  remainingMs?: number;
  /** 下一個可改名的時間 */
  nextAvailableAt?: Date;
}

/**
 * 計算改名冷卻
 *
 * 規則：
 *   1. 從未改過 + 建立 < 7 天 → 可改（grace period）
 *   2. 從未改過 + 建立 >= 7 天 → 可改（首次正式改名）
 *   3. 上次改過 < 30 天 → 拒絕，告知還需多久
 *   4. 上次改過 >= 30 天 → 可改
 */
export function checkRenameCooldown(
  input: RenameCooldownInput,
): RenameCooldownResult {
  const now = input.now ?? new Date();
  const created = new Date(input.createdAt);
  if (Number.isNaN(created.getTime())) {
    return { allowed: false, reason: "建立時間異常" };
  }

  // 從未改過 → 可改（不論 grace period 還是 7 天後）
  if (!input.nameChangedAt) {
    return { allowed: true };
  }

  const lastChanged = new Date(input.nameChangedAt);
  if (Number.isNaN(lastChanged.getTime())) {
    return { allowed: true }; // 異常資料 → 直接放行
  }

  const cooldownMs = RENAME_COOLDOWN_DAYS * 86400 * 1000;
  const elapsed = now.getTime() - lastChanged.getTime();

  if (elapsed >= cooldownMs) {
    return { allowed: true };
  }

  const remainingMs = cooldownMs - elapsed;
  const remainingDays = Math.ceil(remainingMs / (86400 * 1000));
  return {
    allowed: false,
    reason: `改名冷卻中，還需 ${remainingDays} 天`,
    remainingMs,
    nextAvailableAt: new Date(lastChanged.getTime() + cooldownMs),
  };
}

/** 解散後鎖名期限 */
export function computeDissolveLockUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + DISSOLVE_LOCK_DAYS * 86400 * 1000);
}

/** 判斷某個鎖是否仍有效 */
export function isNameLocked(
  lockedUntil: Date | string,
  now: Date = new Date(),
): boolean {
  const lock = new Date(lockedUntil);
  if (Number.isNaN(lock.getTime())) return false;
  return now < lock;
}

export const RENAME_CONFIG = {
  FIRST_RENAME_GRACE_DAYS,
  RENAME_COOLDOWN_DAYS,
  DISSOLVE_LOCK_DAYS,
};
