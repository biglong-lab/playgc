// 預約完成頁 — Phase δ W1 D3
//
// 路徑：/book/:fieldCode/done/:bookingCode
// 顯示：預約碼、時間、人數、價格、取消按鈕、引導到「我的預約」

import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Calendar, Clock, Users, Hash, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface Booking {
  id: number;
  bookingCode: string;
  fieldId: string;
  lineUserId: string;
  displayName?: string;
  phone?: string;
  slotStart: string;
  slotEnd: string;
  partySize: number;
  status: string;
  paymentRequired: boolean;
  paymentStatus: string;
  amountCents: number;
  customerNote?: string;
  cancelledAt?: string | null;
}

export default function BookDonePage() {
  const params = useParams<{ fieldCode: string; bookingCode: string }>();
  const fieldId = params.fieldCode ?? "";
  const bookingCode = params.bookingCode ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lineUserId, setLineUserId] = useState<string | null>(null);

  useEffect(() => {
    // 從 localStorage（dev）或 LIFF 拿
    const stored = localStorage.getItem("__bookpage_test_lineUserId");
    if (stored) setLineUserId(stored);
    // production：從 LIFF 拿（這頁通常從預約頁跳來、應已登入）
  }, []);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingCode, lineUserId],
    queryFn: async () => {
      if (!lineUserId) return null;
      const res = await fetch(
        `/api/bookings/${bookingCode}?lineUserId=${encodeURIComponent(lineUserId)}`,
      );
      if (!res.ok) throw new Error("查詢失敗");
      const data = await res.json();
      return data.booking as Booking;
    },
    enabled: !!lineUserId && !!bookingCode,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!lineUserId) throw new Error("尚未登入");
      const res = await fetch(`/api/bookings/${bookingCode}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "取消失敗");
      return data.booking as Booking;
    },
    onSuccess: () => {
      toast({ title: "已取消" });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingCode] });
      queryClient.invalidateQueries({ queryKey: ["booking-availability"] });
    },
    onError: (err) => {
      toast({
        title: "取消失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">載入中...</div>;
  }
  if (!booking) {
    return (
      <div className="p-6">
        <p className="text-destructive mb-2">查不到此預約</p>
        <Button onClick={() => navigate(`/book/${fieldId}`)}>回預約頁</Button>
      </div>
    );
  }

  const isCancelled = booking.status === "cancelled";
  const slotStartDate = new Date(booking.slotStart);
  const dateStr = `${slotStartDate.getFullYear()}/${slotStartDate.getMonth() + 1}/${slotStartDate.getDate()}（${["日","一","二","三","四","五","六"][slotStartDate.getDay()]}）`;
  const timeStr = `${String(slotStartDate.getHours()).padStart(2,"0")}:${String(slotStartDate.getMinutes()).padStart(2,"0")}`;

  return (
    <div className="container-player py-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(`/book/${fieldId}`)}
        className="flex items-center gap-1 text-sm text-muted-foreground mb-3"
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4" /> 回預約頁
      </button>

      <Card className="mb-4 border-2 border-primary/30">
        <CardHeader className="pb-3 text-center">
          {isCancelled ? (
            <>
              <X className="w-12 h-12 mx-auto text-destructive mb-2" />
              <CardTitle className="text-xl">預約已取消</CardTitle>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-2" />
              <CardTitle className="text-xl">預約成功！</CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">預約碼</div>
            <div className="font-bold text-2xl tracking-widest font-mono" data-testid="booking-code">
              {booking.bookingCode}
            </div>
          </div>
          <BookingDetailRow icon={<Calendar className="w-4 h-4" />} label="日期" value={dateStr} />
          <BookingDetailRow icon={<Clock className="w-4 h-4" />} label="時間" value={timeStr} />
          <BookingDetailRow icon={<Users className="w-4 h-4" />} label="人數" value={`${booking.partySize} 人`} />
          {booking.paymentRequired && (
            <BookingDetailRow
              icon={<Hash className="w-4 h-4" />}
              label="金額"
              value={`NT$${(booking.amountCents / 100).toLocaleString()}（${
                booking.paymentStatus === "paid" ? "已付款" :
                booking.paymentStatus === "pending" ? "待付款" : "—"
              }）`}
            />
          )}
          {booking.customerNote && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">您的備註</div>
              <div className="bg-muted px-3 py-2 rounded text-sm">{booking.customerNote}</div>
            </div>
          )}
          <Badge variant={isCancelled ? "destructive" : "default"} className="w-full justify-center">
            {isCancelled ? "已取消" : booking.status === "pending" ? "待確認" : "已確認"}
          </Badge>
        </CardContent>
      </Card>

      {!isCancelled && booking.status !== "completed" && (
        <Button
          variant="outline"
          className="w-full mb-3"
          onClick={() => {
            if (window.confirm("確定要取消此預約？")) {
              cancelMutation.mutate();
            }
          }}
          disabled={cancelMutation.isPending}
          data-testid="button-cancel"
        >
          {cancelMutation.isPending ? "取消中..." : "取消預約"}
        </Button>
      )}

      <Link href={`/book/${fieldId}/mine`}>
        <a className="block">
          <Button variant="ghost" className="w-full" data-testid="link-my-bookings">
            查看我的所有預約
          </Button>
        </a>
      </Link>

      {!isCancelled && (
        <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
          請保留此預約碼、現場報到使用<br />
          活動開始前 30 分鐘將透過 LINE 提醒您
        </p>
      )}
    </div>
  );
}

function BookingDetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <span className="text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="font-medium flex-1">{value}</span>
    </div>
  );
}
