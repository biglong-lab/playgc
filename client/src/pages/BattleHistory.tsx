// 水彈對戰 PK 擂台 — 我的對戰歷史（深色軍事風格）
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import BattleLayout from "@/components/battle/BattleLayout";
import type { BattlePlayerResult } from "@shared/schema";
import { History, TrendingUp, TrendingDown, Minus, Star, MapPin, Swords } from "lucide-react";

interface HistoryRecord extends BattlePlayerResult {
  slotDate?: string;
  startTime?: string;
  venueName?: string;
}

export default function BattleHistory() {
  const { user } = useAuth();

  const { data: history = [], isLoading } = useQuery<HistoryRecord[]>({
    queryKey: ["/api/battle/my/history"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/battle/my/history?limit=30");
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  // 🚀 戰績統計總覽（聚合計算）
  const stats = history.reduce(
    (acc, r) => ({
      totalGames: acc.totalGames + 1,
      totalScore: acc.totalScore + (r.score ?? 0),
      totalEliminations: acc.totalEliminations + (r.eliminations ?? 0),
      totalHits: acc.totalHits + (r.hits ?? 0),
      totalDeaths: acc.totalDeaths + (r.deaths ?? 0),
      totalRatingChange: acc.totalRatingChange + (r.ratingChange ?? 0),
      mvpCount: acc.mvpCount + (r.isMvp ? 1 : 0),
    }),
    {
      totalGames: 0, totalScore: 0, totalEliminations: 0, totalHits: 0,
      totalDeaths: 0, totalRatingChange: 0, mvpCount: 0,
    },
  );
  const avgScore = stats.totalGames > 0 ? Math.round(stats.totalScore / stats.totalGames) : 0;
  const kdRatio = stats.totalDeaths === 0
    ? (stats.totalEliminations > 0 ? "∞" : "0")
    : (stats.totalEliminations / stats.totalDeaths).toFixed(2);

  return (
    <BattleLayout title="對戰歷史" subtitle="近期對戰紀錄">
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : history.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="mb-4">尚無對戰紀錄，快去報名一場吧！</p>
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
            {/* 🚀 總覽統計（在列表上方） */}
            <Card className="bg-primary/5 border-primary/30">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">場數</p>
                    <p className="text-xl font-number font-bold">{stats.totalGames}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">平均得分</p>
                    <p className="text-xl font-number font-bold">{avgScore}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">總淘汰</p>
                    <p className="text-xl font-number font-bold text-green-500">{stats.totalEliminations}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">總陣亡</p>
                    <p className="text-xl font-number font-bold text-red-500">{stats.totalDeaths}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">K/D</p>
                    <p className="text-xl font-number font-bold">{kdRatio}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-0.5">
                      <Star className="h-3 w-3 text-yellow-500" /> MVP
                    </p>
                    <p className="text-xl font-number font-bold">{stats.mvpCount}</p>
                  </div>
                </div>
                {/* 累積積分變動 */}
                <div className="mt-3 pt-3 border-t border-primary/20 flex items-center justify-center gap-2 text-sm">
                  <span className="text-muted-foreground">累積積分變動：</span>
                  {stats.totalRatingChange > 0 ? (
                    <span className="flex items-center gap-1 text-green-500 font-number font-semibold">
                      <TrendingUp className="h-4 w-4" /> +{stats.totalRatingChange}
                    </span>
                  ) : stats.totalRatingChange < 0 ? (
                    <span className="flex items-center gap-1 text-red-500 font-number font-semibold">
                      <TrendingDown className="h-4 w-4" /> {stats.totalRatingChange}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Minus className="h-4 w-4" /> 0
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
            {history.map((record) => (
              <Card key={record.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{record.team}</Badge>
                      <div className="text-sm">
                        <span className="text-muted-foreground">得分 </span>
                        <span className="font-number font-semibold">{record.score}</span>
                        <span className="text-muted-foreground ml-2">淘汰 </span>
                        <span className="font-number font-semibold">{record.eliminations}</span>
                        <span className="text-muted-foreground ml-2">命中 </span>
                        <span className="font-number font-semibold">{record.hits}</span>
                      </div>
                      {record.isMvp && (
                        <Star className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {record.ratingChange > 0 ? (
                        <span className="flex items-center gap-1 text-green-500 font-number font-semibold text-sm">
                          <TrendingUp className="h-4 w-4" /> +{record.ratingChange}
                        </span>
                      ) : record.ratingChange < 0 ? (
                        <span className="flex items-center gap-1 text-red-500 font-number font-semibold text-sm">
                          <TrendingDown className="h-4 w-4" /> {record.ratingChange}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground text-sm">
                          <Minus className="h-4 w-4" /> 0
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground font-number">{record.ratingAfter}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    {record.venueName && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {record.venueName}
                      </span>
                    )}
                    {record.slotDate ?? new Date(record.createdAt).toLocaleDateString("zh-TW")}
                    {record.startTime && ` ${record.startTime.slice(0, 5)}`}
                  </p>
                </CardContent>
              </Card>
            ))}
            </div>
          </>
        )}
      </div>
    </BattleLayout>
  );
}
