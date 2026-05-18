// 🆘 排解中心 — 退款處理（2026-05-19 Phase D）
//
// cash 退款立即 completed（業主自己手動退錢、系統記錄）
// 線上退款（recur/stripe）等業主拿到金流商戶帳號

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Receipt, Search, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface TxLookup {
  transaction: {
    id: string;
    fieldId: string;
    bookingId: number | null;
    activityId: string | null;
    amountCents: number;
    paidAmountCents: number;
    paymentMethod: string;
    customerName: string | null;
    customerPhone: string | null;
    createdAt: string;
  };
  refunded: number;
  remaining: number;
}

interface RefundListItem {
  id: number;
  sourceType: string;
  sourceId: string;
  bookingId: number | null;
  amountCents: number;
  reason: string;
  refundMethod: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  processedAt: string | null;
  createdAt: string;
  staffName: string | null;
}

export default function TroubleshootRefund() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [txIdInput, setTxIdInput] = useState("");
  const [lookup, setLookup] = useState<TxLookup | null>(null);
  const [amountTwd, setAmountTwd] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<"cash" | "manual_adjust">("cash");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const recentRefunds = useQuery<{ refunds: RefundListItem[] }>({
    queryKey: ["/api/admin/refunds"],
    queryFn: () => fetchWithAdminAuth("/api/admin/refunds"),
    refetchInterval: 30_000,
  });

  const lookupMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await fetchWithAdminAuth(`/api/admin/refunds/lookup-tx?id=${encodeURIComponent(id.trim())}`)) as TxLookup;
    },
    onSuccess: (data) => {
      setLookup(data);
      setAmountTwd("");
      setReason("");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "查無此交易";
      toast({ variant: "destructive", title: "查詢失敗", description: msg });
      setLookup(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!lookup) throw new Error("尚未查到交易");
      const amountCents = Math.round(Number(amountTwd) * 100);
      return await fetchWithAdminAuth("/api/admin/refunds", {
        method: "POST",
        body: JSON.stringify({
          sourceType: "pos_transaction",
          sourceId: lookup.transaction.id,
          bookingId: lookup.transaction.bookingId,
          amountCents,
          reason,
          refundMethod: method,
          customerName: lookup.transaction.customerName,
          customerPhone: lookup.transaction.customerPhone,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "✅ 退款已記錄", description: "原交易狀態已更新" });
      setConfirmOpen(false);
      if (lookup) lookupMutation.mutate(lookup.transaction.id);
      recentRefunds.refetch();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "退款失敗";
      toast({ variant: "destructive", title: "失敗", description: msg });
    },
  });

  const amountCents = Math.round(Number(amountTwd) * 100);
  const valid = lookup && reason.trim().length >= 5 && amountCents > 0 && amountCents <= lookup.remaining;

  return (
    <UnifiedAdminLayout title="🆘 退款處理">
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin/troubleshoot")} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" />
          回排解中心
        </Button>

        <Card className="border-amber-200 dark:border-amber-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="w-5 h-5 text-amber-600" />
              現場退款（cash 模式立即生效）
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              業主自己手動退錢給客人、系統記錄交易紀錄 + audit 軌跡。線上金流退款待商戶帳號開通。
            </p>
          </CardHeader>
        </Card>

        {/* 步驟 1：查交易 */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <Label htmlFor="tx-input">交易 ID（pos_transaction.id）</Label>
            <div className="flex gap-2">
              <Input
                id="tx-input"
                value={txIdInput}
                onChange={(e) => setTxIdInput(e.target.value)}
                placeholder="UUID..."
                className="font-mono text-sm"
              />
              <Button
                onClick={() => txIdInput.trim() && lookupMutation.mutate(txIdInput)}
                disabled={!txIdInput.trim() || lookupMutation.isPending}
              >
                {lookupMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="ml-1">查交易</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              從 /pos/summary 或 /admin/revenue/transactions 拿交易 ID
            </p>
          </CardContent>
        </Card>

        {/* 步驟 2：交易資訊 + 退款表單 */}
        {lookup && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">交易資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Kv label="客人姓名" value={lookup.transaction.customerName ?? "—"} />
                <Kv label="電話" value={lookup.transaction.customerPhone ?? "—"} />
                <Kv label="原額" value={`NT$${(lookup.transaction.paidAmountCents / 100).toFixed(0)}`} />
                <Kv
                  label="可退"
                  value={
                    <span className={lookup.remaining > 0 ? "text-green-600" : "text-red-600"}>
                      NT${(lookup.remaining / 100).toFixed(0)}
                    </span>
                  }
                />
                <Kv label="付款方式" value={lookup.transaction.paymentMethod} />
                <Kv label="連動預約" value={lookup.transaction.bookingId ? `#${lookup.transaction.bookingId}` : "—"} />
              </div>

              {lookup.refunded > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 px-3 py-2 rounded text-xs">
                  此交易已退過 NT${(lookup.refunded / 100).toFixed(0)}
                </div>
              )}

              {lookup.remaining > 0 ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="amount">退款金額（TWD）</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="amount"
                        type="number"
                        value={amountTwd}
                        onChange={(e) => setAmountTwd(e.target.value)}
                        placeholder="例：500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAmountTwd(String(lookup.remaining / 100))}
                      >
                        全退
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="method">退款方式</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                      <SelectTrigger id="method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">💵 現金（業主現場退錢）</SelectItem>
                        <SelectItem value="manual_adjust">📝 手動調整（純記錄）</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      線上金流（recur / stripe）待業主商戶帳號開通後啟用
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="reason">原因（≥ 5 字、必填）</Label>
                    <Textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="例：客人未到、提前取消、爭議退款"
                      rows={2}
                    />
                  </div>

                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    disabled={!valid}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Receipt className="w-4 h-4 mr-1" />
                    準備退款 NT${amountTwd || "0"}
                  </Button>
                </>
              ) : (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 px-3 py-2 rounded text-sm">
                  此交易已全額退完、無法再退
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 最近退款 */}
        {recentRefunds.data && recentRefunds.data.refunds.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">最近退款（{recentRefunds.data.refunds.length} 筆）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {recentRefunds.data.refunds.slice(0, 20).map((r) => (
                <div key={r.id} className="text-xs border-l-2 border-amber-300 dark:border-amber-700 pl-2 py-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">NT${(r.amountCents / 100).toFixed(0)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.refundMethod === "cash" ? "💵 現金" : r.refundMethod}
                    </Badge>
                    <Badge
                      variant={r.status === "completed" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {r.status}
                    </Badge>
                    <span className="text-muted-foreground">{r.customerName ?? "—"}</span>
                    <span className="text-muted-foreground ml-auto">
                      {new Date(r.createdAt).toLocaleString("zh-TW", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5">原因：{r.reason}</p>
                  <p className="text-muted-foreground">操作員：{r.staffName ?? "—"}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 確認 dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                確認退款？
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 px-3 py-2 rounded">
                <p>
                  退款金額：<span className="font-bold text-lg">NT${amountTwd}</span>
                </p>
                <p>方式：{method === "cash" ? "💵 現金（請現場退錢給客人）" : "📝 手動調整"}</p>
                <p>原因：{reason}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                此動作會建立 refund 記錄 + audit log、無法刪除（可重新建立反向交易調整）
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                取消
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Receipt className="w-4 h-4 mr-1" />
                )}
                確認退款
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UnifiedAdminLayout>
  );
}

function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
