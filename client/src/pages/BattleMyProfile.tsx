// 水彈對戰 PK 擂台 — 我的戰鬥檔案頁
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { BattlePlayerRanking, BattleClan, BattleClanMember } from "@shared/schema";
import {
  ArrowLeft, User, Trophy, Shield, Flame,
  TrendingUp, History as HistoryIcon, Crown,
  Medal, Calendar,
} from "lucide-react";

interface MyRankingResponse extends BattlePlayerRanking {
  tierLabel: string;
  winRate: number;
}

interface MyClanResponse extends BattleClan {
  myRole: string;
  members: BattleClanMember[];
}

export default function BattleMyProfile() {
  const { user } = useAuth();
  const fieldId = user?.defaultFieldId;

  const { data: ranking } = useQuery<MyRankingResponse>({
    queryKey: ["/api/battle/rankings/me", fieldId],
    queryFn: async () => {
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

  const { data: myClan } = useQuery<MyClanResponse | null>({
    queryKey: ["/api/battle/my/clan", fieldId],
    queryFn: async () => {
      const { getIdToken } = await import("@/lib/firebase");
      const token = await getIdToken();
      const res = await fetch(`/api/battle/my/clan?fieldId=${fieldId}`, {
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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/battle">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white gap-1 mb-2">
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <User className="h-8 w-8" />
            <h1 className="text-2xl font-bold">我的戰鬥檔案</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 段位卡片 */}
        {ranking && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">目前段位</p>
                  <p className="text-2xl font-bold">{ranking.tierLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{ranking.rating}</p>
                  <p className="text-sm text-muted-foreground">積分</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-sm">
                <div>
                  <p className="text-muted-foreground">總場</p>
                  <p className="font-semibold">{ranking.totalBattles}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">勝率</p>
                  <p className="font-semibold">{ranking.winRate}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">連勝</p>
                  <p className="font-semibold flex items-center justify-center gap-1">
                    {ranking.winStreak > 0 && <Flame className="h-3 w-3 text-orange-500" />}
                    {ranking.winStreak}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">最佳</p>
                  <p className="font-semibold">{ranking.bestStreak}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">MVP</p>
                  <p className="font-semibold">{ranking.mvpCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 我的戰隊 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> 我的戰隊
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myClan ? (
              <Link href={`/battle/clan/${myClan.id}`}>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                  <div>
                    <p className="font-semibold">[{myClan.tag}] {myClan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {myClan.members.filter((m) => !m.leftAt).length} 名成員 · 積分 {myClan.clanRating}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {myClan.myRole === "leader" && <Crown className="h-3 w-3 mr-1 text-yellow-500" />}
                    {myClan.myRole === "leader" ? "隊長" : myClan.myRole === "officer" ? "幹部" : "隊員"}
                  </Badge>
                </div>
              </Link>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm mb-3">你還沒有加入任何戰隊</p>
                <Link href="/battle/clan/create">
                  <Button size="sm">建立戰隊</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 快速連結 */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/battle/ranking">
            <Card className="hover:bg-gray-50 cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="font-medium text-sm">排行榜</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/battle/history">
            <Card className="hover:bg-gray-50 cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <HistoryIcon className="h-5 w-5 text-gray-500" />
                <span className="font-medium text-sm">對戰歷史</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
