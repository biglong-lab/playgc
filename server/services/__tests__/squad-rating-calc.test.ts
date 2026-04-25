// Squad 計分公式單元測試
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §6 + §7
import { describe, it, expect } from "vitest";
import {
  eloExpected,
  getKValue,
  pveExpectedCompletion,
  capDeltaByOpponentDiff,
  deriveTier,
  calcRewards,
  type CalcInput,
} from "../squad-rating-calc";

// ============================================================================
// 基礎公式測試
// ============================================================================
describe("eloExpected", () => {
  it("雙方等強 → 期望 0.5", () => {
    expect(eloExpected(1500, 1500)).toBeCloseTo(0.5, 4);
  });

  it("我方強 200 分 → 期望 ~0.76", () => {
    expect(eloExpected(1700, 1500)).toBeCloseTo(0.76, 1);
  });

  it("我方弱 200 分 → 期望 ~0.24", () => {
    expect(eloExpected(1300, 1500)).toBeCloseTo(0.24, 1);
  });

  it("我方強 400 分 → 期望 ~0.91", () => {
    expect(eloExpected(1900, 1500)).toBeCloseTo(0.91, 1);
  });
});

describe("getKValue", () => {
  it("新手期 (0-10 場) → K=32", () => {
    expect(getKValue(0)).toBe(32);
    expect(getKValue(10)).toBe(32);
  });

  it("中段 (11-50 場) → K=24", () => {
    expect(getKValue(11)).toBe(24);
    expect(getKValue(50)).toBe(24);
  });

  it("老手 (51+) → K=16", () => {
    expect(getKValue(51)).toBe(16);
    expect(getKValue(1000)).toBe(16);
  });
});

describe("pveExpectedCompletion", () => {
  it("青銅 → 50%", () => {
    expect(pveExpectedCompletion(1100)).toBe(0.5);
  });

  it("白銀 → 65%", () => {
    expect(pveExpectedCompletion(1300)).toBe(0.65);
  });

  it("黃金 → 80%", () => {
    expect(pveExpectedCompletion(1500)).toBe(0.8);
  });

  it("鑽石 → 90%", () => {
    expect(pveExpectedCompletion(1700)).toBe(0.9);
  });

  it("名人 → 95%", () => {
    expect(pveExpectedCompletion(1900)).toBe(0.95);
  });
});

describe("capDeltaByOpponentDiff", () => {
  it("我方強很多 + 贏 → 只給 30%", () => {
    expect(capDeltaByOpponentDiff(20, 500, true)).toBe(6); // 20 * 0.3
  });

  it("我方強很多 + 輸 → 正常扣分", () => {
    expect(capDeltaByOpponentDiff(-20, 500, false)).toBe(-20);
  });

  it("我方弱很多 + 贏 → 1.5 倍爆冷", () => {
    expect(capDeltaByOpponentDiff(20, -500, true)).toBe(30); // 20 * 1.5
  });

  it("我方弱很多 + 輸 → 少扣 50%", () => {
    expect(capDeltaByOpponentDiff(-20, -500, false)).toBe(-10);
  });

  it("差距在 400 內 → 不調整", () => {
    expect(capDeltaByOpponentDiff(20, 200, true)).toBe(20);
    expect(capDeltaByOpponentDiff(-20, -100, false)).toBe(-20);
  });
});

describe("deriveTier", () => {
  it("段位邊界值", () => {
    expect(deriveTier(999)).toBe("bronze");
    expect(deriveTier(1199)).toBe("bronze");
    expect(deriveTier(1200)).toBe("silver");
    expect(deriveTier(1399)).toBe("silver");
    expect(deriveTier(1400)).toBe("gold");
    expect(deriveTier(1599)).toBe("gold");
    expect(deriveTier(1600)).toBe("diamond");
    expect(deriveTier(1799)).toBe("diamond");
    expect(deriveTier(1800)).toBe("master");
  });
});

// ============================================================================
// calcRewards 主函式
// ============================================================================
function makeInput(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    myRating: 1500,
    opponentRating: 1500,
    result: "win",
    performance: {},
    totalGames: 5,
    isCrossField: false,
    isFirstVisit: false,
    scoringMode: "pvp",
    ...overrides,
  };
}

