// 水彈對戰 PK 擂台 — ELO 積分引擎
import { getTierFromRating, type Tier } from "@shared/schema";

/** ELO 計算輸入 */
export interface EloInput {
  playerRating: number;
  opponentAvgRating: number;
  won: boolean;
  isDraw: boolean;
  totalBattles: number;
  isMvp: boolean;
  winStreak: number;
}

/** ELO 計算結果 */
export interface EloResult {
  newRating: number;
  ratingChange: number;
  newTier: Tier;
}

/**
 * 取得 K 值（波動係數）
 * - 新手（< 10 場）：K=40 快速定位
 * - 一般：K=20
 * - 高段（rating > 1500）：K=10 穩定
 */
function getKFactor(totalBattles: number, rating: number): number {
  if (totalBattles < 10) return 40;
  if (rating > 1500) return 10;
  return 20;
}

/**
 * 計算預期勝率
 * E = 1 / (1 + 10^((opponent - player) / 400))
 */
function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * 計算新的 ELO 分數
 *
 * 基礎公式：newRating = oldRating + K × (actualResult - expectedResult)
 *
 * 加成：
 * - 連勝 3 場起：額外 +5/場（最多 +15）
 * - MVP：額外 +10
 */
export function calculateElo(input: EloInput): EloResult {
  const { playerRating, opponentAvgRating, won, isDraw, totalBattles, isMvp, winStreak } = input;

  const K = getKFactor(totalBattles, playerRating);
  const expected = expectedScore(playerRating, opponentAvgRating);

  // 實際結果：勝=1, 平=0.5, 負=0
  let actual = 0;
  if (won) actual = 1;
  else if (isDraw) actual = 0.5;

  // 基礎變動
  let change = Math.round(K * (actual - expected));

  // 連勝加成（3 連勝起，每場 +5，最多 +15）
  if (won && winStreak >= 3) {
    const streakBonus = Math.min((winStreak - 2) * 5, 15);
    change += streakBonus;
  }

  // MVP 加成
  if (isMvp) {
    change += 10;
  }

  // 最低不低於 0
  const newRating = Math.max(0, playerRating + change);
  const newTier = getTierFromRating(newRating);

  return {
    newRating,
    ratingChange: newRating - playerRating,
    newTier,
  };
}

/**
 * 計算隊伍平均 rating
 */
export function teamAvgRating(ratings: number[]): number {
  if (ratings.length === 0) return 1000;
  return Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length);
}
