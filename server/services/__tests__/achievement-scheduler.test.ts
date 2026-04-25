import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  type AchievementContext,
} from "../achievement-rules";

function makeCtx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    squadId: "squad_test",
    totalGames: 0,
    totalGamesRaw: 0,
    totalWins: 0,
    totalLosses: 0,
    totalExpPoints: 0,
    recruitsCount: 0,
    fieldsPlayed: [],
    homeFieldGames: 0,
    fieldGamesMap: {},
    ...overrides,
  };
}

function findAch(key: string) {
  const ach = ACHIEVEMENTS.find((a) => a.key === key);
  if (!ach) throw new Error(`achievement ${key} not found`);
  return ach;
}

describe("achievement-scheduler", () => {
  describe("milestone 成就", () => {
    it("first_game：1 場達成", () => {
      const ach = findAch("first_game");
      expect(ach.check(makeCtx({ totalGamesRaw: 0 }))).toBe(false);
      expect(ach.check(makeCtx({ totalGamesRaw: 1 }))).toBe(true);
    });

    it("hall_of_fame：100 場達成", () => {
      const ach = findAch("hall_of_fame");
      expect(ach.check(makeCtx({ totalGamesRaw: 99 }))).toBe(false);
      expect(ach.check(makeCtx({ totalGamesRaw: 100 }))).toBe(true);
      expect(ach.check(makeCtx({ totalGamesRaw: 200 }))).toBe(true);
    });

    it("legend_500：500 場達成", () => {
      const ach = findAch("legend_500");
      expect(ach.check(makeCtx({ totalGamesRaw: 499 }))).toBe(false);
      expect(ach.check(makeCtx({ totalGamesRaw: 500 }))).toBe(true);
    });
  });

  describe("跨場域徽章", () => {
    it("local_regular：主場 50+ 場", () => {
      const ach = findAch("local_regular");
      expect(ach.check(makeCtx({ homeFieldGames: 49 }))).toBe(false);
      expect(ach.check(makeCtx({ homeFieldGames: 50 }))).toBe(true);
    });

    it("cross_field_2：2 場域各 10+ 場", () => {
      const ach = findAch("cross_field_2");
      expect(
        ach.check(
          makeCtx({
            fieldGamesMap: { f1: 10, f2: 9 },
          }),
        ),
      ).toBe(false);
      expect(
        ach.check(
          makeCtx({
            fieldGamesMap: { f1: 10, f2: 15 },
          }),
        ),
      ).toBe(true);
    });

    it("cross_field_3：3 場域各 10+ 場", () => {
      const ach = findAch("cross_field_3");
      expect(
        ach.check(
          makeCtx({
            fieldGamesMap: { f1: 10, f2: 15, f3: 9 },
          }),
        ),
      ).toBe(false);
      expect(
        ach.check(
          makeCtx({
            fieldGamesMap: { f1: 10, f2: 15, f3: 12 },
          }),
        ),
      ).toBe(true);
    });

    it("cross_field_5：5+ 場域各 5+ 場", () => {
      const ach = findAch("cross_field_5");
      expect(
        ach.check(
          makeCtx({
            fieldGamesMap: { f1: 5, f2: 5, f3: 5, f4: 5 },
          }),
        ),
      ).toBe(false);
      expect(
        ach.check(
          makeCtx({
            fieldGamesMap: { f1: 5, f2: 5, f3: 5, f4: 5, f5: 5 },
          }),
        ),
      ).toBe(true);
    });
  });

  describe("招募徽章", () => {
    it("recruiter_starter：3 人達成", () => {
      const ach = findAch("recruiter_starter");
      expect(ach.check(makeCtx({ recruitsCount: 2 }))).toBe(false);
      expect(ach.check(makeCtx({ recruitsCount: 3 }))).toBe(true);
    });

    it("recruiter_master：10 人達成", () => {
      const ach = findAch("recruiter_master");
      expect(ach.check(makeCtx({ recruitsCount: 9 }))).toBe(false);
      expect(ach.check(makeCtx({ recruitsCount: 10 }))).toBe(true);
    });

    it("super_recruiter：30 人 + 跨 2 場域", () => {
      const ach = findAch("super_recruiter");
      // 招募滿 30 但只跨 1 場域
      expect(
        ach.check(
          makeCtx({ recruitsCount: 30, fieldsPlayed: ["f1"] }),
        ),
      ).toBe(false);
      // 跨 2 場域但招募只 29
      expect(
        ach.check(
          makeCtx({ recruitsCount: 29, fieldsPlayed: ["f1", "f2"] }),
        ),
      ).toBe(false);
      // 兩個都達成
      expect(
        ach.check(
          makeCtx({ recruitsCount: 30, fieldsPlayed: ["f1", "f2"] }),
        ),
      ).toBe(true);
    });
  });

  describe("體驗點數徽章", () => {
    it("regular_100：100 expPoints 達成", () => {
      const ach = findAch("regular_100");
      expect(ach.check(makeCtx({ totalExpPoints: 99 }))).toBe(false);
      expect(ach.check(makeCtx({ totalExpPoints: 100 }))).toBe(true);
    });

    it("regular_1000：1000 expPoints 達成", () => {
      const ach = findAch("regular_1000");
      expect(ach.check(makeCtx({ totalExpPoints: 999 }))).toBe(false);
      expect(ach.check(makeCtx({ totalExpPoints: 1000 }))).toBe(true);
    });
  });

  describe("evaluateAchievements", () => {
    it("空 context → 沒有成就", () => {
      expect(evaluateAchievements(makeCtx())).toHaveLength(0);
    });

    it("百戰隊伍 + 招募達人 → 多個成就同時達成", () => {
      const earned = evaluateAchievements(
        makeCtx({
          totalGamesRaw: 100,
          recruitsCount: 10,
          totalExpPoints: 500,
          homeFieldGames: 50,
        }),
      );
      const keys = earned.map((a) => a.key);
      expect(keys).toContain("first_game");
      expect(keys).toContain("veteran_10");
      expect(keys).toContain("veteran_50");
      expect(keys).toContain("hall_of_fame");
      expect(keys).toContain("local_regular");
      expect(keys).toContain("recruiter_starter");
      expect(keys).toContain("recruiter_master");
      expect(keys).toContain("regular_100");
      expect(keys).toContain("regular_500");
    });
  });

  describe("ACHIEVEMENTS 列表完整性", () => {
    it("每個成就都有唯一 key", () => {
      const keys = ACHIEVEMENTS.map((a) => a.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("每個成就都有必要欄位", () => {
      for (const ach of ACHIEVEMENTS) {
        expect(ach.key).toBeTruthy();
        expect(ach.category).toBeTruthy();
        expect(ach.displayName).toBeTruthy();
        expect(ach.description).toBeTruthy();
        expect(typeof ach.check).toBe("function");
      }
    });

    it("包含所有設計文件 §9 列出的徽章", () => {
      const required = [
        "first_game",
        "hall_of_fame",
        "local_regular",
        "cross_field_2",
        "cross_field_3",
        "cross_field_5",
        "recruiter_starter",
        "recruiter_master",
        "super_recruiter",
      ];
      const keys = ACHIEVEMENTS.map((a) => a.key);
      for (const key of required) {
        expect(keys).toContain(key);
      }
    });
  });
});