describe("calcRewards", () => {
  describe("Mode A: PvP 對戰", () => {
    it("等強對戰 + 贏 → +16 分（K=32, expected=0.5）", () => {
      const result = calcRewards(makeInput({ result: "win" }));
      expect(result.ratingChange).toBe(16); // 32 * (1 - 0.5)
      expect(result.expPoints).toBe(0);
    });

    it("等強對戰 + 輸 → -16 分", () => {
      const result = calcRewards(makeInput({ result: "loss" }));
      expect(result.ratingChange).toBe(-16);
    });

    it("等強對戰 + 平手 → 0 分", () => {
      const result = calcRewards(makeInput({ result: "draw" }));
      expect(result.ratingChange).toBe(0);
    });

    it("贏弱者 → 加分少（cap 0.3 倍）", () => {
      const result = calcRewards(
        makeInput({ myRating: 1900, opponentRating: 1300, result: "win" }),
      );
      // expected ~0.969, delta = 32 * 0.031 ≈ 1，cap × 0.3 ≈ 0.3 → 0
      expect(result.ratingChange).toBeLessThanOrEqual(2);
    });

    it("贏強者爆冷 → 加分多（1.5 倍）", () => {
      const result = calcRewards(
        makeInput({ myRating: 1300, opponentRating: 1900, result: "win" }),
      );
      // expected ~0.031, delta = 32 * 0.969 ≈ 31, × 1.5 ≈ 46
      expect(result.ratingChange).toBeGreaterThan(40);
    });
  });

  describe("Mode B: PvE 完成", () => {
    it("黃金完成 95% → +5（超期望 80%）", () => {
      const result = calcRewards(
        makeInput({
          myRating: 1500,
          result: "completed",
          performance: { completionRate: 0.95 },
          scoringMode: "pve",
        }),
      );
      // expected = 0.8, actual = 0.95, delta = 32 * 0.15 = 4.8 → ~5
      expect(result.ratingChange).toBeGreaterThan(0);
      expect(result.ratingChange).toBeLessThan(10);
    });

    it("黃金完成 60% → 扣分（達不到期望）", () => {
      const result = calcRewards(
        makeInput({
          myRating: 1500,
          result: "completed",
          performance: { completionRate: 0.6 },
          scoringMode: "pve",
        }),
      );
      // expected = 0.8, actual = 0.6, delta = 32 * (-0.2) = -6.4
      expect(result.ratingChange).toBeLessThan(0);
    });
  });

  describe("Mode C: 純體驗（無 rating，給體驗點數）", () => {
    it("基礎 100 點", () => {
      const result = calcRewards(
        makeInput({
          result: "participated",
          scoringMode: "experience",
          performance: {},
        }),
      );
      expect(result.ratingChange).toBe(0);
      expect(result.expPoints).toBe(100);
    });

    it("跨場域 → 100 × 1.2 = 120 點", () => {
      const result = calcRewards(
        makeInput({
          result: "participated",
          scoringMode: "experience",
          isCrossField: true,
        }),
      );
      expect(result.expPoints).toBe(120);
    });

    it("首航 → 100 × 2 = 200 點", () => {
      const result = calcRewards(
        makeInput({
          result: "participated",
          scoringMode: "experience",
          isFirstVisit: true,
        }),
      );
      expect(result.expPoints).toBe(200);
    });

    it("拍照 + 5 人聚會 → +20 +30 = 150 點", () => {
      const result = calcRewards(
        makeInput({
          result: "participated",
          scoringMode: "experience",
          performance: { photoCount: 1, memberCount: 5 },
        }),
      );
      expect(result.expPoints).toBe(150);
    });
  });

  describe("表現 bonus", () => {
    it("MVP +5", () => {
      const baseDelta = calcRewards(makeInput()).ratingChange;
      const withMvp = calcRewards(makeInput({ performance: { isMvp: true } })).ratingChange;
      expect(withMvp - baseDelta).toBe(5);
    });

    it("0 死亡 +3", () => {
      const baseDelta = calcRewards(makeInput()).ratingChange;
      const withZeroDeath = calcRewards(makeInput({ performance: { deaths: 0 } })).ratingChange;
      expect(withZeroDeath - baseDelta).toBe(3);
    });

    it("100% 完成度 +2", () => {
      const baseDelta = calcRewards(makeInput()).ratingChange;
      const with100 = calcRewards(makeInput({ performance: { completionRate: 1.0 } })).ratingChange;
      expect(with100 - baseDelta).toBe(2);
    });
  });

  describe("場次倍率", () => {
    it("主場 → 100", () => {
      const result = calcRewards(makeInput());
      expect(result.gameCountMultiplier).toBe(100);
    });

    it("跨場域 → 120", () => {
      const result = calcRewards(makeInput({ isCrossField: true }));
      expect(result.gameCountMultiplier).toBe(120);
    });

    it("首航 → 200", () => {
      const result = calcRewards(makeInput({ isFirstVisit: true }));
      expect(result.gameCountMultiplier).toBe(200);
    });

    it("首航 + 跨場域 → 取首航（200）", () => {
      const result = calcRewards(
        makeInput({ isFirstVisit: true, isCrossField: true }),
      );
      expect(result.gameCountMultiplier).toBe(200);
    });
  });

  describe("跨場域 rating 加成", () => {
    it("跨場域 → delta × 1.2", () => {
      const baseDelta = calcRewards(makeInput()).ratingChange;
      const cross = calcRewards(makeInput({ isCrossField: true })).ratingChange;
      expect(cross).toBeGreaterThan(baseDelta);
    });

    it("首航 → delta × 2", () => {
      const baseDelta = calcRewards(makeInput()).ratingChange;
      const first = calcRewards(makeInput({ isFirstVisit: true })).ratingChange;
      // 32 * 0.5 = 16, × 2 = 32
      expect(first).toBe(baseDelta * 2);
    });
  });

  describe("§15.5 名次型計算（接力 8 隊）", () => {
    it("rank 1 / 8 → actual 1.0（最大正分）", () => {
      const result = calcRewards(
        makeInput({
          scoringMode: "pvp",
          performance: { rank: 1, totalParticipants: 8 },
        }),
      );
      // expected = 0.5（同分對手），actual = 1.0
      // delta = K × (1.0 - 0.5) = 32 × 0.5 = 16
      expect(result.ratingChange).toBe(16);
    });

    it("rank 8 / 8 → actual 0.0（最大負分）", () => {
      const result = calcRewards(
        makeInput({
          scoringMode: "pvp",
          result: "loss",
          performance: { rank: 8, totalParticipants: 8 },
        }),
      );
      // delta = K × (0 - 0.5) = -16
      expect(result.ratingChange).toBe(-16);
    });

    it("rank 4 / 8 → actual 0.571（中間略偏高）", () => {
      const result = calcRewards(
        makeInput({
          scoringMode: "pvp",
          performance: { rank: 4, totalParticipants: 8 },
        }),
      );
      // actual = (8-4) / (8-1) = 4/7 ≈ 0.571
      // delta = 32 × (0.571 - 0.5) ≈ 2.29 → round 2
      expect(result.ratingChange).toBe(2);
    });

    it("無 rank/totalParticipants → fallback 用 result", () => {
      const result = calcRewards(
        makeInput({ scoringMode: "pvp", result: "draw" }),
      );
      // actual = 0.5 (draw), expected = 0.5 → delta = 0
      expect(result.ratingChange).toBe(0);
    });
  });

  describe("§15.6 表現加成", () => {
    it("用時 < 平均 50% → +2", () => {
      const baseDelta = calcRewards(makeInput()).ratingChange;
      const fast = calcRewards(
        makeInput({
          performance: { duration: 200, avgDuration: 600 },
        }),
      ).ratingChange;
      expect(fast - baseDelta).toBe(2);
    });

    it("用時 = 平均 50% 不算 → 不加成", () => {
      const baseDelta = calcRewards(makeInput()).ratingChange;
      const onTime = calcRewards(
        makeInput({
          performance: { duration: 300, avgDuration: 600 },
        }),
      ).ratingChange;
      expect(onTime).toBe(baseDelta);
    });

    it("全員存活 → +2", () => {
      const baseDelta = calcRewards(makeInput()).ratingChange;
      const survived = calcRewards(
        makeInput({ performance: { allMembersSurvived: true } }),
      ).ratingChange;
      expect(survived - baseDelta).toBe(2);
    });
  });
});
