// 🔒 平台稽核日誌（P0-1）
//
// 用途：所有 platform admin 跨場域操作的留痕（誰、何時、做什麼、改了什麼）
// 涵蓋：場域狀態變更、方案調整、admin 帳號異動 等
//
// 設計原則：
//   - 只能讀，不能改（log 是寫死的歷史記錄）
//   - 支援多維度過濾（時間、場域、操作者、動作類型）
//   - 統計卡片給快速掌握活動量
//   - 展開可看完整 metadata（JSON）
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ScrollText,
  Search,
  Building2,
  ChevronRight,
  User,
  Clock,
  TrendingUp,
} from "lucide-react";

interface AuditLog {
  id: string;
  actorAdminId: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  fieldId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: {
    id: string;
    username: string;
    displayName: string | null;
  } | null;
  field: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface AuditListResponse {
  items: AuditLog[];
  nextCursor: string | null;
}

interface AuditStats {
  todayCount: number;
  monthCount: number;
  topActions: Array<{ action: string; count: number }>;
  topActors: Array<{ actorAdminId: string; count: number }>;
}

export default function PlatformAuditLogs() {
  const { isAuthenticated } = useAdminAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<AuditListResponse>({
    queryKey: ["/api/platform/audit-logs", actionFilter, targetTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (targetTypeFilter !== "all") params.set("targetType", targetTypeFilter);
      params.set("limit", "100");
      const url = `/api/platform/audit-logs?${params.toString()}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: stats } = useQuery<AuditStats>({
    queryKey: ["/api/platform/audit-logs/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/audit-logs/stats");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const logs = data?.items ?? [];

  // 從 logs 抽出唯一動作類型（給 filter 用）
  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(l.action));
    return Array.from(set).sort();
  }, [logs]);

  const targetTypeOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.targetType && set.add(l.targetType));
    return Array.from(set).sort();
  }, [logs]);

  // 客端搜尋
  const filtered = useMemo(() => {
    if (!searchQuery) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter((l) => {
      return (
        l.action.toLowerCase().includes(q) ||
        (l.actor?.username || "").toLowerCase().includes(q) ||
        (l.actor?.displayName || "").toLowerCase().includes(q) ||
        (l.field?.name || "").toLowerCase().includes(q) ||
        (l.field?.code || "").toLowerCase().includes(q) ||
        (l.targetType || "").toLowerCase().includes(q)
      );
    });
  }, [logs, searchQuery]);

  return (
    <PlatformAdminLayout title="平台稽核日誌">
      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="今日操作"
          value={stats?.todayCount ?? 0}
          accent="text-primary"
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="本月操作"
          value={stats?.monthCount ?? 0}
          accent="text-amber-500"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          label="目前列表"
          value={filtered.length}
          accent="text-emerald-500"
          icon={<ScrollText className="w-4 h-4" />}
        />
        <StatCard
          label="動作類型"
          value={actionOptions.length}
          accent="text-blue-500"
        />
      </div>

      {/* 篩選列 */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋動作 / 操作者 / 場域..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-audit"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="動作類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部動作</SelectItem>
            <SelectItem value="platform:">僅平台層</SelectItem>
            <SelectItem value="admin:">僅場域層</SelectItem>
            {actionOptions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="資源類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部資源</SelectItem>
            {targetTypeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Top Actions（本月）*/}
      {stats?.topActions && stats.topActions.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              本月最常見動作
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.topActions.slice(0, 6).map((a) => (
                <Badge
                  key={a.action}
                  variant="secondary"
                  className="font-mono text-xs cursor-pointer hover:bg-primary/20"
                  onClick={() => setActionFilter(a.action)}
                >
                  {a.action}
                  <span className="ml-1 tabular-nums opacity-70">
                    ×{a.count}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 列表 */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={logs.length === 0 ? "尚無稽核紀錄" : "沒有符合條件的紀錄"}
          description={
            logs.length === 0
              ? "尚未有任何 admin 操作被記錄"
              : "試著清除篩選條件"
          }
        />
      ) : (
        <div className="space-y-2" data-testid="audit-logs-list">
          {filtered.map((log) => (
            <AuditLogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </PlatformAdminLayout>
  );
}

function AuditLogCard({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const isPlatform = log.action.startsWith("platform:");

  // 把 metadata 簡短展示
  const summary = useMemo(() => {
    const m = log.metadata;
    if (!m || typeof m !== "object") return null;
    const parts: string[] = [];
    if ("oldStatus" in m && "newStatus" in m) {
      parts.push(`${m.oldStatus ?? "(空)"} → ${m.newStatus}`);
    }
    if ("planCode" in m) {
      parts.push(`方案: ${m.planCode}`);
    }
    if ("targetUsername" in m) {
      parts.push(`帳號: @${m.targetUsername}`);
    }
    if ("changes" in m && m.changes && typeof m.changes === "object") {
      const keys = Object.keys(m.changes as Record<string, unknown>);
      if (keys.length > 0) parts.push(`改動: ${keys.join(", ")}`);
    }
    return parts.join(" · ");
  }, [log.metadata]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="w-full text-left">
          <CardContent className="p-3 hover:bg-accent/30 transition-colors rounded-lg">
            <div className="flex items-center gap-2">
              <ChevronRight
                className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${
                  open ? "rotate-90" : ""
                }`}
              />
              <Badge
                variant={isPlatform ? "default" : "secondary"}
                className={`font-mono text-xs shrink-0 ${
                  isPlatform ? "bg-amber-500" : ""
                }`}
              >
                {log.action}
              </Badge>
              {log.field && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Building2 className="w-3 h-3" />
                  {log.field.code}
                </span>
              )}
              {summary && (
                <span className="text-xs text-foreground/80 truncate">
                  {summary}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                {log.actor && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {log.actor.displayName || log.actor.username}
                  </span>
                )}
                <span className="tabular-nums">
                  {new Date(log.createdAt).toLocaleString("zh-TW", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-4 pb-3 pt-0 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Field label="完整時間" value={new Date(log.createdAt).toLocaleString("zh-TW")} />
              <Field label="動作" value={log.action} mono />
              <Field
                label="操作者"
                value={
                  log.actor
                    ? `${log.actor.displayName || log.actor.username} (@${log.actor.username})`
                    : "（系統 / 未知）"
                }
              />
              <Field
                label="場域"
                value={log.field ? `${log.field.name}（${log.field.code}）` : "（無）"}
              />
              <Field label="資源類型" value={log.targetType ?? "—"} mono />
              <Field label="資源 ID" value={log.targetId ?? "—"} mono small />
              <Field label="IP" value={log.ipAddress ?? "—"} mono small />
              <Field
                label="User-Agent"
                value={log.userAgent ?? "—"}
                small
                className="col-span-2"
              />
            </div>
            {log.metadata && Object.keys(log.metadata as object).length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Metadata
                </div>
                <pre className="text-[10px] bg-muted/30 rounded p-2 overflow-x-auto font-mono">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function Field({
  label,
  value,
  mono,
  small,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`${mono ? "font-mono" : ""} ${small ? "text-[10px]" : "text-xs"} break-all`}
      >
        {value}
      </div>
    </div>
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
