// 🎬 AdminSessionReplay — Session 完整時間軸（爭議仲裁工具）
//
// Phase 0.3 / 2026-05-08
// 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md §3.4
//
// 路徑：/admin/sessions/:sessionId/replay
//
// 功能：
//   - 完整時間軸：每個 ws 事件 + DB 寫入按時間排
//   - 篩選：時間範圍 / 玩家 / eventType / messageType
//   - 事件詳情展開（payload）
//   - CSV export 給業主存檔
//   - 摘要統計（各 eventType 計數、各玩家計數）

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Loader2,
  Filter,
  AlertTriangle,
  Wifi,
  WifiOff,
  MessageSquare,
  Send,
  Users,
} from "lucide-react";
import { format } from "date-fns";

interface WsEvent {
  id: string;
  timestamp: string;
  sessionId: string | null;
  teamId: string | null;
  userId: string | null;
  userName: string | null;
  eventType: string;
  direction: string | null;
  messageType: string | null;
  payload: unknown;
  clientIp: string | null;
  userAgent: string | null;
  closeCode: number | null;
  reason: string | null;
  latencyMs: number | null;
  recipientCount: number | null;
}

interface DbWrite {
  id: string;
  timestamp: string;
  tableName: string;
  operation: string;
  primaryKey: string | null;
  sessionId: string | null;
  teamId: string | null;
  userId: string | null;
  before: unknown;
  after: unknown;
  conflictType: string | null;
  retrySucceeded: boolean | null;
  triggeredBy: string | null;
}

interface ReplayResponse {
  sessionId: string;
  filters: Record<string, unknown>;
  events: WsEvent[];
  dbWrites: DbWrite[];
  totalEvents: number;
  summary: {
    eventTypeStats: Array<{ eventType: string; count: number }>;
    users: Array<{ userId: string; userName: string; eventCount: number }>;
    timeRange: { first: string | null; last: string | null };
  };
  generatedAt: string;
}

type EventTypeFilter = "" | string;

const EVENT_TYPE_COLORS: Record<string, string> = {
  connect: "text-emerald-500",
  close: "text-orange-500",
  message: "text-blue-500",
  broadcast: "text-purple-500",
  error: "text-red-600",
  grace_start: "text-yellow-600",
  grace_expired: "text-red-500",
  auto_leave: "text-red-700",
  reconnect: "text-cyan-500",
  kick: "text-red-800",
};

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "connect":
    case "reconnect":
      return <Wifi className="w-3.5 h-3.5" />;
    case "close":
    case "auto_leave":
    case "kick":
      return <WifiOff className="w-3.5 h-3.5" />;
    case "message":
      return <MessageSquare className="w-3.5 h-3.5" />;
    case "broadcast":
      return <Send className="w-3.5 h-3.5" />;
    case "error":
    case "grace_start":
    case "grace_expired":
      return <AlertTriangle className="w-3.5 h-3.5" />;
    default:
      return <MessageSquare className="w-3.5 h-3.5" />;
  }
}

