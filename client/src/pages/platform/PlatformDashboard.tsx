// 🌐 平台儀表板 — SaaS 平台總覽
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Package,
  ToggleLeft,
  Users,
  // 模組總覽 icons
  DollarSign,
  Shield,
  BarChart3,
  Brain,
  Headphones,
  Server,
  ChevronRight,
} from "lucide-react";

interface PlatformOverview {
  fields: number;
  plans: number;
  activeSubscriptions: number;
  featureFlags: number;
}

export default function PlatformDashboard() {
  const { isAuthenticated } = useAdminAuth();

  const { data, isLoading } = useQuery<PlatformOverview>({
    queryKey: ["/api/platform/overview"],
    enabled: isAuthenticated,
  });

  return (
    <PlatformAdminLayout title="平台儀表板">
      <div className="p-6 space-y-6">
        {/* 歡迎區 */}
        <div className="rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">🌐 歡迎來到大哉遊戲雲</h2>
          <p className="text-blue-100">
            管理所有場域、方案、功能與營收
          </p>
        </div>

        {/* 指標卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="場域總數"
            value={data?.fields ?? 0}
            icon={Building2}
            loading={isLoading}
            href="/platform/fields"
          />
          <MetricCard
            label="訂閱方案"
            value={data?.plans ?? 0}
            icon={Package}
            loading={isLoading}
            href="/platform/plans"
          />
          <MetricCard
            label="有效訂閱"
            value={data?.activeSubscriptions ?? 0}
            icon={Users}
            loading={isLoading}
            href="/platform/fields"
          />
          <MetricCard
            label="功能旗標"
            value={data?.featureFlags ?? 0}
            icon={ToggleLeft}
            loading={isLoading}
            href="/platform/feature-flags"
          />
        </div>

        {/* 🚀 平台模組總覽（25 個頁面分 7 大類）*/}
        <div>
          <h3 className="text-lg font-semibold mb-3">🚀 平台模組總覽</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULE_GROUPS.map((group) => (
              <ModuleGroupCard key={group.title} group={group} />
            ))}
          </div>
        </div>
      </div>
    </PlatformAdminLayout>
  );
}

// ============================================================================
// 模組分組定義（7 大類 / 25 頁面）
// ============================================================================
interface ModuleGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: { label: string; href: string; description?: string }[];
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    title: "場域與訂閱",
    icon: Building2,
    color: "text-blue-600",
    items: [
      { label: "場域管理", href: "/platform/fields", description: "場域列表 / 狀態 / 方案變更" },
      { label: "訂閱方案", href: "/platform/plans", description: "Plan tier 與功能權限" },
      { label: "功能旗標", href: "/platform/feature-flags", description: "Feature flag 控制" },
      { label: "批次操作", href: "/platform/bulk-ops", description: "批量場域狀態 / 方案變更" },
    ],
  },
  {
    title: "財務與營收",
    icon: DollarSign,
    color: "text-green-600",
    items: [
      { label: "營收報告", href: "/platform/revenue", description: "交易明細 / 月報" },
      { label: "計費警示", href: "/platform/billing-alerts", description: "成本超標自動偵測" },
      { label: "API 用量", href: "/platform/usage", description: "按 endpoint / provider 統計" },
      { label: "場域申請", href: "/platform/applications", description: "新申請審核 / 開通" },
    ],
  },
  {
    title: "權限與審計",
    icon: Shield,
    color: "text-purple-600",
    items: [
      { label: "跨場域管理員", href: "/platform/admins", description: "Admin 帳號管理" },
      { label: "角色與權限", href: "/platform/roles", description: "Role-based 權限矩陣" },
      { label: "操作審計", href: "/platform/audit-logs", description: "Admin 操作紀錄" },
      { label: "安全監控", href: "/platform/security", description: "登入失敗 / 風險 IP / 解鎖" },
    ],
  },
  {
    title: "數據洞察",
    icon: BarChart3,
    color: "text-orange-600",
    items: [
      { label: "用量統計", href: "/platform/analytics", description: "平台層 KPI" },
      { label: "跨場域洞察", href: "/platform/insights", description: "排名 / 互動度 / 趨勢" },
    ],
  },
  {
    title: "AI 訓練中心",
    icon: Brain,
    color: "text-indigo-600",
    items: [
      {
        label: "AI 中心",
        href: "/platform/ai-center",
        description: "用量 / 內容打磨 / 健康診斷 / 素材庫 / 訓練設定",
      },
    ],
  },
  {
    title: "客服與通知",
    icon: Headphones,
    color: "text-pink-600",
    items: [
      { label: "客服工單", href: "/platform/tickets", description: "Ticket CRUD + 留言" },
      { label: "推播通知", href: "/platform/notifications", description: "Templates / Logs / Stats" },
    ],
  },
  {
    title: "系統管理",
    icon: Server,
    color: "text-slate-600",
    items: [
      { label: "系統健康", href: "/platform/health", description: "服務存活檢查" },
      { label: "錯誤日誌", href: "/platform/errors", description: "前端 / 後端錯誤回報" },
      { label: "IP 白名單", href: "/platform/ip-whitelist", description: "管理介面存取控管" },
      { label: "API 金鑰", href: "/platform/api-keys", description: "金鑰列表" },
      { label: "登入配置", href: "/platform/login-config", description: "OAuth / SSO" },
      { label: "PWA 狀態", href: "/platform/pwa", description: "Service Worker / Manifest" },
      { label: "導航菜單", href: "/platform/menu-management", description: "Menu overrides" },
      { label: "平台全域設定", href: "/platform/settings", description: "Site-wide settings" },
    ],
  },
];

function ModuleGroupCard({ group }: { group: ModuleGroup }) {
  const Icon = group.icon;
  return (
    <Card data-testid={`module-group-${group.title}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={`w-4 h-4 ${group.color}`} />
          {group.title}
          <span className="text-xs text-muted-foreground ml-auto">{group.items.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {group.items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center justify-between text-xs hover:bg-accent/50 rounded px-2 py-1.5 transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{item.label}</div>
              {item.description && (
                <div className="text-muted-foreground truncate text-[10px]">
                  {item.description}
                </div>
              )}
            </div>
            <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  href?: string;
}

function MetricCard({ label, value, icon: Icon, loading, href }: MetricCardProps) {
  const content = (
    <Card className="hover:border-blue-500/50 transition-colors cursor-pointer">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {loading ? (
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
        ) : (
          <p className="text-3xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }
  return content;
}
