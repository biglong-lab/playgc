// 📊 AdminComponentHealth — 元件健康度儀表板（Phase 1 / 2026-05-12）
//
// 對應端點：GET /api/admin/component-health?days=7
//
// UI：表格 — 元件名 / 跑了幾次 / 完成率 / 平均耗時 / 錯誤率 / vs 基準（前 7 天）

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ComponentStat {
  component_type: string;
  current_runs: string;
  current_completed: string;
  current_errored: string;
  current_abandoned: string;
  current_avg_duration_ms: string | null;
  current_avg_latency_ms: string | null;
  baseline_runs: string;
  baseline_completed: string;
}

interface HealthResponse {
  days: number;
  stats: ComponentStat[];
}

function pct(num: number, den: number): number {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}

function fmtMs(ms: string | null): string {
  if (!ms) return "—";
  const n = parseFloat(ms);
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

function HealthBadge({ completionRate, runs }: { completionRate: number; runs: number }) {
  if (runs < 5) return <Badge variant="outline">樣本不足</Badge>;
  if (completionRate >= 90) return <Badge className="bg-emerald-500 text-white">🟢 健康</Badge>;
  if (completionRate >= 70) return <Badge className="bg-yellow-500 text-white">🟡 注意</Badge>;
  if (completionRate >= 50) return <Badge className="bg-orange-500 text-white">🟠 警告</Badge>;
  return <Badge className="bg-red-600 text-white">🔴 嚴重</Badge>;
}

function TrendArrow({ current, baseline }: { current: number; baseline: number }) {
  const diff = current - baseline;
  if (Math.abs(diff) < 3) return <Minus className="w-3 h-3 text-muted-foreground inline" />;
  if (diff > 0) return <TrendingUp className="w-3 h-3 text-emerald-600 inline" />;
  return <TrendingDown className="w-3 h-3 text-red-600 inline" />;
}

export default function AdminComponentHealth() {
  const [days, setDays] = useState(7);

  const { data, isLoading, refetch } = useQuery<HealthResponse>({
    queryKey: ["/api/admin/component-health", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/component-health?days=${days}`);
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const stats = data?.stats ?? [];

  const summary = useMemo(() => {
    const total = stats.length;
    const totalRuns = stats.reduce((s, x) => s + parseInt(x.current_runs, 10), 0);
    const totalCompleted = stats.reduce((s, x) => s + parseInt(x.current_completed, 10), 0);
    const healthy = stats.filter((x) => {
      const r = parseInt(x.current_runs, 10);
      if (r < 5) return false;
      const c = parseInt(x.current_completed, 10);
      return pct(c, r) >= 90;
    }).length;
    const critical = stats.filter((x) => {
      const r = parseInt(x.current_runs, 10);
      if (r < 5) return false;
      const c = parseInt(x.current_completed, 10);
      return pct(c, r) < 50;
    }).length;
    return { total, totalRuns, totalCompleted, healthy, critical };
  }, [stats]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="container mx-auto p-4 space-y-4 max-w-6xl"
      role="region"
      aria-label="元件健康度 Dashboard"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">📊 元件健康度</h1>
        <div className="flex gap-2">
          {[1, 3, 7, 14, 30].map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d)}
              data-testid={`btn-days-${d}`}
            >
              {d}天
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{summary.total}</div>
          <div className="text-xs text-muted-foreground">元件類型</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{summary.totalRuns}</div>
          <div className="text-xs text-muted-foreground">總執行次數</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{pct(summary.totalCompleted, summary.totalRuns)}%</div>
          <div className="text-xs text-muted-foreground">總完成率</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{summary.healthy}</div>
          <div className="text-xs text-muted-foreground">🟢 健康</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-red-600 tabular-nums">{summary.critical}</div>
          <div className="text-xs text-muted-foreground">🔴 嚴重</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-base">過去 {days} 天元件表現</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <div className="p-8 text-center text-muted-foreground">載入中...</div>}
          {!isLoading && stats.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
              尚無資料。等玩家進入元件、自動紀錄會在此顯示。
            </div>
          )}
          {!isLoading && stats.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">元件</th>
                    <th className="px-3 py-2 text-right">執行</th>
                    <th className="px-3 py-2 text-right">完成率</th>
                    <th className="px-3 py-2 text-right">vs 基準</th>
                    <th className="px-3 py-2 text-right">錯誤</th>
                    <th className="px-3 py-2 text-right">放棄</th>
                    <th className="px-3 py-2 text-right">平均耗時</th>
                    <th className="px-3 py-2 text-right">互動延遲</th>
                    <th className="px-3 py-2 text-center">健康度</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => {
                    const runs = parseInt(s.current_runs, 10);
                    const completed = parseInt(s.current_completed, 10);
                    const errored = parseInt(s.current_errored, 10);
                    const abandoned = parseInt(s.current_abandoned, 10);
                    const baselineRuns = parseInt(s.baseline_runs, 10);
                    const baselineCompleted = parseInt(s.baseline_completed, 10);
                    const completionRate = pct(completed, runs);
                    const baselineCompletionRate = pct(baselineCompleted, baselineRuns);
                    return (
                      <tr key={s.component_type} className="border-t" data-testid={`row-${s.component_type}`}>
                        <td className="px-3 py-2 font-mono text-xs">{s.component_type}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{runs}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{completionRate}%</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">
                          {baselineRuns > 0 ? (
                            <>
                              <TrendArrow current={completionRate} baseline={baselineCompletionRate} />
                              {" "}{baselineCompletionRate}%
                            </>
                          ) : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${errored > 0 ? "text-red-600 font-medium" : ""}`}>
                          {errored > 0 && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {errored}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-orange-600">{abandoned}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMs(s.current_avg_duration_ms)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMs(s.current_avg_latency_ms)}</td>
                        <td className="px-3 py-2 text-center">
                          <HealthBadge completionRate={completionRate} runs={runs} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ⓘ 樣本 &lt; 5 視為樣本不足、不評健康度。互動延遲 = mount 到首次玩家點擊的時間。
      </p>
    </motion.div>
  );
}
