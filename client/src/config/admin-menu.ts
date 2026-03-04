// 管理端統一菜單配置
// 所有管理頁面的菜單定義集中在此，依權限動態過濾
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
  Medal,
  Calendar,
} from "lucide-react";

export interface AdminMenuItem {
  title: string;
  icon: LucideIcon;
  path: string;
  /** null 表示所有人都可見 */
  permission: string | null;
}

export interface AdminMenuGroup {
  label: string;
  items: AdminMenuItem[];
}

/** 統一菜單定義（6 組 17 項） */
export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  {
    label: "系統總覽",
    items: [
      { title: "儀表板", icon: LayoutDashboard, path: "/admin", permission: null },
    ],
  },
  {
    label: "場域營運",
    items: [
      { title: "遊戲管理", icon: Gamepad2, path: "/admin/games", permission: "game:view" },
      { title: "模組庫", icon: Library, path: "/admin/templates", permission: "game:create" },
      { title: "進行中場次", icon: Activity, path: "/admin/sessions", permission: "game:view" },
      { title: "票券/收款", icon: Ticket, path: "/admin/tickets", permission: "game:view" },
      { title: "設備管理", icon: Cpu, path: "/admin/devices", permission: "game:view" },
      { title: "QR Code", icon: QrCode, path: "/admin/qrcodes", permission: "qr:generate" },
    ],
  },
  {
    label: "數據與排行",
    items: [
      { title: "數據分析", icon: BarChart3, path: "/admin/analytics", permission: "game:view" },
      { title: "排行榜", icon: Trophy, path: "/admin/leaderboard", permission: "game:view" },
    ],
  },
  {
    label: "場域設定",
    items: [
      { title: "場域基本資料", icon: Building2, path: "/admin/fields", permission: "field:manage" },
      { title: "場域進階設定", icon: Sliders, path: "/admin/field-settings", permission: "field:manage" },
      { title: "系統設定", icon: Settings, path: "/admin/settings", permission: "field:manage" },
    ],
  },
  {
    label: "權限管理",
    items: [
      { title: "角色管理", icon: Key, path: "/admin/roles", permission: "user:manage_roles" },
      { title: "管理員帳號", icon: UserCog, path: "/admin/accounts", permission: "admin:manage_accounts" },
      { title: "玩家管理", icon: Users, path: "/admin/players", permission: "user:view" },
    ],
  },
  {
    label: "系統記錄",
    items: [
      { title: "操作記錄", icon: FileText, path: "/admin/audit-logs", permission: "admin:view_audit" },
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

/** 系統角色顯示名稱 */
export const SYSTEM_ROLE_LABELS: Record<string, string> = {
  super_admin: "超級管理員",
  field_manager: "場域管理員",
  field_director: "場域主管",
  field_executor: "場域執行者",
  custom: "自訂角色",
};
