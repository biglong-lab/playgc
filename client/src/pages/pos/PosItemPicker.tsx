// 🛒 POS 品項選取器（2026-06-13）
// 載入 /api/pos/menu → 類別 tab → 點品項(有客製則彈選糖度/冰塊/加購) → 購物車
// 透過 onChange 把 cart items + 總額回拋給 PosCheckout。

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Minus } from "lucide-react";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface ModOption { id: string; name: string; priceDeltaCents: number }
interface ModGroup { id: string; name: string; selectType: string; required: boolean; options: ModOption[] }
interface MenuProduct {
  id: string;
  category: string;
  name: string;
  photoUrl: string | null;
  priceCents: number;
  soldOut?: boolean;
  modifierGroups: ModGroup[];
}
export interface CartLine {
  productId: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  modifierOptionIds: string[];
  modifierLabel: string;
  isCustom?: boolean; // 臨時品項（非目錄）
}

const CAT_LABELS: Record<string, string> = { food: "餐飲", goods: "文創", course: "課程" };
const money = (c: number) => `NT$${(c / 100).toLocaleString()}`;

export default function PosItemPicker({
  onChange,
}: {
  onChange: (lines: CartLine[], totalCents: number) => void;
}) {
  const { data } = useQuery<{ products: MenuProduct[] }>({
    queryKey: ["pos-menu"],
    queryFn: () => fetchWithAdminAuth("/api/pos/menu"),
  });
  const products = data?.products ?? [];
  const cats = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);
  const [cat, setCat] = useState<string>("");
  useEffect(() => {
    if (!cat && cats.length) setCat(cats[0]);
  }, [cats, cat]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [picking, setPicking] = useState<MenuProduct | null>(null);
  const [chosen, setChosen] = useState<Record<string, string[]>>({}); // groupId → optionIds

  const total = cart.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
  useEffect(() => {
    onChange(cart, total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  const addToCart = (p: MenuProduct) => {
    if (p.modifierGroups.length === 0) {
      pushLine(p, [], "");
      return;
    }
    // 預設選每組第一個 single 選項
    const init: Record<string, string[]> = {};
    for (const g of p.modifierGroups) {
      if (g.selectType === "single" && g.options[0]) init[g.id] = [g.options[0].id];
      else init[g.id] = [];
    }
    setChosen(init);
    setPicking(p);
  };

  const pushLine = (p: MenuProduct, optionIds: string[], label: string) => {
    const allOpts = p.modifierGroups.flatMap((g) => g.options);
    const delta = optionIds.reduce((s, oid) => s + (allOpts.find((o) => o.id === oid)?.priceDeltaCents ?? 0), 0);
    setCart((prev) => [
      ...prev,
      {
        productId: p.id,
        name: p.name,
        qty: 1,
        unitPriceCents: p.priceCents + delta,
        modifierOptionIds: optionIds,
        modifierLabel: label,
      },
    ]);
  };

  const confirmPick = () => {
    if (!picking) return;
    const optionIds: string[] = [];
    const labels: string[] = [];
    for (const g of picking.modifierGroups) {
      const sel = chosen[g.id] ?? [];
      for (const oid of sel) {
        optionIds.push(oid);
        const o = g.options.find((x) => x.id === oid);
        if (o) labels.push(o.name);
      }
    }
    pushLine(picking, optionIds, labels.join("/"));
    setPicking(null);
  };

  const setQty = (i: number, d: number) =>
    setCart((prev) => prev.map((l, idx) => (idx === i ? { ...l, qty: Math.max(1, l.qty + d) } : l)));
  const removeLine = (i: number) => setCart((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {/* 菜單 */}
      <Card>
        <CardContent className="py-3 px-3">
          {cats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              尚無品項，請先到「品項設定」建立
            </p>
          ) : (
            <Tabs value={cat} onValueChange={setCat}>
              <TabsList>
                {cats.map((c) => (
                  <TabsTrigger key={c} value={c}>{CAT_LABELS[c] ?? c}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {products.filter((p) => p.category === cat).map((p) => (
              <button
                key={p.id}
                onClick={() => !p.soldOut && addToCart(p)}
                disabled={p.soldOut}
                className={`border rounded-lg p-2 text-left ${p.soldOut ? "opacity-50 cursor-not-allowed" : "hover-elevate active-elevate-2"}`}
                data-testid={`menu-product-${p.id}`}
              >
                {p.photoUrl && <img src={p.photoUrl} alt={p.name} className="w-full h-14 object-cover rounded mb-1" />}
                <div className="text-xs font-medium truncate">{p.name}</div>
                <div className="text-xs text-primary font-bold">{p.soldOut ? "售完" : money(p.priceCents)}</div>
              </button>
            ))}
          </div>
          {/* 臨時品項 */}
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2"
            data-testid="btn-custom-item"
            onClick={() => {
              const name = prompt("臨時品項名稱");
              if (!name?.trim()) return;
              const price = prompt("金額（元）", "0");
              const cents = Math.round(Number(price || 0) * 100);
              if (!Number.isFinite(cents) || cents < 0) return;
              setCart((prev) => [
                ...prev,
                { productId: "", name: name.trim(), qty: 1, unitPriceCents: cents, modifierOptionIds: [], modifierLabel: "臨時", isCustom: true },
              ]);
            }}
          >
            ➕ 臨時品項（非目錄）
          </Button>
        </CardContent>
      </Card>

      {/* 購物車 */}
      {cart.length > 0 && (
        <Card>
          <CardContent className="py-3 px-3 space-y-2">
            <div className="text-xs text-muted-foreground">購物車</div>
            {cart.map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-sm border-b pb-2" data-testid={`cart-line-${i}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{l.name}</div>
                  {l.modifierLabel && <div className="text-xs text-muted-foreground">{l.modifierLabel}</div>}
                  <div className="text-xs text-primary">{money(l.unitPriceCents)} × {l.qty}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i, -1)}><Minus className="w-3 h-3" /></Button>
                  <span className="w-5 text-center">{l.qty}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i, 1)}><Plus className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-1">
              <span>合計</span>
              <span className="text-primary">{money(total)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 客製選擇 dialog */}
      <Dialog open={!!picking} onOpenChange={(o) => !o && setPicking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{picking?.name}</DialogTitle>
          </DialogHeader>
          {picking && (
            <div className="space-y-4">
              {picking.modifierGroups.map((g) => (
                <div key={g.id}>
                  <div className="text-sm font-medium mb-1">
                    {g.name}{" "}
                    <span className="text-xs text-muted-foreground">({g.selectType === "single" ? "單選" : "多選"})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.options.map((o) => {
                      const sel = (chosen[g.id] ?? []).includes(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setChosen((prev) => {
                              const cur = prev[g.id] ?? [];
                              if (g.selectType === "single") return { ...prev, [g.id]: [o.id] };
                              return { ...prev, [g.id]: sel ? cur.filter((x) => x !== o.id) : [...cur, o.id] };
                            });
                          }}
                          className={`px-3 py-1.5 rounded-full border text-sm ${sel ? "bg-primary text-primary-foreground" : "bg-background"}`}
                        >
                          {o.name}{o.priceDeltaCents > 0 ? ` +${money(o.priceDeltaCents)}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicking(null)}>取消</Button>
            <Button onClick={confirmPick} data-testid="confirm-pick">加入購物車</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
