// 💰 平台計費警示（P0-3）
//
// 即時掃描 4 種計費風險：
//   - expiring_soon — 訂閱即將到期（30/14/7 天）
//   - expired — 訂閱已過期但場域仍 active
//   - failed_payment — 最近交易失敗
//   - overdue — 待付款但已逾期
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  DollarSign,
  RefreshCw,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";

interface BillingAlert {
  id: string;
  type: "expiring_soon" | "expired" | "failed_payment" | "overdue";
  severity: "info" | "warning" | "urgent" | "critical";
  fieldId: string;
  field?: { id: string; name: string; code: string };
  title: string;
  message: string;
  daysUntil?: number;
  amount?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface AlertsListResponse {
  items: BillingAlert[];
  total: number;
}

interface AlertsSummary {
  total: number;
  critical: number;
  urgent: number;
  warning: number;
  info: number;
  byType: Record<string, number>;
}

const TYPE_LABELS: Record<string, string> = {
  expiring_soon: "即將到期",
  expired: "已過期",
  failed_payment: "交易失敗",
  overdue: "付款逾期",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  expiring_soon: <Clock className="w-4 h-4" />,
  expired: <AlertTriangle className="w-4 h-4" />,
  failed_payment: <AlertCircle className="w-4 h-4" />,
  overdue: <DollarSign className="w-4 h-4" />,
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-destructive text-white",
  urgent: "bg-red-500 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-blue-500 text-white",
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: "border-l-4 border-l-destructive",
  urgent: "border-l-4 border-l-red-500",
  warning: "border-l-4 border-l-amber-500",
  info: "border-l-4 border-l-blue-500",
};

export default function PlatformBillingAlerts() {
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data, isLoading, isFetching } = useQuery<AlertsListResponse>({
    queryKey: ["/api/platform/billing-alerts", typeFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      const url = `/api/platform/billing-alerts?${params.toString()}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000, // 每分鐘自動 refetch
  });

  const { data: summary } = useQuery<AlertsSummary>({
    queryKey: ["/api/platform/billing-alerts/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/billing-alerts/summary");
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const alerts = data?.items ?? [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/platform/billing-alerts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/platform/billing-alerts/summary"] });
  };

  return (
    <PlatformAdminLayout
      title="計費警示"
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={isFetching}
          className="gap-1 transition-transform active:scale-[0.95]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          重新計算
        </Button>
      }
    >
      {/* 統計卡片 — Critical / Urgent / Warning / Info 四級 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard
          label="總警示"
          value={summary?.total ?? 0}
          accent="text-primary"
          icon={<AlertCircle className="w-4 h-4" />}
        />
        <StatCard
          label="嚴重"
          value={summary?.critical ?? 0}
          accent="text-destructive"
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <StatCard
          label="緊急"
          value={summary?.urgent ?? 0}
          accent="text-red-500"
        />
        <StatCard
          label="警告"
          value={summary?.warning ?? 0}
          accent="text-amber-500"
        />
        <StatCard
          label="提醒"
          value={summary?.info ?? 0}
          accent="text-blue-500"
        />
      </div>

      {/* 各類型統計（可點擊過濾） */}
      {summary?.byType && Object.keys(summary.byType).length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              依類型分布
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.byType).map(([type, count]) => (
                <Badge
                  key={type}
                  variant={typeFilter === type ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setTypeFilter(type === typeFilter ? "all" : type)}
                >
                  {TYPE_ICONS[type]}
                  <span className="ml-1">{TYPE_LABELS[type] || type}</span>
                  <span className="ml-1 tabular-nums opacity-70">×{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 篩選列 */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部類型</SelectItem>
            <SelectItem value="expiring_soon">即將到期</SelectItem>
            <SelectItem value="expired">已過期</SelectItem>
            <SelectItem value="failed_payment">交易失敗</SelectItem>
            <SelectItem value="overdue">付款逾期</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-full md:w-32">
            <SelectValue placeholder="嚴重度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部嚴重度</SelectItem>
            <SelectItem value="critical">嚴重</SelectItem>
            <SelectItem value="urgent">緊急</SelectItem>
            <SelectItem value="warning">警告</SelectItem>
            <SelectItem value="info">提醒</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={summary?.total === 0 ? "🎉 目前無計費警示" : "沒有符合條件的警示"}
          description={
            summary?.total === 0
              ? "所有訂閱與帳單狀態都正常"
              : "試著清除篩選條件"
          }
        />
      ) : (
        <div className="space-y-2" data-testid="billing-alerts-list">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </PlatformAdminLayout>
  );
}

function AlertCard({ alert }: { alert: BillingAlert }) {
  return (
    <Card className={SEVERITY_BORDER[alert.severity] || ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0">{TYPE_ICONS[alert.type]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={SEVERITY_BADGE[alert.severity] || "bg-muted"}>
                {alert.severity}
              </Badge>
              <Badge variant="outline">
                {TYPE_LABELS[alert.type] || alert.type}
              </Badge>
              {alert.field && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="w-3 h-3" />
                  {alert.field.code}
                </span>
              )}
              {typeof alert.daysUntil === "number" && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {alert.daysUntil >= 0
                    ? `${alert.daysUntil} 天後`
                    : `已逾 ${Math.abs(alert.daysUntil)} 天`}
                </span>
              )}
              {typeof alert.amount === "number" && alert.amount !== 0 && (
                <span className="text-xs font-semibold tabular-nums">
                  NT${alert.amount.toLocaleString()}
                </span>
              )}
            </div>
            <div className="mt-1 font-semibold">{alert.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {alert.message}
            </div>
          </div>
          {alert.field && (
            <Link href={`/platform/fields`}>
              <Button size="sm" variant="outline" className="shrink-0">
                查看場域
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-bold tabular-nums ${accent}`}>
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
