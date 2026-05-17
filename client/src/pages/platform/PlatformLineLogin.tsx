// 🔐 Platform LINE Login Config — 全平台 LINE Login channel 設定（2026-05-18）
//
// 業主操作流程：
//   1. 到 LINE Developers Console 建 LINE Login channel（注意：不是 Messaging API）
//   2. Callback URL 填 https://game.homi.cc/api/auth/line/callback
//   3. Scopes 勾 profile / openid / email
//   4. 複製 Channel ID / Channel Secret
//   5. 此頁面貼上儲存 → 打開啟用開關
//
// 保護：只有 platform admin（super admin）能改

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, MessageCircle, Save, RotateCcw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface LineLoginConfigResponse {
  channelId: string;
  hasChannelSecret: boolean;
  channelSecretMasked: string;
  callbackUrl: string;
  enabled: boolean;
  updatedAt: string | null;
}

export default function PlatformLineLogin() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<LineLoginConfigResponse>({
    queryKey: ["/api/platform/line-login-config"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/line-login-config")).json(),
  });

  const [channelId, setChannelId] = useState("");
  const [channelSecret, setChannelSecret] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [editingSecret, setEditingSecret] = useState(false);

  useEffect(() => {
    if (!data) return;
    setChannelId(data.channelId ?? "");
    setCallbackUrl(data.callbackUrl ?? "");
    setEnabled(!!data.enabled);
    setChannelSecret("");
    setEditingSecret(false);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        channelId: channelId.trim() || null,
        callbackUrl: callbackUrl.trim() || null,
        enabled,
      };
      if (channelSecret.trim()) body.channelSecret = channelSecret.trim();
      const res = await apiRequest("PATCH", "/api/platform/line-login-config", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "已儲存", description: "LINE Login 設定已更新" });
      qc.invalidateQueries({ queryKey: ["/api/platform/line-login-config"] });
      refetch();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "請重試";
      toast({ variant: "destructive", title: "儲存失敗", description: msg });
    },
  });

  if (isLoading) {
    return (
      <PlatformAdminLayout title="LINE Login 設定">
        <div className="text-sm text-muted-foreground">載入中...</div>
      </PlatformAdminLayout>
    );
  }

  return (
    <PlatformAdminLayout title="LINE Login 設定">
      {/* 說明卡 */}
      <Card className="mb-4 border-l-4 border-l-[#06C755]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-5 h-5 text-[#06C755]" />
            全平台 LINE Login（玩家身份識別）
          </CardTitle>
          <CardDescription>
            玩家用 LINE 帳號登入遊戲平台。所有場域共用一個 LINE Login channel。
            <br />
            ⚠️ 注意：這是 <strong>LINE Login channel</strong>，不是 Messaging API（推播是各館獨立）。
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 設定步驟 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">LINE Developers 設定步驟</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              到{" "}
              <a
                href="https://developers.line.biz/console/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                LINE Developers Console <ExternalLink className="w-3 h-3" />
              </a>
              建立 <strong>LINE Login channel</strong>（不是 Messaging API）
            </li>
            <li>App types 勾 <code className="px-1 bg-muted rounded">Web app</code></li>
            <li>
              Callback URL 填：
              <code className="px-1 bg-muted rounded block mt-1">
                https://game.homi.cc/api/auth/line/callback
              </code>
            </li>
            <li>Scopes 勾：<code className="px-1 bg-muted rounded">profile</code>、<code className="px-1 bg-muted rounded">openid</code>、<code className="px-1 bg-muted rounded">email</code></li>
            <li>從 Basic settings 複製 Channel ID + Channel Secret 貼到下面</li>
          </ol>
        </CardContent>
      </Card>

      {/* 設定表單 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channel 設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-id">Channel ID</Label>
            <Input
              id="channel-id"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="例：2008375094"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-secret">
              Channel Secret
              {data?.hasChannelSecret && !editingSecret && (
                <span className="ml-2 text-xs text-muted-foreground">
                  （已設定：{data.channelSecretMasked}）
                </span>
              )}
            </Label>
            {data?.hasChannelSecret && !editingSecret ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingSecret(true)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                更換 Secret
              </Button>
            ) : (
              <Input
                id="channel-secret"
                type="password"
                value={channelSecret}
                onChange={(e) => setChannelSecret(e.target.value)}
                placeholder="從 LINE Developers Basic settings 複製"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="callback-url">Callback URL</Label>
            <Input
              id="callback-url"
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              placeholder="https://game.homi.cc/api/auth/line/callback"
            />
            <p className="text-xs text-muted-foreground">
              這個值必須與 LINE Developers Console 的 Callback URL 完全一致
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div>
              <Label htmlFor="enabled" className="text-sm font-medium">
                啟用 LINE Login
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                打開後，登入頁會顯示「使用 LINE 登入」按鈕
              </p>
            </div>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {!data?.hasChannelSecret && !channelSecret && enabled && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
              <span>請先填 Channel Secret 才能啟用</span>
            </div>
          )}

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "儲存中..." : "儲存設定"}
          </Button>
        </CardContent>
      </Card>
    </PlatformAdminLayout>
  );
}
