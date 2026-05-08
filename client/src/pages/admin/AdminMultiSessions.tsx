// 📡 AdminMultiSessions — 多人遊戲即時連線監控（v2 完整打磨版 / 2026-05-08）
//
// 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md §3.2
// 16 項打磨：docs/changes/2026-05-08-admin-multi-sessions-v2.md
// 路徑：/admin/multi-sessions
//
// 改進（v2）:
//   ✅ P0-1 三列佈局（grid-cols-1 md:2 lg:3）
//   ✅ P0-2 頂部 4 MetricCard（進行中 / 在線 / 異常 / 平均連線時長）
//   ✅ P0-3 真實 online（ws_event_log 取代假 5 分鐘 polling）
//   ✅ P0-4 健康指標（grace/auto_leave/kick/error/error count）
//   ✅ P0-5 異常排序到頂（server 端 anomalyScore desc）
//   ✅ P1-6 篩選列（搜尋 / 場域 / 健康度）
//   ✅ P1-7 玩家詳情真實狀態（連線時間/重連次數/IP/UA/最近斷線原因）
//   ✅ P1-8 迷你連線時間軸（過去 5 分鐘事件視覺化）
//   ✅ P1-9 CSV 匯出
//   ✅ P2-10 game 進度（隊伍平均進度 %）
//   ✅ P2-11 sessionId 點擊複製 + Replay 按鈕
//   ✅ P2-12 refresh 倒數顯示
//   ✅ P3-16 鍵盤導航（/ 搜尋）

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import MetricCard from "@/components/shared/MetricCard";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { exportToCsv, formatCsvDateTime, type CsvColumn } from "@/lib/csv-export";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  History,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  Timer,
  Copy,
  Download,
  Zap,
  ShieldAlert,
  Globe,
  Smartphone,
  Crown,
  TrendingUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";

// ============================================================================
// Types（與 server endpoint 對應）
// ============================================================================

interface SessionHealth {
  graceCount: number;
  autoLeaveCount: number;
  kickCount: number;
  reconnectCount: number;
  errorCount: number;
}

interface SessionListItem {
  sessionId: string;
  gameId: string;
  gameTitle: string;
  fieldId: string | null;
  startedAt: string | null;
  hostMode: boolean | null;
  teamCount: number;
  totalMembers: number;
  onlineMembers: number;
  recentMembers: number;
  awayMembers: number;
  offlineMembers: number;
  health: SessionHealth;
  anomalyScore: number;
  usingRealtimeData: boolean;
}

interface SessionListResponse {
  sessions: SessionListItem[];
  totalActive: number;
  healthWindowMinutes: number;
  generatedAt: string;
}

interface PlayerWsConn {
  firstConnectAt: string | null;
  lastEventAt: string | null;
  lastEventType: string | null;
  connectCount: number;
  closeCount: number;
  messageCount: number;
  reconnectCount: number;
  clientIp: string | null;
  userAgent: string | null;
  lastReason: string | null;
}

interface SessionDetailMember {
  userId: string;
  role: string | null;
  name: string;
  online: boolean;
  connectionStatus: "online" | "away" | "offline";
  updatedAt: string | null;
  currentPageId: string | null;
  currentPageOrder: number;
  progressPercent: number;
  score: number;
  wsConn: PlayerWsConn | null;
}

interface SessionDetailTeam {
  teamId: string;
  teamName: string;
  memberCount: number;
  members: SessionDetailMember[];
  recentStates: Array<{ component_type?: string; version?: number; updated_at?: string }>;
  lockStates: Array<{ shared_code?: string; attempts?: number; is_unlocked?: boolean; is_failed?: boolean }>;
}

interface TimelineEvent {
  userId: string | null;
  eventType: string;
  timestamp: string | null;
}

