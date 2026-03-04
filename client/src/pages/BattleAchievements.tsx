// 水彈對戰 PK 擂台 — 成就頁面
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import AchievementBadge from "@/components/battle/AchievementBadge";
import {
  rarityLabels,
  rarityColors,
  categoryLabels,
  type AchievementRarity,
  type AchievementCategory,
} from "@shared/schema";
import { ArrowLeft, Medal, Trophy, Lock } from "lucide-react";

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

export default function BattleAchievements() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AchievementCategory | "all">("all");

  const { data: allDefs = [] } = useQuery<AchievementDef[]>({
    queryKey: ["/api/battle/achievements"],
    queryFn: async () => {
      const res = await fetch("/api/battle/achievements", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: myAchievements = [] } = useQuery<PlayerAchievement[]>({
    queryKey: ["/api/battle/my/achievements"],
    queryFn: async () => {
      const { getIdToken } = await import("@/lib/firebase");
      const token = await getIdToken();
      const res = await fetch("/api/battle/my/achievements", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const unlockedIds = new Set(myAchievements.map((a) => a.achievementId));

  const filteredDefs = activeTab === "all"
    ? allDefs
    : allDefs.filter((d) => d.category === activeTab);

  const totalPoints = myAchievements.reduce((sum, a) => sum + a.points, 0);
  const maxPoints = allDefs.reduce((sum, a) => sum + a.points, 0);

  const rarityColorMap: Record<string, string> = {
    common: "bg-gray-100 text-gray-700",
    uncommon: "bg-green-100 text-green-700",
    rare: "bg-blue-100 text-blue-700",
    epic: "bg-purple-100 text-purple-700",
    legendary: "bg-yellow-100 text-yellow-800",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 標題列 */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4">
        <div className="flex items-center gap-3">
          <Link href="/battle/my">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Medal className="h-5 w-5" />
              對戰成就
            </h1>
            <p className="text-sm text-white/80">
              {myAchievements.length}/{allDefs.length} 已解鎖 · {totalPoints}/{maxPoints} 點
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
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
            <Card>
              <CardContent className="p-8 text-center">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">此分類尚無成就</p>
              </CardContent>
            </Card>
          ) : (
            filteredDefs.map((def) => {
              const isUnlocked = unlockedIds.has(def.id);
              const playerAch = myAchievements.find((a) => a.achievementId === def.id);

              return (
                <Card
                  key={def.id}
                  className={isUnlocked ? "border-l-4" : "opacity-60"}
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{def.name}</span>
                        <Badge className={`text-[10px] ${rarityColorMap[def.rarity] ?? ""}`}>
                          {rarityLabels[def.rarity as AchievementRarity] ?? def.rarity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{def.points}pt</span>
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
                        <p className="text-[10px] text-green-600 mt-1">
                          {new Date(playerAch.unlockedAt).toLocaleDateString("zh-TW")} 解鎖
                        </p>
                      )}
                    </div>
                    {isUnlocked ? (
                      <span className="text-green-500 text-lg">✓</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
