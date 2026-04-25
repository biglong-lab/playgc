// 推廣連結 token 工具 — 純函式（可單元測試）
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13.4 §20.7
import crypto from "crypto";

/**
 * 產生 32 字元 URL-safe token
 * 24 bytes random → base64url encode → 32 chars
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("base64url").slice(0, 32);
}

/**
 * 驗證 token 格式（防 SQL injection / 異常請求）
 * 規則：22-32 字元，限 base64url 字元集（A-Za-z0-9_-）
 */
export function isValidInviteToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length < 16 || token.length > 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(token);
}

/**
 * 產生 invite 分享 URL
 */
export function buildInviteShareUrl(token: string, baseUrl?: string): string {
  const root = baseUrl ?? process.env.PUBLIC_BASE_URL ?? "";
  return `${root}/invite/squad/${token}`;
}

/**
 * 計算過期時間（給定天數，回傳 Date 或 null）
 */
export function computeInviteExpiry(days?: number): Date | null {
  if (!days || days <= 0) return null;
  return new Date(Date.now() + days * 86400_000);
}

/**
 * 判斷邀請是否仍有效
 */
export function isInviteValid(invite: {
  expiresAt?: Date | string | null;
  inviteeUserId?: string | null;
}): { valid: boolean; reason?: string } {
  if (invite.inviteeUserId) {
    return { valid: false, reason: "already_accepted" };
  }
  if (invite.expiresAt) {
    const exp = invite.expiresAt instanceof Date
      ? invite.expiresAt
      : new Date(invite.expiresAt);
    if (Number.isNaN(exp.getTime())) {
      return { valid: false, reason: "invalid_date" };
    }
    if (new Date() > exp) {
      return { valid: false, reason: "expired" };
    }
  }
  return { valid: true };
}

/**
 * 計算招募獎勵（超級隊長 ×2）
 */
export function calcRecruitReward(opts: {
  isSuperLeader: boolean;
  baseExp?: number;
}): { expBonus: number; multiplier: number } {
  const base = opts.baseExp ?? 50;
  const multiplier = opts.isSuperLeader ? 2 : 1;
  return {
    expBonus: base * multiplier,
    multiplier,
  };
}
