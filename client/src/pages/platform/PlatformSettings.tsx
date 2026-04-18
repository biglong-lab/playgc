// ⚙️ 平台全域設定（Phase A-1.4）
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings, Loader2, Save } from "lucide-react";

interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultPlanCode: string;
  maintenanceMode: boolean;
  applicationsOpen: boolean;
  customMessage: string;
}

export default function PlatformSettingsPage() {
  const { isAuthenticated } = useAdminAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<PlatformSettings>({
    queryKey: ["/api/platform/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/settings");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const [form, setForm] = useState<PlatformSettings>({
    platformName: "",
    supportEmail: "",
    defaultPlanCode: "free",
    maintenanceMode: false,
    applicationsOpen: true,
    customMessage: "",
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: PlatformSettings) => {
      const res = await apiRequest("PATCH", "/api/platform/settings", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "已儲存", description: "平台設定已更新" });
      qc.invalidateQueries({ queryKey: ["/api/platform/settings"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "儲存失敗";
      toast({ title: "儲存失敗", description: message, variant: "destructive" });
    },
  });

  return (
    <PlatformAdminLayout title="⚙️ 平台設定">
      <div className="p-6 space-y-4 max-w-2xl">
        <div className="rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 p-5 text-white">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            平台全域設定
          </h2>
          <p className="text-slate-200 text-sm">
            影響所有場域的平台層設定，修改後立即生效
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(form);
            }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🏷️ 品牌與聯絡</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="platformName">平台名稱</Label>
                  <Input
                    id="platformName"
                    value={form.platformName}
                    onChange={(e) => setForm({ ...form, platformName: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label htmlFor="supportEmail">客服信箱</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={form.supportEmail}
                    onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                    placeholder="support@example.com"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">📦 場域預設</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="defaultPlanCode">新場域預設方案代碼</Label>
                  <Input
                    id="defaultPlanCode"
                    value={form.defaultPlanCode}
                    onChange={(e) => setForm({ ...form, defaultPlanCode: e.target.value })}
                    placeholder="free"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    常用：free / pro / enterprise
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="applicationsOpen">公開申請開放</Label>
                    <p className="text-xs text-muted-foreground">
                      關閉後 /apply 頁面將不再接受新申請
                    </p>
                  </div>
                  <Switch
                    id="applicationsOpen"
                    checked={form.applicationsOpen}
                    onCheckedChange={(v) => setForm({ ...form, applicationsOpen: v })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">🚧 維護</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="maintenanceMode">維護模式</Label>
                    <p className="text-xs text-muted-foreground">
                      開啟後，非 super_admin 將看到維護訊息
                    </p>
                  </div>
                  <Switch
                    id="maintenanceMode"
                    checked={form.maintenanceMode}
                    onCheckedChange={(v) => setForm({ ...form, maintenanceMode: v })}
                  />
                </div>
                <div>
                  <Label htmlFor="customMessage">自訂公告</Label>
                  <Textarea
                    id="customMessage"
                    value={form.customMessage}
                    onChange={(e) => setForm({ ...form, customMessage: e.target.value })}
                    placeholder="（選填）顯示於管理端頂部的公告文字"
                    maxLength={500}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                儲存設定
              </Button>
            </div>
          </form>
        )}
      </div>
    </PlatformAdminLayout>
  );
}
