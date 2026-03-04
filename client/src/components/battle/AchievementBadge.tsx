// 水彈對戰 PK 擂台 — 成就徽章元件
import { rarityColors, type AchievementRarity } from "@shared/schema";
import { Medal } from "lucide-react";

interface AchievementBadgeProps {
  name: string;
  rarity: string;
  unlocked: boolean;
  size?: "sm" | "md";
}

export default function AchievementBadge({ name, rarity, unlocked, size = "md" }: AchievementBadgeProps) {
  const color = rarityColors[rarity as AchievementRarity] ?? "#9CA3AF";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`rounded-full p-2 border-2 ${
          unlocked ? "" : "opacity-30 grayscale"
        }`}
        style={{ borderColor: color, backgroundColor: unlocked ? `${color}20` : undefined }}
      >
        <Medal className={iconSize} style={{ color: unlocked ? color : "#9CA3AF" }} />
      </div>
      <span className={`${textSize} font-medium text-center leading-tight max-w-[60px] truncate`}>
        {name}
      </span>
    </div>
  );
}
