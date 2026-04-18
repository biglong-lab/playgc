// 🌐 平台方案管理 — 訂閱方案 CRUD
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { GridSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Plus, Check } from "lucide-react";

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  transactionFeePercent: string;
  limits: Record<string, number>;
  features: string[];
  status: string | null;
  sortOrder: number | null;
}

export default function PlatformPlans() {
  const { isAuthenticated } = useAdminAuth();

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/platform/plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/plans");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  return (
    <PlatformAdminLayout
      title="📦 訂閱方案管理"
      actions={
        <Button size="sm" disabled>
          <Plus className="w-4 h-4 mr-1" />
          新增方案
        </Button>
      }
    >
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Package className="w-5 h-5" />
            訂閱方案管理
          </h2>
          <p className="text-blue-100 text-sm">
            定義 SaaS 服務的計費方案，支援月/年訂閱與交易抽成
          </p>
        </div>

        {isLoading ? (
          <GridSkeleton count={4} cols={4} />
        ) : !plans?.length ? (
          <EmptyState
            icon={Package}
            title="尚無訂閱方案"
            description="執行 seed 腳本初始化預設方案（Free / Pro / Enterprise / RevShare）"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </div>
    </PlatformAdminLayout>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const emoji = planEmoji(plan.code);
  const accent = planAccent(plan.code);
  const featureLabels: Record<string, string> = {
    basic_games: "基礎遊戲",
    redeem_code: "兌換碼",
    qr_code: "QR Code 發布",
    battle_system: "水彈對戰",
    ai_key_byo: "AI Key 自帶",
    custom_brand: "自訂品牌",
    email_notify: "Email 通知",
    line_notify: "LINE 通知",
    custom_domain: "自訂網域",
    white_label: "白牌方案",
    api_access: "API 介接",
    priority_support: "專屬客服",
  };

  return (
    <Card className={`${accent.border} relative overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${accent.bg}`} />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">
              {emoji} {plan.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {plan.code}
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {plan.status ?? "active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-2xl font-bold font-number">
            {plan.monthlyPrice === 0 || !plan.monthlyPrice ? (
              "免費"
            ) : (
              <>
                NT$ {plan.monthlyPrice.toLocaleString("zh-TW")}
                <span className="text-xs font-normal text-muted-foreground">
                  /月
                </span>
              </>
            )}
          </p>
          {plan.transactionFeePercent && parseFloat(plan.transactionFeePercent) > 0 && (
            <p className="text-xs text-muted-foreground">
              交易抽成 {plan.transactionFeePercent}%
            </p>
          )}
        </div>

        {plan.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {plan.description}
          </p>
        )}

        {/* 功能列表 */}
        <div className="space-y-1 pt-2 border-t">
          {plan.features.slice(0, 6).map((f) => (
            <div key={f} className="flex items-center gap-1.5 text-xs">
              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{featureLabels[f] ?? f}</span>
            </div>
          ))}
          {plan.features.length > 6 && (
            <p className="text-xs text-muted-foreground pt-1">
              +{plan.features.length - 6} 個其他功能
            </p>
          )}
        </div>

        {/* 限制 */}
        {plan.limits && (
          <div className="pt-2 border-t space-y-0.5 text-xs text-muted-foreground">
            {plan.limits.maxGames !== undefined && (
              <p>
                遊戲：
                {plan.limits.maxGames === -1 ? "♾️ 無限" : plan.limits.maxGames}
              </p>
            )}
            {plan.limits.maxCheckoutsPerMonth !== undefined && (
              <p>
                月結帳：
                {plan.limits.maxCheckoutsPerMonth === -1
                  ? "♾️ 無限"
                  : plan.limits.maxCheckoutsPerMonth}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function planEmoji(code: string): string {
  switch (code) {
    case "free": return "🆓";
    case "pro": return "💼";
    case "enterprise": return "🚀";
    case "revshare": return "🤝";
    default: return "📦";
  }
}

function planAccent(code: string): { bg: string; border: string } {
  switch (code) {
    case "free": return { bg: "bg-slate-500", border: "border-slate-200" };
    case "pro": return { bg: "bg-blue-600", border: "border-blue-200" };
    case "enterprise": return { bg: "bg-violet-600", border: "border-violet-200" };
    case "revshare": return { bg: "bg-emerald-600", border: "border-emerald-200" };
    default: return { bg: "bg-muted", border: "border-border" };
  }
}
