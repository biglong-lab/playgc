import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ArduinoDevice, Game, GameSession } from "@shared/schema";
import {
  Settings, Wifi, Radio, Gamepad2, Users, Clock,
  Save, RefreshCw, CheckCircle, AlertTriangle, Database
} from "lucide-react";

interface MqttStatus {
  connected: boolean;
  reconnectAttempts?: number;
}

export default function AdminSettings() {
  const { toast } = useToast();
  
  const [defaultGameTime, setDefaultGameTime] = useState("30");
  const [maxPlayers, setMaxPlayers] = useState("6");
  const [autoEndSession, setAutoEndSession] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("120");

  const { data: mqttStatus, isLoading: mqttLoading, error: mqttError } = useQuery<MqttStatus>({
    queryKey: ["/api/mqtt/status"],
    refetchInterval: 10000,
    retry: false,
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
  });

  const { data: sessions = [] } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
  });

  const { data: devices = [] } = useQuery<ArduinoDevice[]>({
    queryKey: ["/api/devices"],
  });

  const stats = {
    totalGames: games.length,
    totalSessions: sessions.length,
    totalDevices: devices.length,
    totalTeams: new Set(sessions.map(s => s.teamName).filter(Boolean)).size,
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

  const handleSaveSettings = () => {
    toast({ 
      title: "設定已儲存", 
      description: "系統設定已更新" 
    });
  };

  const isMqttConnected = mqttStatus?.connected === true;

  return (
    <AdminLayout title="系統設定">
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
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gamepad2 className="w-5 h-5" />
                遊戲預設設定
              </CardTitle>
              <CardDescription>
                新建遊戲時的預設參數
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="defaultTime">預設遊戲時間 (分鐘)</Label>
                  <Input
                    id="defaultTime"
                    type="number"
                    value={defaultGameTime}
                    onChange={(e) => setDefaultGameTime(e.target.value)}
                    data-testid="input-default-time"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPlayers">預設最大玩家數</Label>
                  <Input
                    id="maxPlayers"
                    type="number"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(e.target.value)}
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
              <CardDescription>
                遊戲場次的自動化設定
              </CardDescription>
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
                  checked={autoEndSession}
                  onCheckedChange={setAutoEndSession}
                  data-testid="switch-auto-end"
                />
              </div>
              
              {autoEndSession && (
                <div className="space-y-2">
                  <Label htmlFor="timeout">閒置超時時間 (分鐘)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="max-w-xs"
                    data-testid="input-session-timeout"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} className="gap-2" data-testid="button-save-settings">
              <Save className="w-4 h-4" />
              儲存設定
            </Button>
          </div>
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
                      HiveMQ 公共代理
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
                  <p className="font-mono text-sm">broker.hivemq.com</p>
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
                  <RefreshCw className={`w-4 h-4 ${testMqttMutation.isPending ? "animate-spin" : ""}`} />
                  測試連線
                </Button>
              </div>
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
      </Tabs>
    </AdminLayout>
  );
}
