// 裝置管理主頁面
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ArduinoDevice, InsertArduinoDevice, ShootingRecord, DeviceLog } from "@shared/schema";
import {
  Gamepad2, Plus, Cpu, Radio, Wifi, WifiOff, Lightbulb, Power, RefreshCw
} from "lucide-react";
import { menuItems, LED_COLORS } from "./constants";
import type { MqttStatus, DeviceStatistics } from "./types";
import DeviceDialog from "./DeviceDialog";
import DeviceCard from "./DeviceCard";
import LEDControl from "./LEDControl";
import DeviceStats from "./DeviceStats";

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
                <DeviceDialog
                  open={isAddDialogOpen}
                  onOpenChange={setIsAddDialogOpen}
                  isEditing={false}
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={handleSubmit}
                  isPending={createMutation.isPending}
                />
              </Dialog>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            {/* Stats Cards */}
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

            {/* Device List and Detail Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : devices && devices.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {devices.map((device) => (
                      <DeviceCard
                        key={device.id}
                        device={device}
                        isSelected={selectedDevice?.id === device.id}
                        isEditing={editingDevice?.id === device.id}
                        onSelect={() => setSelectedDevice(device)}
                        onActivate={() => activateMutation.mutate(device.id)}
                        onDeactivate={() => deactivateMutation.mutate(device.id)}
                        onEdit={() => handleEdit(device)}
                        onDelete={() => deleteMutation.mutate(device.id)}
                        onCloseEdit={() => setEditingDevice(null)}
                        formData={formData}
                        setFormData={setFormData}
                        onSubmit={handleSubmit}
                        activatePending={activateMutation.isPending}
                        deactivatePending={deactivateMutation.isPending}
                        updatePending={updateMutation.isPending}
                        deletePending={deleteMutation.isPending}
                      />
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
                    <LEDControl
                      device={selectedDevice}
                      ledMode={ledMode}
                      setLedMode={setLedMode}
                      ledColor={ledColor}
                      setLedColor={setLedColor}
                      ledBrightness={ledBrightness}
                      setLedBrightness={setLedBrightness}
                      ledSpeed={ledSpeed}
                      setLedSpeed={setLedSpeed}
                      onSendCommand={handleLedControl}
                      isPending={ledMutation.isPending}
                    />
                    <DeviceStats
                      stats={deviceStats}
                      logs={deviceLogs}
                      onCommand={handleCommand}
                      isPending={commandMutation.isPending}
                    />
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
