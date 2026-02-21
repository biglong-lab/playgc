import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GameSession, Game } from "@shared/schema";
import {
  Search, Filter, Users, Clock, Play, Square, Eye,
  RefreshCw, AlertTriangle, CheckCircle, Trash2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";

export default function AdminSessions() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<GameSession | null>(null);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  const { data: sessions = [], isLoading, refetch } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
    refetchInterval: 10000,
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest("PATCH", `/api/sessions/${sessionId}`, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "場次已結束" });
      setSelectedSession(null);
    },
    onError: () => {
      toast({ title: "操作失敗", variant: "destructive" });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async (thresholdHours: number) => {
      const res = await apiRequest("POST", "/api/admin/sessions/cleanup", { thresholdHours });
      return res.json() as Promise<{ count: number; message: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: data.message });
      setShowCleanupConfirm(false);
    },
    onError: () => {
      toast({ title: "清理失敗", variant: "destructive" });
    },
  });

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = !searchTerm || 
      session.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.gameId && session.gameId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (session.teamName && session.teamName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || session.status === statusFilter;
    const matchesGame = gameFilter === "all" || session.gameId === gameFilter;
    
    return matchesSearch && matchesStatus && matchesGame;
  });

  const activeSessions = sessions.filter(s => s.status === "playing").length;
  const completedSessions = sessions.filter(s => s.status === "completed").length;
  const abandonedSessions = sessions.filter(s => s.status === "abandoned").length;

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

  const getGameTitle = (gameId: string | null) => {
    if (!gameId) return "未知遊戲";
    const game = games.find(g => g.id === gameId);
    return game?.title || gameId;
  };

  return (
    <AdminLayout 
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">進行中</p>
                  <p className="font-number text-3xl font-bold text-success">{activeSessions}</p>
                </div>
                <Play className="w-8 h-8 text-success/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已完成</p>
                  <p className="font-number text-3xl font-bold">{completedSessions}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已放棄</p>
                  <p className="font-number text-3xl font-bold text-destructive">{abandonedSessions}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">總場次</p>
                  <p className="font-number text-3xl font-bold">{sessions.length}</p>
                </div>
                <Users className="w-8 h-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋場次 ID、遊戲或隊伍..."
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
              {games.map(game => (
                <SelectItem key={game.id} value={game.id}>{game.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => (
              <Card 
                key={session.id} 
                className="cursor-pointer hover-elevate transition-all"
                onClick={() => setSelectedSession(session)}
                data-testid={`card-session-${session.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{getGameTitle(session.gameId)}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {session.id.slice(0, 8)}...
                      </p>
                    </div>
                    {getStatusBadge(session.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
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

                    {session.status === "playing" && (
                      <Progress value={50} className="h-2" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">沒有符合條件的場次</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              場次詳情
            </DialogTitle>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">狀態</span>
                {getStatusBadge(selectedSession.status)}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">場次 ID</span>
                  <span className="font-mono text-xs">{selectedSession.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">遊戲</span>
                  <span>{getGameTitle(selectedSession.gameId)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">隊伍名稱</span>
                  <span>{selectedSession.teamName || "無"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">玩家數</span>
                  <span className="font-number">{selectedSession.playerCount || 1}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">開始時間</span>
                  <span>{selectedSession.startedAt ? new Date(selectedSession.startedAt).toLocaleString("zh-TW") : "N/A"}</span>
                </div>
                {selectedSession.completedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">結束時間</span>
                    <span>{new Date(selectedSession.completedAt).toLocaleString("zh-TW")}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">累積分數</span>
                  <span className="font-number font-bold text-primary">{selectedSession.score || 0} 分</span>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">關閉</Button>
            </DialogClose>
            {selectedSession?.status === "playing" && (
              <Button 
                variant="destructive"
                onClick={() => endSessionMutation.mutate(selectedSession.id)}
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
    </AdminLayout>
  );
}
