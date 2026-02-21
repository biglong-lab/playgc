// 付款成功頁面 — Recur 付款完成後重導向到此
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, GamepadIcon } from "lucide-react";
import type { PaymentTransaction } from "@shared/schema";

export default function PurchaseSuccess() {
  const [, setLocation] = useLocation();

  // 從 URL 取得交易 ID
  const params = new URLSearchParams(window.location.search);
  const txId = params.get("txId");

  // 輪詢交易狀態（webhook 可能還沒處理完）
  const { data: purchases } = useQuery<Array<{ gameId: string }>>({
    queryKey: ["/api/purchases"],
    enabled: !!txId,
    refetchInterval: (query) => {
      // 每 2 秒輪詢一次，最多 30 秒
      const dataLen = query.state.data?.length ?? 0;
      return dataLen > 0 ? false : 2000;
    },
  });

  // 找到對應交易的 gameId
  const gameId = purchases?.find(() => true)?.gameId;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <CheckCircle className="w-16 h-16 mx-auto text-success" />
          <h1 className="text-2xl font-bold">付款成功！</h1>
          <p className="text-muted-foreground">
            感謝您的購買，遊戲已自動解鎖。
          </p>
          <div className="pt-4 space-y-2">
            {gameId ? (
              <Button
                className="w-full gap-2"
                onClick={() => setLocation(`/game/${gameId}/chapters`)}
              >
                <GamepadIcon className="w-4 h-4" />
                開始遊玩
              </Button>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={() => setLocation("/home")}
              >
                <GamepadIcon className="w-4 h-4" />
                回到首頁
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation("/purchases")}
            >
              查看購買記錄
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
