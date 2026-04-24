// 對戰中心共用標籤 lib 單元測試
import { describe, it, expect } from "vitest";
import {
  slotStatusLabel,
  skillLevelLabel,
  tierBgClass,
  tierBadgeClass,
  SLOT_STATUS_INFO,
  SKILL_LEVEL_LABEL,
  TIER_BG,
  TIER_BADGE,
} from "../battle-labels";

describe("battle-labels", () => {
  // ============================
  // slotStatusLabel
  // ============================
  describe("slotStatusLabel", () => {
    it("回傳對應中文標籤", () => {
      expect(slotStatusLabel("open")).toBe("開放報名");
      expect(slotStatusLabel("confirmed")).toBe("已成局");
      expect(slotStatusLabel("full")).toBe("已額滿");
      expect(slotStatusLabel("in_progress")).toBe("對戰中");
      expect(slotStatusLabel("completed")).toBe("已結束");
      expect(slotStatusLabel("cancelled")).toBe("已取消");
    });

    it("未知狀態 → 原樣回傳", () => {
      expect(slotStatusLabel("unknown_status")).toBe("unknown_status");
    });

    it("null/undefined → 「未知」", () => {
      expect(slotStatusLabel(null)).toBe("未知");
      expect(slotStatusLabel(undefined)).toBe("未知");
    });
  });

  // ============================
  // skillLevelLabel
  // ============================
  describe("skillLevelLabel", () => {
    it("回傳對應中文", () => {
      expect(skillLevelLabel("beginner")).toBe("初學者");
      expect(skillLevelLabel("intermediate")).toBe("中級");
      expect(skillLevelLabel("advanced")).toBe("高手");
    });

    it("expert 是 advanced 的 alias", () => {
      expect(skillLevelLabel("expert")).toBe("高手");
    });

    it("未知值 → 原樣回傳", () => {
      expect(skillLevelLabel("godlike")).toBe("godlike");
    });

    it("null/undefined → 「未填」", () => {
      expect(skillLevelLabel(null)).toBe("未填");
      expect(skillLevelLabel(undefined)).toBe("未填");
    });

    it("空字串 → 「未填」", () => {
      expect(skillLevelLabel("")).toBe("未填");
    });
  });

  // ============================
  // tierBgClass
  // ============================
  describe("tierBgClass", () => {
    it("回傳對應的 Tailwind class", () => {
      expect(tierBgClass("master")).toBe("bg-yellow-500/10 border-yellow-500/30");
      expect(tierBgClass("diamond")).toBe("bg-cyan-500/10 border-cyan-500/30");
      expect(tierBgClass("bronze")).toBe("bg-orange-500/10 border-orange-500/30");
    });

    it("未知段位 → 空字串", () => {
      expect(tierBgClass("unknown")).toBe("");
    });

    it("null/undefined → 空字串", () => {
      expect(tierBgClass(null)).toBe("");
      expect(tierBgClass(undefined)).toBe("");
    });
  });

  // ============================
  // tierBadgeClass
  // ============================
  describe("tierBadgeClass", () => {
    it("回傳 Badge 用的 class", () => {
      expect(tierBadgeClass("gold")).toBe("bg-yellow-500/20 text-yellow-400");
      expect(tierBadgeClass("master")).toBe("bg-purple-500/20 text-purple-400");
    });

    it("未知段位 → 空字串", () => {
      expect(tierBadgeClass("ultra")).toBe("");
    });
  });

  // ============================
  // 常數一致性
  // ============================
  describe("constants", () => {
    it("SLOT_STATUS_INFO 包含所有狀態", () => {
      expect(Object.keys(SLOT_STATUS_INFO)).toEqual(
        expect.arrayContaining(["open", "confirmed", "full", "in_progress", "completed", "cancelled"]),
      );
    });

    it("SKILL_LEVEL_LABEL 包含所有等級 + alias", () => {
      expect(Object.keys(SKILL_LEVEL_LABEL)).toEqual(
        expect.arrayContaining(["beginner", "intermediate", "advanced", "expert"]),
      );
    });

    it("TIER_BG 與 TIER_BADGE 涵蓋相同段位", () => {
      const tierBgKeys = Object.keys(TIER_BG).sort();
      const tierBadgeKeys = Object.keys(TIER_BADGE).sort();
      expect(tierBgKeys).toEqual(tierBadgeKeys);
    });
  });
});
