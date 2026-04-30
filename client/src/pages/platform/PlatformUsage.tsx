// 📊 平台用量監控（P1-1）
//
// 整合 ai_usage_logs 與 field_usage_meters 兩個資料源
//
// Sections：
//   1. 總覽 — 24h / 7d / 30d AI 呼叫總量、成功率、平均延遲
//   2. AI Provider 分布 — 各 provider 用量
//   3. 場域用量排行 — Top 10 場域
//   4. Endpoint 用量 — 各 AI endpoint 統計
//   5. 場域 Meters — 含超額警告
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  Building2,
  Clock,
  Cpu,
  Gauge,
  TrendingUp,
} from "lucide-react";

interface OverviewStats {
  total: number;
  success: number;
  fail: number;
  avg_latency?: number;
}

interface UsageOverview {
  last24h: OverviewStats;
  last7d: OverviewStats;
  last30d: OverviewStats;
}

interface ProviderRow {
  provider: string;
  total: number;
  success: number;
  fail: number;
  avg_latency: number;
}

interface TopFieldRow {
  field_id: string;
  field: { id: string; name: string; code: string } | null;
  total: number;
  success: number;
  fail: number;
  successRate: number;
}

interface EndpointRow {
  endpoint: string;
  provider: string;
  total: number;
  success: number;
  fail: number;
  avg_latency: number;
}

interface MeterRow {
  id: string;
  fieldId: string;
  meterKey: string;
  currentValue: number | string;
  limitValue: number | string | null;
  overageCount: number | string;
  periodEnd: string;
  field: { id: string; name: string; code: string } | null;
  usagePercent: number | null;
  isOverage: boolean;
}

