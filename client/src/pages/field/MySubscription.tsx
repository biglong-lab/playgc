// 🏢 場域總部 — 我的方案（場域管理員看得到的 SaaS 資訊）
// 包含：當前方案 / 用量進度 / 本月平台費用 / 交易歷史
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  Gauge,
  Receipt,
  ArrowUp,
  Loader2,
  Check,
  AlertCircle,
  Infinity as InfinityIcon,
} from "lucide-react";

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    startedAt: string;
    expiresAt: string | null;
    trialEndsAt: string | null;
    billingCycle: string | null;
    nextBillingAt: string | null;
    customFeePercent: string | null;
  };
  plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    monthlyPrice: number | null;
    yearlyPrice: number | null;
    transactionFeePercent: string;
    features: string[];
  } | null;
  effectiveLimits: Record<string, number>;
  usage: Array<{
    id: string;
    meterKey: string;
    currentValue: number;
    limitValue: number | null;
    periodStart: string;
    periodEnd: string;
  }>;
  platformFeesThisMonth: {
    subscriptionFee: number;
    transactionFees: number;
    addons: number;
    total: number;
  };
}

interface TransactionRow {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  createdAt: string;
}

const METER_LABELS: Record<string, { label: string; emoji: string }> = {
  games: { label: "遊戲數", emoji: "🎮" },
  checkouts: { label: "本月結帳次數", emoji: "💳" },
  admins: { label: "管理員人數", emoji: "👥" },
  storage_bytes: { label: "儲存空間", emoji: "💾" },
  battle_slots: { label: "本月對戰時段", emoji: "⚔️" },
  ai_tokens: { label: "AI Token 使用", emoji: "🤖" },
};

const LIMIT_TO_METER: Record<string, string> = {
  maxGames: "games",
  maxCheckoutsPerMonth: "checkouts",
  maxAdmins: "admins",
  maxStorageGb: "storage_bytes",
  maxBattleSlotsPerMonth: "battle_slots",
};

export default function MySubscription() {
  const { isAuthenticated } = useAdminAuth();

  const { data, isLoading } = useQuery<SubscriptionData>({
    queryKey: ["/api/field/subscription"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/field/subscription");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: txData } = useQuery<{ transactions: TransactionRow[] }>({
    queryKey: ["/api/field/platform-transactions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/field/platform-transactions?limit=20");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  return (
    <UnifiedAdminLayout title="🏢 我的方案">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.plan ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>場域尚未訂閱任何方案</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 當前方案卡 */}
          <Card className="border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">目前方案</p>
                  <h2 className="text-2xl font-bold">
                    {planEmoji(data.plan.code)} {data.plan.name}
                  </h2>
                  {data.plan.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {data.plan.description}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold font-number">
                    {data.plan.monthlyPrice === 0 ? (
                      "免費"
                    ) : (
                      <>
                        NT$ {data.plan.monthlyPrice?.toLocaleString("zh-TW")}
                        <span className="text-xs font-normal text-muted-foreground">
                          /月
                        </span>
                      </>
                    )}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {subStatusLabel(data.subscription.status)}
                  </Badge>
                </div>
              </div>

              {data.subscription.nextBillingAt && (
                <div className="text-xs text-muted-foreground pt-3 border-t">
                  下次扣款：
                  {new Date(data.subscription.nextBillingAt).toLocaleDateString("zh-TW")}
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t mt-4">
                <Button size="sm" variant="outline" disabled>
                  <ArrowUp className="w-4 h-4 mr-1" />
                  升級方案
                </Button>
                <Button size="sm" variant="ghost" disabled>
                  聯絡客服
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 用量進度 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                本月用量
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(data.effectiveLimits).map(([limitKey, limit]) => {
                const meterKey = LIMIT_TO_METER[limitKey];
                if (!meterKey) return null;
                const meter = data.usage.find((u) => u.meterKey === meterKey);
                const current = meter?.currentValue ?? 0;
                const isUnlimited = limit === -1;
                const percent = isUnlimited ? 0 : Math.min(100, (current / limit) * 100);
                const isOver = !isUnlimited && current > limit;
                const isWarning = !isUnlimited && percent >= 80;
                const meta = METER_LABELS[meterKey] ?? {
                  label: meterKey,
                  emoji: "📊",
                };

                return (
                  <div key={limitKey}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span>{meta.emoji}</span>
                        <span className="text-sm font-medium">{meta.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {current.toLocaleString("zh-TW")}
                        {" / "}
                        {isUnlimited ? (
                          <span className="inline-flex items-center gap-1">
                            <InfinityIcon className="w-3 h-3" />
                            無限
                          </span>
                        ) : (
                          limit.toLocaleString("zh-TW")
                        )}
                      </div>
                    </div>
                    {!isUnlimited && (
                      <Progress
                        value={percent}
                        className={
                          isOver
                            ? "[&>div]:bg-rose-500"
                            : isWarning
                              ? "[&>div]:bg-amber-500"
                              : ""
                        }
                      />
                    )}
                    {isOver && (
                      <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        已超過配額，可能影響部分功能
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 已啟用功能 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🎁 已啟用功能</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.plan.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{featureLabel(f)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 本月平台費用 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                本月平台費用
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <FeeRow
                label="訂閱費"
                amount={data.platformFeesThisMonth.subscriptionFee}
              />
              <FeeRow
                label={`交易抽成 (${data.plan.transactionFeePercent}%)`}
                amount={data.platformFeesThisMonth.transactionFees}
              />
              {data.platformFeesThisMonth.addons > 0 && (
                <FeeRow label="加購" amount={data.platformFeesThisMonth.addons} />
              )}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>合計</span>
                <span className="font-number">
                  NT$ {data.platformFeesThisMonth.total.toLocaleString("zh-TW")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 交易歷史 */}
          {txData?.transactions && txData.transactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📝 費用歷史</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {txData.transactions.map((tx) => (
                    <TransactionItem key={tx.id} tx={tx} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </UnifiedAdminLayout>
  );
}

// ============================================================================
// 子元件
// ============================================================================

function FeeRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-number">-NT$ {amount.toLocaleString("zh-TW")}</span>
    </div>
  );
}

function TransactionItem({ tx }: { tx: TransactionRow }) {
  const typeLabels: Record<string, string> = {
    subscription: "💼 訂閱費",
    transaction_fee: "💸 交易抽成",
    addon: "🎁 加購",
    setup_fee: "🚀 開通費",
    refund: "↩️ 退款",
    credit: "🎁 贈送點數",
    adjustment: "✏️ 手動調整",
  };
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{typeLabels[tx.type] ?? tx.type}</p>
        {tx.description && (
          <p className="text-xs text-muted-foreground truncate">
            {tx.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {new Date(tx.createdAt).toLocaleString("zh-TW")}
        </p>
      </div>
      <div className="text-right">
        <p className="font-number text-sm font-medium">
          NT$ {tx.amount.toLocaleString("zh-TW")}
        </p>
        <Badge variant="secondary" className="text-[10px]">
          {tx.status}
        </Badge>
      </div>
    </div>
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

function subStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "✅ 有效",
    trial: "🆓 試用中",
    past_due: "⚠️ 逾期",
    canceled: "❌ 取消",
    suspended: "🚫 停權",
  };
  return labels[status] ?? status;
}

function featureLabel(f: string): string {
  const labels: Record<string, string> = {
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
  return labels[f] ?? f;
}
