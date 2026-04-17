// 💰 財務中心 — 商品管理（統一顯示遊戲 + 對戰場地）
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Gamepad2, Swords, ExternalLink, Package } from "lucide-react";

interface Product {
  id: string;
  category: "game" | "battle";
  sourceId: string;
  name: string;
  pricingMode: string;
  price: number;
  status: string;
  metadata: Record<string, unknown>;
}

interface ProductsResponse {
  products: Product[];
  total: number;
}

export default function RevenueProducts() {
  const { isAuthenticated } = useAdminAuth();
  const [filter, setFilter] = useState<"all" | "game" | "battle">("all");

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["/api/revenue/products", filter],
    queryFn: async () => {
      const url =
        filter === "all"
          ? "/api/revenue/products"
          : `/api/revenue/products?category=${filter}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  return (
    <UnifiedAdminLayout title="💰 商品管理">
      <div className="space-y-4">
        <div className="rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Package className="w-5 h-5" />
            商品管理
          </h2>
          <p className="text-emerald-50 text-sm">
            所有可販售商品一覽（遊戲、對戰場地、章節）
          </p>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="game">🎮 遊戲</TabsTrigger>
            <TabsTrigger value="battle">⚔️ 對戰場地</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.products?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>尚無商品</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.products.map((p) => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </UnifiedAdminLayout>
  );
}

function ProductRow({ product }: { product: Product }) {
  const isGame = product.category === "game";
  const editHref = isGame
    ? `/admin/games/${product.sourceId}/settings`
    : `/admin/battle/venues`;

  return (
    <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          isGame
            ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30"
            : "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
        }`}
      >
        {isGame ? <Gamepad2 className="w-5 h-5" /> : <Swords className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-medium truncate">{product.name}</p>
          <StatusBadge status={product.status} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{isGame ? "🎮 遊戲" : "⚔️ 對戰場地"}</span>
          <span>·</span>
          <PricingBadge mode={product.pricingMode} price={product.price} />
        </div>
      </div>
      <Link href={editHref}>
        <Button variant="ghost" size="sm" className="gap-1">
          <ExternalLink className="w-3.5 h-3.5" />
          編輯
        </Button>
      </Link>
    </div>
  );
}

function PricingBadge({ mode, price }: { mode: string; price: number }) {
  if (mode === "free" || price === 0) {
    return (
      <Badge variant="secondary" className="text-[10px]">
        ✨ 免費
      </Badge>
    );
  }
  const modeLabel: Record<string, string> = {
    one_time: "單次解鎖",
    per_chapter: "章節付費",
    per_person: "每人",
  };
  return (
    <Badge variant="outline" className="text-[10px] font-normal">
      NT$ {price.toLocaleString("zh-TW")} / {modeLabel[mode] ?? mode}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    published: { label: "已發布", className: "bg-emerald-100 text-emerald-700" },
    active: { label: "啟用中", className: "bg-emerald-100 text-emerald-700" },
    draft: { label: "草稿", className: "bg-slate-100 text-slate-600" },
    paused: { label: "暫停", className: "bg-amber-100 text-amber-700" },
    archived: { label: "封存", className: "bg-slate-200 text-slate-500" },
  };
  const v = variants[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <Badge variant="secondary" className={`text-[10px] ${v.className}`}>
      {v.label}
    </Badge>
  );
}
