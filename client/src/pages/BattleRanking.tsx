// 水彈對戰 PK 擂台 — 排行榜（深色軍事風格）
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useBattleFieldId } from "@/hooks/useBattleFieldId";
import { apiRequest } from "@/lib/queryClient";
import { tierBgClass } from "@/lib/battle-labels";
import BattleLayout from "@/components/battle/BattleLayout";
import type { BattlePlayerRanking } from "@shared/schema";
import { Crown, Flame, ArrowDown, TrendingUp } from "lucide-react";

interface RankingEntry extends BattlePlayerRanking {
  rank: number;
  tierLabel: string;
  winRate: number;
  displayName?: string;
}

export default function BattleRanking() {
  const { user } = useAuth();
  const { fieldId } = useBattleFieldId();

  const { data: rankings = [], isLoading } = useQuery<RankingEntry[]>({
    queryKey: ["/api/battle/rankings", fieldId],
    queryFn: async () => {
      if (!fieldId) return [];
      try {
        const res = await apiRequest("GET", `/api/battle/rankings?fieldId=${fieldId}`);
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!fieldId,
  });

  const { data: myRanking } = useQuery<RankingEntry>({
    queryKey: ["/api/battle/rankings/me", fieldId],
    queryFn: async () => {
      if (!fieldId) return null;
      try {
        const res = await apiRequest("GET", `/api/battle/rankings/me?fieldId=${fieldId}`);
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !!fieldId && !!user,
  });

  // 🔧 找到自己在 list 中的位置（用來算上一名距離 + scrollIntoView）
  const myEntryRef = useRef<HTMLDivElement | null>(null);
  const myIndex = user ? rankings.findIndex((e) => e.userId === user.id) : -1;
  const myEntry = myIndex >= 0 ? rankings[myIndex] : null;
  const prevEntry = myIndex > 0 ? rankings[myIndex - 1] : null;
  const ratingGap = prevEntry && myEntry ? prevEntry.rating - myEntry.rating : 0;

  // 「滾到我的位置」 —— 排名在第 6 名以後才顯示
  const showScrollToMe = myIndex >= 5;
  const scrollToMe = () => {
    myEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <BattleLayout title="排行榜" subtitle="全場域積分排名">
      <div className="space-y-4">
        {/* 我的排名 */}
        {myRanking && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">我的段位</p>
                  <p className="text-xl font-display font-bold">
                    {myRanking.tierLabel}
                    {/* 🚀 顯示排名 */}
                    {myEntry && (
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        #{myEntry.rank}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-number font-bold">{myRanking.rating}</p>
                  <p className="text-sm text-muted-foreground">積分</p>
                </div>
              </div>
              {/* 🚀 距離下一名提示（提供向上挑戰動力） */}
              {prevEntry && ratingGap > 0 && (
                <div className="mt-2 flex items-center justify-center gap-1.5 text-xs">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <span className="text-muted-foreground">距離 #{prevEntry.rank} </span>
                  <span className="font-semibold text-primary">{prevEntry.displayName ?? "玩家"}</span>
                  <span className="text-muted-foreground">還差</span>
                  <span className="font-number font-bold text-primary">{ratingGap}</span>
                  <span className="text-muted-foreground">分</span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center text-sm">
                <div>
                  <p className="text-muted-foreground">總場</p>
                  <p className="font-number font-semibold">{myRanking.totalBattles}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">勝率</p>
                  <p className="font-number font-semibold">{myRanking.winRate}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">連勝</p>
                  <p className="font-number font-semibold flex items-center justify-center gap-1">
                    {myRanking.winStreak > 0 && <Flame className="h-3 w-3 text-orange-500" />}
                    {myRanking.winStreak}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">MVP</p>
                  <p className="font-number font-semibold">{myRanking.mvpCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 排行榜列表 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">全場域排行</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : rankings.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">尚無排名資料</p>
            ) : (
              <div className="space-y-2">
                {rankings.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      tierBgClass(entry.tier) || "bg-card"
                    } ${entry.userId === user?.id ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center font-bold text-lg">
                        {entry.rank <= 3 ? (
                          <Crown className={`h-5 w-5 mx-auto ${
                            entry.rank === 1 ? "text-yellow-500" :
                            entry.rank === 2 ? "text-gray-400" :
                            "text-orange-400"
                          }`} />
                        ) : (
                          <span className="text-muted-foreground font-number">{entry.rank}</span>
                        )}
                      </span>
                      <div>
                        <p className="font-medium text-sm">
                          {entry.displayName ?? entry.userId.slice(0, 10)}
                          {entry.userId === user?.id && <span className="text-primary"> (你)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.tierLabel}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-number font-bold">{entry.rating}</p>
                      <p className="text-xs text-muted-foreground font-number">
                        {entry.wins}勝 {entry.losses}負 ({entry.winRate}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </BattleLayout>
  );
}
