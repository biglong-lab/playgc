// 管理端統一菜單配置 v2.0（SaaS 重構 Phase 2）
// 五大中心分組 + 向後相容保留所有現有路徑
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
} from "lucide-react";

/** 場域模組 key（對應 FieldSettings 的 enableXxx 開關） */
export type MenuModuleKey = "battle" | "shooting" | "chapters" | "photo" | "gps" | "payment";

export interface AdminMenuItem {
  title: string;
  icon: LucideIcon;
  path: string;
  /** null 表示所有人都可見 */
  permission: string | null;
  /** 🆕 需要此場域模組啟用才顯示（undefined = 所有場域都顯示） */
  requiresModule?: MenuModuleKey;
}

export interface AdminMenuGroup {
  label: string;
  /** 視覺標記（emoji），讓不同分組一眼辨識 */
  emoji?: string;
  /** 主色（Tailwind 色系，影響分組 label 顏色） */
  accentColor?: string;
  items: AdminMenuItem[];
}

/** 統一菜單定義 — 五大中心 + 系統記錄 */
export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  // ═══════════════════════════════════════════════
  // 📊 系統總覽
  // ═══════════════════════════════════════════════
  {
    label: "系統總覽",
    emoji: "📊",
    accentColor: "slate",
    items: [
      { title: "儀表板", icon: LayoutDashboard, path: "/admin", permission: null },
      { title: "數據分析", icon: BarChart3, path: "/admin/analytics", permission: "game:view" },
      { title: "排行榜", icon: Trophy, path: "/admin/leaderboard", permission: "game:view" },
    ],
  },

  // ═══════════════════════════════════════════════
  // 🎮 遊戲中心
  // ═══════════════════════════════════════════════
  {
    label: "遊戲中心",
    emoji: "🎮",
    accentColor: "violet",
    items: [
      { title: "遊戲管理", icon: Gamepad2, path: "/admin/games", permission: "game:view" },
      { title: "模組庫", icon: Library, path: "/admin/templates", permission: "game:create" },
      { title: "進行中場次", icon: Activity, path: "/admin/sessions", permission: "game:view" },
      { title: "設備管理", icon: Cpu, path: "/admin/devices", permission: "game:view" },
      { title: "QR Code 發布", icon: QrCode, path: "/admin/qrcodes", permission: "qr:generate" },
    ],
  },

  // ═══════════════════════════════════════════════
  // ⚔️ 對戰中心 — 🆕 需啟用 battle 模組才顯示
  // ═══════════════════════════════════════════════
  {
    label: "對戰中心",
    emoji: "⚔️",
    accentColor: "rose",
    items: [
      { title: "對戰儀表板", icon: Swords, path: "/admin/battle/dashboard", permission: "game:view", requiresModule: "battle" },
      { title: "場地管理", icon: MapPin, path: "/admin/battle/venues", permission: "game:view", requiresModule: "battle" },
      { title: "時段管理", icon: Clock, path: "/admin/battle/slots", permission: "game:view", requiresModule: "battle" },
      { title: "排名管理", icon: Trophy, path: "/admin/battle/rankings", permission: "game:view", requiresModule: "battle" },
      { title: "賽季管理", icon: Calendar, path: "/admin/battle/seasons", permission: "game:view", requiresModule: "battle" },
    ],
  },

  // ═══════════════════════════════════════════════
  // 💰 財務中心（Phase 3 建置中）
  // ═══════════════════════════════════════════════
  {
    label: "財務中心",
    emoji: "💰",
    accentColor: "emerald",
    items: [
      { title: "營收總覽", icon: DollarSign, path: "/admin/revenue", permission: "game:view" },
      { title: "商品管理", icon: Library, path: "/admin/revenue/products", permission: "game:view" },
      { title: "兌換碼中心", icon: Ticket, path: "/admin/revenue/codes", permission: "game:view" },
      { title: "交易記錄", icon: Activity, path: "/admin/revenue/transactions", permission: "game:view" },
      // 退款管理、金流設定 — Phase 3 後續加入
    ],
  },

  // ═══════════════════════════════════════════════
  // 🏢 場域總部
  // ═══════════════════════════════════════════════
  {
    label: "場域總部",
    emoji: "🏢",
    accentColor: "blue",
    items: [
      { title: "我的方案", icon: Package, path: "/admin/field/subscription", permission: "field:manage" },
      { title: "場域基本資料", icon: Building2, path: "/admin/fields", permission: "field:manage" },
      { title: "場域進階設定", icon: Sliders, path: "/admin/field-settings", permission: "field:manage" },
      { title: "角色管理", icon: Key, path: "/admin/roles", permission: "user:manage_roles" },
      { title: "管理員帳號", icon: UserCog, path: "/admin/accounts", permission: "admin:manage_accounts" },
      { title: "玩家管理", icon: Users, path: "/admin/players", permission: "user:view" },
      { title: "操作記錄", icon: FileText, path: "/admin/audit-logs", permission: "admin:view_audit" },
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
 * 🆕 根據場域模組開關過濾菜單
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
