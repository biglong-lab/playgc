// engagement-calculator 純函式單元測試
import { describe, it, expect } from "vitest";
import {
  isSuperLeader,
  selectWelcomeSquads,
  determineActivityStatus,
  isInCooldown,
  type SquadProfile,
  type SuperLeaderConfig,
  type SquadForRanking,
  type WelcomeSquadConfig,
  type DormancyConfig,
} from "../engagement-calculator";

// ============================================================================
// isSuperLeader
// ============================================================================
describe("isSuperLeader", () => {
  const baseConfig: SuperLeaderConfig = {
    minGames: 100,
    minRecruits: 10,
    minFields: 2,
    minWinRate: 50,
    autoEnabled: true,
    manualIds: [],
  };

  function makeSquad(overrides: Partial<SquadProfile> = {}): SquadProfile {
    return {
      squadId: "s1",
      totalGames: 100,
      totalWins: 50,
      totalLosses: 50,
      recruitsCount: 10,
      fieldsPlayed: ["jiachun", "hpspace"],
      ...overrides,
    };
  }

  it("手動指定 → 永遠是", () => {
    const config = { ...baseConfig, manualIds: ["s1"] };
    expect(isSuperLeader(makeSquad(), config)).toBe(true);
  });

  it("手動指定即使自動條件不滿足也是", () => {
    const config = { ...baseConfig, manualIds: ["s1"], autoEnabled: false };
    const squad = makeSquad({ totalGames: 0, recruitsCount: 0 });
    expect(isSuperLeader(squad, config)).toBe(true);
  });

  it("自動關閉 + 不在 manualIds → 不是", () => {
    const config = { ...baseConfig, autoEnabled: false };
    expect(isSuperLeader(makeSquad(), config)).toBe(false);
  });

  it("滿足所有自動條件 → 是", () => {
    expect(isSuperLeader(makeSquad(), baseConfig)).toBe(true);
  });

  it("場數不夠 → 否", () => {
    expect(isSuperLeader(makeSquad({ totalGames: 99 }), baseConfig)).toBe(false);
  });

  it("招募不夠 → 否", () => {
    expect(isSuperLeader(makeSquad({ recruitsCount: 9 }), baseConfig)).toBe(false);
  });

  it("跨場域不夠 → 否", () => {
    expect(isSuperLeader(makeSquad({ fieldsPlayed: ["jiachun"] }), baseConfig)).toBe(false);
  });

  it("勝率不夠 → 否", () => {
    expect(isSuperLeader(makeSquad({ totalWins: 30, totalLosses: 70 }), baseConfig)).toBe(false);
  });
});

