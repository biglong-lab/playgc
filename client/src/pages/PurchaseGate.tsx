// 付費攔截頁面 — 遊戲需付費時顯示
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useFieldLink } from "@/hooks/useFieldLink";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Lock, Unlock, CreditCard, Loader2 } from "lucide-react";
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
  const [checkoutChapterId, setCheckoutChapterId] = useState<string | null>(null);

  const { data: game } = useQuery<Game>({
    queryKey: [`/api/games/${gameId}`],
    enabled: !!gameId,
  });

  const { data: access, refetch } = useGameAccess(gameId);

  // 線上付款 mutation（支援遊戲級和章節級）
  const checkoutMutation = useMutation({
    mutationFn: async (chapterId?: string) => {
      const body = chapterId ? { chapterId } : {};
      const res = await apiRequest("POST", `/api/games/${gameId}/checkout`, body);
      return res.json() as Promise<{ checkoutUrl: string }>;
    },
    onSuccess: (data) => {
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

  const handleChapterCheckout = (chapterId: string) => {
    setCheckoutChapterId(chapterId);
    checkoutMutation.mutate(chapterId);
  };

  const isPerChapter = access?.pricingType === "per_chapter" && access.chapters;

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
            {!isPerChapter && access?.price && (
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

        {/* 章節級購買 */}
        {isPerChapter && access.chapters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">購買章節</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {access.chapters.map((ch) => (
                <div
                  key={ch.chapterId}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {ch.hasAccess ? (
                      <Unlock className="w-4 h-4 text-green-500" />
                    ) : (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        第 {ch.chapterOrder} 章：{ch.title}
                      </p>
                      {ch.hasAccess && (
                        <p className="text-xs text-green-600">已解鎖</p>
                      )}
                    </div>
                  </div>
                  {!ch.hasAccess && ch.price && ch.price > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => handleChapterCheckout(ch.chapterId)}
                      disabled={checkoutMutation.isPending && checkoutChapterId === ch.chapterId}
                    >
                      {checkoutMutation.isPending && checkoutChapterId === ch.chapterId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CreditCard className="w-3 h-3" />
                      )}
                      NT${ch.price}
                    </Button>
                  )}
                  {!ch.hasAccess && (!ch.price || ch.price <= 0) && (
                    <Badge variant="secondary">未設定價格</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 遊戲級線上購買（非 per_chapter 時顯示） */}
        {!isPerChapter && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">線上購買</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full gap-2"
                onClick={() => checkoutMutation.mutate(undefined)}
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
        )}
      </main>
    </div>
  );
}
