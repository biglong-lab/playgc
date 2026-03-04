// 水彈對戰 PK 擂台 — 成就檢測引擎
import type { AchievementCondition, BattleAchievementDef } from "@shared/schema";
import {
  getAllAchievementDefs,
  hasAchievement,
  unlockAchievement,
} from "../storage/battle-storage-achievements";

/** 排名資料（用於成就檢測） */
interface RankingData {
  totalBattles: number;
  wins: number;
  winStreak: number;
  bestStreak: number;
  mvpCount: number;
  tier: string;
}

/** 新解鎖的成就 */
export interface UnlockedAchievement {
  id: string;
  key: string;
  name: string;
  description: string;
  rarity: string;
  points: number;
}

// 模組層級快取
let cachedDefs: BattleAchievementDef[] | null = null;

/** 載入並快取成就定義 */
async function loadDefs(): Promise<BattleAchievementDef[]> {
  if (cachedDefs) return cachedDefs;
  cachedDefs = await getAllAchievementDefs();
  return cachedDefs;
}

/** 重置快取（測試用或成就定義更新時呼叫） */
export function resetAchievementCache() {
  cachedDefs = null;
}

/** 段位排序（用於比較） */
const tierOrder: Record<string, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
  master: 5,
};

/**
 * 評估單一條件是否滿足
 */
export function evaluateCondition(
  condition: AchievementCondition,
  ranking: RankingData,
): boolean {
  switch (condition.type) {
    case "total_battles":
      return compare(ranking.totalBattles, condition.threshold ?? 0, condition.comparison ?? "gte");

    case "wins":
      return compare(ranking.wins, condition.threshold ?? 0, condition.comparison ?? "gte");

    case "streak":
      return compare(
        Math.max(ranking.winStreak, ranking.bestStreak),
        condition.threshold ?? 0,
        condition.comparison ?? "gte",
      );

    case "mvp_count":
      return compare(ranking.mvpCount, condition.threshold ?? 0, condition.comparison ?? "gte");

    case "tier_reached": {
      const playerTierOrder = tierOrder[ranking.tier] ?? 0;
      const targetTierOrder = tierOrder[condition.tier ?? "master"] ?? 5;
      return playerTierOrder >= targetTierOrder;
    }

    case "first_win":
      return ranking.wins >= 1;

    case "clan_battle":
      // 由外部判定（需要額外資料），此處永遠 false
      return false;

    default:
      return false;
  }
}

function compare(value: number, threshold: number, comparison: string): boolean {
  if (comparison === "eq") return value === threshold;
  return value >= threshold; // gte
}

/**
 * 檢測並解鎖成就
 *
 * 在記錄對戰結果後呼叫，回傳本次新解鎖的成就列表
 */
export async function checkAndUnlockAchievements(
  userId: string,
  ranking: RankingData,
  resultId?: string,
): Promise<UnlockedAchievement[]> {
  const defs = await loadDefs();
  const unlocked: UnlockedAchievement[] = [];

  for (const def of defs) {
    const condition = def.condition as AchievementCondition;

    // 跳過 clan_battle（需另行處理）
    if (condition.type === "clan_battle") continue;

    // 檢查條件是否滿足
    if (!evaluateCondition(condition, ranking)) continue;

    // 檢查是否已解鎖
    const alreadyHas = await hasAchievement(userId, def.id);
    if (alreadyHas) continue;

    // 解鎖
    const result = await unlockAchievement(userId, def.id, resultId);
    if (result) {
      unlocked.push({
        id: result.id,
        key: def.key,
        name: def.name,
        description: def.description,
        rarity: def.rarity,
        points: def.points,
      });
    }
  }

  return unlocked;
}
