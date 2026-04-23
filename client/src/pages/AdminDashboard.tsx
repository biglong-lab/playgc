// 管理儀表板 — 統一使用 UnifiedAdminLayout
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useCurrentField, type FieldModules } from "@/providers/FieldThemeProvider";
import type { Game, GameSession, ArduinoDevice, FieldSettings } from "@shared/schema";
import {
  Gamepad2,
  Plus,
  Cpu,
  Activity,
  Trophy,
  Zap,
  Target,
  Swords,
  MapPin,
  Camera,
  BookOpen,
  DollarSign,
  Settings2,
  Check,
  ArrowRight,
} from "lucide-react";

export default function AdminDashboard() {
  const { isAuthenticated } = useAdminAuth();

  const { data: games } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
    enabled: isAuthenticated,
  });

  const { data: sessions } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
    enabled: isAuthenticated,
  });

  const { data: devices } = useQuery<ArduinoDevice[]>({
    queryKey: ["/api/devices"],
    enabled: isAuthenticated,
  });

  const activeSessions = sessions?.filter(s => s.status === "playing").length || 0;
  const onlineDevices = devices?.filter(d => d.status === "online").length || 0;
  const publishedGames = games?.filter(g => g.status === "published").length || 0;

  const actions = (
    <Link href="/admin/games/new">
      <Button className="gap-2" data-testid="button-new-game">
        <Plus className="w-4 h-4" />
        新增遊戲
      </Button>
    </Link>
  );

  return (
    <UnifiedAdminLayout title="管理儀表板" actions={actions}>
      {/* 🆕 場域模組狀態 — 一眼看出本場域啟用了哪些功能 */}
      <FieldModulesCard />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">發布遊戲</CardTitle>
            <Gamepad2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-number text-3xl font-bold text-primary">
              {publishedGames}
            </div>
            <p className="text-xs text-muted-foreground">
              共 {games?.length || 0} 個遊戲
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">進行中場次</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-number text-3xl font-bold text-success">
              {activeSessions}
            </div>
            <p className="text-xs text-muted-foreground">
              目前有玩家進行中
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">在線設備</CardTitle>
            <Cpu className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-number text-3xl font-bold text-warning">
              {onlineDevices}
            </div>
            <p className="text-xs text-muted-foreground">
              共 {devices?.length || 0} 台設備
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日完成</CardTitle>
            <Trophy className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-number text-3xl font-bold">
              {sessions?.filter(s => s.status === "completed").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              場遊戲完成
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              最近遊戲
              <Link href="/admin/games">
                <Button variant="ghost" size="sm">查看全部</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {games && games.length > 0 ? (
              <div className="space-y-3">
                {games.slice(0, 5).map((game) => (
                  <Link
                    key={game.id}
                    href={`/admin/games/${game.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover-elevate cursor-pointer"
                    data-testid={`link-game-${game.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                        <Gamepad2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{game.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {game.estimatedTime || 30} 分鐘
                        </p>
                      </div>
                    </div>
                    <Badge variant={game.status === "published" ? "default" : "secondary"}>
                      {game.status === "published" ? "已發布" : "草稿"}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Gamepad2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>尚無遊戲</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              設備狀態
              <Link href="/admin/devices">
                <Button variant="ghost" size="sm">查看全部</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {devices && devices.length > 0 ? (
              <div className="space-y-3">
                {devices.slice(0, 5).map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded flex items-center justify-center ${
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
                        <p className="font-medium text-sm">{device.deviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          {device.deviceType || "未知類型"}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={device.status === "online" ? "default" : "secondary"}
                      className={device.status === "online" ? "bg-success" : ""}
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      {device.status === "online" ? "在線" : "離線"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Cpu className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>尚無設備</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UnifiedAdminLayout>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🆕 場域模組狀態卡片
// ═══════════════════════════════════════════════════════════════

interface ModuleDef {
  key: keyof FieldModules;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const MODULES_TO_SHOW: ModuleDef[] = [
  { key: "shooting", label: "射擊任務", icon: Target, description: "硬體靶機" },
  { key: "battle", label: "水彈對戰", icon: Swords, description: "PK 擂台" },
  { key: "gps", label: "GPS 定位", icon: MapPin, description: "地點導航" },
  { key: "photo", label: "拍照驗證", icon: Camera, description: "AI 照片" },
  { key: "chapters", label: "章節遊戲", icon: BookOpen, description: "劇情推進" },
  { key: "payment", label: "收費功能", icon: DollarSign, description: "兌換碼 / 付費" },
];

function FieldModulesCard() {
  const field = useCurrentField();
  const modules = field?.modules;

  // 未載入 → 骨架（輕量）
  if (!modules) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4 text-sm text-muted-foreground">
          讀取場域模組狀態中...
        </CardContent>
      </Card>
    );
  }

  const enabledCount = MODULES_TO_SHOW.filter((m) => modules[m.key]).length;

  return (
    <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              場域模組 · {field?.name || "當前場域"}
              <Badge variant="outline" className="ml-2 font-mono text-xs">
                {enabledCount}/{MODULES_TO_SHOW.length} 啟用
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              啟用的模組會顯示於玩家端 + 後台；未啟用的自動隱藏
            </p>
          </div>
          <Link href="/admin/field-settings">
            <Button variant="outline" size="sm" className="gap-1" data-testid="btn-field-settings">
              前往設定 <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {MODULES_TO_SHOW.map((m) => {
            const enabled = modules[m.key];
            const Icon = m.icon;
            return (
              <div
                key={m.key}
                className={`rounded-lg border-2 p-3 transition-all ${
                  enabled
                    ? "border-primary/40 bg-primary/5"
                    : "border-dashed border-muted-foreground/20 bg-muted/30 opacity-60"
                }`}
                data-testid={`module-badge-${m.key}`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <Icon
                    className={`w-5 h-5 ${
                      enabled ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  {enabled && (
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  )}
                </div>
                <p
                  className={`font-semibold text-xs ${
                    enabled ? "" : "text-muted-foreground"
                  }`}
                >
                  {m.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {m.description}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
