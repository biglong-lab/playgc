// 📊 AdminCompletionAttribution — 完成率歸因 dashboard（W1 / 2026-05-14）
//
// 對應端點：GET /api/admin/metrics/completion-attribution?days=7|30
//
// 用途：
//   業主活動 7 天完成率 9.5% / 放棄率 47.5% — 看「為什麼放棄、卡哪步」
//   不分析「為什麼」— 純資料展示，業務判斷修補方向
//
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (W1)

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface FinalStateRow {
  finalState: string | null;
  count: number;
}

interface ComponentTypeRow {
  componentType: string;
  finalState: string | null;
  count: number;
}

interface PageIdRow {
  pageId: string | null;
  finalState: string | null;
  count: number;
}

interface TopErrorRow {
  lastError: string | null;
  componentType: string;
  count: number;
}

interface CompletionAttributionResponse {
  windowDays: number;
  fieldId: string;
  totalRuns: number;
  byFinalState: FinalStateRow[];
  byComponentType: ComponentTypeRow[];
  byPageId: PageIdRow[];
  durationDistribution: {
    p50: number | null;
    p90: number | null;
    p95: number | null;
  };
  topErrors: TopErrorRow[];
  timestamp: string;
}

const STATE_LABEL: Record<string, string> = {
  completed: "完成",
  abandoned: "放棄",
  errored: "錯誤",
  timeout: "逾時",
  skipped: "跳過",
};

const STATE_COLOR: Record<string, string> = {
  completed: "bg-green-500/20 text-green-700",
  abandoned: "bg-orange-500/20 text-orange-700",
  errored: "bg-red-500/20 text-red-700",
  timeout: "bg-yellow-500/20 text-yellow-700",
  skipped: "bg-gray-500/20 text-gray-700",
};

function msToReadable(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export default function AdminCompletionAttribution() {
  const [days, setDays] = useState<7 | 30>(7);

  const { data, isLoading, error, refetch } = useQuery<CompletionAttributionResponse>({
    queryKey: ["/api/admin/metrics/completion-attribution", days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/metrics/completion-attribution?days=${days}`);
      return res.json();
    },
  });

  // 計算每個 componentType 的完成率 / 放棄率
  const componentTypeSummary = (() => {
    if (!data?.byComponentType) return [];
    const map = new Map<string, { total: number; completed: number; abandoned: number; errored: number }>();
    for (const row of data.byComponentType) {
      if (!map.has(row.componentType)) {
        map.set(row.componentType, { total: 0, completed: 0, abandoned: 0, errored: 0 });
      }
      const stats = map.get(row.componentType)!;
      stats.total += row.count;
      if (row.finalState === "completed") stats.completed += row.count;
      if (row.finalState === "abandoned") stats.abandoned += row.count;
      if (row.finalState === "errored") stats.errored += row.count;
    }
    return Array.from(map.entries())
      .map(([type, stats]) => ({
        type,
        ...stats,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        abandonRate: stats.total > 0 ? Math.round((stats.abandoned / stats.total) * 100) : 0,
      }))
      .sort((a, b) => a.completionRate - b.completionRate); // 完成率低的排前面
  })();

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">完成率歸因</h1>
          <p className="text-sm text-muted-foreground">
            為什麼放棄、卡哪步、哪個元件留不住人
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
      {data && data.totalRuns === 0 && (
        <Card><CardContent className="p-6 text-muted-foreground">
          這段時間（{days} 天）沒有 component_runs 紀錄 — 確認元件埋點正常或活動是否真的有跑。
        </CardContent></Card>
      )}

      {data && data.totalRuns > 0 && (
        <>
          {/* 1. 整體 finalState 分布 */}
          <Card>
            <CardHeader><CardTitle>整體 final state 分布（總 {data.totalRuns} 筆）</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.byFinalState.map((row) => {
                  const state = row.finalState ?? "in_progress";
                  const pct = data.totalRuns > 0 ? Math.round((row.count / data.totalRuns) * 100) : 0;
                  return (
                    <Badge key={state} className={STATE_COLOR[state] ?? "bg-blue-500/20 text-blue-700"}>
                      {STATE_LABEL[state] ?? state}：{row.count}（{pct}%）
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 2. componentType 完成率排行（低的優先看） */}
          <Card>
            <CardHeader><CardTitle>各元件完成率（低 → 高，越上面越需要關注）</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="p-2">元件</th>
                      <th className="p-2 text-right">總計</th>
                      <th className="p-2 text-right">完成</th>
                      <th className="p-2 text-right">放棄</th>
                      <th className="p-2 text-right">錯誤</th>
                      <th className="p-2 text-right">完成率</th>
                      <th className="p-2 text-right">放棄率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {componentTypeSummary.slice(0, 20).map((row) => (
                      <tr key={row.type} className="border-t">
                        <td className="p-2 font-mono">{row.type}</td>
                        <td className="p-2 text-right">{row.total}</td>
                        <td className="p-2 text-right text-green-700">{row.completed}</td>
                        <td className="p-2 text-right text-orange-700">{row.abandoned}</td>
                        <td className="p-2 text-right text-red-700">{row.errored}</td>
                        <td className="p-2 text-right font-semibold">
                          {row.completionRate}%
                        </td>
                        <td className="p-2 text-right text-orange-700">
                          {row.abandonRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 3. 完成時間 distribution */}
          <Card>
            <CardHeader><CardTitle>完成時間 distribution（只看 completed）</CardTitle></CardHeader>
            <CardContent className="flex gap-6">
              <div><div className="text-xs text-muted-foreground">p50</div><div className="text-xl font-bold">{msToReadable(data.durationDistribution.p50)}</div></div>
              <div><div className="text-xs text-muted-foreground">p90</div><div className="text-xl font-bold">{msToReadable(data.durationDistribution.p90)}</div></div>
              <div><div className="text-xs text-muted-foreground">p95</div><div className="text-xl font-bold">{msToReadable(data.durationDistribution.p95)}</div></div>
            </CardContent>
          </Card>

          {/* 4. Top 錯誤訊息 */}
          {data.topErrors.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Top 錯誤訊息（前 10）</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.topErrors.map((row, idx) => (
                    <div key={idx} className="text-sm border-l-4 border-red-500 pl-3">
                      <div className="font-mono text-xs text-muted-foreground">
                        {row.componentType} × {row.count}
                      </div>
                      <div>{row.lastError}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
