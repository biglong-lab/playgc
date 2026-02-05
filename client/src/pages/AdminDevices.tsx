import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ArduinoDevice, InsertArduinoDevice, ShootingRecord, DeviceLog } from "@shared/schema";
import {
  Gamepad2, Plus, Settings, Cpu, BarChart3,
  Trophy, Home, LogOut, Activity, Zap, Wifi, WifiOff,
  Play, Square, Trash2, Edit, Radio, Lightbulb, Target,
  RefreshCw, Power, RotateCcw, Info, FileText, Battery,
  Globe, Crosshair, TrendingUp
} from "lucide-react";

const menuItems = [
  { title: "總覽", icon: Home, path: "/admin" },
  { title: "遊戲管理", icon: Gamepad2, path: "/admin/games" },
  { title: "進行中場次", icon: Activity, path: "/admin/sessions" },
  { title: "設備管理", icon: Cpu, path: "/admin/devices" },
  { title: "數據分析", icon: BarChart3, path: "/admin/analytics" },
  { title: "排行榜", icon: Trophy, path: "/admin/leaderboard" },
  { title: "系統設定", icon: Settings, path: "/admin/settings" },
];

const DEVICE_TYPES = [
  { value: "shooting_target", label: "射擊靶機" },
  { value: "sensor", label: "感應器" },
  { value: "trigger", label: "觸發器" },
  { value: "display", label: "顯示器" },
  { value: "controller", label: "控制器" },
];

const LED_MODES = [
  { value: "solid", label: "常亮", icon: Lightbulb },
  { value: "off", label: "關閉", icon: Power },
  { value: "blink", label: "閃爍", icon: Zap },
  { value: "pulse", label: "呼吸", icon: Activity },
  { value: "rainbow", label: "彩虹", icon: TrendingUp },
];

const LED_COLORS = [
  { value: "green", color: { r: 0, g: 255, b: 0 }, label: "綠色" },
  { value: "red", color: { r: 255, g: 0, b: 0 }, label: "紅色" },
  { value: "blue", color: { r: 0, g: 0, b: 255 }, label: "藍色" },
  { value: "yellow", color: { r: 255, g: 255, b: 0 }, label: "黃色" },
  { value: "orange", color: { r: 255, g: 165, b: 0 }, label: "橙色" },
  { value: "purple", color: { r: 128, g: 0, b: 128 }, label: "紫色" },
  { value: "white", color: { r: 255, g: 255, b: 255 }, label: "白色" },
];

interface MqttStatus {
  connected: boolean;
  reconnectAttempts: number;
}

interface DeviceStatistics {
  deviceId: string;
  deviceName: string;
  period: string;
  totalHits: number;
  totalScore: number;
  averageScore: number;
  highestScore: number;
  hitsByZone: Record<string, number>;
}