export default function PlatformUsage() {
  const { isAuthenticated } = useAdminAuth();

  const { data: overview } = useQuery<UsageOverview>({
    queryKey: ["/api/platform/usage/overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/usage/overview");
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const { data: providers } = useQuery<{ items: ProviderRow[] }>({
    queryKey: ["/api/platform/usage/by-provider"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/usage/by-provider");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: topFields } = useQuery<{ items: TopFieldRow[] }>({
    queryKey: ["/api/platform/usage/top-fields"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/usage/top-fields");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: endpoints } = useQuery<{ items: EndpointRow[] }>({
    queryKey: ["/api/platform/usage/by-endpoint"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/usage/by-endpoint");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: meters } = useQuery<{ items: MeterRow[] }>({
    queryKey: ["/api/platform/usage/meters"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/usage/meters");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const successRate24h = useMemo(() => {
    const t = overview?.last24h.total ?? 0;
    if (t === 0) return null;
    return ((overview?.last24h.success ?? 0) / t) * 100;
  }, [overview]);

  const overageMeters = useMemo(
    () => (meters?.items ?? []).filter((m) => m.isOverage),
    [meters],
  );

  return (
    <PlatformAdminLayout title="用量監控">
      {/* 總覽：24h / 7d / 30d */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <PeriodCard
          label="過去 24 小時"
          stats={overview?.last24h}
          showLatency
          color="text-primary"
        />
        <PeriodCard
          label="過去 7 天"
          stats={overview?.last7d}
          color="text-amber-500"
        />
        <PeriodCard
          label="過去 30 天"
          stats={overview?.last30d}
          color="text-emerald-500"
        />
      </div>

      {/* 健康分數卡 */}
      {successRate24h !== null && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Gauge
                className={`w-8 h-8 ${
                  successRate24h >= 99 ? "text-emerald-500"
                  : successRate24h >= 95 ? "text-amber-500"
                  : "text-destructive"
                }`}
              />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">過去 24 小時整體成功率</div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold tabular-nums ${
                    successRate24h >= 99 ? "text-emerald-500"
                    : successRate24h >= 95 ? "text-amber-500"
                    : "text-destructive"
                  }`}>
                    {successRate24h.toFixed(2)}%
                  </span>
                  {overview && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                      ({overview.last24h.success.toLocaleString()} / {overview.last24h.total.toLocaleString()})
                    </span>
                  )}
                </div>
              </div>
              {overview?.last24h.avg_latency !== undefined && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">平均延遲</div>
                  <div className="text-2xl font-bold tabular-nums flex items-center gap-1 justify-end">
                    <Clock className="w-4 h-4" />
                    {overview.last24h.avg_latency} ms
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 超額警告 */}
      {overageMeters.length > 0 && (
        <Card className="mb-6 border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <h3 className="font-semibold text-destructive">
                {overageMeters.length} 個 meter 已超額
              </h3>
            </div>
            <div className="space-y-1 text-sm">
              {overageMeters.slice(0, 5).map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <Building2 className="w-3 h-3 text-muted-foreground" />
                  <span>{m.field?.name ?? "（未知）"}（{m.field?.code}）</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono text-xs">{m.meterKey}</span>
                  <span className="text-destructive font-bold tabular-nums ml-auto">
                    {Number(m.currentValue).toLocaleString()} / {Number(m.limitValue).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Provider 分布 */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-1">
          <Cpu className="w-4 h-4" />
          AI Provider 分布（過去 30 天）
        </h2>
        {providers?.items?.length ? (
          <div className="space-y-1">
            {providers.items.map((p) => (
              <ProviderBar key={p.provider} provider={p} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">尚無資料</p>
        )}
      </section>

      {/* 場域用量排行 */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-1">
          <TrendingUp className="w-4 h-4" />
          場域用量排行（Top 10，過去 30 天）
        </h2>
        {topFields?.items?.length ? (
          <div className="space-y-1">
            {topFields.items.map((f, idx) => (
              <Card key={f.field_id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="font-bold tabular-nums text-muted-foreground w-6">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {f.field?.name ?? "（未知場域）"}
                      {f.field?.code && <span className="text-muted-foreground text-xs ml-2">{f.field.code}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums flex items-center gap-2 mt-0.5">
                      <span>{f.total.toLocaleString()} 次</span>
                      <span className="text-muted-foreground/60">·</span>
                      <span className={f.successRate >= 0.95 ? "text-emerald-500" : "text-amber-500"}>
                        成功率 {(f.successRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">尚無資料</p>
        )}
      </section>

      {/* Endpoint 用量 */}
      <section>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-1">
          <Activity className="w-4 h-4" />
          各 Endpoint 統計（Top 20，過去 30 天）
        </h2>
        {endpoints?.items?.length ? (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Endpoint</th>
                    <th className="px-3 py-2 text-left">Provider</th>
                    <th className="px-3 py-2 text-right">總呼叫</th>
                    <th className="px-3 py-2 text-right">成功率</th>
                    <th className="px-3 py-2 text-right">平均延遲</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.items.map((e, idx) => {
                    const successRate = e.total > 0 ? (e.success / e.total) * 100 : 0;
                    return (
                      <tr key={`${e.endpoint}-${e.provider}-${idx}`} className="border-t">
                        <td className="px-3 py-2 font-mono">{e.endpoint}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">{e.provider}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{e.total.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className={successRate >= 95 ? "text-emerald-500" : "text-amber-500"}>
                            {successRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{e.avg_latency} ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">尚無資料</p>
        )}
      </section>
    </PlatformAdminLayout>
  );
}

function PeriodCard({
  label,
  stats,
  color,
  showLatency,
}: {
  label: string;
  stats?: OverviewStats;
  color: string;
  showLatency?: boolean;
}) {
  const successRate = stats && stats.total > 0 ? (stats.success / stats.total) * 100 : null;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className={`text-3xl font-bold tabular-nums ${color}`}>
          {(stats?.total ?? 0).toLocaleString()}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground tabular-nums">
          <span className="text-emerald-500">✓ {(stats?.success ?? 0).toLocaleString()}</span>
          <span>·</span>
          <span className="text-destructive">✗ {(stats?.fail ?? 0).toLocaleString()}</span>
          {successRate !== null && (
            <>
              <span>·</span>
              <span>{successRate.toFixed(1)}%</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderBar({ provider }: { provider: ProviderRow }) {
  const successRate = provider.total > 0 ? (provider.success / provider.total) * 100 : 0;
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="default">{provider.provider}</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            {provider.total.toLocaleString()} 次
          </span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            平均 {provider.avg_latency} ms
          </span>
        </div>
        <Progress value={successRate} className="h-1.5" />
        <div className="text-[10px] text-muted-foreground tabular-nums mt-1">
          成功率 {successRate.toFixed(2)}%（{provider.success.toLocaleString()} / {provider.total.toLocaleString()}）
        </div>
      </CardContent>
    </Card>
  );
}
