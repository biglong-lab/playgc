// 💰 POS 現金收款頁（2026-05-18）
//
// 路徑：/pos/checkout?bookingId=xxx
//   - 有 bookingId → 自動帶入金額 + 玩家姓名（綁定 booking 收款）
//   - 沒有 → 散客手填模式
// 流程：填金額 → 選付款方式 → 確認 → POST /api/pos/checkout → 成功頁

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import PosLayout from "./PosLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, DollarSign, Loader2, User, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { feedbackCheckoutSuccess, feedbackError } from "@/lib/pos-feedback";
import PosItemPicker, { type CartLine } from "./PosItemPicker";

interface BookingForCheckout {
  id: number;
  bookingCode: string;
  displayName: string | null;
  phone: string | null;
  partySize: number;
  amountCents: number;
  paymentStatus: string;
  paidAt: string | null;
  activityId: string | null;
}

interface DashboardResp {
  todayBookings: BookingForCheckout[];
}

type PaymentMethod = "cash" | "online_recur" | "online_stripe" | "linepay" | "voucher_full";

export default function PosCheckout() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  // 從 URL ?bookingId= 解析
  const bookingId = (() => {
    const u = new URL(window.location.href);
    const id = u.searchParams.get("bookingId");
    return id ? Number(id) : null;
  })();
  // 🆕 從現金閉環流程來時 ?return=/pos/cash → 收完返回櫃檯現金
  const returnTo = (() => {
    const r = new URL(window.location.href).searchParams.get("return");
    return r === "/pos/cash" ? "/pos/cash" : null;
  })();

  const { data: dashboard } = useQuery<DashboardResp>({
    queryKey: ["pos-dashboard"],
    queryFn: async () => await fetchWithAdminAuth("/api/pos/dashboard"),
    enabled: !!bookingId,
  });
  const booking = bookingId
    ? dashboard?.todayBookings.find((b) => b.id === bookingId) ?? null
    : null;

  // 表單
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amountDollars, setAmountDollars] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState<{ amountCents: number; method: string; lines: CartLine[]; discountCents: number } | null>(null);
  // 🆕 2026-05-18 找零計算 + 大金額確認
  const [tenderedDollars, setTenderedDollars] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);
  // 🆕 2026-06-13 收款模式：items=選品項 / free=自由金額。綁定預約預設自由金額
  const [mode, setMode] = useState<"items" | "free">("free");
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  // 🆕 整單折扣
  const [discountDollars, setDiscountDollars] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const discountCents = Math.max(0, Math.round(Number(discountDollars) * 100) || 0);

  useEffect(() => {
    if (booking) {
      setCustomerName(booking.displayName ?? "");
      setCustomerPhone(booking.phone ?? "");
      setAmountDollars(booking.amountCents ? String(booking.amountCents / 100) : "");
    }
  }, [booking]);

  const checkoutMut = useMutation({
    mutationFn: async () => {
      const useItems = mode === "items" && cartLines.length > 0;
      const amountCents = Math.round(Number(amountDollars) * 100);
      if (!useItems && (!Number.isFinite(amountCents) || amountCents < 0)) throw new Error("金額無效");
      return await fetchWithAdminAuth("/api/pos/checkout", {
        method: "POST",
        body: JSON.stringify({
          bookingId: bookingId ?? undefined,
          activityId: booking?.activityId ?? undefined,
          amountCents,
          paidAmountCents: amountCents,
          paymentMethod,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          note: note.trim() || undefined,
          // 🆕 帶品項明細 → 後端重算金額 + 記 line items
          items: useItems
            ? cartLines.filter((l) => !l.isCustom).map((l) => ({ productId: l.productId, qty: l.qty, modifierOptionIds: l.modifierOptionIds }))
            : undefined,
          customItems: useItems
            ? cartLines.filter((l) => l.isCustom).map((l) => ({ name: l.name, priceCents: l.unitPriceCents, qty: l.qty }))
            : undefined,
          // 🆕 整單折扣
          discountCents: discountCents > 0 ? discountCents : undefined,
          discountReason: discountCents > 0 ? (discountReason.trim() || undefined) : undefined,
        }),
      });
    },
    onSuccess: () => {
      feedbackCheckoutSuccess();
      setSuccess({
        amountCents: Math.max(0, Math.round(Number(amountDollars) * 100) - discountCents),
        method: paymentMethod,
        lines: mode === "items" ? cartLines : [],
        discountCents,
      });
      toast({ title: "✅ 收款成功" });
    },
    onError: (err: unknown) => {
      feedbackError();
      const msg = err instanceof Error ? err.message : "請重試";
      toast({ variant: "destructive", title: "收款失敗", description: msg });
    },
  });

  if (success) {
    return (
      <PosLayout title="收款完成" backTo="/pos">
        <Card className="mb-4 border-green-500 border-2">
          <CardContent className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" aria-hidden="true" />
            <h2 className="text-3xl font-bold text-green-600">
              NT${(success.amountCents / 100).toLocaleString()}
            </h2>
            <p className="text-sm text-muted-foreground">
              {success.method === "cash" ? "現金收款" : success.method} 已紀錄
            </p>
            {customerName && (
              <p className="text-sm">
                <User className="w-4 h-4 inline mr-1" />
                {customerName}
              </p>
            )}
            {booking && (
              <p className="text-xs text-muted-foreground">預約碼：{booking.bookingCode}</p>
            )}
          </CardContent>
        </Card>

        {/* 🆕 收據明細 */}
        {success.lines.length > 0 && (
          <Card className="mb-4">
            <CardContent className="py-3 px-3">
              <p className="text-xs text-muted-foreground mb-2">🧾 明細（可截圖給客人）</p>
              <div className="space-y-1.5">
                {success.lines.map((l, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="flex-1 min-w-0">
                      {l.name}
                      {l.modifierLabel && l.modifierLabel !== "臨時" ? <span className="text-xs text-muted-foreground"> · {l.modifierLabel}</span> : null}
                      <span className="text-xs text-muted-foreground"> ×{l.qty}</span>
                    </span>
                    <span>NT${((l.unitPriceCents * l.qty) / 100).toLocaleString()}</span>
                  </div>
                ))}
                {success.discountCents > 0 && (
                  <div className="flex justify-between text-sm text-red-600 border-t pt-1">
                    <span>折扣</span>
                    <span>-NT${(success.discountCents / 100).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>合計</span>
                  <span className="text-green-600">NT${(success.amountCents / 100).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => navigate(returnTo ?? "/pos")} data-testid="checkout-done-back">
            {returnTo ? "返回櫃檯現金" : "回首頁"}
          </Button>
          <Button
            onClick={() => {
              setSuccess(null);
              setCustomerName("");
              setCustomerPhone("");
              setAmountDollars("");
              setNote("");
              navigate(returnTo ? "/pos/checkout?return=/pos/cash" : "/pos/checkout");
            }}
          >
            繼續收款
          </Button>
        </div>
      </PosLayout>
    );
  }

  const amountCents = Math.round(Number(amountDollars) * 100) || 0;
  const validAmount = amountCents > 0;
  const tenderedCents = Math.round(Number(tenderedDollars) * 100) || 0;
  const changeCents = tenderedCents > 0 ? tenderedCents - amountCents : 0;
  const isLargeAmount = amountCents >= 200000; // NT$2000 以上要確認

  const triggerCheckout = () => {
    if (isLargeAmount && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setShowConfirm(false);
    checkoutMut.mutate();
  };

  return (
    <PosLayout title="現金收款" backTo={bookingId ? "/pos/bookings/today" : "/pos"}>
      <div className="space-y-3">
        {/* 綁定預約資訊 */}
        {booking && (
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
            <CardContent className="py-3 px-3">
              <p className="text-xs text-muted-foreground">預約 {booking.bookingCode}</p>
              <p className="font-semibold">{booking.displayName || "—"}</p>
              <p className="text-xs">
                {booking.partySize} 人 · 應收 NT${(booking.amountCents / 100).toFixed(0)}
              </p>
              {booking.paymentStatus === "paid" && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  ⚠️ 此預約已收款、繼續會建立新交易
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* 🆕 收款模式切換 */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant={mode === "items" ? "default" : "outline"} onClick={() => setMode("items")} data-testid="mode-items">
            🛒 選品項
          </Button>
          <Button variant={mode === "free" ? "default" : "outline"} onClick={() => { setMode("free"); setCartLines([]); }} data-testid="mode-free">
            ✏️ 自由金額
          </Button>
        </div>

        {/* 🆕 品項模式：選品項 → 自動帶金額 */}
        {mode === "items" && (
          <PosItemPicker
            onChange={(lines, totalCents) => {
              setCartLines(lines);
              setAmountDollars(totalCents > 0 ? String(totalCents / 100) : "");
            }}
          />
        )}

        {/* 金額（大字輸入）— 自由金額模式 */}
        {mode === "free" && (
        <Card>
          <CardContent className="py-4 px-3">
            <Label htmlFor="amount" className="text-xs">
              金額 *
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold text-muted-foreground">NT$</span>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                placeholder="0"
                className="text-2xl h-14 font-bold"
              />
            </div>
            {/* 快速金額按鈕 */}
            <div className="flex gap-1 mt-2">
              {[100, 500, 800, 1000].map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant="outline"
                  onClick={() => setAmountDollars(String(v))}
                >
                  +{v}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setAmountDollars("")}>
                清除
              </Button>
            </div>
          </CardContent>
        </Card>
        )}

        {/* 找零計算（cash 模式才顯示）*/}
        {paymentMethod === "cash" && validAmount && (
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
            <CardContent className="py-3 px-3 space-y-2">
              <Label htmlFor="tendered" className="text-xs">
                客付現金（找零計算、選填）
              </Label>
              <Input
                id="tendered"
                type="number"
                inputMode="decimal"
                value={tenderedDollars}
                onChange={(e) => setTenderedDollars(e.target.value)}
                placeholder="例：客人給 2000"
                className="text-lg h-11 font-semibold"
              />
              {/* 快速面額 */}
              <div className="flex gap-1 flex-wrap">
                {[500, 1000, 2000, 5000].map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant="outline"
                    onClick={() => setTenderedDollars(String(v))}
                  >
                    {v}
                  </Button>
                ))}
                <Button size="sm" variant="outline" onClick={() => setTenderedDollars(String(amountCents / 100))}>
                  剛好
                </Button>
              </div>
              {tenderedCents > 0 && (
                <div
                  className={`rounded px-3 py-2 text-center font-bold ${
                    changeCents < 0
                      ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                      : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                  }`}
                >
                  {changeCents < 0 ? (
                    <>還差 NT$ {(Math.abs(changeCents) / 100).toLocaleString()}</>
                  ) : (
                    <>找零 NT$ {(changeCents / 100).toLocaleString()}</>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 付款方式 */}
        <Card>
          <CardContent className="py-3 px-3">
            <Label className="text-xs">付款方式</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button
                variant={paymentMethod === "cash" ? "default" : "outline"}
                onClick={() => setPaymentMethod("cash")}
              >
                💵 現金
              </Button>
              <Button variant="outline" disabled title="待金流上線後啟用">
                💳 信用卡（待開通）
              </Button>
              <Button variant="outline" disabled title="待金流上線後啟用">
                LINE Pay（待開通）
              </Button>
              <Button variant="outline" disabled title="券折抵走 /pos/voucher">
                🎟️ 券折抵
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 散客資訊（無 booking 才顯示）*/}
        {!booking && (
          <Card>
            <CardContent className="py-3 px-3 space-y-2">
              <div>
                <Label htmlFor="customer-name" className="text-xs">
                  顧客姓名（選填）
                </Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="散客姓名"
                />
              </div>
              <div>
                <Label htmlFor="customer-phone" className="text-xs">
                  電話（選填）
                </Label>
                <Input
                  id="customer-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0912..."
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 備註 */}
        <Card>
          <CardContent className="py-3 px-3">
            <Label htmlFor="note" className="text-xs">
              備註（選填）
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：加購水彈、現金找零等"
              rows={2}
            />
          </CardContent>
        </Card>

        {/* 🆕 整單折扣 */}
        <Card>
          <CardContent className="py-3 px-3 space-y-2">
            <Label className="text-xs">整單折扣（選填，元）</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                value={discountDollars}
                onChange={(e) => setDiscountDollars(e.target.value)}
                placeholder="折抵金額"
                data-testid="discount-amount"
              />
              <Input
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="折扣原因"
                data-testid="discount-reason"
              />
            </div>
            {discountCents > 0 && (
              <div className="text-sm text-right">
                折抵 NT${(discountCents / 100).toLocaleString()} → 應收 <span className="font-bold text-amber-600">NT${(Math.max(0, amountCents - discountCents) / 100).toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 確認按鈕（大、固定底）*/}
        <Button
          className="w-full h-16 text-lg"
          onClick={triggerCheckout}
          disabled={!validAmount || checkoutMut.isPending}
        >
          {checkoutMut.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <DollarSign className="w-5 h-5 mr-1" />
          )}
          確認收款 NT${(amountCents / 100).toLocaleString()}
        </Button>

        {/* 大金額確認對話框 */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                確認大金額收款
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm">您將收取以下金額、請再次確認：</p>
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-200">
                  NT${(amountCents / 100).toLocaleString()}
                </p>
                {customerName && <p className="text-sm mt-1">{customerName}</p>}
                {booking && <p className="text-xs text-muted-foreground mt-1">預約碼 {booking.bookingCode}</p>}
              </div>
              {tenderedCents > 0 && (
                <div className="text-sm text-center">
                  客付 NT${(tenderedCents / 100).toLocaleString()}、{changeCents >= 0 ? `找零 NT$${(changeCents / 100).toLocaleString()}` : `不足 NT$${(Math.abs(changeCents) / 100).toLocaleString()}`}
                </div>
              )}
            </div>
            <DialogFooter className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                取消
              </Button>
              <Button onClick={() => checkoutMut.mutate()} disabled={checkoutMut.isPending}>
                確認收款
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PosLayout>
  );
}
