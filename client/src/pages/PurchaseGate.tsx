// 付費攔截頁面 — 遊戲需付費時顯示
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Lock, CreditCard, Loader2 } from "lucide-react";
import { RedeemCodeInput } from "@/components/shared/RedeemCodeInput";
import { useRedeemCode } from "@/hooks/useRedeemCode";
import { useGameAccess } from "@/hooks/useGameAccess";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Game } from "@shared/schema";

export default function PurchaseGate() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const redeemMutation = useRedeemCode();

  const { data: game } = useQuery<Game>({
    queryKey: [`/api/games/${gameId}`],
    enabled: !!gameId,
  });

  const { data: access, refetch } = useGameAccess(gameId);

  // 線上付款 mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/games/${gameId}/checkout`);
      return res.json() as Promise<{ checkoutUrl: string }>;
    },
    onSuccess: (data) => {
      // 重導向到 Recur 付款頁面
      window.location.href = data.checkoutUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "付款失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 已有存取權 → 導向遊戲
  if (access?.hasAccess) {
    setLocation(`/game/${gameId}/chapters`);
    return null;
  }

  const handleRedeem = (code: string) => {
    redeemMutation.mutate(code, {
      onSuccess: () => {
        refetch();
      },
    });
  };

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
          <h1 className="font-display font-bold text-lg">解鎖遊戲</h1>
        </div>
      </header>

      <main className="container max-w-md py-8 space-y-6">
        {/* 遊戲資訊 */}
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            {game?.coverImageUrl && (
              <img
                src={game.coverImageUrl}
                alt={game.title ?? ""}
                className="w-full h-40 object-cover rounded-lg"
              />
            )}
            <h2 className="text-xl font-bold">{game?.title}</h2>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>此遊戲需要付費才能遊玩</span>
            </div>
            {access?.price && (
              <p className="text-2xl font-bold text-primary">
                NT${access.price}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 兌換碼 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">使用兌換碼</CardTitle>
          </CardHeader>
          <CardContent>
            <RedeemCodeInput
              onSubmit={handleRedeem}
              isLoading={redeemMutation.isPending}
              error={redeemMutation.error instanceof Error ? redeemMutation.error.message : undefined}
            />
          </CardContent>
        </Card>

        {/* 線上購買 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">線上購買</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full gap-2"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              {checkoutMutation.isPending
                ? "跳轉付款中..."
                : access?.price
                  ? `線上付款 NT$${access.price}`
                  : "線上付款"}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              付款後自動解鎖遊戲
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
