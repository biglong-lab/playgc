// 水彈對戰 PK 擂台 — 排行榜
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { BattlePlayerRanking } from "@shared/schema";
import { Trophy, ArrowLeft, Crown, Flame, Target } from "lucide-react";

interface RankingEntry extends BattlePlayerRanking {
  rank: number;
  tierLabel: string;
  winRate: number;
}

const tierBg: Record<string, string> = {
  master: "bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300",
  diamond: "bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200",
  platinum: "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200",
  gold: "bg-yellow-50 border-yellow-200",
  silver: "bg-gray-50 border-gray-200",
  bronze: "bg-orange-50 border-orange-200",
};

export default function BattleRanking() {
  const { user } = useAuth();
  const fieldId = user?.defaultFieldId;

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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/battle">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white gap-1 mb-2">
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8" />
            <h1 className="text-2xl font-bold">排行榜</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 我的排名 */}
        {myRanking && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">我的段位</p>
                  <p className="text-xl font-bold">{myRanking.tierLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{myRanking.rating}</p>
                  <p className="text-sm text-muted-foreground">積分</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3 text-center text-sm">
                <div>
                  <p className="text-muted-foreground">總場</p>
                  <p className="font-semibold">{myRanking.totalBattles}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">勝率</p>
                  <p className="font-semibold">{myRanking.winRate}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">連勝</p>
                  <p className="font-semibold flex items-center justify-center gap-1">
                    {myRanking.winStreak > 0 && <Flame className="h-3 w-3 text-orange-500" />}
                    {myRanking.winStreak}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">MVP</p>
                  <p className="font-semibold">{myRanking.mvpCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 排行榜列表 */}
        <Card>
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
                      tierBg[entry.tier] ?? "bg-white"
                    } ${entry.userId === user?.id ? "ring-2 ring-blue-400" : ""}`}
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
                          <span className="text-muted-foreground">{entry.rank}</span>
                        )}
                      </span>
                      <div>
                        <p className="font-medium text-sm">
                          {entry.userId.slice(0, 10)}...
                          {entry.userId === user?.id && <span className="text-blue-600"> (你)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.tierLabel}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{entry.rating}</p>
                      <p className="text-xs text-muted-foreground">
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
    </div>
  );
}
