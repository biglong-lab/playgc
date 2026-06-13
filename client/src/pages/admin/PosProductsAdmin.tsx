// 🛒 POS 品項設定（2026-06-13）
// 路徑：/admin/pos-products
// 管理品項（照片/名稱/金額/類別）+ 客製群組（糖度/冰塊/加購）+ 品項客製關聯

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { Plus, Trash2, Pencil, Coffee, Package, GraduationCap } from "lucide-react";

const CATEGORIES = [
  { key: "food", label: "餐飲", icon: Coffee },
  { key: "goods", label: "文創商品", icon: Package },
  { key: "course", label: "課程", icon: GraduationCap },
] as const;

interface Product {
  id: string;
  category: string;
  name: string;
  photoUrl: string | null;
  priceCents: number;
  isActive: boolean;
  modifierGroupIds: string[];
}
interface ModOption { id: string; name: string; priceDeltaCents: number }
interface ModGroup { id: string; name: string; selectType: string; required: boolean; options: ModOption[] }

const money = (c: number) => `NT$${(c / 100).toLocaleString()}`;

export default function PosProductsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [cat, setCat] = useState<string>("food");

  const { data: prodData } = useQuery<{ products: Product[] }>({
    queryKey: ["pos-products"],
    queryFn: () => fetchWithAdminAuth("/api/admin/pos/products"),
  });
  const { data: groupData } = useQuery<{ groups: ModGroup[] }>({
    queryKey: ["pos-mod-groups"],
    queryFn: () => fetchWithAdminAuth("/api/admin/pos/modifier-groups"),
  });

  const products = prodData?.products ?? [];
  const groups = groupData?.groups ?? [];

  // ── 品項編輯 dialog ──
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const saveProduct = useMutation({
    mutationFn: async (p: Partial<Product>) => {
      const body = JSON.stringify({
        category: p.category ?? cat,
        name: p.name,
        priceCents: p.priceCents ?? 0,
        isActive: p.isActive ?? true,
      });
      if (p.id) return fetchWithAdminAuth(`/api/admin/pos/products/${p.id}`, { method: "PATCH", body });
      return fetchWithAdminAuth("/api/admin/pos/products", { method: "POST", body });
    },
    onSuccess: async (res: { product?: Product }) => {
      // 存品項客製關聯
      const pid = res.product?.id ?? editing?.id;
      if (pid && editing?.modifierGroupIds) {
        await fetchWithAdminAuth(`/api/admin/pos/products/${pid}/modifiers`, {
          method: "PUT",
          body: JSON.stringify({ groupIds: editing.modifierGroupIds }),
        });
      }
      toast({ title: "✅ 已儲存品項" });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["pos-products"] });
    },
    onError: (e) => toast({ title: "儲存失敗", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });
  const delProduct = useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      fetchWithAdminAuth(`/api/admin/pos/products/${v.id}`, { method: "DELETE", body: JSON.stringify({ reason: v.reason }) }),
    onSuccess: () => {
      toast({ title: "已移到垃圾桶", description: "可在 POS 垃圾桶還原" });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
    },
    onError: (e) => toast({ title: "刪除失敗", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  const uploadPhoto = async (productId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await fetchWithAdminAuth(`/api/admin/pos/products/${productId}/photo`, {
          method: "POST",
          body: JSON.stringify({ imageData: reader.result }),
        });
        toast({ title: "✅ 照片已更新" });
        qc.invalidateQueries({ queryKey: ["pos-products"] });
      } catch (e) {
        toast({ title: "上傳失敗", description: e instanceof Error ? e.message : "", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

  // ── 客製群組 ──
  const seedDefaults = useMutation({
    mutationFn: () => fetchWithAdminAuth("/api/admin/pos/seed-default-modifiers", { method: "POST" }),
    onSuccess: (r: { created?: string[] }) => {
      toast({ title: `✅ 已建立預設客製`, description: (r.created ?? []).join("、") || "已存在" });
      qc.invalidateQueries({ queryKey: ["pos-mod-groups"] });
    },
  });
  const addGroup = useMutation({
    mutationFn: (name: string) =>
      fetchWithAdminAuth("/api/admin/pos/modifier-groups", {
        method: "POST",
        body: JSON.stringify({ name, selectType: "single" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-mod-groups"] }),
  });
  const delGroup = useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      fetchWithAdminAuth(`/api/admin/pos/modifier-groups/${v.id}`, { method: "DELETE", body: JSON.stringify({ reason: v.reason }) }),
    onSuccess: () => { toast({ title: "已移到垃圾桶" }); qc.invalidateQueries({ queryKey: ["pos-mod-groups"] }); },
    onError: (e) => toast({ title: "刪除失敗", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });
  const addOption = useMutation({
    mutationFn: (v: { groupId: string; name: string; priceDeltaCents: number }) =>
      fetchWithAdminAuth(`/api/admin/pos/modifier-groups/${v.groupId}/options`, {
        method: "POST",
        body: JSON.stringify({ name: v.name, priceDeltaCents: v.priceDeltaCents }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-mod-groups"] }),
  });
  const delOption = useMutation({
    mutationFn: (id: string) => fetchWithAdminAuth(`/api/admin/pos/modifier-options/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-mod-groups"] }),
  });

  return (
    <UnifiedAdminLayout title="🛒 POS 品項設定">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* 品項 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>品項目錄</CardTitle>
            <Button size="sm" onClick={() => setEditing({ category: cat, priceCents: 0, isActive: true, modifierGroupIds: [] })} data-testid="btn-add-product">
              <Plus className="w-4 h-4 mr-1" />新增品項
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={cat} onValueChange={setCat}>
              <TabsList>
                {CATEGORIES.map((c) => (
                  <TabsTrigger key={c.key} value={c.key} data-testid={`cat-${c.key}`}>
                    <c.icon className="w-4 h-4 mr-1" />{c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {CATEGORIES.map((c) => (
                <TabsContent key={c.key} value={c.key} className="mt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {products.filter((p) => p.category === c.key).map((p) => (
                      <div key={p.id} className="border rounded-lg p-3 space-y-2" data-testid={`product-${p.id}`}>
                        {p.photoUrl ? (
                          <img src={p.photoUrl} alt={p.name} className="w-full h-24 object-cover rounded" />
                        ) : (
                          <div className="w-full h-24 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">無照片</div>
                        )}
                        <div className="font-medium text-sm truncate">{p.name}</div>
                        <div className="text-primary font-bold">{money(p.priceCents)}</div>
                        {!p.isActive && <Badge variant="outline">停用</Badge>}
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing({ ...p })}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <label className="flex-1">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(p.id, e.target.files[0])} />
                            <span className="inline-flex items-center justify-center w-full h-8 border rounded text-xs cursor-pointer hover-elevate">照片</span>
                          </label>
                          <Button size="sm" variant="ghost" onClick={() => { const r = prompt(`刪除「${p.name}」的原因？（必填）`); if (r && r.trim().length >= 2) delProduct.mutate({ id: p.id, reason: r.trim() }); else if (r !== null) toast({ title: "請填至少 2 字原因", variant: "destructive" }); }}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {products.filter((p) => p.category === c.key).length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-full py-6 text-center">尚無品項，點右上「新增品項」</p>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* 客製群組 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>客製選項（糖度 / 冰塊 / 加購）</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => seedDefaults.mutate()} data-testid="btn-seed-mods">建立預設糖度/冰塊</Button>
              <Button size="sm" onClick={() => { const n = prompt("群組名稱（如：加購）"); if (n) addGroup.mutate(n); }} data-testid="btn-add-group">
                <Plus className="w-4 h-4 mr-1" />新增群組
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {groups.length === 0 && <p className="text-sm text-muted-foreground">尚無客製群組，點「建立預設糖度/冰塊」快速開始</p>}
            {groups.map((g) => (
              <div key={g.id} className="border rounded-lg p-3 space-y-2" data-testid={`group-${g.id}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{g.name} <span className="text-xs text-muted-foreground">({g.selectType === "single" ? "單選" : "多選"})</span></div>
                  <Button size="sm" variant="ghost" onClick={() => confirm(`刪除群組「${g.name}」?`) && delGroup.mutate(g.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((o) => (
                    <Badge key={o.id} variant="secondary" className="gap-1">
                      {o.name}{o.priceDeltaCents > 0 ? ` +${money(o.priceDeltaCents)}` : ""}
                      <button onClick={() => delOption.mutate(o.id)} className="ml-1 text-destructive">×</button>
                    </Badge>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs"
                    onClick={() => {
                      const name = prompt("選項名稱（如：珍珠）");
                      if (!name) return;
                      const price = prompt("加價（元，免費填 0）", "0");
                      addOption.mutate({ groupId: g.id, name, priceDeltaCents: Math.round(Number(price || 0) * 100) });
                    }}
                  >
                    + 選項
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 品項編輯 dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "編輯品項" : "新增品項"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">類別</Label>
                <select className="w-full h-10 px-3 rounded-md border bg-background" value={editing.category ?? cat} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">名稱 *</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="珍珠奶茶 / 文創徽章 / 體驗課程" data-testid="product-name" />
              </div>
              <div>
                <Label className="text-xs">金額（元）*</Label>
                <Input type="number" min={0} value={editing.priceCents != null ? editing.priceCents / 100 : 0} onChange={(e) => setEditing({ ...editing, priceCents: Math.round(Number(e.target.value) * 100) })} data-testid="product-price" />
              </div>
              <div>
                <Label className="text-xs">套用客製群組</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {groups.map((g) => {
                    const on = (editing.modifierGroupIds ?? []).includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          const cur = editing.modifierGroupIds ?? [];
                          setEditing({ ...editing, modifierGroupIds: on ? cur.filter((x) => x !== g.id) : [...cur, g.id] });
                        }}
                        className={`px-3 py-1 rounded-full border text-sm ${on ? "bg-primary text-primary-foreground" : "bg-background"}`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                  {groups.length === 0 && <span className="text-xs text-muted-foreground">先在下方建立客製群組</span>}
                </div>
              </div>
              <div>
                <Label className="text-xs">啟用</Label>
                <input type="checkbox" className="ml-2" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={() => editing && saveProduct.mutate(editing)} disabled={!editing?.name?.trim() || saveProduct.isPending} data-testid="product-save">
              {saveProduct.isPending ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnifiedAdminLayout>
  );
}
