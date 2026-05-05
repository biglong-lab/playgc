// 🧪 DevTools — admin 開發者工具：模擬玩家管理（多用戶測試）
//
// 路徑：/admin/dev-tools
// 用途：admin 建立 / 列出 / 刪除 / impersonate 測試玩家、用 1 台電腦模擬多人遊戲測試
//
// 2026-05-05 重做（A+B+C）：
//   A. cascade 刪除（server 端清關聯）
//   B. per-admin 隔離（每位 admin 各自有自己的 10 個玩家）
//   C. 自動場域綁定（建立時 INSERT field_membership 進該 admin 場域）

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Loader2, Plus, Trash2, ExternalLink, FlaskConical, Users, MapPin,
} from "lucide-react";

interface TestPlayer {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

interface ListResponse {
  players: TestPlayer[];
  adminShortId?: string;
  fieldId?: string;
  fieldName?: string;
}

export default function DevTools() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [count, setCount] = useState(3);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/admin/dev-tools/test-players"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dev-tools/test-players");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (n: number) => {
      const res = await apiRequest("POST", "/api/admin/dev-tools/test-players", { count: n });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ 測試玩家已建立",
        description: data.fieldName
          ? `${data.totalCreated} 個玩家、已加入「${data.fieldName}」場域`
          : `${data.totalCreated} 個玩家就緒`,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/dev-tools/test-players"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "建立失敗";
      toast({ title: "建立失敗", description: msg, variant: "destructive" });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/dev-tools/impersonate-test-player/${userId}`,
      );
      return res.json();
    },
    onSuccess: (data) => {
      const url = `${window.location.origin}/test-impersonate?token=${encodeURIComponent(data.customToken)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      toast({
        title: "🚀 已開啟新分頁",
        description: `${data.email} 將自動登入、進首頁`,
      });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Impersonate 失敗";
      toast({ title: "Impersonate 失敗", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/dev-tools/test-players/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "🗑 已刪除" });
      qc.invalidateQueries({ queryKey: ["/api/admin/dev-tools/test-players"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "刪除失敗";
      toast({ title: "刪除失敗", description: msg, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/admin/dev-tools/test-players");
      return res.json();
    },
    onSuccess: (data) => {
      const failedCount = data.failed?.length ?? 0;
      toast({
        title: failedCount === 0 ? "🧹 已全部清空" : "⚠️ 部分清除失敗",
        description: `成功 ${data.deletedCount}/${data.totalRequested}${failedCount > 0 ? `、失敗 ${failedCount}` : ""}`,
        variant: failedCount === 0 ? "default" : "destructive",
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/dev-tools/test-players"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "全清失敗";
      toast({ title: "全清失敗", description: msg, variant: "destructive" });
    },
  });

  const players = data?.players ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon" data-testid="btn-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <FlaskConical className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-display font-bold text-lg">開發者工具</h1>
            <p className="text-xs text-muted-foreground">模擬玩家、多用戶測試</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 max-w-2xl space-y-4">
        {/* 你的場域提示卡 — 玩家會自動加入這個場域 */}
        {data?.fieldName && (
          <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50">
            <CardContent className="p-3 flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-blue-900 dark:text-blue-100">
                建立的測試玩家會自動加入：
                <span className="font-semibold ml-1">{data.fieldName}</span>
              </span>
            </CardContent>
          </Card>
        )}

        {/* 說明卡 */}
        <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 text-sm space-y-2">
            <div className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <Users className="w-4 h-4" /> 怎麼用
            </div>
            <ol className="text-xs text-amber-800 dark:text-amber-200 space-y-1 list-decimal pl-4">
              <li>輸入想建立的玩家數（最多 10）→ 點「建立」</li>
              <li>玩家會自動加入你的場域、可直接玩你場域的遊戲</li>
              <li>列表中每個玩家有「以此玩家身份開新分頁」按鈕</li>
              <li>建議用 incognito（無痕）視窗開、避免 cookie 衝突</li>
              <li>用 1 台電腦開 N 個 incognito 視窗 = 模擬 N 人多人遊戲</li>
              <li>測試完可一鍵全清（清關聯資料、不再被外鍵擋）</li>
              <li>每位 admin 有自己的測試玩家池、互不干擾</li>
            </ol>
          </CardContent>
        </Card>

        {/* 建立區 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">建立測試玩家</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                min={1}
                max={10}
                className="w-24"
                data-testid="input-count"
              />
              <span className="text-sm text-muted-foreground">個（最多 10）</span>
              <Button
                onClick={() => createMutation.mutate(count)}
                disabled={createMutation.isPending}
                className="ml-auto gap-2"
                data-testid="btn-create"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                建立
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              已存在的測試玩家不會重建、只會補到指定數量
            </p>
          </CardContent>
        </Card>

        {/* 玩家列表 */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              我的測試玩家（{players.length}）
            </CardTitle>
            {players.length > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm(`確定刪除你的全部 ${players.length} 個測試玩家？\n會自動清除所有遊戲紀錄、隊伍、互動資料、無法復原`)) {
                    bulkDeleteMutation.mutate();
                  }
                }}
                disabled={bulkDeleteMutation.isPending}
                className="gap-1.5"
                data-testid="btn-bulk-delete"
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                一鍵全清
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : players.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                還沒有測試玩家、上方點「建立」開始
              </p>
            ) : (
              <div className="space-y-2">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-3 rounded-lg border bg-card"
                    data-testid={`player-row-${p.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{p.displayName}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => impersonateMutation.mutate(p.id)}
                      disabled={impersonateMutation.isPending}
                      className="gap-1.5"
                      data-testid={`btn-impersonate-${p.id}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      開新分頁
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`確定刪除「${p.displayName}」？此動作不可復原（會清關聯資料）`)) {
                          deleteMutation.mutate(p.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`btn-delete-${p.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 安全提示 */}
        <Card className="bg-muted/30">
          <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
            <p>🔒 安全：每位 admin 有獨立的測試玩家池（email pattern：testN-yourId@test.local）</p>
            <p>🗺 場域：建立時自動加入你的場域、可直接測場域內的遊戲流程</p>
            <p>🧹 清理：刪除會自動清關聯（隊伍、Squad、Battle、互動紀錄、不再被外鍵擋）</p>
            <p>📦 customToken 1 小時有效、過期再點一次「開新分頁」即可</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
