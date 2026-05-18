// 管理端統一菜單配置 v3.0（情境式 5 群、2026-05-19 重構）
// 業主回饋：「整體超級複雜」、依使用情境（設計 / 設定 / 現場 / 紀錄 / 排解）重組
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Gamepad2,
  Library,
  Activity,
  Ticket,
  Cpu,
  QrCode,
  BarChart3,
  Trophy,
  Building2,
  Sliders,
  Key,
  UserCog,
  Users,
  FileText,
  Settings,
  Swords,
  MapPin,
  Clock,
  Calendar,
  DollarSign,
  Package,
  Smartphone,
  MessageCircle,
  LifeBuoy,
  RefreshCw,
  Receipt,
  ScrollText,
} from "lucide-react";

/** 場域模組 key（對應 FieldSettings 的 enableXxx 開關） */
export type MenuModuleKey = "battle" | "shooting" | "chapters" | "photo" | "gps" | "payment";

export interface AdminMenuItem {
  title: string;
  icon: LucideIcon;
  path: string;
  /** null 表示所有人都可見 */
  permission: string | null;
  /** 需要此場域模組啟用才顯示（undefined = 所有場域都顯示） */
  requiresModule?: MenuModuleKey;
  /** 🆕 v3：標記功能尚未實作、點擊顯示 coming-soon */
  comingSoon?: boolean;
}

export interface AdminMenuGroup {
  label: string;
  /** 視覺標記（emoji），讓不同分組一眼辨識 */
  emoji?: string;
  /** 主色（Tailwind 色系，影響分組 label 顏色） */
  accentColor?: string;
  /** 🆕 v3：一句話描述、給 onboarding tooltip 用 */
  description?: string;
  items: AdminMenuItem[];
}

