// 📡 AdminMultiSessions — 多人遊戲即時連線監控（Phase 0.1）
//
// 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md §3.2
// 路徑：/admin/multi-sessions
//
// 功能：
//   - 列出 admin 場域內所有 active multi sessions
//   - 5 秒 auto refresh
//   - 顯示：session / 遊戲 / 隊伍數 / 在線vs總人數 / 離線數
//   - 點 session 展開 detail：每隊員在線狀態、最近進度、score、recent states
//
// 用途：
//   - 業主活動進行中即時監控
//   - 玩家反映斷線時可立即比對 server-side 狀態
//   - Phase 1+ 重構後對比觀測指標

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Users, Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp, Loader2, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Link } from "wouter";

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
  offlineMembers: number;
}

interface SessionListResponse {
  sessions: SessionListItem[];
  totalActive: number;
  generatedAt: string;
}

interface SessionDetailMember {
  userId: string;
  role: string | null;
  name: string;
  online: boolean;
  updatedAt: string | null;
  currentPageId: string | null;
  currentPageOrder: number;
  progressPercent: number;
  score: number;
}

interface SessionDetailTeam {
  teamId: string;
  teamName: string;
  memberCount: number;
  members: SessionDetailMember[];
  recentStates: Array<{ page_id?: string; component_type?: string; version?: number; updated_at?: string }>;
  lockStates: Array<{ page_id?: string; shared_code?: string; attempts?: number; is_unlocked?: boolean; is_failed?: boolean; version?: number; updated_at?: string }>;
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
  }>;
  generatedAt: string;
}

const REFRESH_INTERVAL_MS = 5000;

export default function AdminMultiSessions() {
  const { admin } = useAdminAuth({ redirectTo: "/admin/login" });
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<SessionListResponse>({
    queryKey: ["/api/admin/multi-sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/multi-sessions");
      return res.json();
    },
    enabled: !!admin,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  return (
    <UnifiedAdminLayout title="📡 即時連線監控">
      <div className="space-y-6">
        {/* 頁首：總覽 + manual refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-500" />
              即時連線監控
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.totalActive ?? 0} 個進行中 multi session
              {data?.generatedAt && (
                <span className="ml-2 text-xs">
                  · 更新於 {formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true, locale: zhTW })}
                </span>
              )}
              <span className="ml-2 text-xs text-muted-foreground/70">
                · 每 {REFRESH_INTERVAL_MS / 1000} 秒自動更新
              </span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            手動更新
          </Button>
        </div>

        {/* Loading state */}
        {isLoading && (
          <Card>
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">載入中...</span>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {isError && (
          <Card className="border-destructive">
            <CardContent className="py-6">
              <p className="text-destructive">載入失敗、請手動重試</p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && !isError && (data?.sessions?.length ?? 0) === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">目前沒有進行中的 multi session</p>
              <p className="text-xs text-muted-foreground/70 mt-2">
                當有玩家正在多人遊戲中、會自動顯示
              </p>
            </CardContent>
          </Card>
        )}

        {/* Sessions list */}
        {!isLoading && data?.sessions && data.sessions.length > 0 && (
          <div className="grid gap-4">
            {data.sessions.map((s) => (
              <SessionCard
                key={s.sessionId}
                session={s}
                expanded={expandedGameId === s.gameId}
                onToggleExpand={() =>
                  setExpandedGameId(expandedGameId === s.gameId ? null : s.gameId)
                }
              />
            ))}
          </div>
        )}
      </div>
    </UnifiedAdminLayout>
  );
}

function SessionCard({
  session,
  expanded,
  onToggleExpand,
}: {
  session: SessionListItem;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const onlineRatio =
    session.totalMembers > 0 ? (session.onlineMembers / session.totalMembers) * 100 : 0;

  // 在線比 < 60% → 警示色
  const ratioBadgeVariant: "default" | "destructive" | "secondary" =
    onlineRatio >= 80 ? "default" : onlineRatio >= 60 ? "secondary" : "destructive";

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {session.gameTitle}
              {session.hostMode && (
                <Badge variant="secondary" className="text-xs">主控模式</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Session: <code className="text-xs">{session.sessionId.slice(0, 12)}...</code>
              {session.startedAt && (
                <span className="ml-3">
                  開始 {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true, locale: zhTW })}
                </span>
              )}
            </CardDescription>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat icon={<Users className="w-4 h-4" />} label="隊伍數" value={session.teamCount} />
          <Stat icon={<Users className="w-4 h-4" />} label="總玩家" value={session.totalMembers} />
          <Stat
            icon={<Wifi className="w-4 h-4 text-emerald-500" />}
            label="在線"
            value={session.onlineMembers}
            badgeVariant={ratioBadgeVariant}
          />
          <Stat
            icon={<WifiOff className="w-4 h-4 text-orange-500" />}
            label="離線"
            value={session.offlineMembers}
          />
        </div>

        {expanded && (
          <SessionDetail gameId={session.gameId} sessionId={session.sessionId} />
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  badgeVariant,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  badgeVariant?: "default" | "destructive" | "secondary";
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      {badgeVariant ? (
        <Badge variant={badgeVariant} className="text-base font-bold">
          {value}
        </Badge>
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
    </div>
  );
}

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
      <div className="text-xs text-muted-foreground">
        共 {data?.totalPages ?? 0} 頁
      </div>
      {detailSession.teams.map((team) => (
        <div key={team.teamId} className="rounded-lg border p-3 bg-muted/20">
          <div className="font-semibold text-sm mb-2 flex items-center gap-2">
            🛡️ {team.teamName}
            <Badge variant="secondary" className="text-xs">{team.memberCount} 人</Badge>
          </div>
          <div className="space-y-1.5">
            {team.members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {m.online ? (
                    <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-orange-500 shrink-0" />
                  )}
                  <span className="truncate">{m.name}</span>
                  {m.role === "leader" && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1">隊長</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                  <span>P {m.currentPageOrder}</span>
                  <span>{m.progressPercent}%</span>
                  <span>{m.score} 分</span>
                </div>
              </div>
            ))}
          </div>
          {team.recentStates.length > 0 && (
            <div className="mt-2 pt-2 border-t border-muted">
              <div className="text-[11px] text-muted-foreground/70 mb-1">
                最近狀態同步（{team.recentStates.length} 條）
              </div>
              <div className="space-y-0.5">
                {team.recentStates.slice(0, 3).map((rs, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground font-mono">
                    {rs.component_type} v{rs.version}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
