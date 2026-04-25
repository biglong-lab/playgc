// 推廣連結 Cohort 分析後台 — Phase 17.1
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13.4 §25.2
//
// 顯示：
//   - 4 個 KPI（總連結、總點擊、總轉換、總啟動）
//   - 12 週漏斗：點擊 → 註冊 → 首戰 → 5 場達標
//   - 各週留存率對比
//
import { useQuery } from "@tanstack/react-query";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Users,
  MousePointer2,
  Trophy,
  Sparkles,
  Loader2,
  Activity,
} from "lucide-react";

interface CohortRow {
  week: string;
  totalLinks: number;
  totalClicks: number;
  totalConverted: number;
  totalFirstGame: number;
  totalActivated: number;
  totalGamesPlayed: number;
  conversionRate: number;
  firstGameRate: number;
  activationRate: number;
}

interface CohortResponse {
  weeks: number;
  totals: {
    totalLinks: number;
    totalClicks: number;
    totalConverted: number;
    totalFirstGame: number;
    totalActivated: number;
    totalGamesPlayed: number;
  };
  cohorts: CohortRow[];
}

export default function AdminInvitesCohort() {
  const { data, isLoading } = useQuery<CohortResponse>({
    queryKey: ["/api/admin/invites/cohort"],
    queryFn: () =>
      fetchWithAdminAuth("/api/admin/invites/cohort?weeks=12"),
    refetchInterval: 5 * 60_000, // 5 分鐘更新
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { totals, cohorts } = data;

  const overallConversionRate =
    totals.totalClicks > 0
      ? Math.round((totals.totalConverted / totals.totalClicks) * 100)
      : 0;
  const overallFirstGameRate =
    totals.totalConverted > 0
      ? Math.round((totals.totalFirstGame / totals.totalConverted) * 100)
      : 0;
  const overallActivationRate =
    totals.totalConverted > 0
      ? Math.round((totals.totalActivated / totals.totalConverted) * 100)
      : 0;

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          推廣連結 Cohort 分析
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          12 週漏斗：點擊 → 註冊 → 首戰 → 5 場達標 + 各週留存率
        </p>
      </div>

      {/* 4 個 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={<MousePointer2 className="w-4 h-4 text-blue-500" />}
          label="總點擊"
          value={totals.totalClicks}
          sub={`${totals.totalLinks} 個連結`}
        />
        <KpiCard
          icon={<Users className="w-4 h-4 text-emerald-500" />}
          label="總轉換"
          value={totals.totalConverted}
          sub={`轉換率 ${overallConversionRate}%`}
        />
        <KpiCard
          icon={<Trophy className="w-4 h-4 text-amber-500" />}
          label="完成首戰"
          value={totals.totalFirstGame}
          sub={`首戰率 ${overallFirstGameRate}%`}
        />
        <KpiCard
          icon={<Sparkles className="w-4 h-4 text-violet-500" />}
          label="5 場啟動"
          value={totals.totalActivated}
          sub={`啟動率 ${overallActivationRate}%`}
        />
      </div>

      {/* 漏斗總圖 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">完整漏斗</CardTitle>
        </CardHeader>
        <CardContent>
          <FunnelStage
            label="點擊"
            value={totals.totalClicks}
            base={totals.totalClicks}
            color="bg-blue-500"
          />
          <FunnelStage
            label="註冊"
            value={totals.totalConverted}
            base={totals.totalClicks}
            color="bg-emerald-500"
          />
          <FunnelStage
            label="完成首戰"
            value={totals.totalFirstGame}
            base={totals.totalClicks}
            color="bg-amber-500"
          />
          <FunnelStage
            label="5 場達標（啟動）"
            value={totals.totalActivated}
            base={totals.totalClicks}
            color="bg-violet-500"
          />
        </CardContent>
      </Card>

      {/* 各週 cohort 表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            各週 Cohort（最近 {data.weeks} 週）
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            ISO 週數（YYYY-WW）— 該週建立的連結後續轉換成績
          </p>
        </CardHeader>
        <CardContent>
          {cohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              這 {data.weeks} 週還沒有推廣連結
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-2">週數</th>
                    <th className="text-right py-2 px-2">連結</th>
                    <th className="text-right py-2 px-2">點擊</th>
                    <th className="text-right py-2 px-2">註冊</th>
                    <th className="text-right py-2 px-2">轉換率</th>
                    <th className="text-right py-2 px-2">首戰</th>
                    <th className="text-right py-2 px-2">啟動</th>
                    <th className="text-right py-2 px-2">場次</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr key={c.week} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 font-mono text-xs">{c.week}</td>
                      <td className="text-right py-2 px-2">{c.totalLinks}</td>
                      <td className="text-right py-2 px-2">{c.totalClicks}</td>
                      <td className="text-right py-2 px-2">
                        {c.totalConverted}
                      </td>
                      <td className="text-right py-2 px-2">
                        <RateBadge rate={c.conversionRate} />
                      </td>
                      <td className="text-right py-2 px-2">
                        {c.totalFirstGame}
                      </td>
                      <td className="text-right py-2 px-2">
                        <RateBadge rate={c.activationRate} />
                      </td>
                      <td className="text-right py-2 px-2 text-muted-foreground">
                        {c.totalGamesPlayed}
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
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && (
          <div className="text-xs text-muted-foreground mt-1">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelStage({
  label,
  value,
  base,
  color,
}: {
  label: string;
  value: number;
  base: number;
  color: string;
}) {
  const pct = base > 0 ? Math.round((value / base) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value} <span className="text-xs">（{pct}% 留存）</span>
        </span>
      </div>
      <div className="w-full h-3 bg-muted rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RateBadge({ rate }: { rate: number }) {
  const colorClass =
    rate >= 50
      ? "bg-emerald-100 text-emerald-700"
      : rate >= 20
        ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
    >
      {rate}%
    </span>
  );
}
