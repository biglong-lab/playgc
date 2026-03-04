// 水彈對戰 PK 擂台 — 成就種子資料
import type { AchievementCondition } from "@shared/schema";

interface AchievementSeed {
  key: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  condition: AchievementCondition;
  points: number;
  isHidden: boolean;
}

/** 15 個預設成就定義 */
export const DEFAULT_ACHIEVEMENTS: AchievementSeed[] = [
  // 里程碑 (milestone)
  {
    key: "first_battle",
    name: "初出茅廬",
    description: "完成第一場對戰",
    category: "milestone",
    rarity: "common",
    condition: { type: "total_battles", threshold: 1, comparison: "gte" },
    points: 5,
    isHidden: false,
  },
  {
    key: "first_win",
    name: "首戰告捷",
    description: "贏得第一場對戰",
    category: "milestone",
    rarity: "common",
    condition: { type: "first_win" },
    points: 10,
    isHidden: false,
  },
  {
    key: "wins_10",
    name: "十連斬",
    description: "累積 10 場勝利",
    category: "milestone",
    rarity: "uncommon",
    condition: { type: "wins", threshold: 10, comparison: "gte" },
    points: 20,
    isHidden: false,
  },
  {
    key: "wins_50",
    name: "半百勝將",
    description: "累積 50 場勝利",
    category: "milestone",
    rarity: "rare",
    condition: { type: "wins", threshold: 50, comparison: "gte" },
    points: 50,
    isHidden: false,
  },
  {
    key: "battles_100",
    name: "百戰老將",
    description: "完成 100 場對戰",
    category: "milestone",
    rarity: "epic",
    condition: { type: "total_battles", threshold: 100, comparison: "gte" },
    points: 100,
    isHidden: false,
  },

  // 連勝 (streak)
  {
    key: "streak_3",
    name: "三連勝",
    description: "達成 3 連勝",
    category: "streak",
    rarity: "uncommon",
    condition: { type: "streak", threshold: 3, comparison: "gte" },
    points: 15,
    isHidden: false,
  },
  {
    key: "streak_5",
    name: "五連勝",
    description: "達成 5 連勝",
    category: "streak",
    rarity: "rare",
    condition: { type: "streak", threshold: 5, comparison: "gte" },
    points: 30,
    isHidden: false,
  },
  {
    key: "streak_10",
    name: "不敗戰神",
    description: "達成 10 連勝",
    category: "streak",
    rarity: "legendary",
    condition: { type: "streak", threshold: 10, comparison: "gte" },
    points: 100,
    isHidden: false,
  },

  // 戰鬥 (combat)
  {
    key: "first_mvp",
    name: "全場最佳",
    description: "首次獲得 MVP",
    category: "combat",
    rarity: "uncommon",
    condition: { type: "mvp_count", threshold: 1, comparison: "gte" },
    points: 15,
    isHidden: false,
  },
  {
    key: "mvp_10",
    name: "MVP 收割機",
    description: "累積 10 次 MVP",
    category: "combat",
    rarity: "rare",
    condition: { type: "mvp_count", threshold: 10, comparison: "gte" },
    points: 50,
    isHidden: false,
  },
  {
    key: "tier_gold",
    name: "突擊精英",
    description: "達到金牌段位",
    category: "combat",
    rarity: "uncommon",
    condition: { type: "tier_reached", tier: "gold" },
    points: 20,
    isHidden: false,
  },
  {
    key: "tier_platinum",
    name: "菁英玩家",
    description: "達到白金段位",
    category: "combat",
    rarity: "rare",
    condition: { type: "tier_reached", tier: "platinum" },
    points: 40,
    isHidden: false,
  },
  {
    key: "tier_diamond",
    name: "鑽石之路",
    description: "達到鑽石段位",
    category: "combat",
    rarity: "epic",
    condition: { type: "tier_reached", tier: "diamond" },
    points: 80,
    isHidden: false,
  },
  {
    key: "tier_master",
    name: "傳奇大師",
    description: "達到傳奇段位",
    category: "combat",
    rarity: "legendary",
    condition: { type: "tier_reached", tier: "master" },
    points: 200,
    isHidden: true,
  },

  // 社交 (social)
  {
    key: "clan_battle",
    name: "團隊之力",
    description: "以戰隊成員身份參加對戰",
    category: "social",
    rarity: "common",
    condition: { type: "clan_battle" },
    points: 10,
    isHidden: false,
  },
];
