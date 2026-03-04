// ELO 積分引擎 — 單元測試
import { describe, it, expect } from "vitest";
import { calculateElo, teamAvgRating, type EloInput } from "../services/battle-elo";

/** 建立預設輸入，方便覆寫個別欄位 */
function makeInput(overrides: Partial<EloInput> = {}): EloInput {
  return {
    playerRating: 1000,
    opponentAvgRating: 1000,
    won: false,
    isDraw: false,
    totalBattles: 20,
    isMvp: false,
    winStreak: 0,
    ...overrides,
  };
}

describe("battle-elo", () => {
  // ── K 值測試 ──────────────────────────────────────────

  describe("K 值（波動係數）", () => {
    it("新手（< 10 場）K=40，變動幅度大", () => {
      const result = calculateElo(
        makeInput({ won: true, totalBattles: 5 }),
      );
      // K=40, 預期勝率 0.5 → 基礎變動 = 40 * (1 - 0.5) = 20
      expect(result.ratingChange).toBe(20);
    });

    it("一般玩家 K=20", () => {
      const result = calculateElo(
        makeInput({ won: true, totalBattles: 30, playerRating: 1000 }),
      );
      // K=20, 預期勝率 0.5 → 基礎變動 = 20 * 0.5 = 10
      expect(result.ratingChange).toBe(10);
    });

    it("高段玩家（rating > 1500）K=10，變動穩定", () => {
      const result = calculateElo(
        makeInput({ won: true, totalBattles: 50, playerRating: 1600, opponentAvgRating: 1600 }),
      );
      // K=10, 預期勝率 0.5 → 基礎變動 = 10 * 0.5 = 5
      expect(result.ratingChange).toBe(5);
    });
  });

  // ── 基礎勝敗測試 ─────────────────────────────────────

  describe("基礎勝敗計算", () => {
    it("勝利增加 rating", () => {
      const result = calculateElo(makeInput({ won: true }));
      expect(result.ratingChange).toBeGreaterThan(0);
      expect(result.newRating).toBeGreaterThan(1000);
    });

    it("敗北減少 rating", () => {
      const result = calculateElo(makeInput({ won: false, isDraw: false }));
      expect(result.ratingChange).toBeLessThan(0);
      expect(result.newRating).toBeLessThan(1000);
    });

    it("平手時 rating 接近不變（同水平對手）", () => {
      const result = calculateElo(makeInput({ isDraw: true }));
      // 同水平平手：K * (0.5 - 0.5) = 0
      expect(result.ratingChange).toBe(0);
      expect(result.newRating).toBe(1000);
    });
  });

  // ── 加成機制測試 ─────────────────────────────────────

  describe("連勝加成", () => {
    it("連勝 3 場額外 +5", () => {
      const base = calculateElo(makeInput({ won: true, winStreak: 0 }));
      const streak3 = calculateElo(makeInput({ won: true, winStreak: 3 }));
      expect(streak3.ratingChange - base.ratingChange).toBe(5);
    });

    it("連勝 5 場加成上限 +15", () => {
      const base = calculateElo(makeInput({ won: true, winStreak: 0 }));
      const streak5 = calculateElo(makeInput({ won: true, winStreak: 5 }));
      expect(streak5.ratingChange - base.ratingChange).toBe(15);
    });

    it("連勝 10 場加成仍為上限 +15", () => {
      const streak5 = calculateElo(makeInput({ won: true, winStreak: 5 }));
      const streak10 = calculateElo(makeInput({ won: true, winStreak: 10 }));
      expect(streak10.ratingChange).toBe(streak5.ratingChange);
    });
  });

  describe("MVP 加成", () => {
    it("MVP 額外 +10", () => {
      const base = calculateElo(makeInput({ won: true }));
      const mvp = calculateElo(makeInput({ won: true, isMvp: true }));
      expect(mvp.ratingChange - base.ratingChange).toBe(10);
    });
  });

  // ── 邊界條件 ─────────────────────────────────────────

  describe("邊界條件", () => {
    it("rating 最低不低於 0", () => {
      const result = calculateElo(
        makeInput({ playerRating: 5, opponentAvgRating: 2000 }),
      );
      expect(result.newRating).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 段位回傳測試 ─────────────────────────────────────

  describe("段位 (tier) 回傳", () => {
    it("依新 rating 回傳正確段位", () => {
      // rating 1000 + 勝利增加 → 仍在 platinum 區間
      const result = calculateElo(makeInput({ won: true }));
      expect(result.newTier).toBe("platinum");

      // rating 1990 勝利 → 可能升上 master
      const highResult = calculateElo(
        makeInput({ won: true, playerRating: 1990, opponentAvgRating: 1990, totalBattles: 5 }),
      );
      expect(highResult.newTier).toBe("master");
    });
  });

  // ── teamAvgRating ────────────────────────────────────

  describe("teamAvgRating", () => {
    it("空陣列回傳預設 1000", () => {
      expect(teamAvgRating([])).toBe(1000);
    });

    it("正確計算平均值並四捨五入", () => {
      expect(teamAvgRating([1000, 1200, 800])).toBe(1000);
      expect(teamAvgRating([1001, 1002])).toBe(1002); // 1001.5 → 四捨五入 1002
    });
  });
});