export default function AdminSessionReplay() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const { admin } = useAdminAuth({ redirectTo: "/admin/login" });

  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>("");
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [messageTypeFilter, setMessageTypeFilter] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 200;

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ReplayResponse>({
    queryKey: [
      "/api/admin/sessions/replay",
      sessionId,
      eventTypeFilter,
      userIdFilter,
      messageTypeFilter,
      page,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (eventTypeFilter) params.set("eventType", eventTypeFilter);
      if (userIdFilter) params.set("userId", userIdFilter);
      if (messageTypeFilter) params.set("messageType", messageTypeFilter);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      const res = await apiRequest(
        "GET",
        `/api/admin/sessions/${sessionId}/replay?${params.toString()}`,
      );
      return res.json();
    },
    enabled: !!admin && !!sessionId,
  });

  const handleExport = () => {
    if (!sessionId) return;
    const params = new URLSearchParams();
    if (eventTypeFilter) params.set("eventType", eventTypeFilter);
    if (userIdFilter) params.set("userId", userIdFilter);
    if (messageTypeFilter) params.set("messageType", messageTypeFilter);
    const url = `/api/admin/sessions/${sessionId}/export.csv?${params.toString()}`;
    window.open(url, "_blank");
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = useMemo(
    () => (data ? Math.ceil(data.totalEvents / PAGE_SIZE) : 0),
    [data],
  );

  return (
    <UnifiedAdminLayout title="🎬 Session Replay">
      <div className="space-y-6">
        {/* 頁首 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">🎬 Session Replay</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Session: <code className="text-xs">{sessionId?.slice(0, 16)}...</code>
              {data?.summary.timeRange.first && (
                <span className="ml-3 text-xs">
                  · {format(new Date(data.summary.timeRange.first), "yyyy-MM-dd HH:mm:ss")} 至{" "}
                  {data.summary.timeRange.last
                    ? format(new Date(data.summary.timeRange.last), "HH:mm:ss")
                    : ""}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              更新
            </Button>
            <Button variant="default" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              CSV 匯出
            </Button>
          </div>
        </div>

        {/* 篩選 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" /> 篩選
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">事件類型</label>
                <Select value={eventTypeFilter || "all"} onValueChange={(v) => { setEventTypeFilter(v === "all" ? "" : v); setPage(0); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {data?.summary.eventTypeStats.map((s) => (
                      <SelectItem key={s.eventType} value={s.eventType}>
                        {s.eventType} ({s.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">玩家</label>
                <Select value={userIdFilter || "all"} onValueChange={(v) => { setUserIdFilter(v === "all" ? "" : v); setPage(0); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {data?.summary.users.map((u) => (
                      <SelectItem key={u.userId} value={u.userId}>
                        {u.userName || u.userId.slice(0, 8)} ({u.eventCount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">訊息類型</label>
                <Input
                  placeholder="如 team_join / team_score_update"
                  value={messageTypeFilter}
                  onChange={(e) => { setMessageTypeFilter(e.target.value); setPage(0); }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 摘要 */}
        {data?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground">總事件數</div>
                <div className="text-2xl font-bold">{data.totalEvents.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> 玩家數
                </div>
                <div className="text-2xl font-bold">{data.summary.users.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground">DB 寫入</div>
                <div className="text-2xl font-bold">{data.dbWrites.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground text-red-500">異常事件</div>
                <div className="text-2xl font-bold text-red-500">
                  {data.summary.eventTypeStats
                    .filter((s) => ["error", "grace_expired", "auto_leave", "kick"].includes(s.eventType))
                    .reduce((sum, s) => sum + s.count, 0)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading / Error */}
        {isLoading && (
          <Card>
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">載入中...</span>
            </CardContent>
          </Card>
        )}
        {isError && (
          <Card className="border-destructive">
            <CardContent className="py-6">
              <p className="text-destructive">載入失敗</p>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        {!isLoading && data?.events && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">時間軸（{data.events.length} / {data.totalEvents}）</CardTitle>
              <CardDescription className="text-xs">
                按時間排序、點任一筆展開 payload 詳情
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.events.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  此篩選條件下無事件
                </p>
              ) : (
                <div className="space-y-1">
                  {data.events.map((evt) => {
                    const expanded = expandedIds.has(evt.id);
                    const colorClass = EVENT_TYPE_COLORS[evt.eventType] ?? "text-foreground";
                    return (
                      <div key={evt.id} className="border rounded-md text-sm">
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left"
                          onClick={() => toggleExpand(evt.id)}
                        >
                          {expanded ? (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="text-xs font-mono text-muted-foreground shrink-0">
                            {format(new Date(evt.timestamp), "HH:mm:ss.SSS")}
                          </span>
                          <span className={`flex items-center gap-1 ${colorClass} shrink-0`}>
                            {getEventIcon(evt.eventType)}
                            <span className="font-semibold">{evt.eventType}</span>
                          </span>
                          {evt.direction && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 shrink-0">
                              {evt.direction}
                            </Badge>
                          )}
                          {evt.messageType && (
                            <span className="text-xs font-mono text-blue-600 shrink-0">
                              {evt.messageType}
                            </span>
                          )}
                          {evt.userName && (
                            <span className="text-xs text-muted-foreground truncate">
                              👤 {evt.userName}
                            </span>
                          )}
                          {evt.recipientCount !== null && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              → {evt.recipientCount} 人
                            </span>
                          )}
                          {evt.reason && (
                            <span className="text-xs text-orange-600 truncate">
                              ({evt.reason})
                            </span>
                          )}
                          {evt.closeCode !== null && (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1 shrink-0">
                              code={evt.closeCode}
                            </Badge>
                          )}
                        </button>
                        {expanded && (
                          <div className="border-t px-3 py-2 bg-muted/20">
                            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                              <div>
                                <span className="text-muted-foreground">userId:</span>{" "}
                                <code>{evt.userId ?? "—"}</code>
                              </div>
                              <div>
                                <span className="text-muted-foreground">teamId:</span>{" "}
                                <code>{evt.teamId ?? "—"}</code>
                              </div>
                              <div>
                                <span className="text-muted-foreground">clientIp:</span>{" "}
                                <code>{evt.clientIp ?? "—"}</code>
                              </div>
                              <div>
                                <span className="text-muted-foreground">latencyMs:</span>{" "}
                                <code>{evt.latencyMs ?? "—"}</code>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">payload:</div>
                            <pre className="text-xs bg-background p-2 rounded border overflow-x-auto max-h-60">
                              {JSON.stringify(evt.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    第 {page + 1} / {totalPages} 頁
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      上一頁
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一頁
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* DB Writes Section */}
        {!isLoading && data?.dbWrites && data.dbWrites.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">DB 寫入紀錄（{data.dbWrites.length}）</CardTitle>
              <CardDescription className="text-xs">
                關鍵 DB 寫入操作（含樂觀鎖衝突）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {data.dbWrites.map((w) => {
                  const expanded = expandedIds.has(w.id);
                  return (
                    <div key={w.id} className="border rounded-md text-sm">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left"
                        onClick={() => toggleExpand(w.id)}
                      >
                        {expanded ? (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {format(new Date(w.timestamp), "HH:mm:ss.SSS")}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {w.operation}
                        </Badge>
                        <span className="text-xs font-mono">{w.tableName}</span>
                        {w.conflictType && (
                          <Badge variant="destructive" className="text-[10px]">
                            {w.conflictType}
                          </Badge>
                        )}
                      </button>
                      {expanded && (
                        <div className="border-t px-3 py-2 bg-muted/20">
                          <div className="text-xs">
                            <div className="mb-1 text-muted-foreground">before → after:</div>
                            <div className="grid grid-cols-2 gap-2">
                              <pre className="text-xs bg-background p-2 rounded border overflow-x-auto max-h-40">
                                {JSON.stringify(w.before, null, 2)}
                              </pre>
                              <pre className="text-xs bg-background p-2 rounded border overflow-x-auto max-h-40">
                                {JSON.stringify(w.after, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </UnifiedAdminLayout>
  );
}
