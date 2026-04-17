// 💰 財務中心 — 交易記錄（跨類型）
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Gamepad2, Swords } from "lucide-react";

interface Transaction {
  id: string;
  type: "game_purchase" | "battle_registration";
  productId: string;
  productName: string;
  playerId: string | null;
  amount: number;
  status: string;
  createdAt: string | null;
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
}

export default function RevenueTransactions() {
  const { isAuthenticated } = useAdminAuth();
  const [filter, setFilter] = useState<"all" | "game_purchase" | "battle_registration">("all");

  const { data, isLoading } = useQuery<TransactionsResponse>({
    queryKey: ["/api/revenue/transactions", filter],
    queryFn: async () => {
      const url =
        filter === "all"
          ? "/api/revenue/transactions"
          : `/api/revenue/transactions?type=${filter}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  return (
    <UnifiedAdminLayout title="💰 交易記錄">
      <div className="space-y-4">
        <div className="rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            交易記錄
          </h2>
          <p className="text-emerald-50 text-sm">
            所有遊戲購買與對戰報名的交易明細
          </p>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="game_purchase">🎮 遊戲購買</TabsTrigger>
            <TabsTrigger value="battle_registration">⚔️ 對戰報名</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <ListSkeleton count={6} />
        ) : !data?.transactions?.length ? (
          <EmptyState
            icon={Receipt}
            title="尚無交易記錄"
            description="當玩家購買遊戲或報名對戰時，交易會在這裡顯示"
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.transactions.map((t) => (
                  <TransactionRow key={t.id} tx={t} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </UnifiedAdminLayout>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isGame = tx.type === "game_purchase";
  const date = tx.createdAt
    ? new Date(tx.createdAt).toLocaleString("zh-TW", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isGame
            ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30"
            : "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
        }`}
      >
        {isGame ? <Gamepad2 className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{tx.productName}</p>
        <p className="text-xs text-muted-foreground">
          {isGame ? "遊戲購買" : "對戰報名"} · {date}
          {tx.playerId && ` · 玩家 ${tx.playerId.slice(0, 8)}...`}
        </p>
      </div>
      <div className="text-right">
        <p className="font-number text-sm font-medium">
          NT$ {tx.amount.toLocaleString("zh-TW")}
        </p>
        <StatusBadge status={tx.status} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    completed: { label: "完成", className: "bg-emerald-100 text-emerald-700" },
    paid: { label: "已付", className: "bg-emerald-100 text-emerald-700" },
    pending: { label: "待付款", className: "bg-amber-100 text-amber-700" },
    failed: { label: "失敗", className: "bg-rose-100 text-rose-700" },
    refunded: { label: "已退款", className: "bg-slate-100 text-slate-600" },
  };
  const v = variants[status] ?? { label: status, className: "bg-slate-100" };
  return (
    <Badge variant="secondary" className={`text-[10px] ${v.className}`}>
      {v.label}
    </Badge>
  );
}
