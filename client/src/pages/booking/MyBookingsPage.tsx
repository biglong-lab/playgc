// 我的預約 — Phase δ W1 D3
//
// 路徑：/book/:fieldCode/mine
// 顯示玩家所有預約（含已取消、已完成）

import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, ArrowLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Booking {
  id: number;
  bookingCode: string;
  fieldId: string;
  slotStart: string;
  slotEnd: string;
  partySize: number;
  status: string;
  paymentStatus: string;
}

export default function MyBookingsPage() {
  const params = useParams<{ fieldCode: string }>();
  const fieldId = params.fieldCode ?? "";
  const [, navigate] = useLocation();
  const [lineUserId, setLineUserId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("__bookpage_test_lineUserId");
    if (stored) setLineUserId(stored);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings", lineUserId],
    queryFn: async () => {
      if (!lineUserId) return { bookings: [] };
      const res = await fetch(
        `/api/bookings/mine?lineUserId=${encodeURIComponent(lineUserId)}&includeCompleted=true`,
      );
      if (!res.ok) throw new Error("查詢失敗");
      return (await res.json()) as { bookings: Booking[] };
    },
    enabled: !!lineUserId,
  });

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

      <h1 className="text-xl font-bold mb-4">我的預約</h1>

      {!lineUserId && (
        <p className="text-muted-foreground text-sm">請先登入 LINE 才能查看預約</p>
      )}
      {isLoading && <p className="text-muted-foreground text-sm">載入中...</p>}
      {data && data.bookings.length === 0 && (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            目前沒有預約
            <Link href={`/book/${fieldId}`}>
              <a className="block mt-3">
                <Button>前往預約</Button>
              </a>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(data?.bookings ?? [])
          .slice()
          .reverse()
          .map((b) => {
            const date = new Date(b.slotStart);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}（${
              ["日", "一", "二", "三", "四", "五", "六"][date.getDay()]
            }）`;
            const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(
              date.getMinutes(),
            ).padStart(2, "0")}`;
            const statusVariant =
              b.status === "cancelled"
                ? "destructive"
                : b.status === "completed"
                  ? "secondary"
                  : "default";
            const statusLabel =
              b.status === "confirmed"
                ? "已確認"
                : b.status === "pending"
                  ? "待付款"
                  : b.status === "cancelled"
                    ? "已取消"
                    : b.status === "completed"
                      ? "已完成"
                      : b.status === "no_show"
                        ? "未到場"
                        : b.status;

            return (
              <Link key={b.id} href={`/book/${fieldId}/done/${b.bookingCode}`}>
                <a className="block" data-testid={`booking-${b.bookingCode}`}>
                  <Card className="hover:bg-accent transition-colors">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Calendar className="w-3 h-3" />
                          <span>{dateStr}</span>
                          <Clock className="w-3 h-3 ml-2" />
                          <span>{timeStr}</span>
                        </div>
                        <div className="font-mono font-bold text-sm">{b.bookingCode}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.partySize} 人
                          {b.paymentStatus === "paid" && " · 已付款"}
                          {b.paymentStatus === "pending" && " · 待付款"}
                        </div>
                      </div>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </a>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
