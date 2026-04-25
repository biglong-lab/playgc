import { describe, expect, it } from "vitest";
import {
  deriveSquadTier,
  deriveSuperLeaderTier,
  type SuperLeaderInput,
} from "../lifecycle-rules";

describe("lifecycle-scheduler", () => {
  describe("deriveSquadTier", () => {
    it("0 場 → newbie", () => {
      expect(deriveSquadTier(0)).toBe("newbie");
    });
    it("1-9 場 → newbie", () => {
      expect(deriveSquadTier(1)).toBe("newbie");
      expect(deriveSquadTier(9)).toBe("newbie");
    });
    it("10-49 場 → active", () => {
      expect(deriveSquadTier(10)).toBe("active");
      expect(deriveSquadTier(49)).toBe("active");
    });
    it("50-99 場 → veteran", () => {
      expect(deriveSquadTier(50)).toBe("veteran");
      expect(deriveSquadTier(99)).toBe("veteran");
    });
    it("100+ 場 → legend", () => {
      expect(deriveSquadTier(100)).toBe("legend");
      expect(deriveSquadTier(500)).toBe("legend");
    });
    it("接受自訂 thresholds", () => {
      const t = { newbie: 1, active: 5, veteran: 20, legend: 50 };
      expect(deriveSquadTier(4, t)).toBe("newbie");
      expect(deriveSquadTier(5, t)).toBe("active");
      expect(deriveSquadTier(20, t)).toBe("veteran");
      expect(deriveSquadTier(50, t)).toBe("legend");
    });
  });

  describe("deriveSuperLeaderTier", () => {
    function makeInput(overrides: Partial<SuperLeaderInput> = {}): SuperLeaderInput {
      return {
        totalGames: 0,
        totalGamesRaw: 0,
        totalWins: 0,
        totalLosses: 0,
        recruitsCount: 0,
        fieldsPlayed: [],
        ...overrides,
      };
    }

    it("< 10 場 → null（沒段位）", () => {
      expect(deriveSuperLeaderTier(makeInput({ totalGamesRaw: 9 }))).toBeNull();
    });

    it("10-49 場 → bronze", () => {
      expect(deriveSuperLeaderTier(makeInput({ totalGamesRaw: 10 }))).toBe(
        "bronze",
      );
      expect(deriveSuperLeaderTier(makeInput({ totalGamesRaw: 49 }))).toBe(
        "bronze",
      );
    });

    it("50+ 場 + 勝率 40%+ → silver", () => {
      expect(
        deriveSuperLeaderTier(
          makeInput({ totalGamesRaw: 50, totalWins: 25, totalLosses: 25 }),
        ),
      ).toBe("silver");
    });

    it("50+ 場但勝率不到 40% → bronze", () => {
      expect(
        deriveSuperLeaderTier(
          makeInput({ totalGamesRaw: 50, totalWins: 10, totalLosses: 40 }),
        ),
      ).toBe("bronze");
    });

    it("100+ 場 + 勝率 50%+ + 跨 2 場域 → gold", () => {
      expect(
        deriveSuperLeaderTier(
          makeInput({
            totalGamesRaw: 100,
            totalWins: 50,
            totalLosses: 50,
            fieldsPlayed: ["f1", "f2"],
          }),
        ),
      ).toBe("gold");
    });

    it("100+ 場但只 1 場域 → silver（不會升 gold）", () => {
      expect(
        deriveSuperLeaderTier(
          makeInput({
            totalGamesRaw: 100,
            totalWins: 50,
            totalLosses: 50,
            fieldsPlayed: ["f1"],
          }),
        ),
      ).toBe("silver");
    });

    it("200+ 場 + 跨 3 場域 → platinum", () => {
      expect(
        deriveSuperLeaderTier(
          makeInput({
            totalGamesRaw: 200,
            totalWins: 100,
            totalLosses: 100,
            fieldsPlayed: ["f1", "f2", "f3"],
          }),
        ),
      ).toBe("platinum");
    });

    it("平台 top 10 + 招募 30+ → super", () => {
      expect(
        deriveSuperLeaderTier(
          makeInput({
            totalGamesRaw: 200,
            totalWins: 100,
            totalLosses: 100,
            fieldsPlayed: ["f1", "f2", "f3"],
            recruitsCount: 30,
            platformRank: 5,
          }),
        ),
      ).toBe("super");
    });

    it("平台 top 11 → 不是 super", () => {
      const result = deriveSuperLeaderTier(
        makeInput({
          totalGamesRaw: 200,
          totalWins: 100,
          totalLosses: 100,
          fieldsPlayed: ["f1", "f2", "f3"],
          recruitsCount: 30,
          platformRank: 11,
        }),
      );
      expect(result).toBe("platinum");
    });

    it("0 勝 0 敗 → 勝率視為 0", () => {
      const result = deriveSuperLeaderTier(
        makeInput({
          totalGamesRaw: 50,
          totalWins: 0,
          totalLosses: 0,
        }),
      );
      // 50 場但勝率 0 → 不到 silver 門檻 → bronze
      expect(result).toBe("bronze");
    });
  });
});
