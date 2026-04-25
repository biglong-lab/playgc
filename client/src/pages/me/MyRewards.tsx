// 我的獎勵 — 玩家錢包頁面
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26.9
//
// 顯示：
//   - 平台券（CHITO 自家）
//   - 外部券（金門好康券等）
//   - 點數記錄（未來 Phase）
//
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatTimeAgo } from "@/lib/battle-time";
import {
  Gift, Ticket, MapPin, ArrowUpRight, CheckCircle, Clock, Sparkles, Swords,
} from "lucide-react";

interface PlatformReward {
  id: string;
  type: "platform_coupon";
  code: string;
  status: "unused" | "used" | "expired" | "revoked";
  expiresAt: string;
  issuedAt: string;
  usedAt?: string | null;
  template: {
    name: string;
    description?: string;
    discountType: string;
    discountValue?: number;
  } | null;
}

interface ExternalReward {
  id: string;
  type: "external_coupon";
  provider: string;
  status: "pending" | "issued" | "redeemed" | "expired" | "failed";
  displayName?: string;
  valueDescription?: string;
  merchantName?: string;
  merchantAddress?: string;
  externalCouponCode?: string;
  externalCouponUrl?: string;
  expiresAt?: string | null;
  issuedAt?: string | null;
  redeemedAt?: string | null;
}

interface RewardsResponse {
  summary: {
    totalCount: number;
    platformCount: number;
    externalCount: number;
    unusedPlatform: number;
  };
  platform: PlatformReward[];
  external: ExternalReward[];
}

export default function MyRewards() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<RewardsResponse>({
    queryKey: ["/api/me/rewards"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/rewards?status=unused");
      return res.json();
    },
    enabled: !!user,
  });

  const useMutation_ = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/rewards/${id}/use`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ 平台券已使用" });
      queryClient.invalidateQueries({ queryKey: ["/api/me/rewards"] });
    },
    onError: (err: Error) => {
      toast({ title: "使用失敗", description: err.message, variant: "destructive" });
    },
  });

  const redeemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/rewards/${id}/redeem`, {});
      return res.json() as Promise<{ redirectUrl: string; merchantName?: string }>;
    },
    onSuccess: (resp) => {
      toast({ title: `🎁 跳轉到 ${resp.merchantName ?? "兌換頁面"}` });
      // 跳轉到外部兌換頁
      window.open(resp.redirectUrl, "_blank", "noopener,noreferrer");
      queryClient.invalidateQueries({ queryKey: ["/api/me/rewards"] });
    },
    onError: (err: Error) => {
      toast({ title: "兌換失敗", description: err.message, variant: "destructive" });
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Gift className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="mb-3">請先登入查看你的獎勵</p>
            <Link href="/">
              <Button>返回首頁登入</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const platform = data?.platform ?? [];
  const external = data?.external ?? [];
  const summary = data?.summary;

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Gift className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">我的獎勵</h1>
          <p className="text-sm text-muted-foreground">
            玩遊戲累積的折價券、體驗點數
          </p>
        </div>
      </div>

      {/* 總覽卡 */}
      {summary && (
        <Card className="mb-4 bg-primary/5 border-primary/30">
          <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">總獎勵</p>
              <p className="text-2xl font-number font-bold">{summary.totalCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">平台券</p>
              <p className="text-2xl font-number font-bold text-primary">
                {summary.unusedPlatform}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">外部券</p>
              <p className="text-2xl font-number font-bold text-orange-500">
                {summary.externalCount}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 空狀態 */}
      {summary?.totalCount === 0 && (
        <Card className="bg-card border-dashed">
          <CardContent className="p-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">還沒有獎勵</p>
            <p className="text-xs text-muted-foreground mb-4">
              玩遊戲、報名對戰、跨場域出戰都會有機會拿到折價券
            </p>
            <Link href="/battle">
              <Button className="gap-2">
                <Swords className="h-4 w-4" />
                前往對戰中心
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      {summary && summary.totalCount > 0 && (
        <Tabs defaultValue="platform" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="platform" className="gap-1.5">
              <Ticket className="h-3.5 w-3.5" />
              平台券（{summary.platformCount}）
            </TabsTrigger>
            <TabsTrigger value="external" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              金門好康券（{summary.externalCount}）
            </TabsTrigger>
          </TabsList>

          {/* 平台券 */}
          <TabsContent value="platform" className="space-y-2">
            {platform.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                目前沒有平台券
              </p>
            ) : (
              platform.map((p) => (
                <Card key={p.id} className="bg-card border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Ticket className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold">
                            {p.template?.name ?? "平台折價券"}
                          </h3>
                          <Badge
                            variant={p.status === "unused" ? "default" : "outline"}
                            className="text-[10px]"
                          >
                            {p.status === "unused"
                              ? "可使用"
                              : p.status === "used"
                                ? "已使用"
                                : "已過期"}
                          </Badge>
                        </div>
                        {p.template?.description && (
                          <p className="text-xs text-muted-foreground mb-1">
                            {p.template.description}
                          </p>
                        )}
                        {p.template && (
                          <p className="text-xs">
                            {p.template.discountType === "amount"
                              ? `折抵 NT$${p.template.discountValue}`
                              : `${p.template.discountValue}% off`}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                          {p.code}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          有效期：{new Date(p.expiresAt).toLocaleDateString("zh-TW")}
                        </p>
                      </div>
                      {p.status === "unused" && (
                        <Button
                          size="sm"
                          onClick={() => useMutation_.mutate(p.id)}
                          disabled={useMutation_.isPending}
                        >
                          {useMutation_.isPending ? "使用中..." : "使用"}
                        </Button>
                      )}
                      {p.status === "used" && (
                        <CheckCircle className="h-5 w-5 text-green-500 mt-1 shrink-0" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* 外部券 */}
          <TabsContent value="external" className="space-y-2">
            {external.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                目前沒有外部合作券
              </p>
            ) : (
              external.map((e) => (
                <Card key={e.id} className="bg-card border-orange-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="h-4 w-4 text-orange-500" />
                          <h3 className="font-semibold">
                            {e.displayName ?? e.merchantName ?? "外部合作券"}
                          </h3>
                          <Badge variant="outline" className="text-[10px]">
                            {e.status === "issued"
                              ? "可兌換"
                              : e.status === "pending"
                                ? "處理中"
                                : e.status === "redeemed"
                                  ? "已兌換"
                                  : e.status}
                          </Badge>
                        </div>
                        {e.valueDescription && (
                          <p className="text-xs text-muted-foreground mb-1">
                            {e.valueDescription}
                          </p>
                        )}
                        {e.merchantName && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {e.merchantName}
                          </p>
                        )}
                        {e.expiresAt && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            有效期：{new Date(e.expiresAt).toLocaleDateString("zh-TW")}
                          </p>
                        )}
                        {e.issuedAt && (
                          <p className="text-[10px] text-muted-foreground">
                            發放：{formatTimeAgo(new Date(e.issuedAt))}
                          </p>
                        )}
                      </div>
                      {e.status === "issued" && e.externalCouponUrl && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => redeemMutation.mutate(e.id)}
                          disabled={redeemMutation.isPending}
                          className="gap-1"
                        >
                          {redeemMutation.isPending ? (
                            <Clock className="h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          兌換
                        </Button>
                      )}
                      {e.status === "redeemed" && (
                        <CheckCircle className="h-5 w-5 text-green-500 mt-1 shrink-0" />
                      )}
                      {e.status === "pending" && (
                        <Clock className="h-5 w-5 text-muted-foreground mt-1 shrink-0 animate-pulse" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
