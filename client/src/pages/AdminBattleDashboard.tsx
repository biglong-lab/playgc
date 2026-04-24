// 水彈對戰 PK 擂台 — 管理端儀表板
import { useQuery } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { tierLabels } from "@shared/schema";
import { Swords, Users, Calendar, TrendingUp, Trophy, Clock } from "lucide-react";
import { Link } from "wouter";

interface BattleStats {
  totalBattles: number;
  totalPlayers: number;
  monthBattles: number;
  avgPlayersPerBattle: number;
}

interface TierDistribution {
  tier: string;
  tierLabel: string;
  count: number;
}

interface RecentResult {
  id: string;
  slotId: string;
  venueName: string;
  winningTeam: string | null;
  isDraw: boolean;
  durationMinutes: number | null;
  playerCount: number;
  createdAt: string;
}

export default function AdminBattleDashboard() {
  const { admin } = useAdminAuth();
  const fieldId = admin?.fieldId;

  const { data: stats } = useQuery<BattleStats>({
    queryKey: ["/api/admin/battle/stats", fieldId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/battle/stats?fieldId=${fieldId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("取得統計失敗");
      return res.json();
    },
    enabled: !!fieldId,
  });

  const { data: tierDist = [] } = useQuery<TierDistribution[]>({
    queryKey: ["/api/admin/battle/tier-distribution", fieldId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/battle/tier-distribution?fieldId=${fieldId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fieldId,
  });

  const { data: recentResults = [] } = useQuery<RecentResult[]>({
    queryKey: ["/api/admin/battle/recent-results", fieldId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/battle/recent-results?fieldId=${fieldId}&limit=10`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fieldId,
  });

  const { data: topRankings = [] } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ["/api/admin/battle/rankings-top10", fieldId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/battle/rankings?fieldId=${fieldId}&limit=10`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!fieldId,
  });

  const maxTierCount = Math.max(...tierDist.map((d) => d.count), 1);

  const tierColors: Record<string, string> = {
    bronze: "bg-amber-700",
    silver: "bg-gray-400",
    gold: "bg-yellow-500",
    platinum: "bg-cyan-500",
    diamond: "bg-blue-500",
    master: "bg-purple-600",
  };

  return (
    <UnifiedAdminLayout title="對戰儀表板">
      <div className="space-y-6">
        {/* 統計卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Swords className="h-5 w-5 text-blue-500" />}
            label="總場次"
            value={stats?.totalBattles ?? 0}
          />
          <StatCard
            icon={<Calendar className="h-5 w-5 text-green-500" />}
            label="本月場次"
            value={stats?.monthBattles ?? 0}
          />
          <StatCard
            icon={<Users className="h-5 w-5 text-orange-500" />}
            label="活躍玩家"
            value={stats?.totalPlayers ?? 0}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
            label="平均人數/場"
            value={stats?.avgPlayersPerBattle ?? 0}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 段位分佈 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                段位分佈
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tierDist.length === 0 || tierDist.every((d) => d.count === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="empty-tier-distribution">
                  尚無玩家段位資料 — 完成第一場對戰後自動計算
                </p>
              ) : (
                <div className="space-y-3">
                  {tierDist.map((d) => (
                    <div key={d.tier} className="flex items-center gap-3">
                      <span className="text-sm w-20 truncate">{d.tierLabel}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${tierColors[d.tier] ?? "bg-gray-400"} transition-all`}
                          style={{ width: `${(d.count / maxTierCount) * 100}%`, minWidth: d.count > 0 ? "24px" : "0" }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* TOP 10 排名 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  TOP 10 排名
                </span>
                <Link href="/admin/battle/rankings">
                  <span className="text-sm text-blue-500 hover:underline cursor-pointer">查看全部</span>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topRankings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">尚無排名資料</p>
              ) : (
                <div className="space-y-2">
                  {topRankings.map((r, idx) => (
                    <div key={String(r.id)} className="flex items-center gap-3 text-sm">
                      <span className="w-6 text-center font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate">{String(r.userId).slice(0, 8)}...</span>
                      <Badge variant="outline" className="text-xs">
                        {String(r.tierLabel ?? r.tier)}
                      </Badge>
                      <span className="font-medium w-12 text-right">{Number(r.rating)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 最近 10 場結果 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              最近對戰結果
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">尚無對戰紀錄</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2">場地</th>
                      <th className="text-left py-2 px-2">結果</th>
                      <th className="text-center py-2 px-2">人數</th>
                      <th className="text-center py-2 px-2">時長</th>
                      <th className="text-right py-2 px-2">時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentResults.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 px-2">{r.venueName}</td>
                        <td className="py-2 px-2">
                          {r.isDraw ? (
                            <Badge variant="outline">平手</Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700">
                              {r.winningTeam} 勝
                            </Badge>
                          )}
                        </td>
                        <td className="text-center py-2 px-2">{r.playerCount}</td>
                        <td className="text-center py-2 px-2">
                          {r.durationMinutes ? `${r.durationMinutes}分` : "-"}
                        </td>
                        <td className="text-right py-2 px-2 text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString("zh-TW")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UnifiedAdminLayout>
  );
}

/** 統計卡片元件 */
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  // 🆕 無資料時數字 muted + icon 半透明，避免 0 被誤判為真實資料
  const isEmpty = value === 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={isEmpty ? "opacity-40" : ""}>{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${isEmpty ? "text-muted-foreground" : ""}`}>
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