// ============================================================================
// selectWelcomeSquads
// ============================================================================
describe("selectWelcomeSquads", () => {
  const squads: SquadForRanking[] = [
    { squadId: "s1", totalGames: 100, totalWins: 50, totalLosses: 50, recruitsCount: 5, fieldsPlayed: ["a"], rating: 1700 },
    { squadId: "s2", totalGames: 80, totalWins: 40, totalLosses: 40, recruitsCount: 3, fieldsPlayed: ["a"], rating: 1500 },
    { squadId: "s3", totalGames: 60, totalWins: 30, totalLosses: 30, recruitsCount: 2, fieldsPlayed: ["a"], rating: 1800 },
    { squadId: "s4", totalGames: 40, totalWins: 20, totalLosses: 20, recruitsCount: 1, fieldsPlayed: ["a"], rating: 1300 },
    { squadId: "s5", totalGames: 20, totalWins: 10, totalLosses: 10, recruitsCount: 0, fieldsPlayed: ["a"], rating: 1100 },
  ];

  it("auto + total_games 排序 → 取 top N", () => {
    const config: WelcomeSquadConfig = {
      mode: "auto",
      autoTopN: 3,
      autoCriteria: "total_games",
      manualIds: [],
    };
    const result = selectWelcomeSquads(squads, config);
    expect(result.map((s) => s.squadId)).toEqual(["s1", "s2", "s3"]);
  });

  it("auto + rating 排序 → 取最高 rating", () => {
    const config: WelcomeSquadConfig = {
      mode: "auto",
      autoTopN: 2,
      autoCriteria: "rating",
      manualIds: [],
    };
    const result = selectWelcomeSquads(squads, config);
    expect(result.map((s) => s.squadId)).toEqual(["s3", "s1"]);
  });

  it("manual → 只取手動指定", () => {
    const config: WelcomeSquadConfig = {
      mode: "manual",
      autoTopN: 5,
      autoCriteria: "total_games",
      manualIds: ["s4", "s5"],
    };
    const result = selectWelcomeSquads(squads, config);
    expect(result.map((s) => s.squadId).sort()).toEqual(["s4", "s5"]);
  });

  it("hybrid → manual 優先 + auto 補滿", () => {
    const config: WelcomeSquadConfig = {
      mode: "hybrid",
      autoTopN: 3,
      autoCriteria: "total_games",
      manualIds: ["s5"],
    };
    const result = selectWelcomeSquads(squads, config);
    // s5 (manual) + s1, s2 (auto top 排除 s5)
    expect(result.map((s) => s.squadId)).toEqual(["s5", "s1", "s2"]);
  });

  it("hybrid + manual 已超過 topN → 截斷", () => {
    const config: WelcomeSquadConfig = {
      mode: "hybrid",
      autoTopN: 2,
      autoCriteria: "total_games",
      manualIds: ["s4", "s5", "s3"],
    };
    const result = selectWelcomeSquads(squads, config);
    expect(result.length).toBe(2); // 只取前 2 個 manual
  });
});

// ============================================================================
// determineActivityStatus
// ============================================================================
describe("determineActivityStatus", () => {
  const config: DormancyConfig = {
    daysThreshold: 30,
    warningDays: [3, 7, 14],
  };
  const now = new Date("2026-04-30T12:00:00");

  function daysAgo(n: number): Date {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d;
  }

  it("沒紀錄 → active", () => {
    expect(determineActivityStatus(null, config, now)).toBe("active");
  });

  it("< 3 天 → active", () => {
    expect(determineActivityStatus(daysAgo(2), config, now)).toBe("active");
  });

  it("3 天 → warning_3", () => {
    expect(determineActivityStatus(daysAgo(3), config, now)).toBe("warning_3");
  });

  it("6 天 → 還在 warning_3 階段", () => {
    expect(determineActivityStatus(daysAgo(6), config, now)).toBe("warning_3");
  });

  it("7 天 → warning_7", () => {
    expect(determineActivityStatus(daysAgo(7), config, now)).toBe("warning_7");
  });

  it("14 天 → warning_14", () => {
    expect(determineActivityStatus(daysAgo(14), config, now)).toBe("warning_14");
  });

  it("29 天 → 還在 warning_14 階段", () => {
    expect(determineActivityStatus(daysAgo(29), config, now)).toBe("warning_14");
  });

  it("30 天（門檻）→ dormant", () => {
    expect(determineActivityStatus(daysAgo(30), config, now)).toBe("dormant");
  });

  it("60 天 → dormant", () => {
    expect(determineActivityStatus(daysAgo(60), config, now)).toBe("dormant");
  });
});

// ============================================================================
// isInCooldown
// ============================================================================
describe("isInCooldown", () => {
  const now = new Date("2026-04-30T12:00:00");

  it("沒發過 → 不在冷卻", () => {
    expect(isInCooldown(null, 24, now)).toBe(false);
  });

  it("23 小時前 + cooldown 24h → 還在冷卻", () => {
    const past = new Date(now);
    past.setHours(past.getHours() - 23);
    expect(isInCooldown(past, 24, now)).toBe(true);
  });

  it("25 小時前 + cooldown 24h → 已過冷卻", () => {
    const past = new Date(now);
    past.setHours(past.getHours() - 25);
    expect(isInCooldown(past, 24, now)).toBe(false);
  });

  it("剛剛發過 → 在冷卻", () => {
    expect(isInCooldown(now, 1, now)).toBe(true);
  });
});
