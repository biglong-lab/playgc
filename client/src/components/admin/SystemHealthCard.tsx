// 📊 SystemHealthCard — Admin Dashboard 即時健康儀表
//
// 用途：使用者反饋「不要等客訴才知道」
// 設計：
//   - 過去 1 小時錯誤總數 + Top 3 錯誤類型
//   - 自動每 30 秒 refresh
//   - 健康狀態顏色提示（綠 / 黃 / 紅）
//   - 點擊「詳細」跳 /admin/dev-tools

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertTriangle, TrendingUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface HealthStats {
  windowHours: number;
  totalErrors: number;
  totalOccurrences: number;
  topErrors: Array<{
    fingerprint: string;
    message: string;
    source: string;
    occurrenceCount: number;
  }>;
  byPlatform: Record<string, number>;
  generatedAt: string;
}

function formatRelative(iso: string | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} 秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分鐘前`;
  return `${Math.floor(sec / 3600)} 小時前`;
}

export default function SystemHealthCard() {
  const { data, isLoading } = useQuery<HealthStats>({
    queryKey: ["/api/admin/system-health?hours=1"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/system-health?hours=1");
      return res.json();
    },
    refetchInterval: 30_000, // 每 30 秒 refresh
  });

  // 健康狀態分級（過去 1 小時）
  // 綠：< 5 / 黃：5-20 / 紅：> 20
  let healthLevel: "green" | "yellow" | "red" = "green";
  let healthLabel = "🟢 系統健康";
  let healthColor = "text-emerald-700 dark:text-emerald-400";
  let bgColor = "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50";

  if (data) {
    if (data.totalOccurrences > 20) {
      healthLevel = "red";
      healthLabel = "🔴 警告：錯誤數高";
      healthColor = "text-red-700 dark:text-red-400";
      bgColor = "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50";
    } else if (data.totalOccurrences > 5) {
      healthLevel = "yellow";
      healthLabel = "🟡 注意：錯誤數偏高";
      healthColor = "text-amber-700 dark:text-amber-400";
      bgColor = "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50";
    }
  }

  return (
    <Card className={`${bgColor} mb-6`} data-testid="system-health-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">系統健康儀表（過去 1 小時）</h3>
          </div>
          {data && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatRelative(data.generatedAt)} 更新
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-xs text-muted-foreground">載入中...</div>
        ) : !data ? (
          <div className="text-xs text-muted-foreground">尚無資料</div>
        ) : (
          <>
            {/* 主要指標 */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded-lg bg-card p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">健康狀態</div>
                <div className={`text-sm font-bold ${healthColor}`}>{healthLabel}</div>
              </div>
              <div className="rounded-lg bg-card p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">錯誤類型</div>
                <div className="text-2xl font-bold tabular-nums">{data.totalErrors}</div>
              </div>
              <div className="rounded-lg bg-card p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">總發生次數</div>
                <div className="text-2xl font-bold tabular-nums">{data.totalOccurrences}</div>
              </div>
            </div>

            {/* 平台分組 */}
            {Object.keys(data.byPlatform).length > 0 && (
              <div className="flex gap-2 mb-3 text-xs">
                {Object.entries(data.byPlatform).map(([p, c]) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded bg-muted text-muted-foreground"
                  >
                    {p}: <strong>{c}</strong>
                  </span>
                ))}
              </div>
            )}

            {/* Top 3 錯誤 */}
            {data.topErrors.length > 0 && (
              <div className="space-y-1.5 border-t pt-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3" /> Top {Math.min(3, data.topErrors.length)} 錯誤
                </div>
                {data.topErrors.slice(0, 3).map((err, i) => (
                  <div
                    key={err.fingerprint || i}
                    className="text-xs flex items-start gap-2"
                    data-testid={`top-error-${i}`}
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate" title={err.message}>{err.message}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {err.source} · 共 {err.occurrenceCount} 次
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.totalOccurrences === 0 && (
              <div className="text-xs text-emerald-700 dark:text-emerald-400 text-center py-2">
                ✨ 過去 1 小時無任何錯誤、系統運作良好
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
