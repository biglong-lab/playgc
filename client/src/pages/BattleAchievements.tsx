// 水彈對戰 PK 擂台 — 成就頁面（深色軍事風格）
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import BattleLayout from "@/components/battle/BattleLayout";
import AchievementBadge from "@/components/battle/AchievementBadge";
import {
  rarityLabels,
  rarityColors,
  categoryLabels,
  type AchievementRarity,
  type AchievementCategory,
} from "@shared/schema";
import { Trophy, Lock } from "lucide-react";

interface AchievementDef {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  points: number;
  isHidden: boolean;
}

interface PlayerAchievement {
  id: string;
  achievementId: string;
  key: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  points: number;
  unlockedAt: string;
}

const CATEGORIES: AchievementCategory[] = ["milestone", "combat", "streak", "social"];

const rarityColorMap: Record<string, string> = {
  common: "bg-gray-500/20 text-gray-300",
  uncommon: "bg-green-500/20 text-green-400",
  rare: "bg-blue-500/20 text-blue-400",
  epic: "bg-purple-500/20 text-purple-400",
  legendary: "bg-yellow-500/20 text-yellow-400",
};

export default function BattleAchievements() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AchievementCategory | "all">("all");

  const { data: allDefs = [] } = useQuery<AchievementDef[]>({
    queryKey: ["/api/battle/achievements"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/battle/achievements");
        return res.json();
      } catch {
        return [];
      }
    },
  });

  const { data: myAchievements = [] } = useQuery<PlayerAchievement[]>({
    queryKey: ["/api/battle/my/achievements"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/battle/my/achievements");
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  const unlockedIds = new Set(myAchievements.map((a) => a.achievementId));

  const filteredDefs = activeTab === "all"
    ? allDefs
    : allDefs.filter((d) => d.category === activeTab);

  const totalPoints = myAchievements.reduce((sum, a) => sum + a.points, 0);
  const maxPoints = allDefs.reduce((sum, a) => sum + a.points, 0);
  const unlockedRatio = allDefs.length > 0 ? (myAchievements.length / allDefs.length) * 100 : 0;
  const pointsRatio = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;

  // 🔧 排序：已解鎖優先，再按 points 高到低（讓使用者一眼看到自己解鎖的）
  const sortedDefs = [...filteredDefs].sort((a, b) => {
    const aUnlocked = unlockedIds.has(a.id) ? 1 : 0;
    const bUnlocked = unlockedIds.has(b.id) ? 1 : 0;
    if (aUnlocked !== bUnlocked) return bUnlocked - aUnlocked;
    return b.points - a.points;
  });

  return (
    <BattleLayout
      title="對戰成就"
      subtitle={`${myAchievements.length}/${allDefs.length} 已解鎖 · ${totalPoints}/${maxPoints} 點`}
      backHref="/battle/my"
    >
      <div className="space-y-4">
        {/* 🚀 整體解鎖進度（讓使用者看到收集進度） */}
        {allDefs.length > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">收集進度</span>
                  <span className="text-xs font-number font-semibold">
                    {myAchievements.length}/{allDefs.length}（{unlockedRatio.toFixed(0)}%）
                  </span>
                </div>
                <Progress value={unlockedRatio} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">成就點數</span>
                  <span className="text-xs font-number font-semibold">
                    {totalPoints}/{maxPoints}（{pointsRatio.toFixed(0)}%）
                  </span>
                </div>
                <Progress value={pointsRatio} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 分類 Tab */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            variant={activeTab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("all")}
          >
            全部
          </Button>
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={activeTab === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(cat)}
            >
              {categoryLabels[cat]}
            </Button>
          ))}
        </div>

        {/* 成就列表 */}
        <div className="space-y-3">
          {filteredDefs.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">此分類尚無成就</p>
              </CardContent>
            </Card>
          ) : (
            sortedDefs.map((def) => {
              const isUnlocked = unlockedIds.has(def.id);
              const playerAch = myAchievements.find((a) => a.achievementId === def.id);

              return (
                <Card
                  key={def.id}
                  className={`border-border transition-all ${
                    isUnlocked
                      ? "border-l-4 bg-card shadow-sm hover:shadow-md"
                      : "bg-card/40 opacity-60 hover:opacity-90"
                  }`}
                  style={isUnlocked ? { borderLeftColor: rarityColors[def.rarity as AchievementRarity] ?? "#9CA3AF" } : {}}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <AchievementBadge
                      name=""
                      rarity={def.rarity}
                      unlocked={isUnlocked}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm">{def.name}</span>
                        <Badge className={`text-[10px] ${rarityColorMap[def.rarity] ?? ""}`}>
                          {rarityLabels[def.rarity as AchievementRarity] ?? def.rarity}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-number">{def.points}pt</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {def.isHidden && !isUnlocked ? (
                          <span className="flex items-center gap-1">
                            <Lock className="h-3 w-3" /> 隱藏成就
                          </span>
                        ) : (
                          def.description
                        )}
                      </p>
                      {isUnlocked && playerAch && (
                        <p className="text-[10px] text-green-500 mt-1 font-medium">
                          🎉 {new Date(playerAch.unlockedAt).toLocaleDateString("zh-TW")} 解鎖
                        </p>
                      )}
                    </div>
                    {isUnlocked ? (
                      <Trophy className="h-5 w-5 text-yellow-500 fill-yellow-500/20 shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </BattleLayout>
  );
}
