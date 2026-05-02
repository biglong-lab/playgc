// 💳 Pricing — 公開定價頁（W10 D1）
//
// 路徑：/pricing
// 用途：客戶看完 Pitch 後直接下單付費
//
// 特色：
//   - 三方案（一次性 / 訂閱 / 委辦）
//   - 一次性可直接下單（Stripe Checkout）
//   - 訂閱 / 委辦留聯絡表單

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, ArrowRight, CheckCircle, Loader2,
  Heart, PartyPopper, Building2, Briefcase, Home,
} from "lucide-react";
import { SCENARIO_TEMPLATES, type ScenarioCategory } from "@shared/scenario-templates";
import { toast } from "@/hooks/use-toast";

const CATEGORY_PRICING: Record<ScenarioCategory, { label: string; price: string; range: string; emoji: string }> = {
  social: { label: "交誼活動", price: "NT$ 6,000", range: "5,000-15,000", emoji: "💝" },
  event: { label: "公開活動", price: "NT$ 8,000", range: "5,000-30,000", emoji: "🎉" },
  public: { label: "公部門商圈", price: "NT$ 15,000", range: "8,000-30,000", emoji: "🏛️" },
  corporate: { label: "企業內訓", price: "NT$ 12,000", range: "8,000-30,000", emoji: "💼" },
  venue: { label: "空間故事", price: "NT$ 5,000", range: "3,000-10,000", emoji: "🏠" },
};

interface CheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

