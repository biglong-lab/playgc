import { describe, expect, it } from "vitest";
import {
  validateSquadName,
  checkRenameCooldown,
  computeDissolveLockUntil,
  isNameLocked,
  RENAME_CONFIG,
} from "../squad-rename";

describe("squad-rename", () => {
  describe("validateSquadName", () => {
    it("接受合法名稱", () => {
      expect(validateSquadName("火焰戰士").valid).toBe(true);
      expect(validateSquadName("Team Alpha").valid).toBe(true);
    });

    it("拒絕過短", () => {
      expect(validateSquadName("a").valid).toBe(false);
    });

    it("拒絕過長", () => {
      expect(validateSquadName("a".repeat(51)).valid).toBe(false);
    });

    it("拒絕系統保留字", () => {
      expect(validateSquadName("官方代表隊").valid).toBe(false);
      expect(validateSquadName("Admin Squad").valid).toBe(false);
      expect(validateSquadName("平台公會").valid).toBe(false);
    });

    it("空字串拒絕", () => {
      expect(validateSquadName("").valid).toBe(false);
      expect(validateSquadName("   ").valid).toBe(false);
    });

    it("自訂禁字清單", () => {
      const r = validateSquadName("壞蛋隊", { forbiddenWords: ["壞蛋"] });
      expect(r.valid).toBe(false);
      expect(r.reason).toContain("壞蛋");
    });
  });

  describe("checkRenameCooldown", () => {
    const now = new Date("2026-04-25T00:00:00Z");

    it("從未改過 → 可改", () => {
      const result = checkRenameCooldown({
        createdAt: "2026-04-20T00:00:00Z",
        nameChangedAt: null,
        now,
      });
      expect(result.allowed).toBe(true);
    });

    it("剛改過（1 天前）→ 拒絕", () => {
      const oneDayAgo = new Date(now.getTime() - 86400 * 1000);
      const result = checkRenameCooldown({
        createdAt: "2026-01-01T00:00:00Z",
        nameChangedAt: oneDayAgo,
        now,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("29 天");
      expect(result.remainingMs).toBeGreaterThan(0);
    });

    it("剛改過（10 天前）→ 拒絕", () => {
      const tenDaysAgo = new Date(now.getTime() - 10 * 86400 * 1000);
      const result = checkRenameCooldown({
        createdAt: "2026-01-01T00:00:00Z",
        nameChangedAt: tenDaysAgo,
        now,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("20 天");
    });

    it("改過剛好 30 天 → 可改", () => {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000);
      const result = checkRenameCooldown({
        createdAt: "2026-01-01T00:00:00Z",
        nameChangedAt: thirtyDaysAgo,
        now,
      });
      expect(result.allowed).toBe(true);
    });

    it("改過超過 30 天 → 可改", () => {
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400 * 1000);
      const result = checkRenameCooldown({
        createdAt: "2026-01-01T00:00:00Z",
        nameChangedAt: sixtyDaysAgo,
        now,
      });
      expect(result.allowed).toBe(true);
    });

    it("nextAvailableAt 計算正確", () => {
      const lastChanged = new Date(now.getTime() - 5 * 86400 * 1000);
      const result = checkRenameCooldown({
        createdAt: "2026-01-01T00:00:00Z",
        nameChangedAt: lastChanged,
        now,
      });
      expect(result.allowed).toBe(false);
      const expected = lastChanged.getTime() + 30 * 86400 * 1000;
      expect(result.nextAvailableAt!.getTime()).toBe(expected);
    });

    it("異常資料 → 直接放行", () => {
      const result = checkRenameCooldown({
        createdAt: "2026-01-01T00:00:00Z",
        nameChangedAt: "not-a-date",
        now,
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("computeDissolveLockUntil", () => {
    it("回傳 180 天後的時間", () => {
      const now = new Date("2026-04-25T00:00:00Z");
      const result = computeDissolveLockUntil(now);
      const diff = result.getTime() - now.getTime();
      expect(diff).toBe(180 * 86400 * 1000);
    });
  });

  describe("isNameLocked", () => {
    const now = new Date("2026-04-25T00:00:00Z");

    it("鎖未到期 → 仍鎖定", () => {
      const future = new Date(now.getTime() + 86400 * 1000);
      expect(isNameLocked(future, now)).toBe(true);
    });

    it("鎖已到期 → 可用", () => {
      const past = new Date(now.getTime() - 86400 * 1000);
      expect(isNameLocked(past, now)).toBe(false);
    });

    it("剛好到期 → 可用", () => {
      expect(isNameLocked(now, now)).toBe(false);
    });

    it("無效日期 → 視為可用", () => {
      expect(isNameLocked("not-a-date", now)).toBe(false);
    });
  });

  describe("RENAME_CONFIG 常數正確", () => {
    it("符合設計文件 §17.3", () => {
      expect(RENAME_CONFIG.FIRST_RENAME_GRACE_DAYS).toBe(7);
      expect(RENAME_CONFIG.RENAME_COOLDOWN_DAYS).toBe(30);
      expect(RENAME_CONFIG.DISSOLVE_LOCK_DAYS).toBe(180);
    });
  });
});
