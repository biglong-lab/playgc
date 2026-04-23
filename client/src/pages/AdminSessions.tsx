// 📋 場次管理 — 全系統場次 + 玩家帳號 + 遊戲資訊
//
// 改版：改呼叫 /api/admin/sessions（requireAdminAuth）
// 回傳格式：{ session, game, user }[]
// 可直接看到玩家 email/姓名/頭像，不再只是隊伍名

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { GridSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import type { GameSession, Game } from "@shared/schema";
import {
  Search, Filter, Users, Clock, Play, Square, Eye,
  RefreshCw, AlertTriangle, CheckCircle, Trash2, Mail, User as UserIcon,
  UserX,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  getPlayerDisplayName as getDisplayName,
  isAnonymousPlayer,
} from "@shared/lib/playerDisplay";

/** /api/admin/sessions 回傳格式 */
interface AdminSessionRow {
  session: GameSession;
  game: {
    id: string;
    title: string;
    fieldId: string | null;
  } | null;
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
}

/** 組合玩家顯示名稱 + 判斷是否為匿名 */
function getPlayerInfo(row: AdminSessionRow): { name: string; isAnon: boolean } {
  const source = {
    playerName: row.session.playerName,
    firstName: row.user?.firstName,
    lastName: row.user?.lastName,
    email: row.user?.email,
  };
  return {
    name: getDisplayName(source),
    isAnon: isAnonymousPlayer(source),
  };
}

export default function AdminSessions() {
  const { isAuthenticated } = useAdminAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [selectedRow, setSelectedRow] = useState<AdminSessionRow | null>(null);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  /** 🆕 改用 /api/admin/sessions 含玩家資訊 */
  const { data: rows = [], isLoading, refetch } = useQuery<AdminSessionRow[]>({
    queryKey: ["/api/admin/sessions", statusFilter, gameFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (gameFilter !== "all") params.set("gameId", gameFilter);
      params.set("limit", "200");
      return fetchWithAdminAuth(`/api/admin/sessions?${params.toString()}`);
    },
    refetchInterval: 10000,
    enabled: isAuthenticated,
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
    queryFn: () => fetchWithAdminAuth("/api/admin/games"),
    enabled: isAuthenticated,
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return fetchWithAdminAuth(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      toast({ title: "場次已結束" });
      setSelectedRow(null);
    },
    onError: () => {
      toast({ title: "操作失敗", variant: "destructive" });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async (thresholdHours: number) => {
      return fetchWithAdminAuth("/api/admin/sessions/cleanup", {
        method: "POST",
        body: JSON.stringify({ thresholdHours }),
      }) as Promise<{ count: number; message: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      toast({ title: data.message });
      setShowCleanupConfirm(false);
    },
    onError: () => {
      toast({ title: "清理失敗", variant: "destructive" });
    },
  });

  /** 前端再過濾搜尋關鍵字（狀態/遊戲已由後端過濾） */
  const filteredRows = rows.filter((r) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const playerName = getPlayerInfo(r).name.toLowerCase();
    return (
      r.session.id.toLowerCase().includes(q) ||
      (r.session.teamName || "").toLowerCase().includes(q) ||
      (r.game?.title || "").toLowerCase().includes(q) ||
      (r.user?.email || "").toLowerCase().includes(q) ||
      playerName.includes(q)
    );
  });

  const activeSessions = rows.filter((r) => r.session.status === "playing").length;
  const completedSessions = rows.filter((r) => r.session.status === "completed").length;
  const abandonedSessions = rows.filter((r) => r.session.status === "abandoned").length;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "playing":
        return <Badge className="bg-success gap-1"><Play className="w-3 h-3" /> 進行中</Badge>;
      case "completed":
        return <Badge variant="outline" className="gap-1"><CheckCircle className="w-3 h-3" /> 已完成</Badge>;
      case "abandoned":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> 已放棄</Badge>;
      default:
        return <Badge variant="outline">{status || "未知"}</Badge>;
    }
  };

  const formatTime = (date: Date | string | null) => {
    if (!date) return "N/A";
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhTW });
  };

  return (
    <UnifiedAdminLayout
      title="場次管理"
      actions={
        <div className="flex gap-2">
          {activeSessions > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowCleanupConfirm(true)}
              className="gap-1"
              data-testid="button-cleanup-sessions"
            >
              <Trash2 className="w-4 h-4" />
              清理卡住場次
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1"
            data-testid="button-refresh-sessions"
          >
            <RefreshCw className="w-4 h-4" />
            重新整理
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 統計卡 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="進行中"
            value={activeSessions}
            icon={<Play className="w-8 h-8 text-success/50" />}
            accent="text-success"
          />
          <StatCard
            label="已完成"
            value={completedSessions}
            icon={<CheckCircle className="w-8 h-8 text-muted-foreground/50" />}
          />
          <StatCard
            label="已放棄"
            value={abandonedSessions}
            icon={<AlertTriangle className="w-8 h-8 text-destructive/50" />}
            accent="text-destructive"
          />
          <StatCard
            label="總場次"
            value={rows.length}
            icon={<Users className="w-8 h-8 text-primary/50" />}
          />
        </div>

        {/* 篩選列 */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋 ID / 玩家 / email / 遊戲 / 隊伍..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-sessions"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40" data-testid="select-status-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="playing">進行中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="abandoned">已放棄</SelectItem>
            </SelectContent>
          </Select>

          <Select value={gameFilter} onValueChange={setGameFilter}>
            <SelectTrigger className="w-full md:w-48" data-testid="select-game-filter">
              <SelectValue placeholder="遊戲" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部遊戲</SelectItem>
              {games.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 場次卡片清單 */}
        {isLoading ? (
          <GridSkeleton count={6} cols={3} />
        ) : filteredRows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRows.map((row) => (
              <SessionCard
                key={row.session.id}
                row={row}
                onClick={() => setSelectedRow(row)}
                statusBadge={getStatusBadge(row.session.status)}
                formatTime={formatTime}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="沒有符合條件的場次"
            description="改變上方篩選條件或等玩家開始新場次"
          />
        )}
      </div>

      {/* 場次詳細對話框 */}
      <Dialog open={!!selectedRow} onOpenChange={() => setSelectedRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              場次詳情
            </DialogTitle>
          </DialogHeader>

          {selectedRow && (
            <div className="space-y-4">
              {/* 玩家資訊區塊 */}
              {(() => {
                const info = getPlayerInfo(selectedRow);
                return (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/40 border">
                    {selectedRow.user?.profileImageUrl ? (
                      <img
                        src={selectedRow.user.profileImageUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {info.isAnon ? (
                          <UserX className="w-5 h-5 text-amber-500" />
                        ) : (
                          <UserIcon className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {info.name}
                        {info.isAnon && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 shrink-0">
                            匿名
                          </Badge>
                        )}
                      </div>
                      {selectedRow.user?.email && !selectedRow.user.email.endsWith("@firebase.local") && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3" />
                          {selectedRow.user.email}
                        </div>
                      )}
                      {info.isAnon && (
                        <div className="text-xs text-amber-600/80 mt-0.5">
                          ⚠️ 匿名遊玩，積分不累積到個人帳號
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">狀態</span>
                {getStatusBadge(selectedRow.session.status)}
              </div>

              <div className="space-y-2">
                <InfoRow label="場次 ID" value={<span className="font-mono text-xs">{selectedRow.session.id}</span>} />
                <InfoRow label="遊戲" value={selectedRow.game?.title || "未知遊戲"} />
                <InfoRow label="隊伍名稱" value={selectedRow.session.teamName || "無"} />
                <InfoRow label="玩家數" value={<span className="font-number">{selectedRow.session.playerCount || 1}</span>} />
                <InfoRow
                  label="開始時間"
                  value={selectedRow.session.startedAt ? new Date(selectedRow.session.startedAt).toLocaleString("zh-TW") : "N/A"}
                />
                {selectedRow.session.completedAt && (
                  <InfoRow
                    label="結束時間"
                    value={new Date(selectedRow.session.completedAt).toLocaleString("zh-TW")}
                  />
                )}
                <InfoRow
                  label="累積分數"
                  value={<span className="font-number font-bold text-primary">{selectedRow.session.score || 0} 分</span>}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">關閉</Button>
            </DialogClose>
            {selectedRow?.session.status === "playing" && (
              <Button
                variant="destructive"
                onClick={() => endSessionMutation.mutate(selectedRow.session.id)}
                disabled={endSessionMutation.isPending}
                data-testid="button-end-session"
              >
                <Square className="w-4 h-4 mr-1" />
                {endSessionMutation.isPending ? "處理中..." : "強制結束"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 清理對話框 */}
      <Dialog open={showCleanupConfirm} onOpenChange={setShowCleanupConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              清理卡住的場次
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            將所有超過 24 小時仍在「進行中」的場次標記為「已放棄」。
            目前有 <span className="font-bold text-foreground">{activeSessions}</span> 個進行中的場次。
          </p>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => cleanupMutation.mutate(24)}
              disabled={cleanupMutation.isPending}
              data-testid="button-confirm-cleanup"
            >
              {cleanupMutation.isPending ? "清理中..." : "確認清理"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnifiedAdminLayout>
  );
}

// ──────────────────────────────────────────────────────────────
// 子元件
// ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`font-number text-3xl font-bold ${accent || ""}`}>{value}</p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function SessionCard({
  row,
  onClick,
  statusBadge,
  formatTime,
}: {
  row: AdminSessionRow;
  onClick: () => void;
  statusBadge: React.ReactNode;
  formatTime: (d: Date | string | null) => string;
}) {
  const { session, game, user } = row;
  const info = getPlayerInfo(row);

  return (
    <Card
      className="cursor-pointer hover-elevate transition-all"
      onClick={onClick}
      data-testid={`card-session-${session.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{game?.title || "未知遊戲"}</CardTitle>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {session.id.slice(0, 8)}...
            </p>
          </div>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* 🆕 玩家頭像 + 名字 + 匿名徽章 */}
          <div className="flex items-center gap-2 pb-2 border-b">
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${info.isAnon ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"}`}>
                {info.isAnon ? (
                  <UserX className="w-4 h-4 text-amber-500" />
                ) : (
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate flex items-center gap-1">
                {info.name}
                {info.isAnon && (
                  <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-600 shrink-0" title="匿名遊玩">匿</span>
                )}
              </div>
              {user?.email && !user.email.endsWith("@firebase.local") && (
                <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              )}
            </div>
          </div>

          {session.teamName && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> 隊伍
              </span>
              <span className="truncate max-w-[120px]">{session.teamName}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> 開始時間
            </span>
            <span>{formatTime(session.startedAt)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> 玩家數
            </span>
            <span className="font-number">{session.playerCount || 1}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">分數</span>
            <span className="font-number font-bold text-primary">{session.score || 0}</span>
          </div>

          {session.status === "playing" && <Progress value={50} className="h-2" />}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
