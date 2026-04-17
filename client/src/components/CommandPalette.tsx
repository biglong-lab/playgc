// ⌨️ Cmd+K 全域快速跳轉 — 管理員生產力神器
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Gamepad2,
  Swords,
  DollarSign,
  Building2,
  BarChart3,
  Trophy,
  Package,
  Ticket,
  Receipt,
  Globe,
  ToggleLeft,
  Sliders,
  Users,
  Key,
  UserCog,
  FileText,
  Settings,
  MapPin,
  Clock,
  Calendar,
  Library,
  Activity,
  Cpu,
  QrCode,
  Inbox,
} from "lucide-react";

interface CommandItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  group: string;
  emoji?: string;
}

const COMMANDS: CommandItem[] = [
  // 📊 總覽
  { label: "儀表板", path: "/admin", icon: LayoutDashboard, group: "📊 總覽" },
  { label: "數據分析", path: "/admin/analytics", icon: BarChart3, group: "📊 總覽" },
  { label: "排行榜", path: "/admin/leaderboard", icon: Trophy, group: "📊 總覽" },

  // 🎮 遊戲中心
  { label: "遊戲管理", path: "/admin/games", icon: Gamepad2, group: "🎮 遊戲中心", keywords: ["game", "task"] },
  { label: "模組庫", path: "/admin/templates", icon: Library, group: "🎮 遊戲中心", keywords: ["template", "module"] },
  { label: "進行中場次", path: "/admin/sessions", icon: Activity, group: "🎮 遊戲中心", keywords: ["session", "live"] },
  { label: "設備管理", path: "/admin/devices", icon: Cpu, group: "🎮 遊戲中心", keywords: ["device", "led"] },
  { label: "QR Code 發布", path: "/admin/qrcodes", icon: QrCode, group: "🎮 遊戲中心" },

  // ⚔️ 對戰中心
  { label: "對戰儀表板", path: "/admin/battle/dashboard", icon: Swords, group: "⚔️ 對戰中心", keywords: ["battle", "pk"] },
  { label: "場地管理", path: "/admin/battle/venues", icon: MapPin, group: "⚔️ 對戰中心", keywords: ["venue"] },
  { label: "時段管理", path: "/admin/battle/slots", icon: Clock, group: "⚔️ 對戰中心", keywords: ["slot", "schedule"] },
  { label: "對戰排名", path: "/admin/battle/rankings", icon: Trophy, group: "⚔️ 對戰中心", keywords: ["elo", "rank"] },
  { label: "賽季管理", path: "/admin/battle/seasons", icon: Calendar, group: "⚔️ 對戰中心", keywords: ["season"] },

  // 💰 財務中心
  { label: "營收總覽", path: "/admin/revenue", icon: DollarSign, group: "💰 財務中心", keywords: ["revenue", "income"] },
  { label: "商品管理", path: "/admin/revenue/products", icon: Package, group: "💰 財務中心", keywords: ["product", "pricing"] },
  { label: "兌換碼中心", path: "/admin/revenue/codes", icon: Ticket, group: "💰 財務中心", keywords: ["redeem", "coupon"] },
  { label: "交易記錄", path: "/admin/revenue/transactions", icon: Receipt, group: "💰 財務中心", keywords: ["transaction", "purchase"] },

  // 🏢 場域總部
  { label: "我的方案", path: "/admin/field/subscription", icon: Package, group: "🏢 場域總部", keywords: ["plan", "subscription"] },
  { label: "場域基本資料", path: "/admin/fields", icon: Building2, group: "🏢 場域總部", keywords: ["field", "venue"] },
  { label: "場域進階設定", path: "/admin/field-settings", icon: Sliders, group: "🏢 場域總部", keywords: ["settings", "ai"] },
  { label: "角色管理", path: "/admin/roles", icon: Key, group: "🏢 場域總部", keywords: ["role", "permission"] },
  { label: "管理員帳號", path: "/admin/accounts", icon: UserCog, group: "🏢 場域總部", keywords: ["admin", "account"] },
  { label: "玩家管理", path: "/admin/players", icon: Users, group: "🏢 場域總部", keywords: ["player", "user"] },
  { label: "操作記錄", path: "/admin/audit-logs", icon: FileText, group: "🏢 場域總部", keywords: ["audit", "log"] },
  { label: "系統設定", path: "/admin/settings", icon: Settings, group: "🏢 場域總部" },

  // 🌐 平台層
  { label: "平台儀表板", path: "/platform", icon: Globe, group: "🌐 平台管理", keywords: ["platform"] },
  { label: "所有場域", path: "/platform/fields", icon: Building2, group: "🌐 平台管理", keywords: ["tenant", "field"] },
  { label: "場域申請審核", path: "/platform/applications", icon: Inbox, group: "🌐 平台管理", keywords: ["application", "apply", "review"] },
  { label: "訂閱方案", path: "/platform/plans", icon: Package, group: "🌐 平台管理", keywords: ["plan", "pricing"] },
  { label: "功能開關", path: "/platform/feature-flags", icon: ToggleLeft, group: "🌐 平台管理", keywords: ["feature", "flag"] },
  { label: "平台營收", path: "/platform/revenue", icon: DollarSign, group: "🌐 平台管理", keywords: ["mrr", "revenue"] },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const goto = (path: string) => {
    setOpen(false);
    setLocation(path);
  };

  // 依 group 分組
  const grouped = COMMANDS.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="搜尋頁面或功能... (輸入關鍵字)" />
      <CommandList>
        <CommandEmpty>找不到結果</CommandEmpty>
        {Object.entries(grouped).map(([group, items], idx) => (
          <div key={group}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((item) => {
                const Icon = item.icon;
                const searchText = [item.label, ...(item.keywords ?? [])].join(" ");
                return (
                  <CommandItem
                    key={item.path}
                    value={searchText}
                    onSelect={() => goto(item.path)}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    <span>{item.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground font-mono">
                      {item.path}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
