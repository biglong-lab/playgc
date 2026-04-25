// 隊伍 lifecycle 推算規則 — 純函式（可單元測試）
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §1.2 §13.3 §18

export type SquadTier = "newbie" | "active" | "veteran" | "legend";

export function deriveSquadTier(
  totalGamesRaw: number,
  thresholds?: {
    newbie?: number;
    active?: number;
    veteran?: number;
    legend?: number;
  },
): SquadTier {
  const t = {
    newbie: thresholds?.newbie ?? 1,
    active: thresholds?.active ?? 10,
    veteran: thresholds?.veteran ?? 50,
    legend: thresholds?.legend ?? 100,
  };
  if (totalGamesRaw >= t.legend) return "legend";
  if (totalGamesRaw >= t.veteran) return "veteran";
  if (totalGamesRaw >= t.active) return "active";
  return "newbie";
}

export type SuperLeaderTier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "super";

export interface SuperLeaderInput {
  totalGames: number;
  totalGamesRaw: number;
  totalWins: number;
  totalLosses: number;
  recruitsCount: number;
  fieldsPlayed: string[];
  /** 平台場次排名（從低到高，前 10 名 → rank ≤ 10）*/
  platformRank?: number;
}

/**
 * 推算超級隊長段位（依設計文件 §13.3）
 *
 * 條件（從高到低）：
 *   - Super: 平台 top 10 + 招募 30+
 *   - Platinum: 200+ 場 + 跨 3 場域
 *   - Gold: 100+ 場 + 勝率 50%+ + 跨 2 場域
 *   - Silver: 50+ 場 + 勝率 40%+
 *   - Bronze: 10+ 場
 *   - 否則 null（不夠格）
 */
export function deriveSuperLeaderTier(
  input: SuperLeaderInput,
): SuperLeaderTier | null {
  const totalDecisive = input.totalWins + input.totalLosses;
  const winRate =
    totalDecisive > 0 ? Math.round((input.totalWins / totalDecisive) * 100) : 0;
  const fieldCount = input.fieldsPlayed.length;

  if (
    input.platformRank !== undefined &&
    input.platformRank <= 10 &&
    input.recruitsCount >= 30
  ) {
    return "super";
  }
  if (input.totalGamesRaw >= 200 && fieldCount >= 3) {
    return "platinum";
  }
  if (input.totalGamesRaw >= 100 && winRate >= 50 && fieldCount >= 2) {
    return "gold";
  }
  if (input.totalGamesRaw >= 50 && winRate >= 40) {
    return "silver";
  }
  if (input.totalGamesRaw >= 10) {
    return "bronze";
  }
  return null;
}

export function tierLabel(tier: SuperLeaderTier): string {
  const labels: Record<SuperLeaderTier, string> = {
    bronze: "🥉 Bronze 隊長",
    silver: "🥈 Silver 隊長",
    gold: "🥇 Gold 隊長",
    platinum: "💎 Platinum 隊長",
    super: "🌟 超級隊長",
  };
  return labels[tier];
}

/** 比較兩個段位順序：回傳 1 升級 / -1 降級 / 0 無變 */
export function compareTier(
  oldTier: SuperLeaderTier | null,
  newTier: SuperLeaderTier | null,
): 1 | 0 | -1 {
  const order: SuperLeaderTier[] = [
    "bronze",
    "silver",
    "gold",
    "platinum",
    "super",
  ];
  const oldIdx = oldTier ? order.indexOf(oldTier) : -1;
  const newIdx = newTier ? order.indexOf(newTier) : -1;
  if (newIdx > oldIdx) return 1;
  if (newIdx < oldIdx) return -1;
  return 0;
}
