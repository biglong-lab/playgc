// 🔗 BindBookingPage — 人工建單短連結綁定 LINE（2026-06-13）
//
// 路徑：/b/:code（短連結，code = 預約碼）
// 流程：顧客點連結 → 看預約摘要 → 「用 LINE 綁定接收提醒」→ LINE 登入
//        → callback 伺服器端把這筆預約綁到他的 LINE → 回此頁顯示「已綁定」
// 綁定後：自動收到提醒、可在「我的預約」查詢。

import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CalendarCheck, Users, Loader2, MessageCircle } from "lucide-react";

interface BookingSummary {
  bookingCode: string;
  displayName: string | null;
  slotStart: string;
  partySize: number;
  status: string;
  fieldCode: string | null;
  fieldName: string | null;
  alreadyBound: boolean;
}

export default function BindBookingPage() {
  const [, params] = useRoute("/b/:code");
  const code = params?.code ?? "";
  const [summary, setSummary] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/bookings/by-code/${encodeURIComponent(code)}`);
        if (!res.ok) {
          if (active) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (active) setSummary(data.booking);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  const handleBind = () => {
    // 導到 LINE OAuth，callback 完成綁定後回此頁（#lineToken 由 AuthContext 自動登入）
    const returnTo = `/b/${encodeURIComponent(code)}`;
    window.location.href = `/api/auth/line?returnTo=${encodeURIComponent(returnTo)}&bindBooking=${encodeURIComponent(code)}`;
  };

  const formatSlot = (iso: string) =>
    new Date(iso).toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center space-y-2">
            <h1 className="font-bold text-lg">找不到這筆預約</h1>
            <p className="text-sm text-muted-foreground">連結可能有誤，請向現場人員確認。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-emerald-50 to-background dark:from-emerald-950/20">
      <Card className="max-w-sm w-full">
        <CardContent className="p-6 space-y-5">
          <div className="text-center space-y-1">
            <h1 className="font-bold text-xl">
              {summary.fieldName ?? "場域"}預約
            </h1>
            <p className="text-xs text-muted-foreground">預約碼 {summary.bookingCode}</p>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-primary" />
              {formatSlot(summary.slotStart)}
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {summary.partySize} 人
              {summary.displayName && <span className="text-muted-foreground">· {summary.displayName}</span>}
            </div>
          </div>

          {summary.alreadyBound ? (
            <div className="space-y-3 text-center">
              <div className="flex flex-col items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-12 h-12" />
                <p className="font-semibold">已綁定 LINE！</p>
              </div>
              <p className="text-sm text-muted-foreground">
                之後會自動收到預約提醒，也能隨時查詢你的預約。
              </p>
              {summary.fieldCode && (
                <Link href={`/book/${summary.fieldCode}/mine`}>
                  <Button className="w-full" data-testid="btn-my-bookings">查看我的預約</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                綁定 LINE 後，活動前會自動提醒你，也能隨時查詢預約資訊。
              </p>
              <Button
                className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white"
                onClick={handleBind}
                data-testid="btn-bind-line"
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                用 LINE 綁定接收提醒
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                不綁定也沒關係，預約一樣有效，只是不會收到提醒。
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
