import {
  Trophy, MapPin, Star, Zap, Clock, Target, Crown,
  Award, Medal, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// 成就類型常數
export interface AchievementTypeInfo {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const ACHIEVEMENT_TYPES: AchievementTypeInfo[] = [
  { value: "location", label: "地點探索", icon: MapPin, description: "到達特定地點解鎖" },
  { value: "collection", label: "收集成就", icon: Star, description: "收集指定物品解鎖" },
  { value: "speed", label: "速度挑戰", icon: Clock, description: "在時限內完成任務" },
  { value: "exploration", label: "探險成就", icon: Target, description: "探索隱藏區域" },
  { value: "special", label: "特殊成就", icon: Sparkles, description: "完成特殊條件" },
  { value: "legendary", label: "傳說成就", icon: Crown, description: "極難達成的成就" },
];

// 稀有度常數
export interface RarityInfo {
  value: string;
  label: string;
  color: string;
  points: number;
}

export const RARITY_TYPES: RarityInfo[] = [
  { value: "common", label: "普通", color: "bg-gray-500/20 text-gray-400", points: 10 },
  { value: "uncommon", label: "稀有", color: "bg-green-500/20 text-green-400", points: 25 },
  { value: "rare", label: "珍貴", color: "bg-blue-500/20 text-blue-400", points: 50 },
  { value: "epic", label: "史詩", color: "bg-purple-500/20 text-purple-400", points: 100 },
  { value: "legendary", label: "傳說", color: "bg-orange-500/20 text-orange-400", points: 200 },
];

// 圖示常數
export interface AchievementIconInfo {
  value: string;
  icon: LucideIcon;
  label: string;
}

export const ACHIEVEMENT_ICONS: AchievementIconInfo[] = [
  { value: "trophy", icon: Trophy, label: "獎盃" },
  { value: "star", icon: Star, label: "星星" },
  { value: "medal", icon: Medal, label: "獎牌" },
  { value: "award", icon: Award, label: "獎狀" },
  { value: "crown", icon: Crown, label: "皇冠" },
  { value: "sparkles", icon: Sparkles, label: "閃耀" },
  { value: "target", icon: Target, label: "目標" },
  { value: "zap", icon: Zap, label: "閃電" },
  { value: "mappin", icon: MapPin, label: "地標" },
];

// 表單資料介面
export interface AchievementFormData {
  name: string;
  description: string;
  achievementType: string;
  rarity: string;
  points: number;
  iconUrl: string;
  isHidden: boolean;
  condition: {
    type: string;
    target?: string;
    count?: number;
  };
}

export const defaultFormData: AchievementFormData = {
  name: "",
  description: "",
  achievementType: "location",
  rarity: "common",
  points: 10,
  iconUrl: "trophy",
  isHidden: false,
  condition: { type: "visit_location" },
};

// 工具函式
export function getTypeInfo(type: string): AchievementTypeInfo {
  return ACHIEVEMENT_TYPES.find(t => t.value === type) || ACHIEVEMENT_TYPES[0];
}

export function getRarityInfo(rarity: string): RarityInfo {
  return RARITY_TYPES.find(r => r.value === rarity) || RARITY_TYPES[0];
}

export function getIconComponent(iconName: string): LucideIcon {
  const iconInfo = ACHIEVEMENT_ICONS.find(i => i.value === iconName);
  return iconInfo?.icon || Trophy;
}
