// 🌐 平台營收報表
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Loader2, TrendingUp, AlertCircle } from "lucide-react";

interface RevenueData {
  totalRevenue: number;
  pendingAmount: number;
  monthly: Array<{
    month: string;
    total: number;
    by_type: Record<string, number>;
  }>;
}

interface TransactionRow {
  transaction: {
    id: string;
    fieldId: string;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
    description: string | null;
  };
  field: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export default function PlatformRevenue() {
  const { isAuthenticated } = useAdminAuth();

  const { data, isLoading } = useQuery<RevenueData>({
    queryKey: ["/api/platform/revenue"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/revenue");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: transactions } = useQuery<TransactionRow[]>({
    queryKey: ["/api/platform/transactions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/transactions");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  return (
    <PlatformAdminLayout title="💵 平台營收">
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            平台營收報表
          </h2>
          <p className="text-emerald-50 text-sm">
            所有場域支付給平台的費用（訂閱費、交易抽成、加購）
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* 統計卡 */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">累計收入</p>
                  <p className="text-3xl font-bold font-number">
                    NT$ {(data?.totalRevenue ?? 0).toLocaleString("zh-TW")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-xs text-muted-foreground">待付款</p>
                  <p className="text-3xl font-bold font-number">
                    NT$ {(data?.pendingAmount ?? 0).toLocaleString("zh-TW")}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 月度趨勢 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📈 最近 12 個月</CardTitle>
              </CardHeader>
              <CardContent>
                {!data?.monthly?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    尚無月度資料（Phase 6 計費引擎會自動產生）
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.monthly.map((m) => (
                      <div
                        key={m.month}
                        className="flex items-center justify-between p-3 rounded hover:bg-muted/50"
                      >
                        <span className="text-sm font-mono">{m.month}</span>
                        <span className="font-number font-medium">
                          NT$ {m.total.toLocaleString("zh-TW")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 交易記錄 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📝 最近交易</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!transactions?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    尚無交易記錄
                  </p>
                ) : (
                  <div className="divide-y">
                    {transactions.slice(0, 20).map((row) => (
                      <TransactionRowItem key={row.transaction.id} row={row} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PlatformAdminLayout>
  );
}

function TransactionRowItem({ row }: { row: TransactionRow }) {
  const { transaction: tx, field } = row;
  const typeLabels: Record<string, string> = {
    subscription: "訂閱費",
    transaction_fee: "交易抽成",
    addon: "加購",
    setup_fee: "開通費",
    refund: "退款",
    credit: "贈送點數",
    adjustment: "手動調整",
  };
  const statusBadge: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="flex items-center gap-3 p-4 hover:bg-muted/30">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {field?.name ?? "（未知場域）"}
          <span className="text-muted-foreground ml-2 text-xs">
            {typeLabels[tx.type] ?? tx.type}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(tx.createdAt).toLocaleString("zh-TW")}
        </p>
      </div>
      <div className="text-right">
        <p className="font-number font-medium">
          NT$ {tx.amount.toLocaleString("zh-TW")}
        </p>
        <Badge variant="secondary" className={`text-[10px] ${statusBadge[tx.status] ?? ""}`}>
          {tx.status}
        </Badge>
      </div>
    </div>
  );
}
