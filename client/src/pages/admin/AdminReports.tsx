// 📊 AdminReports — 活動結束報告列表（Phase 5 / 2026-05-10）
//
// 對應端點：
//   GET  /api/admin/reports?limit=50&minAnomaly=0
//   GET  /api/admin/reports/:sessionId
//   POST /api/admin/reports/:sessionId/generate
//
// 用途：
//   - 業主一頁看完所有活動結束報告
//   - 異常分數醒目顯示、點擊看詳情
//   - 跟前 5 場對比、看趨勢

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  CheckCircle2,
  Activity,
  Users,
  RefreshCw,
  ExternalLink,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AdminReportRow {
  id: string;
  sessionId: string;
  gameId: string | null;
  totalPlayers: number | null;
  completedPlayers: number | null;
  completionRate: number | null;
  wsConnects: number | null;
  graceStartCount: number | null;
  graceExpiredCount: number | null;
  autoLeaveCount: number | null;
  wsConfigChangeCloses: number | null;
  avgWsLatencyMs: number | null;
  anomalyScore: number | null;
  anomalies: Array<{ type: string; severity: string; message: string }> | null;
  telegramSent: boolean | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface ReportsResponse {
  reports: AdminReportRow[];
  count: number;
}

function ratioPct(num: number | null, den: number | null): string {
  if (!num || !den || den === 0) return "0%";
  return `${Math.round((num / den) * 100)}%`;
}

function fmtDuration(ms: number | null): string {
  if (!ms) return "—";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} 分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function HealthBadge({ score }: { score: number | null }) {
  const s = score ?? 0;
  if (s === 0) return <Badge className="bg-emerald-500 text-white">🟢 健康</Badge>;
  if (s < 30) return <Badge className="bg-yellow-500 text-white">🟡 注意</Badge>;
  if (s < 60) return <Badge className="bg-orange-500 text-white">🟠 警告</Badge>;
  return <Badge className="bg-red-600 text-white">🔴 嚴重</Badge>;
}

export default function AdminReports() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [minAnomaly, setMinAnomaly] = useState(0);
  const [genSessionId, setGenSessionId] = useState("");

  const { data, isLoading, refetch } = useQuery<ReportsResponse>({
    queryKey: ["/api/admin/reports", minAnomaly],
    queryFn: async () => {
      const url = `/api/admin/reports?limit=50&minAnomaly=${minAnomaly}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    refetchInterval: 30_000, // 30 秒自動 refresh
  });

  const generateMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/admin/reports/${sessionId}/generate`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "報告已產生", description: "5 秒內出現在列表" });
      setGenSessionId("");
      qc.invalidateQueries({ queryKey: ["/api/admin/reports"] });
    },
    onError: (err) => {
      toast({
        title: "產生失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    },
  });

  const reports = data?.reports ?? [];

  const summary = useMemo(() => {
    const total = reports.length;
    const healthy = reports.filter((r) => (r.anomalyScore ?? 0) === 0).length;
    const warning = reports.filter((r) => (r.anomalyScore ?? 0) > 0 && (r.anomalyScore ?? 0) < 60).length;
    const critical = reports.filter((r) => (r.anomalyScore ?? 0) >= 60).length;
    const avgGraceRate = total > 0
      ? Math.round(
          (reports.reduce((s, r) => {
            const c = r.wsConnects ?? 0;
            return c > 0 ? s + ((r.graceStartCount ?? 0) / c) : s;
          }, 0) / total) * 100,
        )
      : 0;
    return { total, healthy, warning, critical, avgGraceRate };
  }, [reports]);

  // 🆕 2026-05-16 B 任務：計算「最近一份報告距今天數」+ actionable hint
  const latestReportInfo = useMemo(() => {
    if (reports.length === 0) {
      return { daysAgo: null, severity: "none" as const };
    }
    const latestCreatedAt = reports.reduce<string | null>((acc, r) => {
      const created = r.createdAt ?? r.endedAt ?? r.startedAt;
      if (!created) return acc;
      if (!acc) return created;
      return new Date(created).getTime() > new Date(acc).getTime() ? created : acc;
    }, null);
    if (!latestCreatedAt) return { daysAgo: null, severity: "none" as const };
    const daysAgo = Math.floor(
      (Date.now() - new Date(latestCreatedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const severity = daysAgo > 7 ? "critical" : daysAgo > 3 ? "warning" : "ok";
    return { daysAgo, severity };
  }, [reports]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="container mx-auto p-4 space-y-4 max-w-6xl"
      role="region"
      aria-label="活動結束報告 Dashboard"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📊 活動結束報告</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="btn-refresh-reports"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          重新整理
        </Button>
      </div>

      {/* 🆕 2026-05-16 B：最近報告 hint（actionable）*/}
      {!isLoading && latestReportInfo.severity !== "ok" && (
        <Card
          role="status"
          aria-live="polite"
          className={
            latestReportInfo.severity === "critical"
              ? "border-red-300 bg-red-50/80 dark:bg-red-950/30"
              : latestReportInfo.severity === "warning"
              ? "border-amber-300 bg-amber-50/80 dark:bg-amber-950/30"
              : "border-blue-300 bg-blue-50/80 dark:bg-blue-950/30"
          }
          data-testid="reports-stale-hint"
        >
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <AlertTriangle
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                latestReportInfo.severity === "critical"
                  ? "text-red-600"
                  : latestReportInfo.severity === "warning"
                  ? "text-amber-600"
                  : "text-blue-600"
              }`}
              aria-hidden="true"
            />
            <div className="space-y-1">
              {latestReportInfo.severity === "none" ? (
                <>
                  <p className="font-semibold">尚無任何活動結束報告</p>
                  <p className="text-muted-foreground">
                    需要至少一場 host_mode 多人活動完成後、cron 才會自動產生報告。
                    或可手動使用下方「手動生成」工具觸發既有 session。
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">
                    最近一份報告：<span className="tabular-nums">{latestReportInfo.daysAgo}</span> 天前
                    {latestReportInfo.severity === "critical" && "（已超過 7 天，請確認是否需要安排新活動）"}
                    {latestReportInfo.severity === "warning" && "（已超過 3 天）"}
                  </p>
                  <p className="text-muted-foreground">
                    報告寫入依賴「host_mode 多人活動完成」。若近期無新活動、屬正常。
                    若有活動但仍無報告、檢查 cron 是否運作（CRON_SECRET 設定 + /api/cron/generate-reports）。
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {!isLoading && reports.length === 0 && (
        <Card
          role="status"
          aria-live="polite"
          className="border-blue-300 bg-blue-50/80 dark:bg-blue-950/30"
        >
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">尚無任何活動結束報告</p>
              <p className="text-muted-foreground">
                需要 host_mode 多人活動完成後、cron 才會自動產生報告。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 摘要卡 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{summary.total}</div>
          <div className="text-xs text-muted-foreground">總場次</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{summary.healthy}</div>
          <div className="text-xs text-muted-foreground">🟢 健康</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600 tabular-nums">{summary.warning}</div>
          <div className="text-xs text-muted-foreground">🟡 注意</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold text-red-600 tabular-nums">{summary.critical}</div>
          <div className="text-xs text-muted-foreground">🔴 嚴重</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{summary.avgGraceRate}%</div>
          <div className="text-xs text-muted-foreground">平均 grace 率</div>
        </CardContent></Card>
      </div>

      {/* 篩選 + 手動觸發 */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm whitespace-nowrap">最低異常分</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={minAnomaly}
              onChange={(e) => setMinAnomaly(parseInt(e.target.value, 10) || 0)}
              className="w-20 h-8"
              data-testid="input-min-anomaly"
            />
          </div>
          <div className="flex-1 flex items-center gap-2">
            <Input
              placeholder="手動產報告（輸入 sessionId）"
              value={genSessionId}
              onChange={(e) => setGenSessionId(e.target.value)}
              className="h-8"
              data-testid="input-gen-session-id"
            />
            <Button
              size="sm"
              disabled={!genSessionId || generateMutation.isPending}
              onClick={() => generateMutation.mutate(genSessionId.trim())}
              data-testid="btn-gen-report"
            >
              產生報告
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 報告列表 */}
      {isLoading && <div className="text-center text-muted-foreground py-8">載入中...</div>}
      {!isLoading && reports.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            尚無報告。等下一場活動結束、cron 會自動產生（每 15 分鐘跑）。
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {reports.map((r) => {
          const gracePct = r.wsConnects && r.wsConnects > 0 ? Math.round(((r.graceStartCount ?? 0) / r.wsConnects) * 100) : 0;
          const autoLeavePct = r.wsConnects && r.wsConnects > 0 ? Math.round(((r.autoLeaveCount ?? 0) / r.wsConnects) * 100) : 0;
          const configPct = r.wsConnects && r.wsConnects > 0 ? Math.round(((r.wsConfigChangeCloses ?? 0) / r.wsConnects) * 100) : 0;
          const topAnomaly = r.anomalies?.[0];
          return (
            <Card key={r.id} data-testid={`report-${r.sessionId}`}>
              <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <HealthBadge score={r.anomalyScore} />
                  <code className="text-xs">{r.sessionId.slice(0, 16)}…</code>
                  <span className="text-xs text-muted-foreground">
                    <Clock className="inline w-3 h-3 mr-1" />
                    {r.endedAt ? new Date(r.endedAt).toLocaleString("zh-TW") : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    時長 {fmtDuration(r.durationMs)}
                  </span>
                  {r.telegramSent && (
                    <Badge variant="outline" className="text-xs">📩 已推</Badge>
                  )}
                </div>
                <Link href={`/admin/sessions/${r.sessionId}/replay`}>
                  <Button size="sm" variant="ghost" data-testid={`btn-replay-${r.sessionId}`}>
                    <ExternalLink className="w-3 h-3 mr-1" />Replay
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">完成</div>
                    <div className="font-medium tabular-nums">
                      <Users className="inline w-3 h-3 mr-1" />
                      {r.completedPlayers ?? 0}/{r.totalPlayers ?? 0} ({r.completionRate ?? 0}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">grace</div>
                    <div className={`font-medium tabular-nums ${gracePct > 30 ? "text-orange-600" : ""}`}>
                      {gracePct}% ({r.graceStartCount ?? 0})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">auto_leave</div>
                    <div className={`font-medium tabular-nums ${autoLeavePct > 10 ? "text-red-600" : ""}`}>
                      {autoLeavePct}% ({r.autoLeaveCount ?? 0})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">config_change</div>
                    <div className={`font-medium tabular-nums ${configPct > 5 ? "text-red-600" : ""}`}>
                      {configPct}% ({r.wsConfigChangeCloses ?? 0})
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">延遲</div>
                    <div className="font-medium tabular-nums">
                      <Activity className="inline w-3 h-3 mr-1" />
                      {r.avgWsLatencyMs ?? "—"}ms
                    </div>
                  </div>
                </div>
                {topAnomaly && (
                  <div className="mt-2 flex items-start gap-2 text-xs bg-orange-50 dark:bg-orange-950/20 p-2 rounded">
                    <AlertTriangle className="w-3 h-3 mt-0.5 text-orange-600 shrink-0" />
                    <span>{topAnomaly.message}</span>
                    {(r.anomalies?.length ?? 0) > 1 && (
                      <span className="text-muted-foreground ml-auto">
                        +{(r.anomalies?.length ?? 1) - 1} 項
                      </span>
                    )}
                  </div>
                )}
                {!topAnomaly && (r.anomalyScore ?? 0) === 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    無異常、活動正常
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}