interface SessionDetailResponse {
  gameId: string;
  gameTitle: string;
  totalPages: number;
  activeSessions: number;
  sessions: Array<{
    sessionId: string;
    startedAt: string | null;
    status: string | null;
    hostMode: boolean | null;
    teamCount: number;
    teams: SessionDetailTeam[];
    timelineEvents: TimelineEvent[];
    timelineWindowMinutes: number;
    health: SessionHealth & { messageCount: number; broadcastCount: number };
    avgProgressPercent: number;
    totalPages: number;
  }>;
  generatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const REFRESH_INTERVAL_MS = 5000;

type HealthFilter = "all" | "healthy" | "warning" | "critical";

function classifyHealth(s: SessionListItem): "healthy" | "warning" | "critical" {
  if (s.anomalyScore >= 20) return "critical";
  if (s.anomalyScore >= 5) return "warning";
  return "healthy";
}

function timeAgoZh(iso: string | null): string {
  if (!iso) return "—";
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: zhTW });
}

// ============================================================================
// Main page
// ============================================================================

export default function AdminMultiSessions() {
  const { admin } = useAdminAuth({ redirectTo: "/admin/login" });
  const { toast } = useToast();
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useQuery<SessionListResponse>({
      queryKey: ["/api/admin/multi-sessions"],
      queryFn: async () => {
        const res = await apiRequest("GET", "/api/admin/multi-sessions");
        return res.json();
      },
      enabled: !!admin,
      refetchInterval: REFRESH_INTERVAL_MS,
      refetchIntervalInBackground: false,
    });

  // 🆕 P2-12 倒數顯示
  useEffect(() => {
    setCountdown(REFRESH_INTERVAL_MS / 1000);
    const id = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [dataUpdatedAt]);

  // 🆕 P3-16 鍵盤 / 聚焦搜尋
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 🆕 場域 dropdown 選項（從現有資料推）
  const fieldOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of data?.sessions ?? []) {
      if (s.fieldId) set.add(s.fieldId);
    }
    return Array.from(set);
  }, [data?.sessions]);

  // 🆕 P1-6 套用篩選
  const filteredSessions = useMemo(() => {
    const sessions = data?.sessions ?? [];
    return sessions.filter((s) => {
      // 搜尋
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const hit =
          s.sessionId.toLowerCase().includes(q) ||
          (s.gameTitle ?? "").toLowerCase().includes(q) ||
          (s.fieldId ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      // 場域
      if (fieldFilter !== "all" && s.fieldId !== fieldFilter) return false;
      // 健康度
      if (healthFilter !== "all" && classifyHealth(s) !== healthFilter) return false;
      return true;
    });
  }, [data?.sessions, searchTerm, fieldFilter, healthFilter]);

  // 🆕 P0-2 統計卡資料
  const stats = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const totalSessions = sessions.length;
    const totalOnline = sessions.reduce((sum, s) => sum + s.onlineMembers, 0);
    const criticalCount = sessions.filter((s) => classifyHealth(s) === "critical").length;
    const avgUptimeMinutes = sessions.length > 0
      ? Math.round(
          sessions.reduce((sum, s) => {
            if (!s.startedAt) return sum;
            return sum + (Date.now() - new Date(s.startedAt).getTime()) / 60_000;
          }, 0) / sessions.length,
        )
      : 0;
    return { totalSessions, totalOnline, criticalCount, avgUptimeMinutes };
  }, [data?.sessions]);

  // 🆕 P1-9 CSV 匯出
  const handleExport = () => {
    const cols: CsvColumn<SessionListItem>[] = [
      { header: "sessionId", get: (s) => s.sessionId },
      { header: "gameTitle", get: (s) => s.gameTitle },
      { header: "fieldId", get: (s) => s.fieldId ?? "" },
      { header: "startedAt", get: (s) => formatCsvDateTime(s.startedAt) },
      { header: "teamCount", get: (s) => s.teamCount },
      { header: "totalMembers", get: (s) => s.totalMembers },
      { header: "onlineMembers", get: (s) => s.onlineMembers },
      { header: "recentMembers", get: (s) => s.recentMembers },
      { header: "awayMembers", get: (s) => s.awayMembers },
      { header: "offlineMembers", get: (s) => s.offlineMembers },
      { header: "graceCount", get: (s) => s.health.graceCount },
      { header: "autoLeaveCount", get: (s) => s.health.autoLeaveCount },
      { header: "kickCount", get: (s) => s.health.kickCount },
      { header: "errorCount", get: (s) => s.health.errorCount },
      { header: "anomalyScore", get: (s) => s.anomalyScore },
      { header: "usingRealtimeData", get: (s) => (s.usingRealtimeData ? "yes" : "no") },
    ];
    exportToCsv(cols, filteredSessions, "multi-sessions");
    toast({ title: "CSV 已匯出", description: `${filteredSessions.length} 場 session` });
  };

  return (
    <UnifiedAdminLayout
      title="📡 即時連線監控"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data?.sessions.length}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            手動更新
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 標題 + 描述 */}
        <div>
          <p className="text-sm text-muted-foreground">
            多人遊戲 active sessions 即時觀測
            {data?.healthWindowMinutes && (
              <span className="ml-2 text-xs">· 健康指標統計過去 {data.healthWindowMinutes} 分鐘</span>
            )}
            {data?.generatedAt && (
              <span className="ml-2 text-xs">· 上次更新 {timeAgoZh(data.generatedAt)}</span>
            )}
            <span className="ml-2 text-xs text-muted-foreground/70">
              · {countdown} 秒後自動更新
            </span>
          </p>
        </div>

        {/* 🆕 P0-2 頂部 4 MetricCard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="進行中 session"
            value={stats.totalSessions}
            icon={Activity}
            accent={stats.totalSessions > 0 ? "primary" : "muted"}
            live={stats.totalSessions > 0}
            active={healthFilter === "all"}
            onClick={() => setHealthFilter("all")}
          />
          <MetricCard
            label="總在線玩家"
            value={stats.totalOnline}
            icon={Users}
            accent={stats.totalOnline > 0 ? "success" : "muted"}
            sublabel={stats.totalOnline > 0 ? "真實 ws 連線" : undefined}
          />
          <MetricCard
            label="異常 session"
            value={stats.criticalCount}
            icon={ShieldAlert}
            accent={stats.criticalCount > 0 ? "destructive" : "muted"}
            active={healthFilter === "critical"}
            onClick={() =>
              setHealthFilter(healthFilter === "critical" ? "all" : "critical")
            }
            sublabel={stats.criticalCount > 0 ? "點擊只看異常" : undefined}
          />
          <MetricCard
            label="平均連線時長"
            value={`${stats.avgUptimeMinutes} 分`}
            icon={Timer}
            accent="default"
          />
        </div>

        {/* 🆕 P1-6 篩選列 */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="搜尋 sessionId / 遊戲名 / 場域...（按 / 聚焦）"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {fieldOptions.length > 1 && (
            <Select value={fieldFilter} onValueChange={setFieldFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="場域" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部場域</SelectItem>
                {fieldOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={healthFilter} onValueChange={(v) => setHealthFilter(v as HealthFilter)}>
            <SelectTrigger className="w-full md:w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="健康度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部健康度</SelectItem>
              <SelectItem value="healthy">健康</SelectItem>
              <SelectItem value="warning">警示</SelectItem>
              <SelectItem value="critical">異常</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading / Error / Empty */}
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
              <p className="text-destructive">載入失敗、請手動重試</p>
            </CardContent>
          </Card>
        )}
        {!isLoading && !isError && filteredSessions.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {(data?.sessions.length ?? 0) === 0
                  ? "目前沒有進行中的 multi session"
                  : "篩選條件下無 session"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 🆕 P0-1 三列 grid */}
        {!isLoading && filteredSessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((s) => (
              <SessionCard
                key={s.sessionId}
                session={s}
                expanded={expandedGameId === s.sessionId}
                onToggleExpand={() =>
                  setExpandedGameId(expandedGameId === s.sessionId ? null : s.sessionId)
                }
              />
            ))}
          </div>
        )}
      </div>
    </UnifiedAdminLayout>
  );
}

