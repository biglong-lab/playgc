// 🌐 平台儀表板 — SaaS 平台總覽
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Package, ToggleLeft, Users } from "lucide-react";

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

        {/* Phase 1 提示 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🚧 建置中</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Phase 1 已完成 SaaS 基礎層（7 張平台表 + 4 個預設方案 + 6 個功能旗標 + 平台認證）。
              接下來 Phase 2 會開始重組管理端側邊欄，Phase 5 會實作完整的平台管理功能。
            </p>
          </CardContent>
        </Card>
      </div>
    </PlatformAdminLayout>
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
