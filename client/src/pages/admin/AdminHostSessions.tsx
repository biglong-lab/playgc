// 📺 AdminHostSessions — 主控大螢幕 session 管理（W2 D5）
//
// 設計依據：docs/decisions/0004-host-screen-axis.md
// 路徑：/admin/host-sessions
//
// 用途：
//   - 列出我場域目前所有 active host sessions
//   - 建立新 session（選 game → 簽 12h hostToken）
//   - 複製大螢幕網址（含 token）+ 玩家網址
//   - 結束 session

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tv, Plus, Copy, X, Loader2, ExternalLink, Smartphone, Printer } from "lucide-react";

interface HostSessionItem {
  sessionId: string;
  gameId: string;
  gameTitle: string;
  startedAt: string;
  expiresAt: string;
  hostUrl: string;
  playUrl: string;
}

interface AdminGame {
  id: string;
  title: string;
  fieldId: string | null;
  status: string | null;
  editorMode?: "game" | "activity" | null;
  description?: string | null;
}

export default function AdminHostSessions() {
  const { admin } = useAdminAuth({ redirectTo: "/admin/login" });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [createdInfo, setCreatedInfo] = useState<{
    hostFullUrl: string;
    playFullUrl: string;
    expiresAt: string;
  } | null>(null);

  // 列現有 active sessions
  const { data, isLoading } = useQuery<{ sessions: HostSessionItem[] }>({
    queryKey: ["/api/admin/host-sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/host-sessions");
      return res.json();
    },
    enabled: !!admin,
  });

  // 列 admin 場域可用的 games
  const { data: gamesData } = useQuery<AdminGame[]>({
    queryKey: ["/api/admin/games"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/games");
      const json = await res.json();
      return json.games ?? json;
    },
    enabled: !!admin,
  });

  // 建 session
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/host-sessions", {
        gameId: selectedGameId,
      });
      return res.json();
    },
    onSuccess: (data: {
      sessionId: string;
      hostToken: string;
      expiresAt: string;
      hostUrl: string;
      playUrl: string;
    }) => {
      toast({ title: "✅ Host session 已建立" });
      const origin = window.location.origin;
      setCreatedInfo({
        hostFullUrl: `${origin}${data.hostUrl}`,
        playFullUrl: `${origin}${data.playUrl}`,
        expiresAt: data.expiresAt,
      });
      setSelectedGameId("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/host-sessions"] });
    },
    onError: (err: Error) => {
      toast({ title: "建立失敗", description: err.message, variant: "destructive" });
    },
  });

  // 結束 session
  const endMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/admin/host-sessions/${sessionId}/end`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Session 已結束" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/host-sessions"] });
    },
    onError: (err: Error) => {
      toast({ title: "結束失敗", description: err.message, variant: "destructive" });
    },
  });

  /**
   * 開啟 QR 列印頁，傳入給定的 sessions
   * 使用與 TemplateMarketDetail 相同的 base64 格式
   */
  const openPrintPage = (
    targetSessions: Array<{
      sessionId: string;
      gameTitle: string;
      hostUrl: string;
      playUrl: string;
    }>,
    displayName: string,
  ) => {
    const printData = {
      displayName,
      instances: targetSessions.map((s) => ({
        axis: "host" as const,
        label: s.gameTitle,
        pageType: "host_session",
        hostUrl: s.hostUrl,
        playUrl: s.playUrl,
      })),
    };
    const json = JSON.stringify(printData);
    const base64 = btoa(unescape(encodeURIComponent(json)));
    window.open(`/admin/scenario-qr-print?data=${encodeURIComponent(base64)}`, "_blank");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} 已複製`, duration: 2000 });
  };

  const sessions = data?.sessions ?? [];
  // 🆕 軟分流階段 1：只顯示 editorMode='activity' 的 game（host session 專用）
  // 排除 SCENARIO 實例（已透過 instantiate 自動建好 session、不需手動再建）
  const games = (gamesData ?? []).filter((g) => {
    if (g.editorMode !== "activity") return false;
    if (g.description?.includes("[scenario:")) return false;
    return true;
  });

  return (
    <UnifiedAdminLayout title="📺 主控大螢幕 Sessions">
      <div className="space-y-6">
        {/* 建立新 session */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> 建立新 Session
            </CardTitle>
            <CardDescription>
              選一個「🎉 活動」mode 的遊戲、系統簽發 12 小時有效的大螢幕網址。
              <br />
              <span className="text-xs text-muted-foreground">
                🆕 軟分流階段 1：只列出 editorMode='activity' 的遊戲（路線 II/III、玩家匿名）
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3 items-center">
            <Select value={selectedGameId} onValueChange={setSelectedGameId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="選擇遊戲" />
              </SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!selectedGameId || createMutation.isPending}
              data-testid="btn-create-host-session"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1" />
              )}
              建立
            </Button>
          </CardContent>
        </Card>

        {/* 現有 active sessions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <Tv className="w-5 h-5" /> 進行中 Sessions
                <Badge variant="outline">{sessions.length}</Badge>
              </CardTitle>
              {sessions.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openPrintPage(
                      sessions,
                      `所有進行中場次（${sessions.length} 個）`,
                    )
                  }
                  data-testid="btn-print-all-sessions"
                >
                  <Printer className="w-4 h-4 mr-1" />
                  列印全部 QR
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">載入中...</p>
            )}
            {!isLoading && sessions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                目前沒有進行中的主控 session
              </p>
            )}
            <div className="space-y-3">
              {sessions.map((s) => {
                const origin = window.location.origin;
                const hostFullUrl = `${origin}${s.hostUrl}`;
                const playFullUrl = `${origin}${s.playUrl}`;
                const expiresAt = new Date(s.expiresAt);
                const remainingHours = Math.max(
                  0,
                  Math.floor((expiresAt.getTime() - Date.now()) / (60 * 60 * 1000)),
                );

                return (
                  <div
                    key={s.sessionId}
                    className="border rounded-lg p-4 space-y-3"
                    data-testid={`host-session-${s.sessionId}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{s.gameTitle}</h3>
                        <p className="text-xs text-muted-foreground">
                          Session {s.sessionId.slice(0, 8)} · 剩餘 {remainingHours} 小時
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openPrintPage([s], s.gameTitle)}
                          data-testid={`btn-print-session-${s.sessionId}`}
                          title="列印 QR"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => endMutation.mutate(s.sessionId)}
                          data-testid={`btn-end-session-${s.sessionId}`}
                          title="結束場次"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="bg-zinc-900/5 dark:bg-zinc-900/40 rounded p-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Tv className="w-3 h-3" /> 大螢幕網址（投影機開）
                        </div>
                        <code className="text-xs break-all block">{hostFullUrl}</code>
                        <div className="flex gap-1 mt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 flex-1"
                            onClick={() => copyToClipboard(hostFullUrl, "大螢幕網址")}
                          >
                            <Copy className="w-3 h-3 mr-1" /> 複製
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => window.open(hostFullUrl, "_blank")}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="bg-zinc-900/5 dark:bg-zinc-900/40 rounded p-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Smartphone className="w-3 h-3" /> 玩家網址（QR / 連結）
                        </div>
                        <code className="text-xs break-all block">{playFullUrl}</code>
                        <div className="flex gap-1 mt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 flex-1"
                            onClick={() => copyToClipboard(playFullUrl, "玩家網址")}
                          >
                            <Copy className="w-3 h-3 mr-1" /> 複製
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => window.open(playFullUrl, "_blank")}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 說明卡 */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p>📺 大螢幕端：投影機 / 大電視打開大螢幕網址（無需登入，token 即身份）</p>
            <p>📱 玩家端：發 QR / 連結給玩家（無需登入，匿名可加入）</p>
            <p>🔒 hostToken 12 小時過期，需重新建 session 取新網址</p>
            <p>🎮 遊戲必須有 host_* 頁面才會顯示主控元件（PollLive / EmojiReact 等）</p>
          </CardContent>
        </Card>
      </div>

      {/* 建立成功後彈出 dialog 顯示網址 */}
      <Dialog open={!!createdInfo} onOpenChange={(open) => !open && setCreatedInfo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>✅ Session 建立成功</DialogTitle>
            <DialogDescription>
              網址已生成（12 小時有效），請保存好分享給活動現場
            </DialogDescription>
          </DialogHeader>
          {createdInfo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Tv className="w-4 h-4" /> 大螢幕網址
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs break-all bg-muted p-2 rounded">
                    {createdInfo.hostFullUrl}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(createdInfo.hostFullUrl, "大螢幕網址")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Smartphone className="w-4 h-4" /> 玩家網址
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs break-all bg-muted p-2 rounded">
                    {createdInfo.playFullUrl}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(createdInfo.playFullUrl, "玩家網址")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                有效期：{new Date(createdInfo.expiresAt).toLocaleString("zh-TW")}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </UnifiedAdminLayout>
  );
}
