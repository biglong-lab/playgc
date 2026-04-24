// 水彈對戰 PK 擂台 — 玩家端賽季歷史（深色軍事風格）
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useBattleFieldId } from "@/hooks/useBattleFieldId";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tierLabels } from "@shared/schema";
import { TIER_BADGE } from "@/lib/battle-labels";
import BattleLayout from "@/components/battle/BattleLayout";
import { Trophy, Medal, Swords } from "lucide-react";

interface SeasonHistoryEntry {
  id: string;
  seasonId: string;
  finalRating: number;
  finalTier: string;
  tierLabel: string;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  rank: number;
  seasonName: string;
  seasonNumber: number;
  startDate: string;
  endDate: string | null;
}

export default function BattleSeasonHistory() {
  const { user } = useAuth();
  const { fieldId } = useBattleFieldId();

  const { data: history = [], isLoading } = useQuery<SeasonHistoryEntry[]>({
    queryKey: ["/api/battle/my/season-history", fieldId],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/battle/my/season-history?fieldId=${fieldId}`);
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!user && !!fieldId,
  });

  // 🚀 賽季級總覽（聚合所有賽季資料）
  const stats = history.reduce(
    (acc, e) => ({
      totalSeasons: acc.totalSeasons + 1,
      bestRank: acc.bestRank === 0 ? e.rank : Math.min(acc.bestRank, e.rank),
      bestRating: Math.max(acc.bestRating, e.finalRating),
      bestTier: !acc.bestTier || tierOrder(e.finalTier) > tierOrder(acc.bestTier) ? e.finalTier : acc.bestTier,
      totalBattles: acc.totalBattles + e.totalBattles,
      totalWins: acc.totalWins + e.wins,
      totalLosses: acc.totalLosses + e.losses,
      totalDraws: acc.totalDraws + e.draws,
    }),
    { totalSeasons: 0, bestRank: 0, bestRating: 0, bestTier: "", totalBattles: 0, totalWins: 0, totalLosses: 0, totalDraws: 0 },
  );
  const overallWinRate = stats.totalBattles > 0
    ? Math.round((stats.totalWins / stats.totalBattles) * 100)
    : 0;

  return (
    <BattleLayout title="賽季歷史" subtitle="歷屆賽季排名紀錄" backHref="/battle/my">
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : history.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-2">尚無賽季紀錄</p>
              <p className="text-xs text-muted-foreground mb-4">
                參加對戰累積排名，賽季結束時會保存紀錄
              </p>
              {/* 🚀 Empty state CTA */}
              <Link href="/battle">
                <Button className="gap-2">
                  <Swords className="h-4 w-4" />
                  前往對戰中心
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 🚀 賽季級總覽（在列表上方） */}
            <Card className="bg-primary/5 border-primary/30">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  歷屆綜合戰績
                </h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">參加賽季</p>
                    <p className="text-xl font-number font-bold">{stats.totalSeasons}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">最佳名次</p>
                    <p className="text-xl font-number font-bold text-yellow-500">
                      #{stats.bestRank}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">最高積分</p>
                    <p className="text-xl font-number font-bold">{stats.bestRating}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-primary/20 grid grid-cols-2 gap-3 text-center text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">最高段位</p>
                    {stats.bestTier ? (
                      <Badge className={`${TIER_BADGE[stats.bestTier] ?? ""} mt-1`}>
                        {tierLabels[stats.bestTier as keyof typeof tierLabels] ?? stats.bestTier}
                      </Badge>
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">總勝率</p>
                    <p className="font-number font-semibold mt-1">
                      {overallWinRate}%
                      <span className="text-xs text-muted-foreground ml-1">
                        ({stats.totalWins}勝 / {stats.totalBattles}場)
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {history.map((entry) => (
            <Card key={entry.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display font-semibold">{entry.seasonName}</h3>
                    <p className="text-xs text-muted-foreground">
                      第 {entry.seasonNumber} 賽季 ·{" "}
                      {new Date(entry.startDate).toLocaleDateString("zh-TW")}
                      {entry.endDate && ` ~ ${new Date(entry.endDate).toLocaleDateString("zh-TW")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.rank <= 3 && (
                      <Medal className={`h-5 w-5 ${
                        entry.rank === 1 ? "text-yellow-500" :
                        entry.rank === 2 ? "text-gray-400" :
                        "text-amber-700"
                      }`} />
                    )}
                    <span className="text-lg font-number font-bold">#{entry.rank}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Badge className={`${TIER_BADGE[entry.finalTier] ?? ""}`}>
                    {tierLabels[entry.finalTier as keyof typeof tierLabels] ?? entry.finalTier}
                  </Badge>
                  <span className="text-lg font-number font-bold">{entry.finalRating} 分</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="bg-primary/5 rounded p-2">
                    <p className="text-xs text-muted-foreground">總場</p>
                    <p className="font-number font-semibold">{entry.totalBattles}</p>
                  </div>
                  <div className="bg-primary/5 rounded p-2">
                    <p className="text-xs text-muted-foreground">勝</p>
                    <p className="font-number font-semibold text-green-500">{entry.wins}</p>
                  </div>
                  <div className="bg-primary/5 rounded p-2">
                    <p className="text-xs text-muted-foreground">負</p>
                    <p className="font-number font-semibold text-red-500">{entry.losses}</p>
                  </div>
                  <div className="bg-primary/5 rounded p-2">
                    <p className="text-xs text-muted-foreground">平</p>
                    <p className="font-number font-semibold">{entry.draws}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </BattleLayout>
  );
}
