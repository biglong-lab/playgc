// 🗂️ 平台管理後台 Sidebar 結構配置
//
// 本檔案定義 PlatformAdminLayout 的選單樹結構。
// 變更選單需修改本檔案；管理員可透過 /platform/menu-management 做即時 override（顯示/隱藏/重命名/排序）。
//
// 為什麼抽出來：layout 和 menu management 頁面都需要這份結構
import {
  Globe,
  LayoutDashboard,
  Building2,
  Package,
  DollarSign,
  ToggleLeft,
  Inbox,
  BarChart3,
  Settings,
  Users,
  Shield,
  ScrollText,
  Ticket,
  AlertTriangle,
  Activity,
  Layers,
  TrendingUp,
  Sparkles,
  Bug,
  Heart,
  Key,
  KeyRound,
  Smartphone,
  Mail,
  ListTree,
  MessageCircle,
} from "lucide-react";

export interface PlatformMenuItemDef {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface PlatformMenuGroupDef {
  label: string;
  items: PlatformMenuItemDef[];
}

/**
 * 平台選單結構（hardcoded）
 *
 * 修改規則：
 * - 新增 → 直接加進對應分組
 * - 移除 → 不要刪除整項；改為設定 visible=false（透過 menu management）
 * - 重命名 → 改 label；admin 可透過 menu management override
 * - 重新分組 → admin 可透過 menu management 設 customGroup
 */
export const PLATFORM_MENU_GROUPS: PlatformMenuGroupDef[] = [
  {
    label: "平台總覽",
    items: [
      { label: "儀表板", path: "/platform", icon: LayoutDashboard },
      { label: "數據洞察", path: "/platform/insights", icon: TrendingUp },
      { label: "跨場域數據", path: "/platform/analytics", icon: BarChart3 },
      { label: "用量監控", path: "/platform/usage", icon: Activity },
      { label: "AI 訓練中心", path: "/platform/ai-center", icon: Sparkles },
    ],
  },
  {
    label: "場域與方案",
    items: [
      { label: "場域管理", path: "/platform/fields", icon: Building2 },
      { label: "場域申請", path: "/platform/applications", icon: Inbox },
      { label: "訂閱方案", path: "/platform/plans", icon: Package },
      { label: "功能開關", path: "/platform/feature-flags", icon: ToggleLeft },
      { label: "批量操作", path: "/platform/bulk-ops", icon: Layers },
    ],
  },
  {
    label: "客服支援",
    items: [
      { label: "客服工單", path: "/platform/tickets", icon: Ticket },
      { label: "通訊中心", path: "/platform/notifications", icon: Mail },
    ],
  },
  {
    label: "財務",
    items: [
      { label: "平台營收", path: "/platform/revenue", icon: DollarSign },
      { label: "計費警示", path: "/platform/billing-alerts", icon: AlertTriangle },
    ],
  },
  {
    label: "權限與安全",
    items: [
      { label: "跨場域管理員", path: "/platform/admins", icon: Users },
      { label: "跨場域角色", path: "/platform/roles", icon: Shield },
      { label: "稽核日誌", path: "/platform/audit-logs", icon: ScrollText },
      { label: "安全機制", path: "/platform/security", icon: Shield },
      { label: "IP 白名單", path: "/platform/ip-whitelist", icon: Globe },
      { label: "API 金鑰", path: "/platform/api-keys", icon: Key },
    ],
  },
  {
    label: "系統運維",
    items: [
      { label: "系統健康", path: "/platform/health", icon: Heart },
      { label: "錯誤記錄", path: "/platform/errors", icon: Bug },
      { label: "登入管理", path: "/platform/login-config", icon: KeyRound },
      { label: "PWA 管理", path: "/platform/pwa", icon: Smartphone },
    ],
  },
  {
    label: "系統",
    items: [
      { label: "選單管理", path: "/platform/menu-management", icon: ListTree },
      { label: "平台設定", path: "/platform/settings", icon: Settings },
    ],
  },
];

/**
 * Override map（從 API 取得）
 */
export interface PlatformMenuOverride {
  customLabel: string | null;
  visible: boolean;
  sortOrder: number;
  customGroup: string | null;
}

export type PlatformMenuOverrideMap = Record<string, PlatformMenuOverride>;

/**
 * 將 overrides 套用到 hardcoded menu groups，產生最終要顯示的選單樹
 *
 * 規則：
 * - visible=false → 整項不顯示
 * - customLabel → 取代原 label
 * - customGroup → 移到指定分組（若不存在會建立新分組）
 * - sortOrder → 在分組內由小到大排列
 */
export function applyMenuOverrides(
  groups: PlatformMenuGroupDef[],
  overrides: PlatformMenuOverrideMap | undefined,
): PlatformMenuGroupDef[] {
  if (!overrides || Object.keys(overrides).length === 0) {
    return groups;
  }

  // 先收集所有 items（保留原分組資訊）
  const allItems: Array<{ item: PlatformMenuItemDef; originalGroup: string }> = [];
  for (const group of groups) {
    for (const item of group.items) {
      allItems.push({ item, originalGroup: group.label });
    }
  }

  // 套用 overrides + 過濾隱藏
  const visibleItems: Array<{
    item: PlatformMenuItemDef;
    targetGroup: string;
    sortOrder: number;
  }> = [];

  for (const { item, originalGroup } of allItems) {
    const override = overrides[item.path];
    if (override && override.visible === false) continue;

    const finalItem: PlatformMenuItemDef = {
      ...item,
      label: override?.customLabel || item.label,
    };

    visibleItems.push({
      item: finalItem,
      targetGroup: override?.customGroup || originalGroup,
      sortOrder: override?.sortOrder ?? 0,
    });
  }

  // 按 customGroup 重新分組
  const groupMap = new Map<string, Array<{ item: PlatformMenuItemDef; sortOrder: number }>>();
  // 保持原分組順序
  const groupOrder: string[] = [];
  for (const group of groups) {
    groupOrder.push(group.label);
    groupMap.set(group.label, []);
  }

  for (const { item, targetGroup, sortOrder } of visibleItems) {
    if (!groupMap.has(targetGroup)) {
      groupMap.set(targetGroup, []);
      groupOrder.push(targetGroup);
    }
    groupMap.get(targetGroup)!.push({ item, sortOrder });
  }

  // 排序 + 組裝結果
  const result: PlatformMenuGroupDef[] = [];
  for (const groupLabel of groupOrder) {
    const items = groupMap.get(groupLabel);
    if (!items || items.length === 0) continue;
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    result.push({
      label: groupLabel,
      items: items.map((x) => x.item),
    });
  }
  return result;
}
