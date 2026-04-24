// 管理儀表板 — 統一使用 UnifiedAdminLayout
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useMemo } from "react";
import OptimizedImage from "@/components/shared/OptimizedImage";
import { useCurrentField, type FieldModules } from "@/providers/FieldThemeProvider";
import type { Game, GameSession, ArduinoDevice, FieldSettings } from "@shared/schema";
import { daysUntilDate } from "@/lib/date-utils";
import { getDeviceIcon, DEVICE_TYPES } from "@/pages/admin-devices/constants";
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
  HelpCircle,
  Megaphone,
  AlertCircle,
} from "lucide-react";

/** 🆕 依時段產生個人化問候 */
function getAdminGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "☀️ 早安";
  if (h >= 11 && h < 14) return "🌞 午安";
  if (h >= 14 && h < 18) return "⛅ 午後愉快";
  if (h >= 18 && h < 22) return "🌅 辛苦了";
  return "🌙 夜深了";
}

export default function AdminDashboard() {
  const { admin, isAuthenticated, hasPermission } = useAdminAuth();
  const greeting = useMemo(() => getAdminGreeting(), []);
  const adminName = admin?.displayName || admin?.username || "管理員";
  // 🆕 只有 game:create 權限才顯示「新增遊戲」按鈕
  const canCreateGame = hasPermission("game:create");

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
  const offlineDevices = (devices?.length || 0) - onlineDevices;
  const publishedGames = games?.filter(g => g.status === "published").length || 0;
  const draftGames = games?.filter(g => g.status === "draft").length || 0;

  // 🆕 今日完成場次（精確過濾 completedAt 為今日）
  const todayCompleted = useMemo(() => {
    if (!sessions) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessions.filter((s) => {
      if (s.status !== "completed") return false;
      const completed = s.completedAt;
      if (!completed) return false;
      const d = new Date(completed);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;
  }, [sessions]);
  const totalCompleted = sessions?.filter(s => s.status === "completed").length || 0;

  // 🆕 依權限決定顯示哪些操作按鈕
  const actions = canCreateGame ? (
    <Link href="/admin/games/new">
      <Button className="gap-2" data-testid="button-new-game">
        <Plus className="w-4 h-4" />
        新增遊戲
      </Button>
    </Link>
  ) : null;

  return (
    <UnifiedAdminLayout title="管理儀表板" actions={actions}>
      {/* 🆕 時段個人化問候 */}
      <div className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="admin-greeting">
        <span>{greeting}，</span>
        <span className="font-medium text-foreground">{adminName}</span>
      </div>

      {/* 🆕 當前公告（僅有生效公告時顯示） */}
      <AnnouncementStatusCard />

      {/* 🆕 場域模組狀態 — 一眼看出本場域啟用了哪些功能 */}
      <FieldModulesCard />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* 🆕 stats 卡片改成可點擊 shortcut — 直接跳到對應管理頁 */}
        <Link href="/admin/games" data-testid="stats-published-games">
          <Card className="hover-elevate cursor-pointer transition-all">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">發布遊戲</CardTitle>
              <Gamepad2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-number text-3xl font-bold text-primary">
                {publishedGames}
              </div>
              <p className="text-xs text-muted-foreground">
                {draftGames > 0
                  ? `還有 ${draftGames} 個草稿 · 共 ${games?.length || 0} 個`
                  : `共 ${games?.length || 0} 個遊戲`}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sessions" data-testid="stats-active-sessions">
          <Card className="hover-elevate cursor-pointer transition-all">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                進行中場次
                {/* 🆕 有進行中場次時加脈衝綠點（「LIVE」指示） */}
                {activeSessions > 0 && (
                  <span className="relative flex h-2 w-2" aria-label="live">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                )}
              </CardTitle>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-number text-3xl font-bold text-success">
                {activeSessions}
              </div>
              <p className="text-xs text-muted-foreground">
                {activeSessions > 0 ? "目前有玩家進行中" : "目前無進行中場次"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/devices" data-testid="stats-online-devices">
          <Card className="hover-elevate cursor-pointer transition-all">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">在線設備</CardTitle>
              <Cpu className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {/* 🆕 依設備狀態切換顏色：有離線=警示紅、全在線=安全綠、無設備=muted */}
              <div
                className={`font-number text-3xl font-bold ${
                  (devices?.length || 0) === 0
                    ? "text-muted-foreground"
                    : offlineDevices > 0
                      ? "text-destructive"
                      : "text-success"
                }`}
              >
                {onlineDevices}
              </div>
              <p className="text-xs text-muted-foreground">
                {offlineDevices > 0
                  ? `${offlineDevices} 台離線 · 共 ${devices?.length || 0} 台`
                  : devices?.length
                    ? `共 ${devices.length} 台設備 · 全部在線`
                    : "尚未登錄任何設備"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sessions" data-testid="stats-today-completed">
          <Card className="hover-elevate cursor-pointer transition-all">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日完成</CardTitle>
              <Trophy className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-number text-3xl font-bold">
                {todayCompleted}
              </div>
              <p className="text-xs text-muted-foreground">
                {todayCompleted > 0
                  ? `場遊戲完成 · 累計 ${totalCompleted}`
                  : `累計 ${totalCompleted} 場`}
              </p>
            </CardContent>
          </Card>
        </Link>
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
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* 🆕 有封面就顯示縮圖，沒則 icon fallback */}
                      {game.coverImageUrl ? (
                        <div className="w-10 h-10 rounded overflow-hidden shrink-0 bg-muted">
                          <OptimizedImage
                            src={game.coverImageUrl}
                            alt={game.title}
                            preset="thumbnail"
                            className="w-full h-full object-cover"
                            loading="lazy"
                            fallback={
                              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                <Gamepad2 className="w-5 h-5 text-primary" />
                              </div>
                            }
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <Gamepad2 className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{game.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {game.estimatedTime || 30} 分鐘
                        </p>
                      </div>
                    </div>
                    <Badge variant={game.status === "published" ? "default" : "secondary"} className="shrink-0">
                      {game.status === "published" ? "已發布" : "草稿"}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Gamepad2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="mb-3">尚無遊戲</p>
                {canCreateGame && (
                  <Link href="/admin/games/new">
                    <Button size="sm" variant="outline" className="gap-1.5" data-testid="btn-empty-new-game">
                      <Plus className="w-3.5 h-3.5" />
                      建立第一個遊戲
                    </Button>
                  </Link>
                )}
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
                {devices.slice(0, 5).map((device) => {
                  // 🆕 依 deviceType 換 icon（射擊靶機=Target、感應器=Radio 等）
                  const DeviceIcon = getDeviceIcon(device.deviceType);
                  const typeLabel =
                    DEVICE_TYPES.find((t) => t.value === device.deviceType)?.label
                      || device.deviceType
                      || "未知類型";
                  return (
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
                          <DeviceIcon className={`w-5 h-5 ${
                            device.status === "online"
                              ? "text-success"
                              : "text-muted-foreground"
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{device.deviceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {typeLabel}
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
                  );
                })}
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
// 🆕 當前公告狀態卡片
// ═══════════════════════════════════════════════════════════════

function AnnouncementStatusCard() {
  const field = useCurrentField();
  const announcement = field?.announcement;
  const severity = field?.announcementSeverity ?? "info";
  const endAt = field?.announcementEndAt;

  // 沒公告就不佔版面
  if (!announcement) return null;

  // 🆕 剩餘天數 — Dashboard 版加「下架」讓語意完整
  const days = daysUntilDate(endAt);
  let remainingLabel: string | null = null;
  if (days !== null) {
    if (days > 1) remainingLabel = `剩 ${days} 天下架`;
    else if (days === 1) remainingLabel = "明天下架";
    else if (days === 0) remainingLabel = "今日最後一天";
  }

  // 🆕 依 severity 切換視覺
  const isUrgent = severity === "urgent";
  const Icon = isUrgent ? AlertCircle : Megaphone;
  const cardClass = isUrgent
    ? "mb-6 bg-red-500/5 border-red-500/50"
    : "mb-6 bg-amber-500/5 border-amber-500/40";
  const iconClass = isUrgent
    ? "text-red-600 dark:text-red-400"
    : "text-amber-600 dark:text-amber-400";
  const textClass = isUrgent
    ? "text-red-700 dark:text-red-300"
    : "text-amber-700 dark:text-amber-300";
  const label = isUrgent
    ? "🚨 緊急公告顯示中（玩家端紅色 banner · 不可關閉）"
    : "🔔 當前公告顯示中（玩家端所有頁面可見）";

  return (
    <Link href="/admin/field-settings?tab=intro" className="block">
      <Card
        className={`${cardClass} cursor-pointer hover-elevate transition-all`}
        data-testid="dashboard-announcement-card"
        data-severity={severity}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {remainingLabel && (
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground cursor-help"
                      title={endAt ? `公告結束日：${endAt}` : ""}
                    >
                      ⏱ {remainingLabel}
                    </span>
                  )}
                </div>
                <p className={`text-sm font-medium leading-relaxed ${textClass}`}>
                  {announcement}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1 shrink-0 pointer-events-none" data-testid="btn-edit-announcement">
              編輯 <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🆕 場域模組狀態卡片
// ═══════════════════════════════════════════════════════════════

interface ModuleDef {
  key: keyof FieldModules;
  /** 對應 fields.settings jsonb 中的 key（PATCH 時用） */
  settingsKey: keyof FieldSettings;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 卡片下方短說明 */
  description: string;
  /** 🆕 hover tooltip 的完整說明（啟用條件 + 影響範圍） */
  helpText: string;
}

const MODULES_TO_SHOW: ModuleDef[] = [
  {
    key: "shooting",
    settingsKey: "enableShootingMission",
    label: "射擊任務",
    icon: Target,
    description: "硬體靶機",
    helpText:
      "需要實體 Arduino 靶機設備才能使用。啟用後：玩家端遊戲可加入射擊關卡、後台側邊欄顯示「🔌 設備管理」菜單。",
  },
  {
    key: "battle",
    settingsKey: "enableBattleArena",
    label: "水彈對戰",
    icon: Swords,
    description: "PK 擂台",
    helpText:
      "提供多人對戰場地預約 + 排名系統。啟用後：玩家 Home 顯示「水彈對戰 PK 擂台」快速入口、後台側邊欄顯示「⚔️ 對戰中心」5 個菜單。僅有實體水彈 / 漆彈場地的場域才需啟用。",
  },
  {
    key: "gps",
    settingsKey: "enableGpsMission",
    label: "GPS 定位",
    icon: MapPin,
    description: "地點導航",
    helpText:
      "啟用後：遊戲可加入地點導航關卡，玩家手機需開啟定位權限，抵達指定座標才觸發任務完成。適合景點巡禮、市集走踏類遊戲。",
  },
  {
    key: "photo",
    settingsKey: "enablePhotoMission",
    label: "拍照驗證",
    icon: Camera,
    description: "AI 照片",
    helpText:
      "啟用後：遊戲可加入拍照關卡，玩家上傳照片後透過 AI（Gemini/OpenRouter）驗證內容是否符合要求。需先在「AI 設定」Tab 設好 API Key。",
  },
  {
    key: "chapters",
    settingsKey: "enableChapters",
    label: "章節遊戲",
    icon: BookOpen,
    description: "劇情推進",
    helpText:
      "啟用後：遊戲可拆分多個章節，玩家需依序完成（或依解鎖規則），適合有劇情連貫性的主題遊戲。不啟用時遊戲只能用單一頁面模式。",
  },
  {
    key: "payment",
    settingsKey: "enablePayment",
    label: "收費功能",
    icon: DollarSign,
    description: "兌換碼 / 付費",
    helpText:
      "啟用後：遊戲可設定收費或兌換碼才能進入，後台側邊欄顯示「💰 財務中心」（4 個菜單：營收/商品/兌換碼/交易）。若場域為免費開放，不用啟用。",
  },
];

function FieldModulesCard() {
  const { admin, hasPermission } = useAdminAuth();
  const field = useCurrentField();
  const modules = field?.modules;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission("field:manage");

  // 🆕 切換模組開關 — 直接 PATCH，成功後 invalidate cache 讓 UI 自動反映
  const toggleMutation = useMutation({
    mutationFn: async ({ settingsKey, enabled }: { settingsKey: keyof FieldSettings; enabled: boolean }) => {
      if (!admin?.fieldId) throw new Error("沒有場域 ID");
      const res = await apiRequest("PATCH", `/api/admin/fields/${admin.fieldId}/settings`, {
        [settingsKey]: enabled,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "切換失敗");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      // 清掉 field theme cache 讓菜單/玩家端立刻重新拉新 modules
      queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
      const mod = MODULES_TO_SHOW.find((m) => m.settingsKey === vars.settingsKey);
      toast({
        title: vars.enabled ? `✅ 已啟用「${mod?.label}」` : `⏸️ 已停用「${mod?.label}」`,
        description: vars.enabled
          ? "玩家端和後台菜單會立即顯示相關項目"
          : "玩家端和後台菜單自動隱藏相關項目",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "切換失敗",
        description: err instanceof Error ? err.message : "請稍後重試",
        variant: "destructive",
      });
      // 失敗也 invalidate，讓 UI 從伺服器拉回真實狀態
      queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
    },
  });

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
              {canManage
                ? "點下方開關即時啟用/停用；啟用狀態同步到玩家端和後台菜單"
                : "啟用的模組會顯示於玩家端 + 後台；聯繫管理員修改"}
            </p>
          </div>
          <Link href="/admin/field-settings">
            <Button variant="outline" size="sm" className="gap-1" data-testid="btn-field-settings">
              詳細設定 <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {MODULES_TO_SHOW.map((m) => {
            const enabled = modules[m.key];
            const Icon = m.icon;
            const pending = toggleMutation.isPending && toggleMutation.variables?.settingsKey === m.settingsKey;
            return (
              <div
                key={m.key}
                className={`rounded-lg border-2 p-3 transition-all relative ${
                  enabled
                    ? "border-primary/40 bg-primary/5"
                    : "border-dashed border-muted-foreground/20 bg-muted/30"
                } ${pending ? "opacity-70" : ""}`}
                data-testid={`module-badge-${m.key}`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <Icon
                    className={`w-5 h-5 ${
                      enabled ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  {/* 🆕 內嵌 Switch：有權限的管理員可直接切換 */}
                  {canManage ? (
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) =>
                        toggleMutation.mutate({ settingsKey: m.settingsKey, enabled: v })
                      }
                      disabled={toggleMutation.isPending}
                      className="scale-75 origin-top-right"
                      data-testid={`module-switch-${m.key}`}
                    />
                  ) : (
                    enabled && (
                      <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                    )
                  )}
                </div>
                {/* 🆕 label 旁邊加 help tooltip */}
                <div className="flex items-center gap-1">
                  <p
                    className={`font-semibold text-xs ${
                      enabled ? "" : "text-muted-foreground"
                    }`}
                  >
                    {m.label}
                  </p>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground/50 hover:text-primary transition-colors cursor-help"
                        aria-label={`${m.label} 說明`}
                        data-testid={`module-help-${m.key}`}
                      >
                        <HelpCircle className="w-3 h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs">
                      <p className="font-semibold mb-1">{m.label}</p>
                      <p className="leading-relaxed">{m.helpText}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
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
