// 📬 通訊中心 — 通道 / 模板 / 發送紀錄
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  Smartphone,
  MessageCircle,
  Send,
  Bell,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Channel {
  type: string;
  name: string;
  configured: boolean;
  envKeys: string[];
  description: string;
}

interface Template {
  id: string;
  templateKey: string;
  name: string;
  description: string | null;
  category: string;
  channels: string[];
  subject: string | null;
  body: string;
  variables: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationLog {
  id: string;
  templateKey: string | null;
  channel: string;
  recipient: string;
  subject: string | null;
  status: string;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  last_24h: number;
  last_7d: number;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  fcm: <Smartphone className="w-4 h-4" />,
  line: <MessageCircle className="w-4 h-4" />,
  telegram: <Send className="w-4 h-4" />,
  webpush: <Bell className="w-4 h-4" />,
};

export default function PlatformNotifications() {
  const { isAuthenticated } = useAdminAuth();
  const [tab, setTab] = useState("channels");

  return (
    <PlatformAdminLayout title="通訊中心">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="channels">通道狀態</TabsTrigger>
          <TabsTrigger value="templates">訊息模板</TabsTrigger>
          <TabsTrigger value="logs">發送紀錄</TabsTrigger>
        </TabsList>

        <TabsContent value="channels">
          <ChannelsView isAuthenticated={isAuthenticated} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesView isAuthenticated={isAuthenticated} />
        </TabsContent>
        <TabsContent value="logs">
          <LogsView isAuthenticated={isAuthenticated} />
        </TabsContent>
      </Tabs>
    </PlatformAdminLayout>
  );
}

// ────────────────────────────────────────
// 1. 通道狀態
// ────────────────────────────────────────
function ChannelsView({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { data, isLoading } = useQuery<{ channels: Channel[] }>({
    queryKey: ["/api/platform/notifications/channels"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/notifications/channels")).json(),
    enabled: isAuthenticated,
  });

  if (isLoading) return <ListSkeleton count={5} />;

  return (
    <div className="space-y-2">
      <Card className="border-l-4 border-l-blue-500 mb-3">
        <CardContent className="p-4 text-sm">
          <p className="font-semibold mb-1">📨 5 種通知通道</p>
          <p className="text-xs text-muted-foreground">
            修改通道配置請改 .env 環境變數，重啟 server 即生效。
          </p>
        </CardContent>
      </Card>

      {data?.channels.map((ch) => (
        <Card
          key={ch.type}
          className={ch.configured ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-amber-500"}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              {CHANNEL_ICONS[ch.type] ?? <Bell className="w-4 h-4" />}
              <div className="flex-1">
                <div className="font-semibold">{ch.name}</div>
                <div className="text-xs text-muted-foreground">{ch.description}</div>
              </div>
              {ch.configured ? (
                <Badge className="bg-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" />已配置</Badge>
              ) : (
                <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />未配置</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {ch.envKeys.map((key) => (
                <Badge key={key} variant="outline" className="text-[10px] font-mono">
                  {key}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ────────────────────────────────────────
// 2. 訊息模板
// ────────────────────────────────────────
function TemplatesView({ isAuthenticated }: { isAuthenticated: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Template | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<Template>>({});

  const { data, isLoading } = useQuery<{ items: Template[]; total: number }>({
    queryKey: ["/api/platform/notifications/templates"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/notifications/templates")).json(),
    enabled: isAuthenticated,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return (await apiRequest("PATCH", `/api/platform/notifications/templates/${editing.id}`, form)).json();
      }
      return (await apiRequest("POST", "/api/platform/notifications/templates", form)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/notifications/templates"] });
      setEditing(null);
      setShowAdd(false);
      setForm({});
      toast({ title: "✅ 已儲存" });
    },
    onError: (err) => {
      toast({
        title: "儲存失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await apiRequest("DELETE", `/api/platform/notifications/templates/${id}`)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/notifications/templates"] });
      toast({ title: "已刪除" });
    },
  });

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({ ...t });
  };
  const openAdd = () => {
    setShowAdd(true);
    setEditing(null);
    setForm({ category: "general", channels: [], variables: [], enabled: true });
  };

  return (
    <div>
      <div className="flex justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {data?.total ?? 0} 個模板 · 用 {`{{變數}}`} 在 body 中標記替換點
        </p>
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> 新增模板
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : data?.items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            尚無模板。點「新增模板」建立常見通知範本（如帳號鎖定、計費警示等）
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data?.items.map((t) => (
            <Card key={t.id} className={t.enabled ? "" : "opacity-60"}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <code className="font-mono text-sm font-semibold">{t.templateKey}</code>
                  <Badge variant="outline">{t.category}</Badge>
                  {!t.enabled && <Badge variant="secondary">停用</Badge>}
                  <div className="flex gap-1 ml-auto">
                    {t.channels.map((ch) => (
                      <Badge key={ch} variant="default" className="text-[10px]">
                        {CHANNEL_ICONS[ch]}
                        <span className="ml-1">{ch}</span>
                      </Badge>
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`確定刪除模板「${t.name}」？`)) deleteMutation.mutate(t.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="text-sm font-medium">{t.name}</div>
                {t.subject && (
                  <div className="text-xs text-muted-foreground mt-1">主旨：{t.subject}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.body}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing || showAdd} onOpenChange={(open) => { if (!open) { setEditing(null); setShowAdd(false); }}}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯模板" : "新增模板"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Template Key（小寫英數+底線）</label>
              <Input
                value={form.templateKey ?? ""}
                onChange={(e) => setForm({ ...form, templateKey: e.target.value })}
                placeholder="例：account_locked / billing_due"
                className="font-mono mt-1"
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">名稱</label>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">分類</label>
              <Select value={form.category ?? "general"} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">一般</SelectItem>
                  <SelectItem value="billing">計費</SelectItem>
                  <SelectItem value="security">安全</SelectItem>
                  <SelectItem value="support">客服</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">使用通道（多選）</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(["email", "fcm", "line", "telegram", "webpush"] as const).map((ch) => {
                  const selected = (form.channels ?? []).includes(ch);
                  return (
                    <Badge
                      key={ch}
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const cur = form.channels ?? [];
                        setForm({
                          ...form,
                          channels: selected ? cur.filter((c) => c !== ch) : [...cur, ch],
                        });
                      }}
                    >
                      {CHANNEL_ICONS[ch]}
                      <span className="ml-1">{ch}</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">主旨（email / 通知標題用）</label>
              <Input
                value={form.subject ?? ""}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1"
                placeholder="例：⚠️ 帳號 {{username}} 已鎖定"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">內容（支援 {"{{variable}}"} 替換）</label>
              <Textarea
                value={form.body ?? ""}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={8}
                className="mt-1 font-mono text-xs"
                placeholder="親愛的 {{name}}：&#10;&#10;您的帳號於 {{time}} 鎖定..."
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={form.enabled ?? true}
                onCheckedChange={(enabled) => setForm({ ...form, enabled })}
              />
              <span className="text-sm">啟用此模板</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setShowAdd(false); }}>取消</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.templateKey || !form.name || !form.body || saveMutation.isPending}
            >
              {saveMutation.isPending ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────
// 3. 發送紀錄
// ────────────────────────────────────────
function LogsView({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery<{ items: NotificationLog[]; total: number }>({
    queryKey: ["/api/platform/notifications/logs", channelFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (channelFilter !== "all") params.set("channel", channelFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      return (await apiRequest("GET", `/api/platform/notifications/logs?${params.toString()}`)).json();
    },
    enabled: isAuthenticated,
  });

  const { data: stats } = useQuery<NotificationStats>({
    queryKey: ["/api/platform/notifications/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/notifications/stats")).json(),
    enabled: isAuthenticated,
  });

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard label="總發送" value={stats?.total ?? 0} accent="text-primary" />
        <KpiCard label="成功" value={stats?.sent ?? 0} accent="text-emerald-500" />
        <KpiCard label="失敗" value={stats?.failed ?? 0} accent="text-destructive" />
        <KpiCard label="24h" value={stats?.last_24h ?? 0} accent="text-amber-500" />
        <KpiCard label="7天" value={stats?.last_7d ?? 0} accent="text-blue-500" />
      </div>

      <div className="flex gap-2 mb-3">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部通道</SelectItem>
            {(["email", "fcm", "line", "telegram", "webpush"] as const).map((ch) => (
              <SelectItem key={ch} value={ch}>{ch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="sent">已送出</SelectItem>
            <SelectItem value="failed">失敗</SelectItem>
            <SelectItem value="pending">待送</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton count={5} />
      ) : data?.items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">尚無發送紀錄</CardContent></Card>
      ) : (
        <div className="space-y-1">
          {data?.items.map((log) => (
            <Card key={log.id} className={log.status === "failed" ? "border-l-4 border-l-destructive" : ""}>
              <CardContent className="p-3 flex items-center gap-2 text-xs">
                {CHANNEL_ICONS[log.channel] ?? <Bell className="w-3 h-3" />}
                <Badge
                  variant={log.status === "sent" ? "default" : log.status === "failed" ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  {log.status}
                </Badge>
                {log.templateKey && <code className="font-mono">{log.templateKey}</code>}
                <span className="font-mono truncate">{log.recipient}</span>
                {log.error && <span className="text-destructive truncate">{log.error}</span>}
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {new Date(log.createdAt).toLocaleString("zh-TW", {
                    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${accent}`}>
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
