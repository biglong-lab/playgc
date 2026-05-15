// 🔌 PlayerHistoryDialog — cross-session 連線歷史（從 AdminMultiSessions 抽出 / 2026-05-16）
//
// 抽檔原因：AdminMultiSessions.tsx 1129 行破 800 紅線、本 dialog 與型別 167 行可獨立
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (C)

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, Loader2 } from "lucide-react";
import { format } from "date-fns";

export interface PlayerHistorySession {
  sessionId: string;
  gameTitle: string;
  startedAt: string | null;
  status: string | null;
  connectCount: number;
  closeCount: number;
  reconnectCount: number;
  graceExpired: number;
  autoLeave: number;
  error: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
  uniqueIps: string[];
}

export interface PlayerHistoryResponse {
  userId: string;
  windowDays: number;
  totalSessions: number;
  totalConnects: number;
  totalReconnects: number;
  totalGraceExpired: number;
  totalAutoLeaves: number;
  totalErrors: number;
  sessions: PlayerHistorySession[];
}

export function PlayerHistoryDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useQuery<PlayerHistoryResponse>({
    queryKey: ["/api/admin/players/history", userId, days],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/players/${userId}/connection-history?days=${days}`);
      return res.json();
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            玩家連線歷史 — {userName}
          </DialogTitle>
          <DialogDescription>
            <code className="text-xs">{userId}</code>
            <span className="ml-3">
              查詢範圍：
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger className="inline-flex w-24 h-7 mx-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 天</SelectItem>
                  <SelectItem value="7">7 天</SelectItem>
                  <SelectItem value="30">30 天</SelectItem>
                  <SelectItem value="90">90 天</SelectItem>
                </SelectContent>
              </Select>
            </span>
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && data && (
          <div className="space-y-4">
            {/* 總計 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <Card>
                <CardContent className="py-2">
                  <div className="text-[10px] text-muted-foreground">參與場次</div>
                  <div className="text-lg font-bold">{data.totalSessions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-2">
                  <div className="text-[10px] text-muted-foreground">總連線</div>
                  <div className="text-lg font-bold">{data.totalConnects}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-2">
                  <div className="text-[10px] text-muted-foreground text-amber-600">總重連</div>
                  <div className="text-lg font-bold text-amber-600">{data.totalReconnects}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-2">
                  <div className="text-[10px] text-muted-foreground text-orange-600">grace 觸發</div>
                  <div className="text-lg font-bold text-orange-600">{data.totalGraceExpired}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-2">
                  <div className="text-[10px] text-muted-foreground text-destructive">auto-leave</div>
                  <div className="text-lg font-bold text-destructive">{data.totalAutoLeaves}</div>
                </CardContent>
              </Card>
            </div>

            {/* 場次清單 */}
            {data.sessions.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">過去 {days} 天無連線紀錄</p>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">場次清單（按時間倒序）：</div>
                {data.sessions.map((s) => (
                  <div key={s.sessionId} className="border rounded-md p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium">{s.gameTitle}</div>
                      <Link href={`/admin/sessions/${s.sessionId}/replay`}>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]">
                          <History className="w-3 h-3 mr-1" />
                          Replay
                        </Button>
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span>
                        {s.firstEventAt && format(new Date(s.firstEventAt), "MM/dd HH:mm")}
                      </span>
                      <span>連線 {s.connectCount}</span>
                      {s.reconnectCount > 0 && (
                        <span className="text-amber-600">重連 {s.reconnectCount}</span>
                      )}
                      {s.graceExpired > 0 && (
                        <span className="text-orange-600">grace {s.graceExpired}</span>
                      )}
                      {s.autoLeave > 0 && (
                        <span className="text-destructive">auto-leave {s.autoLeave}</span>
                      )}
                      {s.uniqueIps.length > 1 && (
                        <span title={s.uniqueIps.join(", ")}>{s.uniqueIps.length} 個 IP</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