export default function Pricing() {
  const [location] = useLocation();
  const [selected, setSelected] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);

  // 從 URL query 偵測付款狀態
  const search = typeof window !== "undefined" ? window.location.search : "";
  const isCanceled = search.includes("canceled=1");

  const handleCheckout = async () => {
    if (!selected) return;
    setCreating(true);
    try {
      // W10 D3: 主要路徑 Recur.tw、Stripe 退場為 international fallback
      const res = await fetch("/api/payments/recur/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: selected,
          mode: "PAYMENT",
          customerEmail: email.trim() || undefined,
        }),
      });
      const data: CheckoutResponse | { error: string; code?: string } = await res.json();

      if (!res.ok) {
        const errorCode = "code" in data ? data.code : null;
        // 友善訊息對應 error code
        if (errorCode === "RECUR_NOT_CONFIGURED" || errorCode === "RECUR_PRODUCT_NOT_MAPPED") {
          toast({
            title: "💳 付費系統準備中",
            description: "請聯絡業務報名（LINE / Email），活動建場流程不受影響",
          });
        } else {
          toast({
            title: "❌ 失敗",
            description: "error" in data ? data.error : "付費建立失敗",
            variant: "destructive",
          });
        }
        return;
      }

      // 跳轉到 Recur.tw Checkout
      window.location.href = (data as CheckoutResponse).checkoutUrl;
    } catch (err) {
      toast({
        title: "❌ 連線錯誤",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const liveScenarios = SCENARIO_TEMPLATES.filter((s) => s.status === "live");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b safe-top">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="p-2 hover:bg-muted rounded-lg" data-testid="btn-back-home">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="font-display font-bold text-lg">💳 定價方案</h1>
              <p className="text-xs text-muted-foreground">
                依場合規模、彈性收費
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-12">
        {isCanceled && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-4 text-sm">
              💰 您取消了付款。如有任何問題請 LINE 我們。
            </CardContent>
          </Card>
        )}

        {/* Hero */}
        <section className="text-center space-y-4 py-8">
          <h2 className="text-3xl md:text-5xl font-display font-bold">
            選一個情境，<span className="text-primary">立即下單</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            一次性付費 — 完整建場 + AI 客製 + QR 列印 + 活動當天技術支援
            <br />
            付費後 5 分鐘內收到大螢幕網址 + 玩家 QR
          </p>
        </section>

        {/* 三方案總覽 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PricingCard
            tier="一次性活動"
            priceRange="NT$ 3,000-30,000"
            perWhat="/ 場"
            highlight={true}
            features={["完整建場", "AI 客製內容", "A4 QR 列印 PDF", "活動當天 LINE 支援", "活動後回顧寄送"]}
            cta="下方選情境立即下單"
          />
          <PricingCard
            tier="月訂閱"
            priceRange="NT$ 1,500-5,000"
            perWhat="/ 月"
            features={["10/50/無限 場次配額", "全 12 情境模板", "AI 客製內容", "優先技術支援", "Q4 升級活動 SaaS"]}
            cta="聯絡業務"
          />
          <PricingCard
            tier="季度委辦"
            priceRange="NT$ 80,000-200,000"
            perWhat="/ 季"
            features={["公部門 / 商圈 / 教育單位", "場域客製情境", "現場執行協作", "資料分析報告", "代理商分潤可談"]}
            cta="聯絡業務"
          />
        </section>

        {/* 選情境 */}
        <section className="space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-xl md:text-2xl font-display font-bold">
              選一個情境立即下單（一次性）
            </h2>
            <p className="text-sm text-muted-foreground">
              依分類預設價格、實際依規模可議
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveScenarios.map((s) => {
              const pricing = CATEGORY_PRICING[s.category];
              const isSelected = selected === s.id;
              return (
                <Card
                  key={s.id}
                  className={`cursor-pointer transition-all ${
                    isSelected ? "border-primary border-2 shadow-md" : "hover:border-primary/40"
                  }`}
                  onClick={() => setSelected(s.id)}
                  data-testid={`scenario-card-${s.id}`}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-sm">{pricing.emoji} {s.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.tagline}</p>
                      </div>
                      {isSelected && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
                    </div>
                    <div className="text-sm font-bold text-primary">{pricing.price}</div>
                    <div className="text-xs text-muted-foreground">{s.estimatedPlayers} · {s.estimatedDuration}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 下單表單 */}
          {selected && (
            <Card className="bg-primary/5 border-primary/30 mt-6">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-display font-bold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  您選了：{liveScenarios.find((s) => s.id === selected)?.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, 100))}
                    placeholder="活動名稱（如：Hung & Anita 5/15 婚禮）"
                    className="px-3 py-2 rounded-md border bg-background text-sm"
                    data-testid="input-display-name"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.slice(0, 100))}
                    placeholder="Email（收發票用，可選）"
                    className="px-3 py-2 rounded-md border bg-background text-sm"
                    data-testid="input-email"
                  />
                </div>
                <Button
                  onClick={handleCheckout}
                  disabled={creating}
                  size="lg"
                  className="w-full"
                  data-testid="btn-checkout"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" />建立付款中...</>
                  ) : (
                    <>立即付款 <ArrowRight className="w-4 h-4 ml-1" /></>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  跳轉到 Recur.tw 安全付款頁面 · 信用卡 / LINE Pay / ATM / 超商
                  <br />
                  自動開立電子發票（依 Email 寄送）
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* CTA 補充 */}
        <section className="text-center space-y-3 py-8">
          <p className="text-sm text-muted-foreground">
            還在猶豫？
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/pitch"><Button variant="outline">看完整介紹</Button></Link>
            <Link href="/find-scenario"><Button variant="outline">3 問找情境</Button></Link>
            <Link href="/showcase"><Button variant="outline">先試玩元件</Button></Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function PricingCard({
  tier,
  priceRange,
  perWhat,
  features,
  cta,
  highlight,
}: {
  tier: string;
  priceRange: string;
  perWhat: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary border-2 shadow-lg relative" : ""}>
      <CardContent className="p-5 space-y-3">
        {highlight && (
          <Badge className="absolute -top-2 -right-2 bg-primary">推薦</Badge>
        )}
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{tier}</div>
        <div>
          <div className="text-xl md:text-2xl font-display font-bold text-primary">
            {priceRange}
          </div>
          <div className="text-xs text-muted-foreground">{perWhat}</div>
        </div>
        <div className="space-y-1.5 pt-2 border-t">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-center text-muted-foreground pt-2 border-t italic">
          {cta}
        </div>
      </CardContent>
    </Card>
  );
}
