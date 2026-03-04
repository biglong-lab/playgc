// 水彈對戰 PK 擂台 — 排行榜（深色軍事風格）
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useBattleFieldId } from "@/hooks/useBattleFieldId";
import BattleLayout from "@/components/battle/BattleLayout";
import type { BattlePlayerRanking } from "@shared/schema";
import { Crown, Flame } from "lucide-react";

interface RankingEntry extends BattlePlayerRanking {
  rank: number;
  tierLabel: string;
  winRate: number;
}

const tierBg: Record<string, string> = {
  master: "bg-yellow-500/10 border-yellow-500/30",
  diamond: "bg-cyan-500/10 border-cyan-500/30",
  platinum: "bg-indigo-500/10 border-indigo-500/30",
  gold: "bg-amber-500/10 border-amber-500/30",
  silver: "bg-gray-500/10 border-gray-500/30",
  bronze: "bg-orange-500/10 border-orange-500/30",
};

export default function BattleRanking() {
  const { user } = useAuth();
  const { fieldId } = useBattleFieldId();

  const { data: rankings = [], isLoading } = useQuery<RankingEntry[]>({
    queryKey: ["/api/battle/rankings", fieldId],
    queryFn: async () => {
      if (!fieldId) return [];
      const res = await fetch(`/api/battle/rankings?fieldId=${fieldId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fieldId,
  });

  const { data: myRanking } = useQuery<RankingEntry>({
    queryKey: ["/api/battle/rankings/me", fieldId],
    queryFn: async () => {
      if (!fieldId) return null;
      const { getIdToken } = await import("@/lib/firebase");
      const token = await getIdToken();
      const res = await fetch(`/api/battle/rankings/me?fieldId=${fieldId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!fieldId && !!user,
  });

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
                  <p className="text-xl font-display font-bold">{myRanking.tierLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-number font-bold">{myRanking.rating}</p>
                  <p className="text-sm text-muted-foreground">積分</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 text-center text-sm">
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
              <p className="text-muted-foreground py-4">載入中...</p>
            ) : rankings.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">尚無排名資料</p>
            ) : (
              <div className="space-y-2">
                {rankings.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      tierBg[entry.tier] ?? "bg-card"
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
                          {entry.userId.slice(0, 10)}...
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