// ============================================================================
// SessionCard
// ============================================================================

function SessionCard({
  session,
  expanded,
  onToggleExpand,
}: {
  session: SessionListItem;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { toast } = useToast();
  const health = classifyHealth(session);
  const onlineRatio =
    session.totalMembers > 0 ? (session.onlineMembers / session.totalMembers) * 100 : 0;

  // 🆕 P2-11 sessionId 點擊複製
  const copySessionId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(session.sessionId).then(() => {
      toast({ title: "Session ID 已複製", description: session.sessionId });
    });
  };

  // 健康度視覺
  const healthBorder =
    health === "critical"
      ? "border-destructive/60 bg-destructive/5"
      : health === "warning"
      ? "border-orange-500/40 bg-orange-50/30 dark:bg-orange-950/10"
      : "";

  return (
    <Card className={`hover-elevate transition-all ${healthBorder}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2 truncate">
              {session.gameTitle}
              {session.hostMode && (
                <Badge variant="secondary" className="text-[10px] shrink-0">主控</Badge>
              )}
              {health === "critical" && (
                <Badge variant="destructive" className="text-[10px] shrink-0">
                  <ShieldAlert className="w-3 h-3 mr-0.5" />
                  異常
                </Badge>
              )}
              {health === "warning" && (
                <Badge variant="default" className="text-[10px] shrink-0 bg-orange-500">
                  警示
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1 flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-mono hover:bg-muted px-1 rounded inline-flex items-center gap-1"
                onClick={copySessionId}
                title="點擊複製"
              >
                <code>{session.sessionId.slice(0, 12)}...</code>
                <Copy className="w-2.5 h-2.5" />
              </button>
              {session.startedAt && (
                <span className="text-xs">{timeAgoZh(session.startedAt)}</span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link href={`/admin/sessions/${session.sessionId}/replay`}>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => e.stopPropagation()}
                className="h-7"
              >
                <History className="w-3 h-3 mr-1" />
                Replay
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent
        className="cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* 4 mini stats */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Stat icon={<Users className="w-3 h-3" />} label="隊伍" value={session.teamCount} />
          <Stat
            icon={<Wifi className="w-3 h-3 text-emerald-500" />}
            label="在線"
            value={`${session.onlineMembers}/${session.totalMembers}`}
            tone={onlineRatio < 60 ? "danger" : "default"}
          />
          <Stat
            icon={<Zap className="w-3 h-3 text-amber-500" />}
            label="暫離"
            value={session.awayMembers}
            tone={session.awayMembers > 0 ? "warn" : "default"}
          />
          <Stat
            icon={<WifiOff className="w-3 h-3 text-orange-500" />}
            label="離線"
            value={session.offlineMembers}
          />
        </div>

        {/* 健康指標小行 */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2 flex-wrap">
          <span>5min 內：</span>
          <HealthBadge label="grace" count={session.health.graceCount} variant="warning" />
          <HealthBadge label="auto-leave" count={session.health.autoLeaveCount} variant="destructive" />
          <HealthBadge label="kick" count={session.health.kickCount} variant="destructive" />
          <HealthBadge label="error" count={session.health.errorCount} variant="destructive" />
          {!session.usingRealtimeData && (
            <span className="text-[10px] text-muted-foreground/70" title="ws_event_log 無資料、回退用 player_progress">
              · fallback
            </span>
          )}
        </div>

        <div className="flex items-center justify-center text-xs text-muted-foreground">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          <span className="ml-1">{expanded ? "收合" : "展開玩家詳情"}</span>
        </div>

        {expanded && <SessionDetail gameId={session.gameId} sessionId={session.sessionId} />}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Stat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "default" | "warn" | "danger";
}) {
  const colorClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
      ? "text-orange-600"
      : "";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

function HealthBadge({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "warning" | "destructive";
}) {
  if (count === 0) return null;
  const colorClass = variant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-orange-500/10 text-orange-600";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${colorClass}`} title={label}>
      {label} {count}
    </span>
  );
}

