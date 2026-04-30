// 🛡️ Platform IP 白名單管理
//
// 限制 platform admin 只能從特定 IP/CIDR 登入
// 注意：只對 platform admin 生效，場域 admin 不受限
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Globe, Plus, Trash2, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IpWhitelistItem {
  id: string;
  ipOrCidr: string;
  label: string | null;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function PlatformIpWhitelist() {
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editing, setEditing] = useState<IpWhitelistItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    ipOrCidr: "",
    label: "",
    description: "",
    enabled: true,
  });

  const { data, isLoading } = useQuery<{ items: IpWhitelistItem[]; total: number }>({
    queryKey: ["/api/platform/ip-whitelist"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/ip-whitelist")).json(),
    enabled: isAuthenticated,
  });

  const items = data?.items ?? [];
  const enabledCount = items.filter((i) => i.enabled).length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return (await apiRequest("PATCH", `/api/platform/ip-whitelist/${editing.id}`, form)).json();
      }
      return (await apiRequest("POST", "/api/platform/ip-whitelist", form)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/ip-whitelist"] });
      setEditing(null);
      setShowAdd(false);
      setForm({ ipOrCidr: "", label: "", description: "", enabled: true });
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

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return (await apiRequest("PATCH", `/api/platform/ip-whitelist/${id}`, { enabled })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/ip-whitelist"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await apiRequest("DELETE", `/api/platform/ip-whitelist/${id}`)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/ip-whitelist"] });
      toast({ title: "已刪除" });
    },
  });

  const openEdit = (item: IpWhitelistItem) => {
    setEditing(item);
    setForm({
      ipOrCidr: item.ipOrCidr,
      label: item.label ?? "",
      description: item.description ?? "",
      enabled: item.enabled,
    });
  };

  const openAdd = () => {
    setShowAdd(true);
    setEditing(null);
    setForm({ ipOrCidr: "", label: "", description: "", enabled: true });
  };

  const isOpen = !!editing || showAdd;

  return (
    <PlatformAdminLayout
      title="IP 白名單"
      actions={
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> 新增
        </Button>
      }
    >
      {/* 警告：尚未啟用模式 */}
      <Card className="mb-4 border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <div className="text-sm">
            <p className="font-semibold mb-1">📋 IP 白名單規則</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• 此白名單<strong className="text-foreground">只對 platform admin（super_admin / platform_*）生效</strong></li>
              <li>• 若白名單為空 → 不啟用限制（保持現有登入流程）</li>
              <li>• 若有任一啟用條目 → 只允許列表內 IP 登入 platform 後台</li>
              <li>• 場域 admin、玩家用戶端不受影響</li>
              <li>• 支援 CIDR（例 192.168.1.0/24）</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">總條目</div>
            <div className="text-2xl font-bold tabular-nums text-primary">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">啟用中</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-500">{enabledCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">狀態</div>
            <div className="text-sm font-bold">
              {enabledCount === 0
                ? <span className="text-muted-foreground">未啟用限制</span>
                : <span className="text-amber-500">⚠️ 限制中</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <ListSkeleton count={3} />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            尚無 IP 白名單條目。新增後 platform admin 將被限制只能從這些 IP 登入。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className={item.enabled ? "" : "opacity-60"}>
              <CardContent className="p-3 flex items-center gap-3">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono font-semibold">{item.ipOrCidr}</code>
                    {item.label && <Badge variant="outline">{item.label}</Badge>}
                    {!item.enabled && <Badge variant="secondary">停用中</Badge>}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                  )}
                </div>
                <Switch
                  checked={item.enabled}
                  onCheckedChange={(enabled) => toggleMutation.mutate({ id: item.id, enabled })}
                />
                <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`確定刪除 ${item.ipOrCidr}？`)) {
                      deleteMutation.mutate(item.id);
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: 新增 / 編輯 */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setEditing(null); setShowAdd(false); }}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "編輯 IP" : "新增 IP 至白名單"}</DialogTitle>
            <DialogDescription>
              支援 IPv4（例：203.0.113.5）或 CIDR（例：10.0.0.0/24）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">IP / CIDR</label>
              <Input
                value={form.ipOrCidr}
                onChange={(e) => setForm({ ...form, ipOrCidr: e.target.value })}
                placeholder="203.0.113.5 或 10.0.0.0/24"
                className="font-mono mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">標籤（選填）</label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="例：辦公室 / 家裡 / VPN"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">說明（選填）</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="額外備註"
                className="mt-1"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={form.enabled}
                onCheckedChange={(enabled) => setForm({ ...form, enabled })}
              />
              <span className="text-sm">啟用此條目</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setShowAdd(false); }}>
              取消
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.ipOrCidr || saveMutation.isPending}
            >
              {saveMutation.isPending ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlatformAdminLayout>
  );
}
