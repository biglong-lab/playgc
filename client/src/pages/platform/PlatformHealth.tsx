// 💚 系統健康監控
//
// 即時檢查模組狀態：DB / Cloudinary / Firebase / Resend / 錯誤頻率
// 顯示 process uptime / memory / Node 版本
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Heart,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Activity,
  Cpu,
  Clock,
  Database,
} from "lucide-react";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  detail?: string;
}

interface HealthResponse {
  timestamp: string;
  checks: HealthCheck[];
  process: {
    uptimeSeconds: number;
    uptimeText: string;
    memoryMB: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    nodeVersion: string;
  };
  summary: {
    healthy: number;
    degraded: number;
    down: number;
  };
}

export default function PlatformHealth() {
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery<HealthResponse>({
    queryKey: ["/api/platform/health/check"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/health/check")).json(),
    enabled: isAuthenticated,
    refetchInterval: 30_000, // 每 30 秒自動更新
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/platform/health/check"] });
  };

  const overallStatus = !data
    ? "loading"
    : data.summary.down > 0
      ? "down"
      : data.summary.degraded > 0
        ? "degraded"
        : "healthy";

  return (
    <PlatformAdminLayout
      title="系統健康監控"
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={isFetching}
          className="gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          重新檢查
        </Button>
      }
    >
      {/* 整體狀態 */}
      <Card
        className={`mb-6 border-l-4 ${
          overallStatus === "healthy" ? "border-l-emerald-500" :
          overallStatus === "degraded" ? "border-l-amber-500" :
          overallStatus === "down" ? "border-l-destructive" :
          "border-l-muted"
        }`}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <Heart
            className={`w-12 h-12 ${
              overallStatus === "healthy" ? "text-emerald-500 animate-pulse" :
              overallStatus === "degraded" ? "text-amber-500" :
              overallStatus === "down" ? "text-destructive" :
              "text-muted-foreground"
            }`}
          />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">整體系統狀態</div>
            <div className="text-2xl font-bold">
              {overallStatus === "healthy" ? "✅ 健康" :
               overallStatus === "degraded" ? "⚠️ 部分降級" :
               overallStatus === "down" ? "🚨 服務異常" :
               "檢查中..."}
            </div>
            {data && (
              <div className="text-xs text-muted-foreground mt-1">
                最後檢查：{new Date(data.timestamp).toLocaleString("zh-TW")}
              </div>
            )}
          </div>
          {data && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-2xl font-bold tabular-nums text-emerald-500">{data.summary.healthy}</div>
                <div className="text-[10px] text-muted-foreground">健康</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums text-amber-500">{data.summary.degraded}</div>
                <div className="text-[10px] text-muted-foreground">降級</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums text-destructive">{data.summary.down}</div>
                <div className="text-[10px] text-muted-foreground">異常</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 模組檢查列表 */}
      <h2 className="text-sm font-semibold mb-2 flex items-center gap-1">
        <Activity className="w-4 h-4" />
        模組健康檢查
      </h2>
      {isLoading ? (
        <Card><CardContent className="p-4">載入中...</CardContent></Card>
      ) : data?.checks ? (
        <div className="space-y-2 mb-6">
          {data.checks.map((check) => (
            <Card key={check.name}>
              <CardContent className="p-3 flex items-center gap-3">
                {check.status === "healthy" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : check.status === "degraded" ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive shrink-0" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{check.name}</div>
                  {check.detail && (
                    <div className="text-xs text-muted-foreground">{check.detail}</div>
                  )}
                </div>
                {check.latencyMs !== undefined && (
                  <Badge variant="outline" className="tabular-nums">
                    <Clock className="w-3 h-3 mr-1" />
                    {check.latencyMs} ms
                  </Badge>
                )}
                <Badge
                  className={
                    check.status === "healthy" ? "bg-emerald-500" :
                    check.status === "degraded" ? "bg-amber-500" :
                    "bg-destructive"
                  }
                >
                  {check.status === "healthy" ? "正常" :
                   check.status === "degraded" ? "降級" :
                   "異常"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Process 資訊 */}
      {data?.process && (
        <>
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <Cpu className="w-4 h-4" />
            Process 資訊
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  運行時間
                </div>
                <div className="text-2xl font-bold tabular-nums text-primary">
                  {data.process.uptimeText}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  RSS
                </div>
                <div className="text-2xl font-bold tabular-nums text-blue-500">
                  {data.process.memoryMB.rss}
                  <span className="text-xs text-muted-foreground ml-1">MB</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Heap (用 / 總)</div>
                <div className="text-2xl font-bold tabular-nums text-amber-500">
                  {data.process.memoryMB.heapUsed}
                  <span className="text-sm text-muted-foreground"> / {data.process.memoryMB.heapTotal}</span>
                  <span className="text-xs text-muted-foreground ml-1">MB</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Node 版本</div>
                <div className="text-xl font-bold tabular-nums text-emerald-500">
                  {data.process.nodeVersion}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 自動更新提示 */}
      <p className="text-xs text-muted-foreground text-center mt-6">
        💡 此頁每 30 秒自動更新
      </p>
    </PlatformAdminLayout>
  );
}
