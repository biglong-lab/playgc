// 🆘 排解中心 — 遊戲重置（2026-05-19 Phase C）
//
// 業主使用情境：客人玩遊戲中途出狀況（斷網、卡 bug、家長中斷）
// → 現場讓他重新來一次、必填原因 + 留紀錄
//
// 流程：
// 1. 輸入 session ID（或之後加掃 QR / 搜尋）
// 2. 顯示玩家資訊 + 目前進度
// 3. 輸入重置原因（≥ 10 字）
// 4. 二段確認 → 完成

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface SessionLookup {
  session: {
    id: string;
    gameId: string | null;
    teamName: string | null;
    playerName: string | null;
    status: string;
    score: number;
    currentChapterId: string | null;
    startedAt: string;
    completedAt: string | null;
    resetCount: number;
    resetHistory: ResetEntry[];
  };
  game: { id: string; name: string; fieldId: string | null } | null;
  players: Array<{
    id: string;
    userId: string | null;
    currentPageId: string | null;
    score: number;
    updatedAt: string;
  }>;
}

interface ResetEntry {
  at: string;
  byAdminId: string;
  byAdminName?: string | null;
  reason: string;
  fromChapterId?: string | null;
  fromScore: number;
  fromStatus: string;
}

export default function TroubleshootReset() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [sessionIdInput, setSessionIdInput] = useState("");
  const [lookup, setLookup] = useState<SessionLookup | null>(null);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const searchMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await fetchWithAdminAuth(`/api/admin/sessions/${encodeURIComponent(id.trim())}/lookup`)) as SessionLookup;
    },
    onSuccess: (data) => {
      setLookup(data);
      setReason("");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "查無此場次";
      toast({ variant: "destructive", title: "查詢失敗", description: msg });
      setLookup(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!lookup) throw new Error("尚未查到場次");
      return await fetchWithAdminAuth(`/api/admin/sessions/${lookup.session.id}/reset`, {
        method: "POST",
        body: JSON.stringify({ reason, notifyPlayers: false }),
      });
    },
    onSuccess: () => {
      toast({ title: "✅ 場次已重置", description: "玩家可重新開始" });
      setConfirmOpen(false);
      // 重抓 lookup 顯示新狀態
      if (lookup) searchMutation.mutate(lookup.session.id);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "重置失敗";
      toast({ variant: "destructive", title: "重置失敗", description: msg });
    },
  });

  const reasonValid = reason.trim().length >= 10;

  return (
    <UnifiedAdminLayout title="🆘 遊戲重置">
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin/troubleshoot")} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" />
          回排解中心
        </Button>

        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="w-5 h-5 text-red-600" />
              重置玩家遊戲（出狀況可重新來一次）
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              玩家斷網、卡 bug、家長中斷 → 重置後玩家可從頭開始。必填原因、會留 audit 軌跡。
            </p>
          </CardHeader>
        </Card>

        {/* 步驟 1：搜尋 session */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <Label htmlFor="session-input">場次 ID（從玩家裝置 / Dashboard 看）</Label>
            <div className="flex gap-2">
              <Input
                id="session-input"
                value={sessionIdInput}
                onChange={(e) => setSessionIdInput(e.target.value)}
                placeholder="貼上 session UUID..."
                className="font-mono text-sm"
              />
              <Button
                onClick={() => sessionIdInput.trim() && searchMutation.mutate(sessionIdInput)}
                disabled={!sessionIdInput.trim() || searchMutation.isPending}
              >
                {searchMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="ml-1">查詢</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              提示：可從 /admin/sessions 或玩家手機畫面右下角找到場次 ID
            </p>
          </CardContent>
        </Card>

        {/* 步驟 2：場次資訊 + 重置表單 */}
        {lookup && <SessionDetailCard lookup={lookup} />}

        {lookup && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                重置原因（必填、≥ 10 字）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例：客人手機斷網、進度卡住、無法繼續遊戲"
                rows={3}
                className="resize-none"
              />
              <div className="flex items-center justify-between text-xs">
                <span className={reasonValid ? "text-green-600" : "text-muted-foreground"}>
                  {reason.trim().length}/10+ 字
                </span>
                <span className="text-muted-foreground">會寫進 audit_logs + reset_history</span>
              </div>
              <Button
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={!reasonValid}
                onClick={() => setConfirmOpen(true)}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                準備重置
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 重置歷史 */}
        {lookup && lookup.session.resetHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">過去重置紀錄（{lookup.session.resetCount} 次）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...lookup.session.resetHistory].reverse().map((entry, i) => (
                <div
                  key={i}
                  className="text-xs border-l-2 border-red-300 dark:border-red-700 pl-2 py-1 space-y-0.5"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(entry.at).toLocaleString("zh-TW")}
                    <span>·</span>
                    <User className="w-3 h-3" />
                    {entry.byAdminName ?? entry.byAdminId}
                  </div>
                  <div className="text-foreground">{entry.reason}</div>
                  <div className="text-muted-foreground">
                    原狀態：{entry.fromStatus} / 分數 {entry.fromScore}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 二段確認 dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                確認重置場次？
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>此動作會：</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>清空所有玩家進度（無法復原）</li>
                <li>場次狀態回到 playing、分數歸零</li>
                <li>留下 audit 紀錄 + 你的 admin ID + 原因</li>
              </ul>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 px-3 py-2 rounded text-xs">
                <p className="font-semibold mb-1">原因：</p>
                <p>{reason}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                取消
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                確認重置
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UnifiedAdminLayout>
  );
}

function SessionDetailCard({ lookup }: { lookup: SessionLookup }) {
  const s = lookup.session;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          找到場次
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <Kv label="遊戲" value={lookup.game?.name ?? "—"} />
          <Kv label="場域" value={lookup.game?.fieldId ?? "—"} />
          <Kv label="隊伍" value={s.teamName ?? "—"} />
          <Kv label="玩家名" value={s.playerName ?? "—"} />
          <Kv
            label="狀態"
            value={
              <Badge variant={s.status === "playing" ? "default" : "secondary"}>{s.status}</Badge>
            }
          />
          <Kv label="分數" value={String(s.score)} />
          <Kv label="開始時間" value={new Date(s.startedAt).toLocaleString("zh-TW")} />
          <Kv
            label="當前章節"
            value={s.currentChapterId ? <code className="text-xs">{s.currentChapterId.slice(0, 8)}…</code> : "—"}
          />
        </div>
        {s.resetCount > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 px-3 py-2 rounded text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
            <span>此場次已重置過 {s.resetCount} 次（見下方歷史）</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground">玩家進度：{lookup.players.length} 筆</div>
      </CardContent>
    </Card>
  );
}

function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
