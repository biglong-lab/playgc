// 獎勵總覽 Dashboard — Phase 12 加值
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26.7 §26.8
//
// 提供：
//   1. 總獎勵發放次數（含過去 7 / 30 天）
//   2. 平台券 vs 外部券分布
//   3. Top 10 規則命中
//   4. 兌換率
//
import { useQuery } from "@tanstack/react-query";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Gift,
  ExternalLink,
  Loader2,
  Award,
} from "lucide-react";

interface AnalyticsData {
  summary: {
    totalEvents30d: number;
    totalEvents7d: number;
    totalEventsToday: number;
    platformIssued: number;
    platformUsed: number;
    externalIssued: number;
    externalRedeemed: number;
    platformConversionRate: number;
    externalConversionRate: number;
  };
  topRules: Array<{
    ruleId: string;
    name: string;
    rewardType?: string;
    hits: number;
  }>;
  platformCouponStats: Array<{ status: string; count: number }>;
  externalRewardStats: Array<{ status: string; count: number }>;
}

const STATUS_LABELS: Record<string, string> = {
  unused: "未使用",
  used: "已使用",
  expired: "已過期",
  pending: "待處理",
  issued: "已發放",
  redeemed: "已兌換",
  failed: "失敗",
};

const STATUS_COLORS: Record<string, string> = {
  unused: "bg-blue-500",
  used: "bg-emerald-500",
  expired: "bg-gray-400",
  pending: "bg-amber-500",
  issued: "bg-cyan-500",
  redeemed: "bg-violet-500",
  failed: "bg-red-500",
};

export default function AdminRewardsAnalytics() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/rewards/analytics"],
    queryFn: () => fetchWithAdminAuth("/api/admin/rewards/analytics"),
    refetchInterval: 60_000, // 每分鐘更新
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { summary, topRules, platformCouponStats, externalRewardStats } = data;

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          獎勵總覽 Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          規則命中 / 兌換率 / 配額分析
        </p>
      </div>

      {/* 4 個 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={<Gift className="w-4 h-4 text-emerald-500" />}
          label="今日觸發"
          value={summary.totalEventsToday}
        />
        <KpiCard
          icon={<Gift className="w-4 h-4 text-blue-500" />}
          label="近 7 天"
          value={summary.totalEvents7d}
        />
        <KpiCard
          icon={<Gift className="w-4 h-4 text-violet-500" />}
          label="近 30 天"
          value={summary.totalEvents30d}
        />
        <KpiCard
          icon={<Award className="w-4 h-4 text-amber-500" />}
          label="總獎勵"
          value={summary.platformIssued + summary.externalIssued}
        />
      </div>

      {/* 兌換率 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-500" />
              平台券兌換率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              {summary.platformConversionRate}%
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {summary.platformUsed} / {summary.platformIssued} 已使用
            </p>
            <StatusBars stats={platformCouponStats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-violet-500" />
              外部券兌換率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              {summary.externalConversionRate}%
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {summary.externalRedeemed} / {summary.externalIssued} 已兌換
            </p>
            <StatusBars stats={externalRewardStats} />
          </CardContent>
        </Card>
      </div>

      {/* Top 10 規則命中 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 規則命中</CardTitle>
          <p className="text-xs text-muted-foreground">
            近 30 天觸發次數最高的規則
          </p>
        </CardHeader>
        <CardContent>
          {topRules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              目前還沒有規則被觸發
            </p>
          ) : (
            <div className="space-y-2">
              {topRules.map((r, i) => (
                <div
                  key={r.ruleId}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                >
                  <span className="w-8 text-center text-sm font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    {r.rewardType && (
                      <Badge variant="outline" className="text-[10px]">
                        {r.rewardType}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm font-bold text-primary">
                    {r.hits} 次
                  </div>
                </div>
              ))}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBars({
  stats,
}: {
  stats: Array<{ status: string; count: number }>;
}) {
  const total = stats.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return <p className="text-xs text-muted-foreground">無資料</p>;
  }
  return (
    <div className="space-y-1.5">
      {stats.map((s) => {
        const pct = Math.round((s.count / total) * 100);
        const color = STATUS_COLORS[s.status] ?? "bg-gray-400";
        return (
          <div key={s.status}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span>{STATUS_LABELS[s.status] ?? s.status}</span>
              <span className="font-medium">
                {s.count}（{pct}%）
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded overflow-hidden">
              <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
