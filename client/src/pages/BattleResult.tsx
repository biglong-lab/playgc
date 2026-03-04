// 水彈對戰 PK 擂台 — 對戰結果頁
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { BattleResult as BattleResultType, BattlePlayerResult } from "@shared/schema";
import { Trophy, ArrowLeft, Star, TrendingUp, TrendingDown, Minus, Swords } from "lucide-react";

interface ResultResponse extends BattleResultType {
  playerResults: BattlePlayerResult[];
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">尚無結果記錄</p>
        <Link href={`/battle/slot/${slotId}`}>
          <Button variant="outline">返回時段</Button>
        </Link>
      </div>
    );
  }

  const myResult = data.playerResults?.find((r) => r.userId === user?.id);
  const teamColors: Record<string, string> = {
    紅隊: "text-red-600",
    藍隊: "text-blue-600",
    綠隊: "text-green-600",
    黃隊: "text-yellow-600",
  };

  // 按隊伍分組
  const teamMap = new Map<string, BattlePlayerResult[]>();
  for (const pr of data.playerResults ?? []) {
    if (!teamMap.has(pr.team)) teamMap.set(pr.team, []);
    teamMap.get(pr.team)!.push(pr);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3">
        <Link href={`/battle/slot/${slotId}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> 返回
          </Button>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 勝負結果 */}
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="p-6 text-center">
            <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
            {data.isDraw ? (
              <h2 className="text-2xl font-bold text-gray-700">平手！</h2>
            ) : (
              <>
                <h2 className={`text-2xl font-bold ${teamColors[data.winningTeam ?? ""] ?? ""}`}>
                  {data.winningTeam} 獲勝！
                </h2>
              </>
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
              <Card key={ts.teamName} className={ts.teamName === data.winningTeam ? "border-yellow-300 bg-yellow-50/50" : ""}>
                <CardContent className="p-4 text-center">
                  <p className={`font-semibold ${teamColors[ts.teamName] ?? ""}`}>{ts.teamName}</p>
                  <p className="text-3xl font-bold">{ts.score}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 我的戰績 */}
        {myResult && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-blue-600" />
                我的戰績
                {myResult.isMvp && <Badge className="bg-yellow-500">MVP</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 text-center text-sm mb-3">
                <div>
                  <p className="text-muted-foreground">得分</p>
                  <p className="text-lg font-bold">{myResult.score}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">命中</p>
                  <p className="text-lg font-bold">{myResult.hits}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">淘汰</p>
                  <p className="text-lg font-bold">{myResult.eliminations}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">陣亡</p>
                  <p className="text-lg font-bold">{myResult.deaths}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">積分變動：</span>
                {myResult.ratingChange > 0 ? (
                  <span className="flex items-center gap-1 text-green-600 font-semibold">
                    <TrendingUp className="h-4 w-4" /> +{myResult.ratingChange}
                  </span>
                ) : myResult.ratingChange < 0 ? (
                  <span className="flex items-center gap-1 text-red-600 font-semibold">
                    <TrendingDown className="h-4 w-4" /> {myResult.ratingChange}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-500">
                    <Minus className="h-4 w-4" /> 0
                  </span>
                )}
                <span className="text-muted-foreground">
                  ({myResult.ratingBefore} → {myResult.ratingAfter})
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 全員戰績 */}
        {Array.from(teamMap.entries()).map(([teamName, members]) => (
          <Card key={teamName}>
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
                        {pr.userId.slice(0, 8)}...
                        {pr.isMvp && <Badge variant="outline" className="text-xs bg-yellow-50">MVP</Badge>}
                      </span>
                      <span className="flex items-center gap-3 text-muted-foreground">
                        <span>得分 {pr.score}</span>
                        <span>淘汰 {pr.eliminations}</span>
                        <span className={pr.ratingChange >= 0 ? "text-green-600" : "text-red-600"}>
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
    </div>
  );
}
