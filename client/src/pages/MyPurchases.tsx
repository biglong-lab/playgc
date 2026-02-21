// 我的購買記錄頁面
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { usePurchases } from "@/hooks/usePurchases";

const typeLabels: Record<string, string> = {
  redeem_code: "兌換碼",
  cash_payment: "現金",
  online_payment: "線上付款",
  in_game_points: "遊戲點數",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "處理中", variant: "outline" },
  completed: { label: "完成", variant: "default" },
  failed: { label: "失敗", variant: "destructive" },
  refunded: { label: "已退款", variant: "secondary" },
};

export default function MyPurchases() {
  const [, setLocation] = useLocation();
  const { data: purchases = [], isLoading } = usePurchases();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/home")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            <h1 className="font-display font-bold text-lg">我的購買記錄</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-md py-6 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            尚無購買記錄
          </div>
        ) : (
          purchases.map((p) => {
            const status = statusConfig[p.status ?? "pending"];
            return (
              <Card key={p.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {typeLabels[p.purchaseType] ?? p.purchaseType}
                      </Badge>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.createdAt
                        ? new Date(p.createdAt).toLocaleDateString("zh-TW", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                  {p.amount && p.amount > 0 ? (
                    <span className="font-medium">NT${p.amount}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">免費</span>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
