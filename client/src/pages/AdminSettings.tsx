import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ArduinoDevice, Game, GameSession } from "@shared/schema";
import {
  Settings,
  Wifi,
  Radio,
  Gamepad2,
  Users,
  Clock,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Database,
  History,
  MessageSquare,
  Flag,
  ScrollText,
  ChevronRight,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Link } from "wouter";
import SettingsChangeHistory from "@/pages/admin/SettingsChangeHistory";

interface MqttStatus {
  connected: boolean;
  reconnectAttempts?: number;
  source?: "database" | "env" | null;
  brokerUrl?: string | null;
}

interface BrokerConfig {
  brokerUrl: string;
  username: string;
  hasPassword: boolean;
  hasCaCert: boolean;
  enabled: boolean;
  updatedAt: string | null;
  status: MqttStatus;
}

interface SystemSettings {
  defaultGameTime: number;
  defaultMaxPlayers: number;
  autoEndIdleSession: boolean;
  sessionIdleTimeout: number;
}

export default function AdminSettings() {
  const { isAuthenticated } = useAdminAuth();
  const { toast } = useToast();

  // 載入設定
  const { data: settings, isLoading: settingsLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/admin/settings"],
    enabled: isAuthenticated,
  });

  // 表單狀態
  const [formValues, setFormValues] = useState<SystemSettings>({
    defaultGameTime: 30,
    defaultMaxPlayers: 6,
    autoEndIdleSession: true,
    sessionIdleTimeout: 120,
  });

  // API 回傳後同步表單
  useEffect(() => {
    if (settings) {
      setFormValues(settings);
    }
  }, [settings]);

  const setField = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const { data: mqttStatus, isLoading: mqttLoading } = useQuery<MqttStatus>({
    queryKey: ["/api/mqtt/status"],
    refetchInterval: 10000,
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
    enabled: isAuthenticated,
  });

  const { data: sessions = [] } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
    enabled: isAuthenticated,
  });

  const { data: devices = [] } = useQuery<ArduinoDevice[]>({
    queryKey: ["/api/devices"],
    enabled: isAuthenticated,
  });

  const stats = {
    totalGames: games.length,
    totalSessions: sessions.length,
    totalDevices: devices.length,
    totalTeams: new Set(sessions.map((s) => s.teamName).filter(Boolean)).size,
  };

  const testMqttMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/devices/broadcast/ping", {});
    },
    onSuccess: () => {
      toast({ title: "MQTT 測試成功", description: "已發送 Ping 到所有設備" });
    },
    onError: () => {
      toast({ title: "MQTT 測試失敗", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: SystemSettings) => {
      return apiRequest("PATCH", "/api/admin/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "設定已儲存" });
    },
    onError: () => {
      toast({ title: "儲存失敗", variant: "destructive" });
    },
  });

  const handleSaveSettings = () => {
    saveMutation.mutate(formValues);
  };

  // 🔌 Broker 設定（ADR-0024）
  const { data: brokerConfig } = useQuery<BrokerConfig>({
    queryKey: ["/api/admin/mqtt/broker-config"],
    refetchInterval: 10000,
    enabled: isAuthenticated,
  });

  const [brokerForm, setBrokerForm] = useState({
    brokerUrl: "",
    username: "",
    password: "",
    enabled: false,
  });
  useEffect(() => {
    if (brokerConfig) {
      setBrokerForm({
        brokerUrl: brokerConfig.brokerUrl || "",
        username: brokerConfig.username || "",
        password: "", // 不回填密碼，留空=不變更
        enabled: brokerConfig.enabled,
      });
    }
  }, [brokerConfig]);

  const saveBrokerMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        brokerUrl: brokerForm.brokerUrl,
        username: brokerForm.username,
        enabled: brokerForm.enabled,
      };
      if (brokerForm.password) body.password = brokerForm.password;
      return apiRequest("PATCH", "/api/admin/mqtt/broker-config", body);
    },
    onSuccess: async (res: Response) => {
      const data = await res.json().catch(() => ({}));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mqtt/broker-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mqtt/status"] });
      toast({
        title: "Broker 設定已儲存",
        description: data?.status?.connected
          ? "已成功連線"
          : brokerForm.enabled
            ? "已套用，連線中…"
            : "已停用",
      });
    },
    onError: (e: Error) => {
      toast({ title: "儲存失敗", description: e?.message || "請稍後再試", variant: "destructive" });
    },
  });

  const testBrokerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/mqtt/broker-config/test", {
        brokerUrl: brokerForm.brokerUrl,
        username: brokerForm.username,
        password: brokerForm.password || undefined,
      });
      return res.json() as Promise<{ ok: boolean; error?: string }>;
    },
    onSuccess: (result: { ok: boolean; error?: string }) => {
      toast({
        title: result.ok ? "連線測試成功" : "連線測試失敗",
        description: result.ok ? "broker 可正常連線" : result.error || "無法連線",
        variant: result.ok ? undefined : "destructive",
      });
    },
    onError: (e: Error) => {
      toast({ title: "測試失敗", description: e?.message, variant: "destructive" });
    },
  });

  const isMqttConnected = mqttStatus?.connected === true;

  return (
    <UnifiedAdminLayout title="系統設定">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-1" data-testid="tab-general">
            <Settings className="w-4 h-4" />
            一般設定
          </TabsTrigger>
          <TabsTrigger value="mqtt" className="gap-1" data-testid="tab-mqtt">
            <Radio className="w-4 h-4" />
            MQTT 設備
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-1" data-testid="tab-system">
            <Database className="w-4 h-4" />
            系統資訊
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1" data-testid="tab-history">
            <History className="w-4 h-4" />
            變更歷史
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {settingsLoading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5" />
                    遊戲預設設定
                  </CardTitle>
                  <CardDescription>新建遊戲時的預設參數</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="defaultTime">預設遊戲時間 (分鐘)</Label>
                      <Input
                        id="defaultTime"
                        type="number"
                        min={1}
                        max={999}
                        value={formValues.defaultGameTime}
                        onChange={(e) => setField("defaultGameTime", Number(e.target.value) || 1)}
                        data-testid="input-default-time"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxPlayers">預設最大玩家數</Label>
                      <Input
                        id="maxPlayers"
                        type="number"
                        min={1}
                        max={999}
                        value={formValues.defaultMaxPlayers}
                        onChange={(e) => setField("defaultMaxPlayers", Number(e.target.value) || 1)}
                        data-testid="input-max-players"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    場次管理設定
                  </CardTitle>
                  <CardDescription>遊戲場次的自動化設定</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>自動結束閒置場次</Label>
                      <p className="text-sm text-muted-foreground">
                        超過設定時間無活動的場次將自動結束
                      </p>
                    </div>
                    <Switch
                      checked={formValues.autoEndIdleSession}
                      onCheckedChange={(v) => setField("autoEndIdleSession", v)}
                      data-testid="switch-auto-end"
                    />
                  </div>

                  {formValues.autoEndIdleSession && (
                    <div className="space-y-2">
                      <Label htmlFor="timeout">閒置超時時間 (分鐘)</Label>
                      <Input
                        id="timeout"
                        type="number"
                        min={1}
                        max={9999}
                        value={formValues.sessionIdleTimeout}
                        onChange={(e) =>
                          setField("sessionIdleTimeout", Number(e.target.value) || 1)
                        }
                        className="max-w-xs"
                        data-testid="input-session-timeout"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={saveMutation.isPending}
                  className="gap-2"
                  data-testid="button-save-settings"
                >
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? "儲存中..." : "儲存設定"}
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    更多設定
                  </CardTitle>
                  <CardDescription>其他設定頁面的統一入口</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      href: "/admin/line-settings",
                      icon: MessageSquare,
                      title: "LINE 設定",
                      desc: "Bot / LIFF / 通知",
                    },
                    {
                      href: "/admin/feature-flags",
                      icon: Flag,
                      title: "功能開關",
                      desc: "模組啟用 / 降級",
                    },
                    {
                      href: "/admin/audit-logs",
                      icon: ScrollText,
                      title: "操作記錄",
                      desc: "完整稽核紀錄",
                    },
                  ].map((item) => (
                    <Link key={item.href} href={item.href}>
                      <div
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                        data-testid={`link-settings-${item.href.split("/").pop()}`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="mqtt" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wifi className="w-5 h-5" />
                MQTT 連線狀態
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  {mqttLoading ? (
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : isMqttConnected ? (
                    <CheckCircle className="w-8 h-8 text-success" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium">
                      {mqttLoading ? "檢查中..." : isMqttConnected ? "已連線" : "未連線"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {brokerConfig?.status?.source === "database"
                        ? "自訂 broker（後台設定）"
                        : brokerConfig?.status?.source === "env"
                          ? "環境變數設定"
                          : "尚未設定"}
                    </p>
                  </div>
                </div>
                <Badge variant={isMqttConnected ? "default" : "destructive"}>
                  {mqttLoading ? "..." : isMqttConnected ? "Online" : "Offline"}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">代理位址</p>
                  <p className="font-mono text-sm break-all">{brokerConfig?.brokerUrl || "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">重連次數</p>
                  <p className="font-number">{mqttStatus?.reconnectAttempts ?? 0}</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => testMqttMutation.mutate()}
                  disabled={testMqttMutation.isPending || !isMqttConnected}
                  className="gap-2"
                  data-testid="button-test-mqtt"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${testMqttMutation.isPending ? "animate-spin" : ""}`}
                  />
                  測試連線
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 🔌 Broker 設定（ADR-0024）*/}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Radio className="w-5 h-5" />
                Broker 設定
              </CardTitle>
              <CardDescription>
                自訂 MQTT 代理位址與帳密，儲存後立即套用。此為平台級設定，影響全平台裝置連線。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">啟用 MQTT</p>
                  <p className="text-sm text-muted-foreground">關閉時平台不連線任何 broker</p>
                </div>
                <Switch
                  checked={brokerForm.enabled}
                  onCheckedChange={(v) => setBrokerForm((prev) => ({ ...prev, enabled: v }))}
                  data-testid="switch-mqtt-enabled"
                />
              </div>
              <div className="space-y-2">
                <Label>Broker 位址</Label>
                <Input
                  value={brokerForm.brokerUrl}
                  onChange={(e) =>
                    setBrokerForm((prev) => ({ ...prev, brokerUrl: e.target.value }))
                  }
                  placeholder="例如 mqtts://xxx.hivemq.cloud:8883 或 mqtt://mqttgo.io:1883"
                  data-testid="input-broker-url"
                />
                <p className="text-xs text-muted-foreground">
                  正式營運請用 mqtts://（TLS 加密）；mqtt://（明文）僅建議測試。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>帳號（選填）</Label>
                  <Input
                    value={brokerForm.username}
                    onChange={(e) =>
                      setBrokerForm((prev) => ({ ...prev, username: e.target.value }))
                    }
                    placeholder="broker 使用者名稱"
                    data-testid="input-broker-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>密碼（選填）</Label>
                  <Input
                    type="password"
                    value={brokerForm.password}
                    onChange={(e) =>
                      setBrokerForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder={brokerConfig?.hasPassword ? "已設定，留空不變更" : "broker 密碼"}
                    data-testid="input-broker-password"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => saveBrokerMutation.mutate()}
                  disabled={saveBrokerMutation.isPending || !brokerForm.brokerUrl.trim()}
                  className="gap-2"
                  data-testid="button-save-broker"
                >
                  <Save
                    className={`w-4 h-4 ${saveBrokerMutation.isPending ? "animate-spin" : ""}`}
                  />
                  儲存並套用
                </Button>
                <Button
                  variant="outline"
                  onClick={() => testBrokerMutation.mutate()}
                  disabled={testBrokerMutation.isPending || !brokerForm.brokerUrl.trim()}
                  className="gap-2"
                  data-testid="button-test-broker"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${testBrokerMutation.isPending ? "animate-spin" : ""}`}
                  />
                  測試連線
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ 公用測試 broker（如 mqttgo.io
                免費版）任何人都能訂閱與偽造訊息，請勿用於正式營運；正式請用具 per-device 帳密與
                Topic ACL 的託管 broker。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">設備統計</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="font-number text-3xl font-bold">{stats.totalDevices}</p>
                  <p className="text-sm text-muted-foreground">總設備數</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-success/10">
                  <p className="font-number text-3xl font-bold text-success">
                    {devices.filter((d) => d.status === "online").length}
                  </p>
                  <p className="text-sm text-muted-foreground">在線</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="font-number text-3xl font-bold text-muted-foreground">
                    {devices.filter((d) => d.status !== "online").length}
                  </p>
                  <p className="text-sm text-muted-foreground">離線</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-5 h-5" />
                系統統計
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Gamepad2 className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="font-number text-2xl font-bold">{stats.totalGames}</p>
                  <p className="text-sm text-muted-foreground">遊戲總數</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="font-number text-2xl font-bold">{stats.totalSessions}</p>
                  <p className="text-sm text-muted-foreground">場次總數</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Radio className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="font-number text-2xl font-bold">{stats.totalDevices}</p>
                  <p className="text-sm text-muted-foreground">設備總數</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="font-number text-2xl font-bold">{stats.totalTeams}</p>
                  <p className="text-sm text-muted-foreground">隊伍數</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">系統資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">平台版本</span>
                <span className="font-mono">v1.0.0</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">資料庫</span>
                <Badge variant="outline">PostgreSQL (Neon)</Badge>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">檔案儲存</span>
                <Badge variant="outline">Google Cloud Storage</Badge>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-muted-foreground">IoT 通訊</span>
                <Badge variant="outline">MQTT (HiveMQ)</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <SettingsChangeHistory />
        </TabsContent>
      </Tabs>
    </UnifiedAdminLayout>
  );
}
