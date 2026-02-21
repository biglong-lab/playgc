// 購買記錄列表元件
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";
import type { Purchase } from "@shared/schema";

interface PurchaseHistoryProps {
  purchases: Purchase[];
  onRevoke: (id: string) => void;
}

const typeLabels: Record<string, string> = {
  redeem_code: "兌換碼",
  cash_payment: "現金",
  online_payment: "線上",
  in_game_points: "點數",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "處理中", variant: "outline" },
  completed: { label: "完成", variant: "default" },
  failed: { label: "失敗", variant: "destructive" },
  refunded: { label: "已退款", variant: "secondary" },
};

export function PurchaseHistory({ purchases, onRevoke }: PurchaseHistoryProps) {
  if (purchases.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        尚無購買記錄
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {purchases.map((p) => {
        const status = statusLabels[p.status ?? "pending"];
        return (
          <div
            key={p.id}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Badge variant="outline">
                {typeLabels[p.purchaseType] ?? p.purchaseType}
              </Badge>
              <Badge variant={status.variant}>{status.label}</Badge>
              <span className="text-xs text-muted-foreground truncate">
                {p.userId.slice(0, 12)}...
              </span>
              {p.amount && p.amount > 0 && (
                <span className="text-xs font-medium">
                  NT${p.amount}
                </span>
              )}
              {p.note && (
                <span className="text-xs text-muted-foreground truncate max-w-32">
                  {p.note}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {p.createdAt ? new Date(p.createdAt).toLocaleDateString("zh-TW") : ""}
              </span>
            </div>
            {p.status === "completed" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onRevoke(p.id)}
                title="撤銷/退款"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