// ============================================================================
// SessionDetail（展開區）
// ============================================================================

function SessionDetail({ gameId, sessionId }: { gameId: string; sessionId: string }) {
  const { data, isLoading } = useQuery<SessionDetailResponse>({
    queryKey: ["/api/admin/multi-sessions/state", gameId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/multi-sessions/${gameId}/state`);
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const detailSession = data?.sessions.find((s) => s.sessionId === sessionId);
  if (!detailSession) {
    return (
      <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
        找不到 session 詳情（可能已結束）
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      {/* 🆕 P2-10 game 進度 */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground shrink-0">遊戲進度</span>
        <div className="flex-1">
          <Progress value={detailSession.avgProgressPercent} className="h-1.5" />
        </div>
        <span className="font-mono shrink-0">
          {detailSession.avgProgressPercent}% · {detailSession.totalPages} 頁
        </span>
      </div>

      {/* 🆕 P1-8 迷你連線時間軸 */}
      <MiniTimeline
        events={detailSession.timelineEvents}
        windowMinutes={detailSession.timelineWindowMinutes}
      />

      {/* 訊息流統計 + P3-15 broadcast/min */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
        <span>
          📩 inbound：<strong className="text-foreground">{detailSession.health.messageCount}</strong>
        </span>
        <span>
          📡 broadcast：<strong className="text-foreground">{detailSession.health.broadcastCount}</strong>
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <strong className="text-foreground">
            {Math.round(detailSession.health.broadcastCount / Math.max(1, detailSession.timelineWindowMinutes))}
          </strong>
          /min
        </span>
        <span className="text-muted-foreground/70">（過去 5 分鐘）</span>
      </div>

      {/* 隊伍 + 玩家 */}
      {detailSession.teams.map((team) => (
        <div key={team.teamId} className="rounded-lg border p-3 bg-muted/20">
          <div className="font-semibold text-sm mb-2 flex items-center gap-2">
            🛡️ {team.teamName}
            <Badge variant="secondary" className="text-[10px]">
              {team.memberCount} 人
            </Badge>
          </div>
          <div className="space-y-2">
            {team.members.map((m) => (
              <PlayerRow key={m.userId} member={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PlayerRow（含真實 ws 連線詳情）
// ============================================================================

function PlayerRow({ member }: { member: SessionDetailMember }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const status = member.connectionStatus;
  const StatusIcon = status === "online" ? Wifi : status === "away" ? Zap : WifiOff;
  const statusColor =
    status === "online"
      ? "text-emerald-500"
      : status === "away"
      ? "text-amber-500"
      : "text-orange-500";

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-2 min-w-0 flex-1 hover:bg-muted/40 rounded px-1 -mx-1 text-left"
          onClick={() => setHistoryOpen(true)}
          title="點擊看玩家連線歷史"
        >
          <StatusIcon className={`w-3 h-3 shrink-0 ${statusColor}`} />
          <span className="truncate">{member.name}</span>
          {member.role === "leader" && (
            <Crown className="w-3 h-3 text-amber-500 shrink-0" />
          )}
          {status === "away" && (
            <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-500 text-amber-600">
              暫離
            </Badge>
          )}
          <History className="w-2.5 h-2.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
        </button>
        <div className="flex items-center gap-3 text-muted-foreground shrink-0">
          <span title="當前頁">P{member.currentPageOrder}</span>
          <span title="進度">{member.progressPercent}%</span>
          <span title="分數">{member.score} 分</span>
        </div>
      </div>

      {/* 🆕 P1-7 真實 ws 連線詳情 */}
      {member.wsConn && (member.wsConn.connectCount > 0 || member.wsConn.lastEventAt) && (
        <div className="ml-5 mt-1 text-[10px] text-muted-foreground space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {member.wsConn.firstConnectAt && (
              <span title="首次連線">
                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                {format(new Date(member.wsConn.firstConnectAt), "HH:mm:ss")}
              </span>
            )}
            {member.wsConn.reconnectCount > 0 && (
              <span className="text-amber-600" title="重連次數">
                ⟲ {member.wsConn.reconnectCount} 次重連
              </span>
            )}
            {member.wsConn.lastEventAt && (
              <span title="最後活動">
                · 最後 {timeAgoZh(member.wsConn.lastEventAt)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {member.wsConn.clientIp && (
              <span title="IP">
                <Globe className="w-2.5 h-2.5 inline mr-0.5" />
                {member.wsConn.clientIp}
              </span>
            )}
            {member.wsConn.userAgent && (
              <span title={member.wsConn.userAgent} className="truncate max-w-[200px]">
                <Smartphone className="w-2.5 h-2.5 inline mr-0.5" />
                {member.wsConn.userAgent.slice(0, 40)}
              </span>
            )}
          </div>
          {member.wsConn.lastReason && (
            <div className="text-orange-600">
              <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />
              {member.wsConn.lastReason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MiniTimeline（迷你連線時間軸 P1-8）
// ============================================================================

function MiniTimeline({
  events,
  windowMinutes,
}: {
  events: TimelineEvent[];
  windowMinutes: number;
}) {
  if (events.length === 0) {
    return (
      <div className="text-[10px] text-muted-foreground/60 italic">
        過去 {windowMinutes} 分鐘無連線事件
      </div>
    );
  }

  // 30 格、每格代表 windowMinutes/30 分鐘
  const BUCKETS = 30;
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const bucketMs = windowMs / BUCKETS;

  // 計算每格事件
  const buckets: Array<{ connect: number; close: number; grace: number; error: number }> = [];
  for (let i = 0; i < BUCKETS; i++) {
    buckets.push({ connect: 0, close: 0, grace: 0, error: 0 });
  }
  for (const e of events) {
    if (!e.timestamp) continue;
    const t = new Date(e.timestamp).getTime();
    const ago = now - t;
    if (ago > windowMs || ago < 0) continue;
    const bucketIdx = Math.min(BUCKETS - 1, Math.floor((windowMs - ago) / bucketMs));
    if (e.eventType === "connect" || e.eventType === "reconnect") buckets[bucketIdx].connect += 1;
    else if (e.eventType === "close" || e.eventType === "auto_leave" || e.eventType === "kick") buckets[bucketIdx].close += 1;
    else if (e.eventType === "grace_start" || e.eventType === "grace_expired") buckets[bucketIdx].grace += 1;
    else if (e.eventType === "error") buckets[bucketIdx].error += 1;
  }

  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-1">
        過去 {windowMinutes} 分鐘連線事件（{events.length} 筆）
      </div>
      <div className="flex gap-px h-6 items-end">
        {buckets.map((b, i) => {
          const total = b.connect + b.close + b.grace + b.error;
          if (total === 0) {
            return (
              <div
                key={i}
                className="flex-1 bg-muted/30 rounded-sm"
                style={{ minHeight: "4px" }}
              />
            );
          }
          // 主導事件決定顏色
          const dominant = b.error > 0
            ? "bg-red-500"
            : b.close > 0
            ? "bg-orange-500"
            : b.grace > 0
            ? "bg-amber-400"
            : "bg-emerald-500";
          const height = Math.min(24, 4 + total * 2);
          return (
            <div
              key={i}
              className={`flex-1 ${dominant} rounded-sm`}
              style={{ height: `${height}px` }}
              title={`${i * (windowMinutes * 60 / BUCKETS)}s 前: connect=${b.connect}, close=${b.close}, grace=${b.grace}, error=${b.error}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-[9px] text-muted-foreground/70 mt-1">
        <span>{windowMinutes} 分前</span>
        <div className="flex-1" />
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-500 rounded-sm" />
          connect
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-amber-400 rounded-sm" />
          grace
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-orange-500 rounded-sm" />
          close
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-sm" />
          error
        </span>
        <div className="flex-1" />
        <span>現在</span>
      </div>
    </div>
  );
}