export default function AdminDevices() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<ArduinoDevice | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<ArduinoDevice | null>(null);
  const [ledMode, setLedMode] = useState("solid");
  const [ledColor, setLedColor] = useState("green");
  const [ledBrightness, setLedBrightness] = useState(100);
  const [ledSpeed, setLedSpeed] = useState(500);
  const [formData, setFormData] = useState<Partial<InsertArduinoDevice>>({
    deviceName: "",
    deviceType: "shooting_target",
    mqttTopic: "",
    locationLat: "",
    locationLng: "",
  });

  const { data: devices, isLoading } = useQuery<ArduinoDevice[]>({
    queryKey: ["/api/devices"],
  });

  const { data: mqttStatus } = useQuery<MqttStatus>({
    queryKey: ["/api/mqtt/status"],
    refetchInterval: 10000,
  });

  const { data: deviceStats } = useQuery<DeviceStatistics>({
    queryKey: ["/api/devices", selectedDevice?.id, "statistics"],
    enabled: !!selectedDevice,
  });

  const { data: deviceLogs } = useQuery<DeviceLog[]>({
    queryKey: ["/api/devices", selectedDevice?.id, "logs"],
    enabled: !!selectedDevice,
  });

  const { data: shootingRecords } = useQuery<ShootingRecord[]>({
    queryKey: ["/api/devices", selectedDevice?.id, "shooting-records"],
    enabled: !!selectedDevice,
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertArduinoDevice) => 
      apiRequest("POST", "/api/devices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "設備新增成功" });
    },
    onError: () => {
      toast({ title: "新增失敗", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertArduinoDevice> }) =>
      apiRequest("PATCH", `/api/devices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setEditingDevice(null);
      resetForm();
      toast({ title: "設備更新成功" });
    },
    onError: () => {
      toast({ title: "更新失敗", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/devices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      toast({ title: "設備已刪除" });
    },
    onError: () => {
      toast({ title: "刪除失敗", variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/devices/${id}/activate`, {}),
    onSuccess: () => {
      toast({ title: "啟動命令已發送" });
    },
    onError: () => {
      toast({ title: "啟動失敗", variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/devices/${id}/deactivate`, {}),
    onSuccess: () => {
      toast({ title: "停用命令已發送" });
    },
    onError: () => {
      toast({ title: "停用失敗", variant: "destructive" });
    },
  });

  const ledMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("POST", `/api/devices/${id}/led`, data),
    onSuccess: () => {
      toast({ title: "LED 命令已發送" });
    },
    onError: () => {
      toast({ title: "LED 控制失敗", variant: "destructive" });
    },
  });

  const commandMutation = useMutation({
    mutationFn: ({ id, command, data }: { id: string; command: string; data?: any }) =>
      apiRequest("POST", `/api/devices/${id}/command`, { command, data }),
    onSuccess: (_, variables) => {
      toast({ title: `${variables.command} 命令已發送` });
    },
    onError: () => {
      toast({ title: "命令發送失敗", variant: "destructive" });
    },
  });

  const broadcastLedMutation = useMutation({
    mutationFn: (data: { mode: string; color?: any }) =>
      apiRequest("POST", "/api/devices/broadcast/led", data),
    onSuccess: () => {
      toast({ title: "全體設備 LED 命令已發送" });
    },
    onError: () => {
      toast({ title: "廣播失敗", variant: "destructive" });
    },
  });

  const pingAllMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/devices/broadcast/ping", {}),
    onSuccess: () => {
      toast({ title: "已向所有設備發送 Ping" });
    },
    onError: () => {
      toast({ title: "Ping 廣播失敗", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      deviceName: "",
      deviceType: "shooting_target",
      mqttTopic: "",
      locationLat: "",
      locationLng: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.deviceName) {
      toast({ title: "請輸入設備名稱", variant: "destructive" });
      return;
    }

    if (editingDevice) {
      updateMutation.mutate({ id: editingDevice.id, data: formData });
    } else {
      createMutation.mutate(formData as InsertArduinoDevice);
    }
  };

  const handleEdit = (device: ArduinoDevice) => {
    setEditingDevice(device);
    setFormData({
      deviceName: device.deviceName,
      deviceType: device.deviceType || "shooting_target",
      mqttTopic: device.mqttTopic || "",
      locationLat: device.locationLat || "",
      locationLng: device.locationLng || "",
    });
  };

  const handleLedControl = () => {
    if (!selectedDevice) return;
    
    const colorData = LED_COLORS.find(c => c.value === ledColor)?.color || { r: 0, g: 255, b: 0 };
    
    ledMutation.mutate({
      id: selectedDevice.id,
      data: {
        mode: ledMode,
        color: colorData,
        brightness: ledBrightness,
        speed: ledSpeed,
      },
    });
  };

  const handleCommand = (command: string) => {
    if (!selectedDevice) return;
    commandMutation.mutate({ id: selectedDevice.id, command });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/";
    return null;
  }

  const onlineCount = devices?.filter(d => d.status === "online").length || 0;
  const offlineCount = devices?.filter(d => d.status !== "online").length || 0;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display font-bold text-sm">賈村競技場</h1>
                <p className="text-xs text-sidebar-foreground/60">管理後台</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>主選單</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton 
                        asChild
                        isActive={item.path === "/admin/devices"}
                      >
                        <Link href={item.path}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback>{(user.firstName?.[0] || "A").toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{user.firstName || "Admin"}</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-border bg-background">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h2 className="font-display font-bold text-lg">設備管理</h2>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge 
                variant={mqttStatus?.connected ? "default" : "secondary"}
                className="gap-1"
              >
                <Radio className="w-3 h-3" />
                MQTT: {mqttStatus?.connected ? "已連接" : "未連接"}
              </Badge>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => pingAllMutation.mutate()}
                disabled={pingAllMutation.isPending}
                className="gap-1"
                data-testid="button-ping-all"
              >
                <RefreshCw className={`w-4 h-4 ${pingAllMutation.isPending ? "animate-spin" : ""}`} />
                Ping 全部
              </Button>
              
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-add-device">
                    <Plus className="w-4 h-4" />
                    新增設備
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新增設備</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>設備名稱</Label>
                      <Input
                        value={formData.deviceName || ""}
                        onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                        placeholder="例如: 射擊靶機 A1"
                        data-testid="input-device-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>設備類型</Label>
                      <Select
                        value={formData.deviceType || "shooting_target"}
                        onValueChange={(v) => setFormData({ ...formData, deviceType: v })}
                      >
                        <SelectTrigger data-testid="select-device-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEVICE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>MQTT Topic</Label>
                      <Input
                        value={formData.mqttTopic || ""}
                        onChange={(e) => setFormData({ ...formData, mqttTopic: e.target.value })}
                        placeholder="例如: jiachun/targets/device-001"
                        data-testid="input-mqtt-topic"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>緯度</Label>
                        <Input
                          value={formData.locationLat || ""}
                          onChange={(e) => setFormData({ ...formData, locationLat: e.target.value })}
                          placeholder="例如: 24.1234"
                          data-testid="input-location-lat"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>經度</Label>
                        <Input
                          value={formData.locationLng || ""}
                          onChange={(e) => setFormData({ ...formData, locationLng: e.target.value })}
                          placeholder="例如: 120.5678"
                          data-testid="input-location-lng"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">取消</Button>
                    </DialogClose>
                    <Button 
                      onClick={handleSubmit}
                      disabled={createMutation.isPending}
                      data-testid="button-submit-device"
                    >
                      {createMutation.isPending ? "新增中..." : "新增"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">在線設備</p>
                      <p className="font-number text-3xl font-bold text-success">{onlineCount}</p>
                    </div>
                    <Wifi className="w-8 h-8 text-success/50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">離線設備</p>
                      <p className="font-number text-3xl font-bold text-muted-foreground">{offlineCount}</p>
                    </div>
                    <WifiOff className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">總設備數</p>
                      <p className="font-number text-3xl font-bold">{devices?.length || 0}</p>
                    </div>
                    <Cpu className="w-8 h-8 text-primary/50" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">全體 LED</p>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => broadcastLedMutation.mutate({ mode: "on", color: { r: 0, g: 255, b: 0 } })}
                          disabled={broadcastLedMutation.isPending}
                          data-testid="button-all-led-on"
                        >
                          <Lightbulb className="w-3 h-3 mr-1" />
                          開
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => broadcastLedMutation.mutate({ mode: "off" })}
                          disabled={broadcastLedMutation.isPending}
                          data-testid="button-all-led-off"
                        >
                          <Power className="w-3 h-3 mr-1" />
                          關
                        </Button>
                      </div>
                    </div>
                    <Lightbulb className="w-8 h-8 text-yellow-500/50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : devices && devices.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {devices.map((device) => (
                      <Card 
                        key={device.id} 
                        className={`relative cursor-pointer transition-all ${
                          selectedDevice?.id === device.id ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedDevice(device)}
                        data-testid={`card-device-${device.id}`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                device.status === "online" 
                                  ? "bg-success/10" 
                                  : "bg-muted"
                              }`}>
                                <Cpu className={`w-5 h-5 ${
                                  device.status === "online" 
                                    ? "text-success" 
                                    : "text-muted-foreground"
                                }`} />
                              </div>
                              <div>
                                <CardTitle className="text-base">{device.deviceName}</CardTitle>
                                <CardDescription>
                                  {DEVICE_TYPES.find(t => t.value === device.deviceType)?.label || device.deviceType}
                                </CardDescription>
                              </div>
                            </div>
                            <Badge 
                              variant={device.status === "online" ? "default" : "secondary"}
                              className={device.status === "online" ? "bg-success" : ""}
                            >
                              {device.status === "online" ? "在線" : "離線"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            {device.deviceId && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Info className="w-3 h-3" />
                                <span className="truncate">ID: {device.deviceId}</span>
                              </div>
                            )}
                            {device.mqttTopic && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Radio className="w-3 h-3" />
                                <span className="truncate">{device.mqttTopic}</span>
                              </div>
                            )}
                            {device.batteryLevel !== null && device.batteryLevel !== undefined && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Battery className="w-3 h-3" />
                                <span>電量: {device.batteryLevel}%</span>
                              </div>
                            )}
                            {device.firmwareVersion && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <FileText className="w-3 h-3" />
                                <span>韌體: {device.firmwareVersion}</span>
                              </div>
                            )}
                            {device.ipAddress && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Globe className="w-3 h-3" />
                                <span>IP: {device.ipAddress}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                activateMutation.mutate(device.id);
                              }}
                              disabled={activateMutation.isPending}
                              className="flex-1 gap-1"
                              data-testid={`button-activate-${device.id}`}
                            >
                              <Play className="w-3 h-3" />
                              啟動
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deactivateMutation.mutate(device.id);
                              }}
                              disabled={deactivateMutation.isPending}
                              className="flex-1 gap-1"
                              data-testid={`button-deactivate-${device.id}`}
                            >
                              <Square className="w-3 h-3" />
                              停用
                            </Button>
                            <Dialog 
                              open={editingDevice?.id === device.id} 
                              onOpenChange={(open) => !open && setEditingDevice(null)}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(device);
                                  }}
                                  data-testid={`button-edit-${device.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent onClick={(e) => e.stopPropagation()}>
                                <DialogHeader>
                                  <DialogTitle>編輯設備</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>設備名稱</Label>
                                    <Input
                                      value={formData.deviceName || ""}
                                      onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                                      data-testid="input-edit-device-name"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>設備類型</Label>
                                    <Select
                                      value={formData.deviceType || "shooting_target"}
                                      onValueChange={(v) => setFormData({ ...formData, deviceType: v })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {DEVICE_TYPES.map((type) => (
                                          <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>MQTT Topic</Label>
                                    <Input
                                      value={formData.mqttTopic || ""}
                                      onChange={(e) => setFormData({ ...formData, mqttTopic: e.target.value })}
                                      data-testid="input-edit-mqtt-topic"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>緯度</Label>
                                      <Input
                                        value={formData.locationLat || ""}
                                        onChange={(e) => setFormData({ ...formData, locationLat: e.target.value })}
                                        data-testid="input-edit-location-lat"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>經度</Label>
                                      <Input
                                        value={formData.locationLng || ""}
                                        onChange={(e) => setFormData({ ...formData, locationLng: e.target.value })}
                                        data-testid="input-edit-location-lng"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">取消</Button>
                                  </DialogClose>
                                  <Button 
                                    onClick={handleSubmit}
                                    disabled={updateMutation.isPending}
                                    data-testid="button-update-device"
                                  >
                                    {updateMutation.isPending ? "更新中..." : "更新"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(device.id);
                              }}
                              disabled={deleteMutation.isPending}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-${device.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-20 text-center">
                      <Cpu className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground mb-4">尚未新增任何設備</p>
                      <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        新增第一台設備
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-4">
                {selectedDevice ? (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" />
                          LED 控制 - {selectedDevice.deviceName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">模式</Label>
                          <div className="grid grid-cols-5 gap-1">
                            {LED_MODES.map((mode) => (
                              <Button
                                key={mode.value}
                                variant={ledMode === mode.value ? "default" : "outline"}
                                size="sm"
                                onClick={() => setLedMode(mode.value)}
                                className="flex flex-col gap-1 h-auto py-2"
                                data-testid={`button-led-mode-${mode.value}`}
                              >
                                <mode.icon className="w-3 h-3" />
                                <span className="text-xs">{mode.label}</span>
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">顏色</Label>
                          <div className="grid grid-cols-7 gap-1">
                            {LED_COLORS.map((color) => (
                              <Button
                                key={color.value}
                                variant={ledColor === color.value ? "default" : "outline"}
                                size="sm"
                                onClick={() => setLedColor(color.value)}
                                className="h-8 w-8 p-0"
                                style={{
                                  backgroundColor: ledColor === color.value ? undefined : `rgb(${color.color.r}, ${color.color.g}, ${color.color.b})`,
                                }}
                                data-testid={`button-led-color-${color.value}`}
                              >
                                {ledColor === color.value && <span className="text-xs">&#10003;</span>}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">亮度: {ledBrightness}%</Label>
                          <Slider
                            value={[ledBrightness]}
                            onValueChange={(v) => setLedBrightness(v[0])}
                            min={0}
                            max={100}
                            step={10}
                            data-testid="slider-led-brightness"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">速度: {ledSpeed}ms</Label>
                          <Slider
                            value={[ledSpeed]}
                            onValueChange={(v) => setLedSpeed(v[0])}
                            min={100}
                            max={2000}
                            step={100}
                            data-testid="slider-led-speed"
                          />
                        </div>

                        <Button 
                          onClick={handleLedControl}
                          disabled={ledMutation.isPending}
                          className="w-full gap-2"
                          data-testid="button-send-led"
                        >
                          <Zap className="w-4 h-4" />
                          發送 LED 指令
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          設備控制
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCommand("ping")}
                            disabled={commandMutation.isPending}
                            className="gap-1"
                            data-testid="button-cmd-ping"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Ping
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCommand("status")}
                            disabled={commandMutation.isPending}
                            className="gap-1"
                            data-testid="button-cmd-status"
                          >
                            <Info className="w-3 h-3" />
                            狀態
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCommand("calibrate")}
                            disabled={commandMutation.isPending}
                            className="gap-1"
                            data-testid="button-cmd-calibrate"
                          >
                            <Crosshair className="w-3 h-3" />
                            校準
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCommand("reboot")}
                            disabled={commandMutation.isPending}
                            className="gap-1 text-destructive"
                            data-testid="button-cmd-reboot"
                          >
                            <RotateCcw className="w-3 h-3" />
                            重啟
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          射擊統計
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {deviceStats ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">總命中數</p>
                                <p className="font-number text-xl font-bold">{deviceStats.totalHits}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">總得分</p>
                                <p className="font-number text-xl font-bold">{deviceStats.totalScore}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">平均得分</p>
                                <p className="font-number text-xl font-bold">{deviceStats.averageScore?.toFixed(1)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">最高分</p>
                                <p className="font-number text-xl font-bold text-primary">{deviceStats.highestScore}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            暫無統計資料
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          設備日誌
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-48">
                          {deviceLogs && deviceLogs.length > 0 ? (
                            <div className="space-y-2">
                              {deviceLogs.slice(0, 10).map((log, index) => (
                                <div key={index} className="text-xs border-b border-border pb-2">
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-xs">
                                      {log.logType}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                      {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ""}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-muted-foreground truncate">{log.message}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              暫無日誌
                            </p>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Cpu className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        點擊左側設備卡片查看詳情
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
