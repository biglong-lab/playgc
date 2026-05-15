// 📊 AdminSlaDashboard — admin 30 分鐘建場 SLA + AI 採用率 dashboard（W2 / 2026-05-14）
//
// 對應端點：GET /api/admin/timings/sla-stats?days=7|30
//
// 用途：
//   - admin 從進後台到 QR 印出真的 30 分鐘嗎？p50/p90/p95 看真相
//   - AI 採用率（紫色 vs 綠色按鈕） — 低於 20% 表示 AI 內容品質有問題
//   - 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (W2)

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface SlaStatsResponse {
  windowDays: number;
  fieldId: string;
  funnel: {
    total: number;
    completed: number;
    abandoned: number;
    completionRate: number;
  };
  duration: {
    p50Ms: number | null;
    p90Ms: number | null;
    p95Ms: number | null;
  };
  sla: {
    targetMs: number;
    warningMs: number;
    hits: number;
    warnings: number;
    critical: number;
    attainmentRate: number;
  };
  aiAdoption: {
    totalCompleted: number;
    aiUsed: number;
    rate: number;
  };
  timestamp: string;
}

function msToReadable(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)} 分鐘`;
}

function slaColor(attainmentRate: number): string {
  if (attainmentRate >= 80) return "text-green-700";
  if (attainmentRate >= 50) return "text-yellow-700";
  return "text-red-700";
}

function aiAdoptionColor(rate: number): string {
  if (rate >= 50) return "text-green-700";
  if (rate >= 20) return "text-yellow-700";
  return "text-red-700";
}

interface ReportsHealthResponse {
  total: number;
  last7d: number;
  last30d: number;
  latestCreatedAt: string | null;
  daysAgo: number | null;
  severity: "ok" | "warning" | "critical" | "none";
  avgAnomaly: number | null;
  telegramSent7d: number;
  dailyTrend: Array<{ day: string; count: number }>;
  timestamp: string;
}

export default function AdminSlaDashboard() {
  const [days, setDays] = useState<7 | 30>(30);

  const { data, isLoading, error, refetch } = useQuery<SlaStatsResponse>({
    queryKey: ["/api/admin/timings/sla-stats", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/timings/sla-stats?days=${days}`);
      return res.json();
    },
  });

  // 🆕 D 任務：session_reports 健康指標
  const { data: reportsHealth } = useQuery<ReportsHealthResponse>({
    queryKey: ["/api/admin/metrics/reports-health"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/metrics/reports-health");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">建場 SLA + AI 採用率</h1>
          <p className="text-sm text-muted-foreground">
            admin 從進後台到 QR 印出實際耗時 + 紫色 AI 按鈕被選用比例
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={days === 7 ? "default" : "outline"} onClick={() => setDays(7)}>
            7 天
          </Button>
          <Button variant={days === 30 ? "default" : "outline"} onClick={() => setDays(30)}>
            30 天
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            重新整理
          </Button>
        </div>
      </div>

      {isLoading && <Card><CardContent className="p-6">載入中…</CardContent></Card>}
      {error && (
        <Card><CardContent className="p-6 text-red-600">載入失敗：{String(error)}</CardContent></Card>
      )}
      {data && data.funnel.total === 0 && (
        <Card><CardContent className="p-6 text-muted-foreground">
          這段時間（{days} 天）沒有 admin funnel 紀錄 — 確認前端埋點是否已串、或業主沒在這段時間建場。
        </CardContent></Card>
      )}

      {data && data.funnel.total > 0 && (
        <>
          {/* KPI 卡：3 個並列 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">建場完成率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.funnel.completionRate}%</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.funnel.completed} / {data.funnel.total}（放棄 {data.funnel.abandoned}）
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">30 分鐘 SLA 達成率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${slaColor(data.sla.attainmentRate)}`}>
                  {data.sla.attainmentRate}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ≤30m: {data.sla.hits} / 30-45m: {data.sla.warnings} / &gt;45m: {data.sla.critical}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">AI 採用率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${aiAdoptionColor(data.aiAdoption.rate)}`}>
                  {data.aiAdoption.rate}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  紫色 AI: {data.aiAdoption.aiUsed} / 全建場: {data.aiAdoption.totalCompleted}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* duration percentile 卡 */}
          <Card>
            <CardHeader>
              <CardTitle>建場耗時 distribution（只看完成）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">p50（中位數）</div>
                  <div className="text-xl font-bold">{msToReadable(data.duration.p50Ms)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">p90</div>
                  <div className="text-xl font-bold">{msToReadable(data.duration.p90Ms)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">p95</div>
                  <div className="text-xl font-bold">{msToReadable(data.duration.p95Ms)}</div>
                </div>
              </div>

              <div className="mt-4 text-sm text-muted-foreground space-y-1">
                <div>目標：30 分鐘以內 SLA 達成率 ≥ 80%</div>
                {data.duration.p90Ms !== null && data.duration.p90Ms > data.sla.targetMs && (
                  <div className="text-orange-600">
                    ⚠️ p90 超過 30 分鐘目標 — 10% 業主建場耗時過長，需檢查流程瓶頸
                  </div>
                )}
                {data.aiAdoption.rate < 20 && data.aiAdoption.totalCompleted >= 5 && (
                  <div className="text-orange-600">
                    ⚠️ AI 採用率 &lt; 20% — 紫色 AI 按鈕被避用，需檢查 AI 內容品質
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">埋點狀態</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <div>場域：<Badge variant="secondary">{data.fieldId}</Badge></div>
              <div>窗口：{data.windowDays} 天</div>
              <div>更新：{new Date(data.timestamp).toLocaleString("zh-TW")}</div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 🆕 D：session_reports 健康指標卡 */}
      {reportsHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              session_reports 健康指標
              {reportsHealth.severity === "ok" && (
                <Badge className="bg-green-500/20 text-green-700">健康</Badge>
              )}
              {reportsHealth.severity === "warning" && (
                <Badge className="bg-amber-500/20 text-amber-700">注意</Badge>
              )}
              {reportsHealth.severity === "critical" && (
                <Badge className="bg-red-500/20 text-red-700">嚴重</Badge>
              )}
              {reportsHealth.severity === "none" && (
                <Badge variant="secondary">無資料</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">過去 7 天</div>
                <div className="text-2xl font-bold tabular-nums">{reportsHealth.last7d}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">過去 30 天</div>
                <div className="text-2xl font-bold tabular-nums">{reportsHealth.last30d}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">累計總數</div>
                <div className="text-2xl font-bold tabular-nums">{reportsHealth.total}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">最後一份距今</div>
                <div className={`text-2xl font-bold tabular-nums ${
                  reportsHealth.severity === "critical" ? "text-red-700" :
                  reportsHealth.severity === "warning" ? "text-amber-700" :
                  reportsHealth.severity === "ok" ? "text-green-700" : ""
                }`}>
                  {reportsHealth.daysAgo === null ? "—" : `${reportsHealth.daysAgo} 天`}
                </div>
              </div>
            </div>
            {reportsHealth.severity === "critical" && (
              <div role="status" aria-live="polite" className="text-sm text-red-700">
                ⚠️ 超過 7 天無新報告 — 檢查 cron（CRON_SECRET）或確認是否有 host_mode 多人活動完成
              </div>
            )}
            {reportsHealth.severity === "warning" && (
              <div role="status" aria-live="polite" className="text-sm text-amber-700">
                ⚠️ 超過 3 天無新報告 — 屬正常範圍但需注意
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              7 天 Telegram 推送：{reportsHealth.telegramSent7d} 次
              {reportsHealth.avgAnomaly !== null && ` · 平均異常分數：${reportsHealth.avgAnomaly}`}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
