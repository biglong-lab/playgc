// 成就檢測引擎 — evaluateCondition 單元測試
import { describe, it, expect, vi } from "vitest";

// Mock storage 模組避免觸發 DB 連線
vi.mock("../storage/battle-storage-achievements", () => ({
  getAllAchievementDefs: vi.fn().mockResolvedValue([]),
  hasAchievement: vi.fn().mockResolvedValue(false),
  unlockAchievement: vi.fn().mockResolvedValue(null),
}));

import { evaluateCondition } from "../services/battle-achievement-checker";

/** 建立預設排名資料的輔助函式 */
function makeRanking(overrides: Partial<{
  totalBattles: number;
  wins: number;
  winStreak: number;
  bestStreak: number;
  mvpCount: number;
  tier: string;
}> = {}) {
  return {
    totalBattles: 0,
    wins: 0,
    winStreak: 0,
    bestStreak: 0,
    mvpCount: 0,
    tier: "bronze",
    ...overrides,
  };
}

describe("evaluateCondition — 成就條件判定", () => {
  // 1. total_battles >= 1
  describe("total_battles", () => {
    it("totalBattles=0 未達門檻 → false", () => {
      const result = evaluateCondition(
        { type: "total_battles", threshold: 1, comparison: "gte" },
        makeRanking({ totalBattles: 0 }),
      );
      expect(result).toBe(false);
    });

    it("totalBattles=1 剛好達標 → true", () => {
      const result = evaluateCondition(
        { type: "total_battles", threshold: 1, comparison: "gte" },
        makeRanking({ totalBattles: 1 }),
      );
      expect(result).toBe(true);
    });
  });

  // 2. wins >= 10
  describe("wins", () => {
    it("wins=10 剛好達標 → true", () => {
      const result = evaluateCondition(
        { type: "wins", threshold: 10, comparison: "gte" },
        makeRanking({ wins: 10 }),
      );
      expect(result).toBe(true);
    });

    it("wins=9 未達門檻 → false", () => {
      const result = evaluateCondition(
        { type: "wins", threshold: 10, comparison: "gte" },
        makeRanking({ wins: 9 }),
      );
      expect(result).toBe(false);
    });
  });

  // 3. streak >= 3（取 winStreak 和 bestStreak 的最大值）
  describe("streak", () => {
    it("winStreak=3 達標 → true", () => {
      const result = evaluateCondition(
        { type: "streak", threshold: 3, comparison: "gte" },
        makeRanking({ winStreak: 3, bestStreak: 0 }),
      );
      expect(result).toBe(true);
    });

    it("bestStreak=5 也算達標 → true", () => {
      const result = evaluateCondition(
        { type: "streak", threshold: 3, comparison: "gte" },
        makeRanking({ winStreak: 1, bestStreak: 5 }),
      );
      expect(result).toBe(true);
    });

    it("兩者都不足 → false", () => {
      const result = evaluateCondition(
        { type: "streak", threshold: 3, comparison: "gte" },
        makeRanking({ winStreak: 2, bestStreak: 2 }),
      );
      expect(result).toBe(false);
    });
  });

  // 4. mvp_count >= 1
  describe("mvp_count", () => {
    it("mvpCount=0 未達門檻 → false", () => {
      const result = evaluateCondition(
        { type: "mvp_count", threshold: 1, comparison: "gte" },
        makeRanking({ mvpCount: 0 }),
      );
      expect(result).toBe(false);
    });

    it("mvpCount=1 達標 → true", () => {
      const result = evaluateCondition(
        { type: "mvp_count", threshold: 1, comparison: "gte" },
        makeRanking({ mvpCount: 1 }),
      );
      expect(result).toBe(true);
    });
  });

  // 5. tier_reached
  describe("tier_reached", () => {
    it("tier=gold 目標 gold → true", () => {
      const result = evaluateCondition(
        { type: "tier_reached", tier: "gold" },
        makeRanking({ tier: "gold" }),
      );
      expect(result).toBe(true);
    });

    it("tier=silver 目標 gold → false", () => {
      const result = evaluateCondition(
        { type: "tier_reached", tier: "gold" },
        makeRanking({ tier: "silver" }),
      );
      expect(result).toBe(false);
    });

    it("tier=diamond 目標 gold → true（超越目標）", () => {
      const result = evaluateCondition(
        { type: "tier_reached", tier: "gold" },
        makeRanking({ tier: "diamond" }),
      );
      expect(result).toBe(true);
    });
  });

  // 6. first_win
  describe("first_win", () => {
    it("wins=1 首勝達成 → true", () => {
      const result = evaluateCondition(
        { type: "first_win" },
        makeRanking({ wins: 1 }),
      );
      expect(result).toBe(true);
    });

    it("wins=0 尚無勝場 → false", () => {
      const result = evaluateCondition(
        { type: "first_win" },
        makeRanking({ wins: 0 }),
      );
      expect(result).toBe(false);
    });
  });

  // 7. clan_battle 永遠回傳 false
  describe("clan_battle", () => {
    it("永遠回傳 false（由外部判定）", () => {
      const result = evaluateCondition(
        { type: "clan_battle" },
        makeRanking({ wins: 100, totalBattles: 200 }),
      );
      expect(result).toBe(false);
    });
  });

  // 8. 未知 type 回傳 false
  describe("未知條件類型", () => {
    it("未知 type 回傳 false", () => {
      const result = evaluateCondition(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: "unknown_type" as any },
        makeRanking(),
      );
      expect(result).toBe(false);
    });
  });
});
