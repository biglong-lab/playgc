// 水彈對戰 PK 擂台 — 我的戰鬥檔案頁（深色軍事風格）
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useBattleFieldId } from "@/hooks/useBattleFieldId";
import { apiRequest } from "@/lib/queryClient";
import BattleLayout from "@/components/battle/BattleLayout";
import type { BattlePlayerRanking } from "@shared/schema";
import {
  Trophy, Shield, Flame, Crown,
  History as HistoryIcon, Medal, Calendar,
  ChevronRight,
} from "lucide-react";

interface MyRankingResponse extends BattlePlayerRanking {
  tierLabel: string;
  winRate: number;
}

// 🆕 Squad 系統一次到位（PR2）：用 squads 取代 battle_clans
interface MySquad {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  primaryColor: string | null;
  status: string;
  myRole: "leader" | "officer" | "member";
  joinedAt: string;
}

export default function BattleMyProfile() {
  const { user } = useAuth();
  const { fieldId } = useBattleFieldId();

  const { data: ranking } = useQuery<MyRankingResponse>({
    queryKey: ["/api/battle/rankings/me", fieldId],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/battle/rankings/me?fieldId=${fieldId}`);
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !!fieldId && !!user,
  });

  // 🆕 Squad 系統一次到位（PR2）：取代 /api/battle/my/clan
  const { data: squadsData } = useQuery<{ memberships: MySquad[] }>({
    queryKey: ["/api/me/squads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/squads");
      return res.json();
    },
    enabled: !!user,
  });
  const activeSquads = (squadsData?.memberships ?? []).filter((s) => s.status === "active");

  return (
    <BattleLayout title="我的戰鬥檔案">
      <div className="space-y-4">
        {/* 段位卡片 */}
        {ranking && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">目前段位</p>
                  <p className="text-2xl font-display font-bold">{ranking.tierLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-number font-bold">{ranking.rating}</p>
                  <p className="text-sm text-muted-foreground">積分</p>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-sm">
                <div>
                  <p className="text-muted-foreground">總場</p>
                  <p className="font-number font-semibold">{ranking.totalBattles}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">勝率</p>
                  <p className="font-number font-semibold">{ranking.winRate}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">連勝</p>
                  <p className="font-number font-semibold flex items-center justify-center gap-1">
                    {ranking.winStreak > 0 && <Flame className="h-3 w-3 text-orange-500" />}
                    {ranking.winStreak}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">最佳</p>
                  <p className="font-number font-semibold">{ranking.bestStreak}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">MVP</p>
                  <p className="font-number font-semibold">{ranking.mvpCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 我的隊伍（Squad 系統一次到位 PR2 — 改用 /api/me/squads）*/}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> 我的隊伍
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeSquads.length > 0 ? (
              <>
                {activeSquads.map((squad) => {
                  const color = squad.primaryColor || "#a855f7";
                  return (
                    <Link key={squad.id} href={`/squad/${squad.id}`}>
                      <div
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-card/80 cursor-pointer transition-colors"
                        data-testid={`battle-my-squad-${squad.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs"
                            style={{ backgroundColor: `${color}25`, color }}
                          >
                            [{squad.tag}]
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{squad.name}</p>
                            {squad.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {squad.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {squad.myRole === "leader" && <Crown className="h-3 w-3 mr-1 text-yellow-500" />}
                          {squad.myRole === "leader" ? "隊長" : squad.myRole === "officer" ? "幹部" : "隊員"}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
                <Link href="/me/squads">
                  <Button variant="ghost" size="sm" className="w-full gap-1 text-xs">
                    管理所有隊伍
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm mb-1">你還沒有加入任何隊伍</p>
                <p className="text-xs text-muted-foreground mb-3">
                  與隊友一起戰鬥、累積跨遊戲戰績
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Link href="/squad/create">
                    <Button size="sm" data-testid="btn-battle-create-squad">建立隊伍</Button>
                  </Link>
                  <Link href="/battle/ranking">
                    <Button size="sm" variant="outline">瀏覽排行榜</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 快速連結 */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/battle/ranking">
            <Card className="bg-card/50 border-border hover:bg-card cursor-pointer transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <Trophy className="h-5 w-5 text-tactical-orange" />
                <span className="font-medium text-sm">排行榜</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/battle/history">
            <Card className="bg-card/50 border-border hover:bg-card cursor-pointer transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <HistoryIcon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-sm">對戰歷史</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/battle/achievements">
            <Card className="bg-card/50 border-border hover:bg-card cursor-pointer transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <Medal className="h-5 w-5 text-orange-400" />
                <span className="font-medium text-sm">成就徽章</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/battle/seasons">
            <Card className="bg-card/50 border-border hover:bg-card cursor-pointer transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <Calendar className="h-5 w-5 text-indigo-400" />
                <span className="font-medium text-sm">賽季歷史</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </BattleLayout>
  );
}