/** 統一菜單定義 v3 — 依使用情境 5 群（設計 / 設定 / 現場 / 紀錄 / 排解） */
export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  // ═══════════════════════════════════════════════
  // 🎮 設計 — 偶爾、業主自己用：開發遊戲、設定活動、做素材
  // ═══════════════════════════════════════════════
  {
    label: "設計",
    emoji: "🎮",
    accentColor: "violet",
    description: "開發遊戲、設定活動、做素材",
    items: [
      { title: "遊戲管理", icon: Gamepad2, path: "/admin/games", permission: "game:view" },
      { title: "模組庫", icon: Library, path: "/admin/templates", permission: "game:create" },
      { title: "活動管理", icon: Activity, path: "/admin/activities", permission: "game:edit" },
      { title: "預約管理", icon: Calendar, path: "/admin/bookings", permission: "game:edit" },
      { title: "進行中場次", icon: Activity, path: "/admin/sessions", permission: "game:view" },
      { title: "即時連線監控", icon: Activity, path: "/admin/multi-sessions", permission: "game:view" },
      { title: "主控大螢幕", icon: Cpu, path: "/admin/host-sessions", permission: "game:create" },
      { title: "活動結束報告", icon: BarChart3, path: "/admin/reports", permission: "game:view" },
      { title: "元件健康度", icon: BarChart3, path: "/admin/component-health", permission: "game:view" },
      { title: "元件開關", icon: Sliders, path: "/admin/feature-flags", permission: "game:edit" },
      // 對戰系統（需啟用 battle 模組）
      { title: "對戰儀表板", icon: Swords, path: "/admin/battle/dashboard", permission: "game:view", requiresModule: "battle" },
      { title: "對戰場地", icon: MapPin, path: "/admin/battle/venues", permission: "game:view", requiresModule: "battle" },
      { title: "對戰時段", icon: Clock, path: "/admin/battle/slots", permission: "game:view", requiresModule: "battle" },
      { title: "對戰排名", icon: Trophy, path: "/admin/battle/rankings", permission: "game:view", requiresModule: "battle" },
      { title: "對戰賽季", icon: Calendar, path: "/admin/battle/seasons", permission: "game:view", requiresModule: "battle" },
    ],
  },

  // ═══════════════════════════════════════════════
  // 💰 現場 — 每天、工讀生 / 業主：POS 收款、報到、券核銷
  // ═══════════════════════════════════════════════
  {
    label: "現場",
    emoji: "💰",
    accentColor: "amber",
    description: "POS 收款、報到、券核銷（手機優先）",
    items: [
      { title: "POS 工作站", icon: DollarSign, path: "/pos", permission: "game:view" },
      { title: "QR 掃描", icon: QrCode, path: "/pos/scan", permission: "game:view" },
      { title: "今日預約", icon: Calendar, path: "/pos/bookings/today", permission: "game:view" },
      { title: "現場收款", icon: Receipt, path: "/pos/checkout", permission: "game:view" },
      { title: "券核銷", icon: Ticket, path: "/pos/voucher", permission: "game:view" },
      { title: "今日小結", icon: BarChart3, path: "/pos/summary", permission: "game:view" },
      { title: "設備管理", icon: Cpu, path: "/admin/devices", permission: "game:view", requiresModule: "shooting" },
      { title: "QR Code 發布", icon: QrCode, path: "/admin/qrcodes", permission: "qr:generate" },
    ],
  },

  // ═══════════════════════════════════════════════
  // 🆘 排解 — 發生時、業主 + 工讀：客人現場出問題 → 重來 / 退款 / 改梯次
  // ═══════════════════════════════════════════════
  {
    label: "排解",
    emoji: "🆘",
    accentColor: "red",
    description: "客人現場出問題：遊戲重來、退款、改梯次、玩家補償",
    items: [
      { title: "排解中心", icon: LifeBuoy, path: "/admin/troubleshoot", permission: "game:view" },
      { title: "遊戲重置", icon: RefreshCw, path: "/admin/troubleshoot/reset", permission: "game:edit" },
      { title: "退款處理", icon: Receipt, path: "/admin/troubleshoot/refund", permission: "field:manage" },
      { title: "預約調整", icon: Calendar, path: "/admin/troubleshoot/booking", permission: "game:edit", comingSoon: true },
      { title: "玩家補償", icon: Users, path: "/admin/troubleshoot/compensation", permission: "field:manage", comingSoon: true },
      { title: "排解紀錄", icon: ScrollText, path: "/admin/troubleshoot/logs", permission: "admin:view_audit", comingSoon: true },
    ],
  },

  // ═══════════════════════════════════════════════
  // 📊 紀錄 — 不定、業主：看數據、營收、玩家、操作歷史
  // ═══════════════════════════════════════════════
  {
    label: "紀錄",
    emoji: "📊",
    accentColor: "blue",
    description: "數據、營收、玩家、操作歷史",
    items: [
      { title: "儀表板", icon: LayoutDashboard, path: "/admin", permission: null },
      { title: "數據分析", icon: BarChart3, path: "/admin/analytics", permission: "game:view" },
      { title: "PWA 使用分析", icon: Smartphone, path: "/admin/pwa-analytics", permission: "game:view" },
      { title: "排行榜", icon: Trophy, path: "/admin/leaderboard", permission: "game:view" },
      { title: "玩家管理", icon: Users, path: "/admin/players", permission: "user:view" },
      // 財務（需啟用 payment 模組）
      { title: "營收總覽", icon: DollarSign, path: "/admin/revenue", permission: "game:view", requiresModule: "payment" },
      { title: "商品管理", icon: Library, path: "/admin/revenue/products", permission: "game:view", requiresModule: "payment" },
      { title: "兌換碼中心", icon: Ticket, path: "/admin/revenue/codes", permission: "game:view", requiresModule: "payment" },
      { title: "交易記錄", icon: Activity, path: "/admin/revenue/transactions", permission: "game:view", requiresModule: "payment" },
      { title: "操作記錄", icon: FileText, path: "/admin/audit-logs", permission: "admin:view_audit" },
    ],
  },

  // ═══════════════════════════════════════════════
  // ⚙️ 設定 — 偶爾、業主：場域、帳號、權限、計費
  // ═══════════════════════════════════════════════
  {
    label: "設定",
    emoji: "⚙️",
    accentColor: "slate",
    description: "場域、帳號、權限、計費、整合",
    items: [
      { title: "我的方案", icon: Package, path: "/admin/field/subscription", permission: "field:manage" },
      { title: "場域基本資料", icon: Building2, path: "/admin/fields", permission: "field:manage" },
      { title: "場域進階設定", icon: Sliders, path: "/admin/field-settings", permission: "field:manage" },
      { title: "LINE 設定", icon: MessageCircle, path: "/admin/line-settings", permission: "field:manage" },
      { title: "角色管理", icon: Key, path: "/admin/roles", permission: "user:manage_roles" },
      { title: "管理員帳號", icon: UserCog, path: "/admin/accounts", permission: "admin:manage_accounts" },
      { title: "系統設定", icon: Settings, path: "/admin/settings", permission: "field:manage" },
    ],
  },
];

/** 根據權限過濾菜單，回傳只包含有權限項目的分組 */
export function filterMenuByPermissions(
  groups: AdminMenuGroup[],
  hasPermission: (permission: string) => boolean,
): AdminMenuGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.permission === null || hasPermission(item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * 根據場域模組開關過濾菜單
 * - 沒指定 requiresModule 的項目 → 永遠顯示
 * - 有指定 → 該模組必須啟用才顯示
 * - modules === undefined（尚未載入）→ 暫時全顯示，避免閃爍
 */
export function filterMenuByModules(
  groups: AdminMenuGroup[],
  modules: Partial<Record<MenuModuleKey, boolean>> | undefined,
): AdminMenuGroup[] {
  if (!modules) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.requiresModule) return true;
        return modules[item.requiresModule] === true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/** 系統角色顯示名稱 */
export const SYSTEM_ROLE_LABELS: Record<string, string> = {
  super_admin: "超級管理員",
  field_manager: "場域管理員",
  field_director: "場域主管",
  field_executor: "場域執行者",
  custom: "自訂角色",
};
