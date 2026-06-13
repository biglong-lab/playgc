// 🗑️ POS 垃圾桶（2026-06-13）
// 路徑：/admin/pos-trash
// 顯示已軟刪除的 POS 資料(品項/客製群組/帳務交易)、含刪除原因+時間+操作者、可還原。
// 完整歷史(誰增刪改)請看「操作記錄」/admin/audit-logs。

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PosLayout from "./PosLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { RotateCcw } from "lucide-react";

const money = (c: number) => `NT$${((c ?? 0) / 100).toLocaleString()}`;
const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

interface DelProduct { id: string; name: string; category: string; priceCents: number; deletedAt: string | null; deleteReason: string | null }
interface DelGroup { id: string; name: string; deletedAt: string | null; deleteReason: string | null }
interface DelTxn { id: string; paidAmountCents: number; paymentMethod: string; customerName: string | null; deletedAt: string | null; deleteReason: string | null }

export default function PosTrash() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery<{ products: DelProduct[]; modifierGroups: DelGroup[]; transactions: DelTxn[] }>({
    queryKey: ["pos-trash"],
    queryFn: () => fetchWithAdminAuth("/api/admin/pos/trash"),
  });

  const restore = useMutation({
    mutationFn: (v: { type: string; id: string }) =>
      fetchWithAdminAuth("/api/admin/pos/restore", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => {
      toast({ title: "✅ 已還原" });
      qc.invalidateQueries({ queryKey: ["pos-trash"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["pos-mod-groups"] });
    },
    onError: (e) => toast({ title: "還原失敗", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  const products = data?.products ?? [];
  const groups = data?.modifierGroups ?? [];
  const txns = data?.transactions ?? [];
  const empty = products.length === 0 && groups.length === 0 && txns.length === 0;

  const Item = ({ title, sub, reason, deletedAt, onRestore }: { title: string; sub: string; reason: string | null; deletedAt: string | null; onRestore: () => void }) => (
    <div className="flex items-start gap-2 border-b py-2 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{title}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
        <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">原因：{reason || "（未填）"}</div>
        <div className="text-[11px] text-muted-foreground">刪除於 {fmt(deletedAt)}</div>
      </div>
      <Button size="sm" variant="outline" onClick={onRestore}><RotateCcw className="w-3 h-3 mr-1" />還原</Button>
    </div>
  );

  return (
    <PosLayout title="垃圾桶" backTo="/pos">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">已刪除的資料保留在此，可還原。完整增刪改歷史請看後台「操作記錄」。</p>
        {empty && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">垃圾桶是空的</CardContent></Card>
        )}

        {products.length > 0 && (
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">品項（{products.length}）</CardTitle></CardHeader>
            <CardContent className="py-1 px-3">
              {products.map((p) => (
                <Item key={p.id} title={p.name} sub={`${p.category} · ${money(p.priceCents)}`} reason={p.deleteReason} deletedAt={p.deletedAt} onRestore={() => restore.mutate({ type: "product", id: p.id })} />
              ))}
            </CardContent>
          </Card>
        )}

        {groups.length > 0 && (
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">客製群組（{groups.length}）</CardTitle></CardHeader>
            <CardContent className="py-1 px-3">
              {groups.map((g) => (
                <Item key={g.id} title={g.name} sub="客製群組" reason={g.deleteReason} deletedAt={g.deletedAt} onRestore={() => restore.mutate({ type: "modifierGroup", id: g.id })} />
              ))}
            </CardContent>
          </Card>
        )}

        {txns.length > 0 && (
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">帳務交易（{txns.length}）</CardTitle></CardHeader>
            <CardContent className="py-1 px-3">
              {txns.map((t) => (
                <Item key={t.id} title={money(t.paidAmountCents)} sub={`${t.paymentMethod}${t.customerName ? " · " + t.customerName : ""}`} reason={t.deleteReason} deletedAt={t.deletedAt} onRestore={() => restore.mutate({ type: "transaction", id: t.id })} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PosLayout>
  );
}
