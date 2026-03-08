// 水彈對戰 PK 擂台 — 對戰結果頁（深色軍事風格）
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import BattleLayout from "@/components/battle/BattleLayout";
import type { BattleResult as BattleResultType, BattlePlayerResult } from "@shared/schema";
import { Trophy, Star, TrendingUp, TrendingDown, Minus, Swords } from "lucide-react";

interface PlayerResultWithName extends BattlePlayerResult {
  displayName?: string;
}

interface ResultResponse extends BattleResultType {
  playerResults: PlayerResultWithName[];
}

export default function BattleResult() {
  const [, params] = useRoute("/battle/slot/:slotId/result");
  const slotId = params?.slotId ?? "";
  const { user } = useAuth();

  const { data, isLoading } = useQuery<ResultResponse>({
    queryKey: ["/api/battle/slots", slotId, "result"],
    queryFn: async () => {
      const res = await fetch(`/api/battle/slots/${slotId}/result`);
      if (!res.ok) throw new Error("取得結果失敗");
      return res.json();
    },
    enabled: !!slotId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">尚無結果記錄</p>
        <Link href={`/battle/slot/${slotId}`}>
          <Button variant="outline">返回時段</Button>
        </Link>
      </div>
    );
  }

  const myResult = data.playerResults?.find((r) => r.userId === user?.id);
  const teamColors: Record<string, string> = {
    紅隊: "text-red-500",
    藍隊: "text-blue-400",
    綠隊: "text-green-500",
    黃隊: "text-yellow-500",
  };

  const teamMap = new Map<string, BattlePlayerResult[]>();
  for (const pr of data.playerResults ?? []) {
    if (!teamMap.has(pr.team)) teamMap.set(pr.team, []);
    teamMap.get(pr.team)!.push(pr);
  }

  return (
    <BattleLayout title="對戰結果" backHref={`/battle/slot/${slotId}`}>
      <div className="space-y-4">
        {/* 勝負結果 */}
        <Card className="bg-tactical-orange/10 border-tactical-orange/30">
          <CardContent className="p-6 text-center">
            <Trophy className="h-10 w-10 text-tactical-orange mx-auto mb-2" />
            {data.isDraw ? (
              <h2 className="text-2xl font-display font-bold">平手！</h2>
            ) : (
              <h2 className={`text-2xl font-display font-bold ${teamColors[data.winningTeam ?? ""] ?? ""}`}>
                {data.winningTeam} 獲勝！
              </h2>
            )}
            {data.durationMinutes && (
              <p className="text-sm text-muted-foreground mt-1">對戰時長：{data.durationMinutes} 分鐘</p>
            )}
          </CardContent>
        </Card>

        {/* 隊伍分數 */}
        {data.teamScores && (data.teamScores as { teamName: string; score: number }[]).length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {(data.teamScores as { teamName: string; score: number }[]).map((ts) => (
              <Card key={ts.teamName} className={`bg-card border-border ${ts.teamName === data.winningTeam ? "border-tactical-orange/30" : ""}`}>
                <CardContent className="p-4 text-center">
                  <p className={`font-semibold ${teamColors[ts.teamName] ?? ""}`}>{ts.teamName}</p>
                  <p className="text-3xl font-number font-bold">{ts.score}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 我的戰績 */}
        {myResult && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                我的戰績
                {myResult.isMvp && <Badge className="bg-tactical-orange text-white">MVP</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 text-center text-sm mb-3">
                <div>
                  <p className="text-muted-foreground">得分</p>
                  <p className="text-lg font-number font-bold">{myResult.score}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">命中</p>
                  <p className="text-lg font-number font-bold">{myResult.hits}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">淘汰</p>
                  <p className="text-lg font-number font-bold">{myResult.eliminations}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">陣亡</p>
                  <p className="text-lg font-number font-bold">{myResult.deaths}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">積分變動：</span>
                {myResult.ratingChange > 0 ? (
                  <span className="flex items-center gap-1 text-green-500 font-number font-semibold">
                    <TrendingUp className="h-4 w-4" /> +{myResult.ratingChange}
                  </span>
                ) : myResult.ratingChange < 0 ? (
                  <span className="flex items-center gap-1 text-red-500 font-number font-semibold">
                    <TrendingDown className="h-4 w-4" /> {myResult.ratingChange}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Minus className="h-4 w-4" /> 0
                  </span>
                )}
                <span className="text-muted-foreground font-number">
                  ({myResult.ratingBefore} → {myResult.ratingAfter})
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 全員戰績 */}
        {Array.from(teamMap.entries()).map(([teamName, members]) => (
          <Card key={teamName} className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className={`text-base ${teamColors[teamName] ?? ""}`}>
                {teamName} ({members.length}人)
                {teamName === data.winningTeam && <Trophy className="inline h-4 w-4 text-yellow-500 ml-1" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {members
                  .sort((a, b) => b.score - a.score)
                  .map((pr) => (
                    <div key={pr.id} className="flex items-center justify-between text-sm py-1">
                      <span className="flex items-center gap-2">
                        {pr.displayName ?? pr.userId.slice(0, 8)}
                        {pr.isMvp && <Badge variant="outline" className="text-xs border-tactical-orange/30">MVP</Badge>}
                      </span>
                      <span className="flex items-center gap-3 text-muted-foreground font-number">
                        <span>得分 {pr.score}</span>
                        <span>淘汰 {pr.eliminations}</span>
                        <span className={pr.ratingChange >= 0 ? "text-green-500" : "text-red-500"}>
                          {pr.ratingChange >= 0 ? "+" : ""}{pr.ratingChange}
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </BattleLayout>
  );
}
