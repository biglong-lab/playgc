/**
 * 水彈對戰相關 Schema 測試
 * 涵蓋：段位計算、對戰結果、個人戰績、賽季、成就條件
 */
import { describe, it, expect } from "vitest";
import {
  getTierFromRating,
  insertBattleResultSchema,
  insertPlayerResultSchema,
  createSeasonSchema,
  achievementConditionSchema,
} from "@shared/schema";

// ============================================================================
// getTierFromRating 段位計算
// ============================================================================
describe("getTierFromRating 段位計算", () => {
  it("0 分 → bronze（新兵）", () => {
    expect(getTierFromRating(0)).toBe("bronze");
  });

  it("300 分 → silver（步兵）", () => {
    expect(getTierFromRating(300)).toBe("silver");
  });

  it("600 分 → gold（突擊）", () => {
    expect(getTierFromRating(600)).toBe("gold");
  });

  it("1000 分 → platinum（精英）", () => {
    expect(getTierFromRating(1000)).toBe("platinum");
  });

  it("1500 分 → diamond（菁英）", () => {
    expect(getTierFromRating(1500)).toBe("diamond");
  });

  it("2000 分 → master（傳奇）", () => {
    expect(getTierFromRating(2000)).toBe("master");
  });
});

// ============================================================================
// insertBattleResultSchema 對戰結果驗證
// ============================================================================
describe("insertBattleResultSchema 對戰結果", () => {
  it("有效的完整輸入通過驗證", () => {
    const result = insertBattleResultSchema.safeParse({
      winningTeam: "紅隊",
      isDraw: false,
      teamScores: [
        { teamName: "紅隊", score: 10 },
        { teamName: "藍隊", score: 7 },
      ],
      durationMinutes: 15,
      notes: "精彩的一場比賽",
    });
    expect(result.success).toBe(true);
  });

  it("isDraw 不接受非布林值", () => {
    const result = insertBattleResultSchema.safeParse({
      isDraw: "yes",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// insertPlayerResultSchema 個人戰績驗證
// ============================================================================
describe("insertPlayerResultSchema 個人戰績", () => {
  it("有效的個人戰績通過驗證", () => {
    const result = insertPlayerResultSchema.safeParse({
      userId: "user-abc",
      team: "紅隊",
      score: 5,
      hits: 12,
      eliminations: 3,
      deaths: 2,
      isMvp: true,
    });
    expect(result.success).toBe(true);
  });

  it("score 不接受負數", () => {
    const result = insertPlayerResultSchema.safeParse({
      userId: "user-abc",
      team: "紅隊",
      score: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// createSeasonSchema 賽季驗證
// ============================================================================
describe("createSeasonSchema 賽季", () => {
  it("有效的賽季資料通過驗證", () => {
    const result = createSeasonSchema.safeParse({
      name: "第一季：烈焰之戰",
      startDate: "2026-04-01T00:00:00Z",
      resetRatingTo: 1000,
      rewards: [
        { tier: "master", minRank: 1, maxRank: 3, title: "傳奇勇士" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// achievementConditionSchema 成就條件驗證
// ============================================================================
describe("achievementConditionSchema 成就條件", () => {
  it("有效的成就條件通過驗證", () => {
    const result = achievementConditionSchema.safeParse({
      type: "wins",
      threshold: 10,
      comparison: "gte",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("wins");
      expect(result.data.threshold).toBe(10);
    }
  });
});
