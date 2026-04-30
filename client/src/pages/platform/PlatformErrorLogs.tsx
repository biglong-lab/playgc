// 🐛 平台錯誤記錄管理
//
// 收集前端 ErrorBoundary / unhandledrejection 上報的錯誤
// 支援同源錯誤聚合（fingerprint）+ 標記已解決
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bug, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ErrorLog {
  id: string;
  level: string;
  message: string;
  stack: string | null;
  source: string | null;
  url: string | null;
  userAgent: string | null;
  fingerprint: string | null;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolvedNote: string | null;
}

interface ErrorListResponse {
  items: ErrorLog[];
  total: number;
}

interface ErrorStats {
  total: number;
  unresolved: number;
  last_24h: number;
  last_7d: number;
  unique_fingerprints: number;
  total_occurrences: number;
}

export default function PlatformErrorLogs() {
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<string>("false");
  const [resolvingError, setResolvingError] = useState<ErrorLog | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const { data, isLoading } = useQuery<ErrorListResponse>({
    queryKey: ["/api/platform/errors", levelFilter, resolvedFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (resolvedFilter !== "all") params.set("resolved", resolvedFilter);
      const url = `/api/platform/errors?${params.toString()}`;
      return (await apiRequest("GET", url)).json();
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const { data: stats } = useQuery<ErrorStats>({
    queryKey: ["/api/platform/errors/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/errors/stats")).json(),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!resolvingError) return;
      const res = await apiRequest("PATCH", `/api/platform/errors/${resolvingError.id}/resolve`, {
        note: resolveNote || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/errors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/errors/stats"] });
      setResolvingError(null);
      setResolveNote("");
      toast({ title: "✅ 已標記為解決" });
    },
    onError: (err) => {
      toast({
        title: "標記失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  const errors = data?.items ?? [];

  return (
    <PlatformAdminLayout title="錯誤記錄">
      {/* 統計 6 卡 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <KpiCard label="總錯誤" value={stats?.total ?? 0} accent="text-primary" />
        <KpiCard label="未解決" value={stats?.unresolved ?? 0} accent={(stats?.unresolved ?? 0) > 0 ? "text-destructive" : "text-emerald-500"} />
        <KpiCard label="24h" value={stats?.last_24h ?? 0} accent="text-amber-500" />
        <KpiCard label="7天" value={stats?.last_7d ?? 0} accent="text-blue-500" />
        <KpiCard label="獨特錯誤" value={stats?.unique_fingerprints ?? 0} accent="text-purple-500" />
        <KpiCard label="累計次數" value={stats?.total_occurrences ?? 0} accent="text-muted-foreground" />
      </div>

      {/* 篩選列 */}
      <div className="flex gap-2 mb-4">
        <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="false">未解決</SelectItem>
            <SelectItem value="true">已解決</SelectItem>
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部等級</SelectItem>
            <SelectItem value="error">錯誤</SelectItem>
            <SelectItem value="warning">警告</SelectItem>
            <SelectItem value="info">資訊</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : errors.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="🎉 目前無錯誤紀錄"
          description="所有錯誤都已處理"
        />
      ) : (
        <div className="space-y-2" data-testid="error-logs-list">
          {errors.map((err) => (
            <ErrorCard
              key={err.id}
              error={err}
              onResolve={() => setResolvingError(err)}
            />
          ))}
        </div>
      )}

      {/* 標記已解決 dialog */}
      <AlertDialog open={!!resolvingError} onOpenChange={(open) => !open && setResolvingError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>標記錯誤為已解決</AlertDialogTitle>
          </AlertDialogHeader>
          {resolvingError && (
            <div className="space-y-2 text-sm">
              <div className="bg-muted/30 rounded p-2 text-xs font-mono break-all">
                {resolvingError.message}
              </div>
              <Input
                placeholder="解決備註（選填）"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
              {resolveMutation.isPending ? "標記中..." : "確認解決"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlatformAdminLayout>
  );
}

function ErrorCard({
  error,
  onResolve,
}: {
  error: ErrorLog;
  onResolve: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isResolved = !!error.resolvedAt;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={isResolved ? "opacity-60" : "border-l-4 border-l-destructive"}>
        <div className="flex items-center">
          <CollapsibleTrigger className="flex-1 text-left">
            <CardContent className="p-3 hover:bg-accent/30 transition-colors rounded-lg">
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${
                    open ? "rotate-90" : ""
                  }`}
                />
                {isResolved ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">已解決</Badge>
                ) : (
                  <Badge variant="destructive">{error.level}</Badge>
                )}
                <span className="font-mono text-xs flex-1 truncate">{error.message}</span>
                <Badge variant="outline" className="tabular-nums shrink-0">
                  ×{error.occurrenceCount}
                </Badge>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {new Date(error.lastSeenAt).toLocaleString("zh-TW", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </CardContent>
          </CollapsibleTrigger>
          {!isResolved && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onResolve();
              }}
              className="mr-3 gap-1 shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              解決
            </Button>
          )}
        </div>
        <CollapsibleContent>
          <CardContent className="px-4 pb-3 pt-0 text-xs space-y-2">
            <Field label="完整訊息" value={error.message} mono />
            {error.source && <Field label="來源" value={error.source} />}
            {error.url && <Field label="URL" value={error.url} mono small />}
            <Field
              label="首次/最後出現"
              value={`${new Date(error.firstSeenAt).toLocaleString("zh-TW")} → ${new Date(error.lastSeenAt).toLocaleString("zh-TW")}`}
            />
            {error.fingerprint && <Field label="Fingerprint" value={error.fingerprint} mono small />}
            {error.userAgent && <Field label="User-Agent" value={error.userAgent} small />}
            {error.stack && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Stack</div>
                <pre className="bg-muted/30 rounded p-2 text-[10px] overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {error.stack}
                </pre>
              </div>
            )}
            {error.resolvedNote && (
              <div className="bg-emerald-500/10 rounded p-2">
                <div className="text-[10px] text-emerald-600 mb-1">解決備註</div>
                <div className="text-xs">{error.resolvedNote}</div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function Field({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`${mono ? "font-mono" : ""} ${small ? "text-[10px]" : "text-xs"} break-all`}>
        {value}
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${accent}`}>
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
