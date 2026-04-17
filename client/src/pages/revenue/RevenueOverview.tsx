// 💰 財務中心 — 營收總覽（升級版 TicketsOverview）
// 整合遊戲 + 對戰收入、兌換碼統計、本月數據
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  Gamepad2,
  Swords,
  Ticket,
  Package,
  Receipt,
  Loader2,
} from "lucide-react";

interface RevenueOverview {
  totalRevenue: number;
  monthlyRevenue: number;
  breakdown: {
    games: { totalRevenue: number; monthlyRevenue: number; purchaseCount: number };
    battles: { totalRevenue: number; monthlyRevenue: number; registrationCount: number };
  };
  codes: { total: number; active: number; used: number };
}

export default function RevenueOverview() {
  const { isAuthenticated } = useAdminAuth();

  const { data, isLoading } = useQuery<RevenueOverview>({
    queryKey: ["/api/revenue/overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/revenue/overview");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  return (
    <UnifiedAdminLayout title="💰 財務中心 / 營收總覽">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* 頂部歡迎區 */}
          <div className="rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white">
            <h2 className="text-xl font-bold mb-1">💰 財務中心</h2>
            <p className="text-emerald-50 text-sm">
              統一管理遊戲與對戰收入、兌換碼、交易與退款
            </p>
          </div>

          {/* 頂部統計 */}
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              title="總收入"
              value={formatCurrency(data?.totalRevenue ?? 0)}
              icon={<DollarSign className="w-5 h-5" />}
              accent="emerald"
            />
            <SummaryCard
              title="本月收入"
              value={formatCurrency(data?.monthlyRevenue ?? 0)}
              icon={<TrendingUp className="w-5 h-5" />}
              accent="blue"
            />
            <SummaryCard
              title="兌換碼"
              value={`${data?.codes?.active ?? 0} / ${data?.codes?.total ?? 0}`}
              subtitle={`已使用 ${data?.codes?.used ?? 0}`}
              icon={<Ticket className="w-5 h-5" />}
              accent="violet"
            />
          </div>

          {/* 分類收入明細 */}
          <div className="grid gap-4 md:grid-cols-2">
            <BreakdownCard
              title="🎮 遊戲收入"
              totalRevenue={data?.breakdown?.games?.totalRevenue ?? 0}
              monthlyRevenue={data?.breakdown?.games?.monthlyRevenue ?? 0}
              count={data?.breakdown?.games?.purchaseCount ?? 0}
              countLabel="筆購買"
              icon={<Gamepad2 className="w-5 h-5" />}
              accent="violet"
            />
            <BreakdownCard
              title="⚔️ 對戰收入"
              totalRevenue={data?.breakdown?.battles?.totalRevenue ?? 0}
              monthlyRevenue={data?.breakdown?.battles?.monthlyRevenue ?? 0}
              count={data?.breakdown?.battles?.registrationCount ?? 0}
              countLabel="筆報名"
              icon={<Swords className="w-5 h-5" />}
              accent="rose"
            />
          </div>

          {/* 快速導覽 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">快速操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <QuickLink
                  href="/admin/revenue/products"
                  icon={<Package className="w-5 h-5" />}
                  label="商品管理"
                  description="遊戲與對戰場地定價"
                />
                <QuickLink
                  href="/admin/revenue/codes"
                  icon={<Ticket className="w-5 h-5" />}
                  label="兌換碼中心"
                  description="跨遊戲兌換碼"
                />
                <QuickLink
                  href="/admin/revenue/transactions"
                  icon={<Receipt className="w-5 h-5" />}
                  label="交易記錄"
                  description="所有購買與報名"
                />
                <QuickLink
                  href="/admin/tickets"
                  icon={<DollarSign className="w-5 h-5" />}
                  label="舊版票券總覽"
                  description="原本的票券/收款頁"
                />
              </div>
            </CardContent>
          </Card>

          {/* Phase 3 提示 */}
          <Card className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/20">
            <CardContent className="pt-4 text-sm text-muted-foreground">
              <p>
                💡 <strong>Phase 3 建置中：</strong>
                財務中心正在擴建。目前可看到統合的營收統計、商品列表、兌換碼中心與交易記錄。
                Phase 4 會加入退款管理、金流設定、以及統一的商品資料模型。
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </UnifiedAdminLayout>
  );
}

// ============================================================================
// 子元件
// ============================================================================

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accent: "emerald" | "blue" | "violet" | "rose";
}) {
  const accentClasses = {
    emerald: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
    blue: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    violet: "text-violet-600 bg-violet-100 dark:bg-violet-900/30",
    rose: "text-rose-600 bg-rose-100 dark:bg-rose-900/30",
  };
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-number mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-full ${accentClasses[accent]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  totalRevenue,
  monthlyRevenue,
  count,
  countLabel,
  icon,
  accent,
}: {
  title: string;
  totalRevenue: number;
  monthlyRevenue: number;
  count: number;
  countLabel: string;
  icon: React.ReactNode;
  accent: "violet" | "rose";
}) {
  const borderColor = accent === "violet" ? "border-violet-200" : "border-rose-200";
  return (
    <Card className={borderColor}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">累計</p>
          <p className="text-xl font-bold font-number">{formatCurrency(totalRevenue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">本月</p>
          <p className="text-lg font-semibold font-number">
            {formatCurrency(monthlyRevenue)}
          </p>
        </div>
        <Badge variant="secondary">
          {count} {countLabel}
        </Badge>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Button
        variant="outline"
        className="h-auto w-full justify-start flex-col items-start gap-1 p-4"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </div>
        <p className="text-xs text-muted-foreground font-normal">{description}</p>
      </Button>
    </Link>
  );
}

function formatCurrency(amount: number): string {
  return `NT$ ${amount.toLocaleString("zh-TW")}`;
}
