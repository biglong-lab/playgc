import { describe, expect, it } from "vitest";
import {
  generateInviteToken,
  isValidInviteToken,
  buildInviteShareUrl,
  computeInviteExpiry,
  isInviteValid,
  calcRecruitReward,
} from "../invite-token";

describe("invite-token", () => {
  describe("generateInviteToken", () => {
    it("產生 32 字元的 token", () => {
      const token = generateInviteToken();
      expect(token).toHaveLength(32);
    });

    it("token 為 URL-safe（不含 +/= 等）", () => {
      const token = generateInviteToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("每次產生的 token 不同（避免衝突）", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateInviteToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe("isValidInviteToken", () => {
    it("接受合法格式", () => {
      expect(isValidInviteToken("abcDEF123_-XYZ_abc")).toBe(true);
      expect(isValidInviteToken("a".repeat(32))).toBe(true);
      expect(isValidInviteToken(generateInviteToken())).toBe(true);
    });

    it("拒絕長度過短", () => {
      expect(isValidInviteToken("abc")).toBe(false);
    });

    it("拒絕長度過長", () => {
      expect(isValidInviteToken("a".repeat(100))).toBe(false);
    });

    it("拒絕特殊字元（防 SQL injection）", () => {
      expect(isValidInviteToken("abc'or'1=1")).toBe(false);
      expect(isValidInviteToken("abc<script>")).toBe(false);
      expect(isValidInviteToken("abc/../../etc")).toBe(false);
    });

    it("拒絕非字串", () => {
      expect(isValidInviteToken(null)).toBe(false);
      expect(isValidInviteToken(undefined)).toBe(false);
      expect(isValidInviteToken(123)).toBe(false);
      expect(isValidInviteToken({})).toBe(false);
    });
  });

  describe("buildInviteShareUrl", () => {
    it("用提供的 baseUrl", () => {
      expect(buildInviteShareUrl("abc", "https://example.com")).toBe(
        "https://example.com/invite/squad/abc",
      );
    });

    it("無 baseUrl 時使用相對路徑", () => {
      const url = buildInviteShareUrl("xyz", "");
      expect(url).toBe("/invite/squad/xyz");
    });
  });

  describe("computeInviteExpiry", () => {
    it("days 不提供時回 null（永久）", () => {
      expect(computeInviteExpiry()).toBeNull();
      expect(computeInviteExpiry(0)).toBeNull();
    });

    it("回傳正確的未來時間", () => {
      const result = computeInviteExpiry(7);
      expect(result).not.toBeNull();
      const now = Date.now();
      const diff = result!.getTime() - now;
      // 允許 1 秒誤差
      expect(diff).toBeGreaterThan(7 * 86400_000 - 1000);
      expect(diff).toBeLessThan(7 * 86400_000 + 1000);
    });
  });

  describe("isInviteValid", () => {
    it("無 expiresAt + 未被接受 → valid", () => {
      expect(isInviteValid({ expiresAt: null })).toEqual({ valid: true });
    });

    it("已被接受 → invalid", () => {
      expect(isInviteValid({ inviteeUserId: "user_123" })).toEqual({
        valid: false,
        reason: "already_accepted",
      });
    });

    it("已過期 → invalid", () => {
      const past = new Date(Date.now() - 86400_000);
      expect(isInviteValid({ expiresAt: past })).toEqual({
        valid: false,
        reason: "expired",
      });
    });

    it("未過期 → valid", () => {
      const future = new Date(Date.now() + 86400_000);
      expect(isInviteValid({ expiresAt: future })).toEqual({ valid: true });
    });

    it("接受字串型別的 expiresAt", () => {
      const future = new Date(Date.now() + 86400_000).toISOString();
      expect(isInviteValid({ expiresAt: future })).toEqual({ valid: true });
    });

    it("拒絕無效日期", () => {
      expect(isInviteValid({ expiresAt: "not-a-date" })).toEqual({
        valid: false,
        reason: "invalid_date",
      });
    });
  });

  describe("calcRecruitReward", () => {
    it("一般隊伍 ×1（50 點）", () => {
      expect(calcRecruitReward({ isSuperLeader: false })).toEqual({
        expBonus: 50,
        multiplier: 1,
      });
    });

    it("超級隊長 ×2（100 點）", () => {
      expect(calcRecruitReward({ isSuperLeader: true })).toEqual({
        expBonus: 100,
        multiplier: 2,
      });
    });

    it("自訂 baseExp", () => {
      expect(calcRecruitReward({ isSuperLeader: false, baseExp: 30 })).toEqual({
        expBonus: 30,
        multiplier: 1,
      });
      expect(calcRecruitReward({ isSuperLeader: true, baseExp: 30 })).toEqual({
        expBonus: 60,
        multiplier: 2,
      });
    });
  });
});
