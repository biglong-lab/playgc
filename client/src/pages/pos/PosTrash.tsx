// 🗑️ POS 垃圾桶（2026-06-13）
// 路徑：/admin/pos-trash
// 顯示已軟刪除的 POS 資料(品項/客製群組/帳務交易/現金支出)、含刪除原因+時間+操作者、可還原。
// 完整歷史(誰增刪改)請看「操作記錄」/admin/audit-logs。
// 2026-09-23：加入現金支出（過去刪了支出不會出現在這裡、也無法還原）

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PosLayout from "./PosLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { RotateCcw } from "lucide-react";

const money = (c: number) => `NT$${((c ?? 0) / 100).toLocaleString()}`;
const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

interface Deleted { id: string; deletedAt: string | null; deleteReason: string | null }
interface DelProduct extends Deleted { name: string; category: string; priceCents: number }
interface DelGroup extends Deleted { name: string }
interface DelTxn extends Deleted { paidAmountCents: number; paymentMethod: string; customerName: string | null }
interface DelExpense extends Deleted { businessDate: string; category: string; amountCents: number; note: string | null }

interface TrashData {
  products?: DelProduct[];
  modifierGroups?: DelGroup[];
  transactions?: DelTxn[];
  expenses?: DelExpense[];
}

type RestoreType = "product" | "modifierGroup" | "transaction" | "expense";

interface TrashItem extends Deleted { title: string; sub: string }
interface TrashSection { type: RestoreType; title: string; items: TrashItem[] }

/** 後端資料 → 各區塊顯示資料（空區塊不顯示） */
function buildSections(data: TrashData | undefined): TrashSection[] {
  const pick = ({ id, deletedAt, deleteReason }: Deleted) => ({ id, deletedAt, deleteReason });
  const sections: TrashSection[] = [
    { type: "product", title: "品項", items: (data?.products ?? []).map((p) => ({ ...pick(p), title: p.name, sub: `${p.category} · ${money(p.priceCents)}` })) },
    { type: "modifierGroup", title: "客製群組", items: (data?.modifierGroups ?? []).map((g) => ({ ...pick(g), title: g.name, sub: "客製群組" })) },
    { type: "transaction", title: "帳務交易", items: (data?.transactions ?? []).map((t) => ({ ...pick(t), title: money(t.paidAmountCents), sub: `${t.paymentMethod}${t.customerName ? " · " + t.customerName : ""}` })) },
    { type: "expense", title: "現金支出", items: (data?.expenses ?? []).map((e) => ({ ...pick(e), title: money(e.amountCents), sub: [e.category, e.note, e.businessDate].filter(Boolean).join(" · ") })) },
  ];
  return sections.filter((s) => s.items.length > 0);
}

export default function PosTrash() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery<TrashData>({
    queryKey: ["pos-trash"],
    queryFn: () => fetchWithAdminAuth("/api/admin/pos/trash"),
  });

  const restore = useMutation({
    mutationFn: (v: { type: RestoreType; id: string }) =>
      fetchWithAdminAuth("/api/admin/pos/restore", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => {
      toast({ title: "✅ 已還原" });
      for (const key of ["pos-trash", "pos-products", "pos-mod-groups", "pos-expenses-today", "pos-cash-today"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (e) => toast({ title: "還原失敗", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  const sections = buildSections(data);

  return (
    <PosLayout title="垃圾桶" backTo="/pos">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">已刪除的資料保留在此，可還原。完整增刪改歷史請看後台「操作記錄」。</p>
        {sections.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">垃圾桶是空的</CardContent></Card>
        )}
        {sections.map((s) => (
          <Card key={s.type}>
            <CardHeader className="py-3"><CardTitle className="text-base">{s.title}（{s.items.length}）</CardTitle></CardHeader>
            <CardContent className="py-1 px-3">
              {s.items.map((item) => (
                <TrashRow key={item.id} item={item} testId={`button-restore-${s.type}-${item.id}`} onRestore={() => restore.mutate({ type: s.type, id: item.id })} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </PosLayout>
  );
}

function TrashRow({ item, testId, onRestore }: { item: TrashItem; testId: string; onRestore: () => void }) {
  return (
    <div className="flex items-start gap-2 border-b py-2 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{item.title}</div>
        <div className="text-xs text-muted-foreground">{item.sub}</div>
        <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">原因：{item.deleteReason || "（未填）"}</div>
        <div className="text-[11px] text-muted-foreground">刪除於 {fmt(item.deletedAt)}</div>
      </div>
      <Button size="sm" variant="outline" onClick={onRestore} data-testid={testId}><RotateCcw className="w-3 h-3 mr-1" />還原</Button>
    </div>
  );
}
