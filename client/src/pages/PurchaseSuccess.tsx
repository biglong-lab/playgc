// 付款成功頁面 — Recur 付款完成後重導向到此
import { useLocation } from "wouter";
import { useFieldLink } from "@/hooks/useFieldLink";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, GamepadIcon } from "lucide-react";

interface TransactionStatus {
  status: string;
  gameId: string;
  chapterId: string | null;
}

export default function PurchaseSuccess() {
  const [, setLocation] = useLocation();
  const link = useFieldLink();

  // 從 URL 取得交易 ID
  const params = new URLSearchParams(window.location.search);
  const txId = params.get("txId");

  // 輪詢交易狀態（webhook 可能還沒處理完）
  const { data: txStatus, isLoading } = useQuery<TransactionStatus>({
    queryKey: [`/api/transactions/${txId}/status`],
    enabled: !!txId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // 已完成或失敗就停止輪詢
      if (status === "completed" || status === "failed") return false;
      // 每 2 秒查一次
      return 2000;
    },
    refetchIntervalInBackground: true,
  });

  const isCompleted = txStatus?.status === "completed";
  const isFailed = txStatus?.status === "failed";
  const isPending = !isCompleted && !isFailed;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          {isPending && txId ? (
            <>
              <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
              <h1 className="text-2xl font-bold">處理付款中...</h1>
              <p className="text-muted-foreground">
                正在確認您的付款，請稍候。
              </p>
            </>
          ) : isFailed ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-3xl">!</span>
              </div>
              <h1 className="text-2xl font-bold">付款失敗</h1>
              <p className="text-muted-foreground">
                付款處理失敗，請重試或聯繫客服。
              </p>
            </>
          ) : (
            <>
              <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
              <h1 className="text-2xl font-bold">付款成功！</h1>
              <p className="text-muted-foreground">
                感謝您的購買，遊戲已自動解鎖。
              </p>
            </>
          )}

          <div className="pt-4 space-y-2">
            {txStatus?.gameId ? (
              <Button
                className="w-full gap-2"
                onClick={() => setLocation(link(`/game/${txStatus.gameId}/chapters`))}
                disabled={isPending}
              >
                <GamepadIcon className="w-4 h-4" />
                開始遊玩
              </Button>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={() => setLocation(link("/home"))}
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
