// 📊 POS 今日小結（2026-05-18）
//
// 路徑：/pos/summary
// 顯示今日 POS 交易統計、按活動分組、含交易明細

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PosLayout from "./PosLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Receipt, User, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface PosTx {
  id: string;
  bookingId: number | null;
  activityId: string | null;
  amountCents: number;
  paidAmountCents: number;
  refundedCents: number;
  paymentMethod: string;
  voucherDiscountCents: number;
  customerName: string | null;
  note: string | null;
  createdAt: string;
  staffName?: string | null;
  staffId?: string;
}

interface Summary {
  date: string;
  fieldId: string;
  totalTransactions: number;
  totalPaidCents: number;
  totalDiscountCents: number;
  byActivity: Array<{
    activityId: string | null;
    count: number;
    totalCents: number;
  }>;
  byStaff?: Array<{
    staffId: string;
    name: string;
    count: number;
    totalCents: number;
  }>;
  transactions: PosTx[];
}

export default function PosSummary() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const refundTxn = useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      fetchWithAdminAuth(`/api/pos/transactions/${v.id}/refund`, { method: "POST", body: JSON.stringify({ reason: v.reason }) }),
    onSuccess: () => {
      toast({ title: "✅ 已記錄退款", description: "現金退款已記入退款報表" });
      qc.invalidateQueries({ queryKey: ["pos-summary"] });
      qc.invalidateQueries({ queryKey: ["pos-status-report"] });
    },
    onError: (e) => toast({ title: "退款失敗", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });
  const delTxn = useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      fetchWithAdminAuth(`/api/pos/transactions/${v.id}/delete`, { method: "POST", body: JSON.stringify({ reason: v.reason }) }),
    onSuccess: () => {
      toast({ title: "已移到垃圾桶", description: "可在 POS 垃圾桶還原" });
      qc.invalidateQueries({ queryKey: ["pos-summary"] });
      qc.invalidateQueries({ queryKey: ["pos-daily-report"] });
    },
    onError: (e) => toast({ title: "刪除失敗", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });
  const { data, isLoading } = useQuery<Summary>({
    queryKey: ["pos-summary"],
    queryFn: async () => await fetchWithAdminAuth("/api/pos/summary"),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <PosLayout title="今日小結" backTo="/pos">
        <p className="text-sm text-muted-foreground text-center py-6">載入中…</p>
      </PosLayout>
    );
  }

  const dateLabel = new Date(data.date).toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // 🆕 2026-05-18 CSV 匯出
  const handleDownloadCsv = () => {
    const headers = ["時間", "客名", "預約碼", "活動", "金額", "折抵", "付款方式", "收款員", "備註"];
    const rows = data.transactions.map((t) => {
      const time = new Date(t.createdAt).toLocaleString("zh-TW");
      return [
        time,
        t.customerName ?? "",
        t.bookingId ? `BK_${t.bookingId}` : "",
        t.activityId ?? "",
        (t.paidAmountCents / 100).toFixed(0),
        ((t.voucherDiscountCents ?? 0) / 100).toFixed(0),
        t.paymentMethod,
        t.staffName ?? "",
        (t.note ?? "").replace(/"/g, '""'),
      ].map((v) => `"${v}"`).join(",");
    });
    const csv = "﻿" + [headers.join(","), ...rows].join("\n"); // UTF-8 BOM + CRLF 兼容 Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pos-summary-${data.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PosLayout title="今日小結" backTo="/pos">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
        {data.transactions.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleDownloadCsv}>
            <Download className="w-3 h-3 mr-1" />
            匯出 CSV
          </Button>
        )}
      </div>

      {/* 大字總計 */}
      <Card className="mb-3 bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0">
        <CardContent className="py-5 text-center">
          <p className="text-xs uppercase tracking-wide">今日總收款</p>
          <p className="text-4xl font-bold my-1">
            NT${(data.totalPaidCents / 100).toLocaleString()}
          </p>
          <p className="text-xs opacity-90">
            {data.totalTransactions} 筆交易
            {data.totalDiscountCents > 0 && (
              <> · 折抵 NT${(data.totalDiscountCents / 100).toLocaleString()}</>
            )}
          </p>
        </CardContent>
      </Card>

      {/* 按活動分組 */}
      <section className="mb-4">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
          <TrendingUp className="w-4 h-4" aria-hidden="true" />
          按活動分組
        </h3>
        {data.byActivity.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-center text-sm text-muted-foreground">
              今日尚無交易
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.byActivity
              .sort((a, b) => b.totalCents - a.totalCents)
              .map((g) => (
                <Card key={g.activityId ?? "uncategorized"}>
                  <CardContent className="py-3 px-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        {g.activityId ? `活動 ${g.activityId.slice(0, 8)}` : "未分類"}
                      </p>
                      <p className="text-xs text-muted-foreground">{g.count} 筆</p>
                    </div>
                    <p className="text-lg font-bold text-amber-600">
                      NT${(g.totalCents / 100).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </section>

      {/* 按收款員分組（班次結算用）*/}
      {data.byStaff && data.byStaff.length > 0 && (
        <section className="mb-4">
          <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
            <User className="w-4 h-4" aria-hidden="true" />
            按收款員分組
          </h3>
          <div className="space-y-2">
            {data.byStaff
              .slice()
              .sort((a, b) => b.totalCents - a.totalCents)
              .map((g) => (
                <Card key={g.staffId}>
                  <CardContent className="py-3 px-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{g.name || "未知"}</p>
                      <p className="text-xs text-muted-foreground">{g.count} 筆</p>
                    </div>
                    <p className="text-lg font-bold text-amber-600">
                      NT${(g.totalCents / 100).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      )}

      {/* 交易明細 */}
      <section>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
          <Receipt className="w-4 h-4" aria-hidden="true" />
          交易明細
        </h3>
        {data.transactions.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-center text-sm text-muted-foreground">
              暫無交易紀錄
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.transactions
              .slice()
              .reverse()
              .map((t) => {
                const time = new Date(t.createdAt);
                const timeStr = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
                return (
                  <Card key={t.id}>
                    <CardContent className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground min-w-[3rem]">{timeStr}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {t.customerName || (t.bookingId ? `預約 #${t.bookingId}` : "散客")}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t.staffName ? `👤 ${t.staffName}` : ""}
                            {t.note ? ` · ${t.note}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {t.paymentMethod === "cash" ? "現金" : t.paymentMethod}
                        </Badge>
                        <p className="font-bold text-amber-600 text-sm">
                          NT${(t.paidAmountCents / 100).toLocaleString()}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 shrink-0 text-xs text-amber-600"
                          aria-label="退款"
                          onClick={() => {
                            const r = prompt("退款原因？（現金退款,記入退款報表）");
                            if (r && r.trim().length >= 2) refundTxn.mutate({ id: t.id, reason: r.trim() });
                            else if (r !== null) toast({ title: "請填至少 2 字原因", variant: "destructive" });
                          }}
                          data-testid={`refund-txn-${t.id}`}
                        >
                          退款
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          aria-label="刪除交易"
                          onClick={() => {
                            const r = prompt("刪除這筆帳務的原因？（必填，會進垃圾桶可還原）");
                            if (r && r.trim().length >= 2) delTxn.mutate({ id: t.id, reason: r.trim() });
                            else if (r !== null) toast({ title: "請填至少 2 字原因", variant: "destructive" });
                          }}
                          data-testid={`del-txn-${t.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}
      </section>
    </PosLayout>
  );
}
