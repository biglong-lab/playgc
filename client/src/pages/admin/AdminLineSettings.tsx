// 🔗 AdminLineSettings — per-field LINE channel 設定頁（2026-05-17）
//
// 業主每館獨立 LINE Bot / LIFF 設定
// 對應端點：GET/PATCH /api/admin/line-config
//
// 業主操作流程：
//   1. 到 LINE Developers Console 建 Messaging API channel + LIFF app
//   2. 複製 Channel ID / Secret / Access Token / LIFF ID
//   3. 此頁面貼上儲存
//   4. Webhook URL（本頁顯示）貼回 LINE Console
//   5. 啟用開關打開、即可開始 per-field LINE 通知

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copy, Check, ExternalLink, AlertTriangle, MessageCircle, Save, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface LineConfigResponse {
  fieldId: string;
  fieldCode: string;
  fieldName: string;
  lineChannelId: string;
  hasLineChannelSecret: boolean;
  lineChannelSecretMasked: string;
  hasLineChannelAccessToken: boolean;
  lineChannelAccessTokenMasked: string;
  lineLiffId: string;
  lineEnabled: boolean;
}

export default function AdminLineSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // 載入當前設定
  const { data, isLoading, refetch } = useQuery<LineConfigResponse>({
    queryKey: ["admin-line-config"],
    queryFn: async () => await fetchWithAdminAuth("/api/admin/line-config"),
  });

  // 表單 state（local）
  const [channelId, setChannelId] = useState("");
  const [channelSecret, setChannelSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [liffId, setLiffId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [editingSecret, setEditingSecret] = useState(false);
  const [editingToken, setEditingToken] = useState(false);

  // data 載入時同步到 form
  useEffect(() => {
    if (!data) return;
    setChannelId(data.lineChannelId);
    setLiffId(data.lineLiffId);
    setEnabled(data.lineEnabled);
    setChannelSecret("");
    setAccessToken("");
    setEditingSecret(false);
    setEditingToken(false);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {
        lineChannelId: channelId,
        lineLiffId: liffId,
        lineEnabled: enabled,
      };
      if (editingSecret && channelSecret) patch.lineChannelSecret = channelSecret;
      if (editingToken && accessToken) patch.lineChannelAccessToken = accessToken;
      await fetchWithAdminAuth("/api/admin/line-config", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: () => {
      toast({ title: "已儲存", description: "LINE 設定已更新" });
      qc.invalidateQueries({ queryKey: ["admin-line-config"] });
    },
    onError: (err) => {
      toast({
        title: "儲存失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/line/webhook`;

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
      toast({ title: "已複製 Webhook URL" });
    } catch {
      toast({ title: "複製失敗", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <UnifiedAdminLayout title="🔗 LINE 設定">
        <Card><CardContent className="p-6">載入中…</CardContent></Card>
      </UnifiedAdminLayout>
    );
  }

  if (!data) {
    return (
      <UnifiedAdminLayout title="🔗 LINE 設定">
        <Card className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30">
          <CardContent className="p-4 flex gap-3" role="status" aria-live="polite">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">無法載入 LINE 設定</p>
              <p className="text-sm text-muted-foreground">admin 帳號可能未綁定場域、或網路錯誤</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>重新載入</Button>
            </div>
          </CardContent>
        </Card>
      </UnifiedAdminLayout>
    );
  }

  return (
    <UnifiedAdminLayout title={`🔗 LINE 設定 · ${data.fieldName}`}>
      <div className="space-y-4 max-w-3xl">
        {/* 開通狀態 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" aria-hidden="true" />
              LINE 通知開關
            </CardTitle>
            <CardDescription>
              此場域 <strong>{data.fieldName}</strong>（代碼 {data.fieldCode}）的 LINE Bot / LIFF 啟用狀態
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">啟用此場域 LINE 功能</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  關閉後：所有 LINE 推送、webhook、LIFF 都會 fallback 到全域 .env 設定
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                data-testid="switch-line-enabled"
                aria-label="啟用 LINE 功能"
              />
            </div>
          </CardContent>
        </Card>

        {/* Webhook URL（給業主到 LINE Console 設定）*/}
        <Card>
          <CardHeader>
            <CardTitle>Webhook URL（貼到 LINE Console）</CardTitle>
            <CardDescription>到 LINE Developers Console → Messaging API → Webhook URL、貼上下方網址並啟用</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-sm" aria-label="Webhook URL" />
              <Button
                size="sm"
                variant="outline"
                onClick={copyWebhook}
                data-testid="btn-copy-webhook"
                aria-label={copiedWebhook ? "已複製" : "複製 Webhook URL"}
              >
                {copiedWebhook ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Channel 設定 */}
        <Card>
          <CardHeader>
            <CardTitle>Messaging API Channel</CardTitle>
            <CardDescription>
              到 <a className="underline" href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer">LINE Developers Console <ExternalLink className="w-3 h-3 inline" aria-hidden="true" /></a> 建立 Messaging API Channel 後複製貼上
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="line-channel-id">Channel ID</Label>
              <Input
                id="line-channel-id"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="例：1234567890"
                className="font-mono"
                data-testid="input-line-channel-id"
              />
            </div>

            <div>
              <Label htmlFor="line-channel-secret">Channel Secret</Label>
              {data.hasLineChannelSecret && !editingSecret ? (
                <div className="flex gap-2">
                  <Input value={data.lineChannelSecretMasked} readOnly className="font-mono" aria-label="Channel Secret（已遮罩）" />
                  <Button size="sm" variant="outline" onClick={() => setEditingSecret(true)} aria-label="編輯 Channel Secret">
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Input
                  id="line-channel-secret"
                  type="password"
                  value={channelSecret}
                  onChange={(e) => setChannelSecret(e.target.value)}
                  placeholder="貼上 32 字元 Channel Secret"
                  className="font-mono"
                  data-testid="input-line-channel-secret"
                />
              )}
            </div>

            <div>
              <Label htmlFor="line-access-token">Channel Access Token（長期）</Label>
              {data.hasLineChannelAccessToken && !editingToken ? (
                <div className="flex gap-2">
                  <Input value={data.lineChannelAccessTokenMasked} readOnly className="font-mono" aria-label="Access Token（已遮罩）" />
                  <Button size="sm" variant="outline" onClick={() => setEditingToken(true)} aria-label="編輯 Access Token">
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Input
                  id="line-access-token"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="貼上長期 Access Token"
                  className="font-mono"
                  data-testid="input-line-access-token"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* LIFF 設定 */}
        <Card>
          <CardHeader>
            <CardTitle>LIFF（LINE Front-end Framework）</CardTitle>
            <CardDescription>玩家從 LINE 進入時走 LIFF 自動帶 LINE 身份（用於預約 / 玩家入口）</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="line-liff-id">LIFF ID</Label>
            <Input
              id="line-liff-id"
              value={liffId}
              onChange={(e) => setLiffId(e.target.value)}
              placeholder="例：1234567890-abcdefgh"
              className="font-mono"
              data-testid="input-line-liff-id"
            />
            <p className="text-xs text-muted-foreground mt-2">
              到 LINE Developers Console → 你的 Channel → LIFF → 「Add」建立、Endpoint URL 設為 <code>{origin}/liff/book/{data.fieldCode}</code>
            </p>
          </CardContent>
        </Card>

        {/* 儲存按鈕 */}
        <div className="flex justify-end gap-2 sticky bottom-4 bg-background/95 backdrop-blur p-4 -mx-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => refetch()}
            data-testid="btn-reset"
            aria-label="放棄變更、重新載入"
          >
            <RotateCcw className="w-4 h-4 mr-1" aria-hidden="true" />
            放棄變更
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="btn-save-line-config"
            aria-label="儲存 LINE 設定"
          >
            <Save className="w-4 h-4 mr-1" aria-hidden="true" />
            {saveMutation.isPending ? "儲存中…" : "儲存設定"}
          </Button>
        </div>
      </div>
    </UnifiedAdminLayout>
  );
}
