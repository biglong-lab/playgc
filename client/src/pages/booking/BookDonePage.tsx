// 預約完成頁 — Phase δ W1 D3
//
// 路徑：/book/:fieldCode/done/:bookingCode
// 顯示：預約碼、時間、人數、價格、取消按鈕、引導到「我的預約」

import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Calendar, Clock, Users, Hash, ArrowLeft, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { initLiff } from "@/lib/liff";
import QRCode from "qrcode";

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
  paymentMode?: string | null;
  qrToken?: string | null;
  customerNote?: string | null;
  cancelledAt?: string | null;
  activityId?: string | null;
  paidAt?: string | null;
  paidByStaffId?: string | null;
}

export default function BookDonePage() {
  const params = useParams<{ fieldCode: string; bookingCode: string }>();
  const fieldId = params.fieldCode ?? "";
  const bookingCode = params.bookingCode ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  // 🆕 2026-05-17 卡片式：場域資訊（封面 + 名稱）
  const [fieldInfo, setFieldInfo] = useState<{ name: string | null; logoUrl: string | null } | null>(null);
  // 🆕 2026-05-18 POS：QR Code dataURL（玩家現場出示用）
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // 🐛 2026-05-18 修補：原本「localStorage 優先 → LIFF」的順序有汙染風險
  // 業主回報：預約成功跳到 done 頁顯示「查不到」、原因是 localStorage 殘留舊測試 userId
  // 正確順序：先試 LIFF（真實身份）→ 失敗才 fallback localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!fieldId) return;
      // 查場域 LIFF ID + 封面 logoUrl
      try {
        const res = await fetch(`/api/bookings/liff/${encodeURIComponent(fieldId)}`);
        if (res.ok) {
          const j = (await res.json()) as { liffId?: string; fieldName?: string | null; logoUrl?: string | null };
          if (!cancelled) {
            setFieldInfo({ name: j.fieldName ?? null, logoUrl: j.logoUrl ?? null });
          }
          if (j.liffId) {
            const result = await initLiff(j.liffId);
            if (cancelled) return;
            if (result.profile) {
              setLineUserId(result.profile.userId);
              return;
            }
          }
        }
      } catch (err) {
        console.warn("[BookDonePage] LIFF init 失敗:", err);
      }
      // Fallback：localStorage（測試模式）
      if (!cancelled) {
        const stored = localStorage.getItem("__bookpage_test_lineUserId");
        if (stored) setLineUserId(stored);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fieldId]);

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

  // 🆕 2026-05-18 產 QR Code（POS 掃描用、優先 qr_token、fallback bookingCode）
  useEffect(() => {
    if (!booking) return;
    const token = booking.qrToken || `BK_${booking.bookingCode}`;
    QRCode.toDataURL(token, { width: 280, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch((err) => console.warn("[BookDonePage] QR 產生失敗:", err));
  }, [booking]);

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

  if (isLoading || !lineUserId) {
    return (
      <div className="container-player py-8 flex flex-col items-center gap-3" role="status" aria-live="polite">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{!lineUserId ? "取得 LINE 身份…" : "載入預約資訊…"}</p>
      </div>
    );
  }
  if (!booking) {
    return (
      <div className="container-player py-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-destructive" aria-hidden="true" />
        <div>
          <p className="font-semibold text-base mb-1">查不到此預約</p>
          <p className="text-xs text-muted-foreground">
            預約編號：<code>{bookingCode}</code>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            可能原因：預約屬於其他 LINE 帳號、或預約編號錯誤
          </p>
        </div>
        <Button onClick={() => navigate(`/book/${fieldId}`)} className="w-full sm:w-auto" aria-label="返回預約頁面">
          <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" />
          回預約頁
        </Button>
      </div>
    );
  }

  const isCancelled = booking.status === "cancelled";
  const slotStartDate = new Date(booking.slotStart);
  const dateStr = `${slotStartDate.getFullYear()}/${slotStartDate.getMonth() + 1}/${slotStartDate.getDate()}（${["日","一","二","三","四","五","六"][slotStartDate.getDay()]}）`;
  const timeStr = `${String(slotStartDate.getHours()).padStart(2,"0")}:${String(slotStartDate.getMinutes()).padStart(2,"0")}`;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg max-w-md mx-auto my-4">
      {/* 封面圖（場域 logo / fallback 預設射擊圖）*/}
      <img
        src={fieldInfo?.logoUrl || "/booking-cover-default.jpg"}
        alt={fieldInfo?.name || fieldId}
        className="w-full h-64 object-cover"
        onError={(e) => {
          // 場域 logoUrl 載入失敗 → 退回預設射擊圖
          if (!e.currentTarget.src.endsWith("/booking-cover-default.jpg")) {
            e.currentTarget.src = "/booking-cover-default.jpg";
          }
        }}
      />
      {fieldInfo?.name && (
        <div className="px-5 pt-3 -mb-1">
          <span className="text-xs text-slate-500">{fieldInfo.name}</span>
        </div>
      )}

      {/* 卡片內容 */}
      <div className="p-5 space-y-4">
        {/* 標題 */}
        <div className="flex items-center gap-2">
          {isCancelled ? (
            <>
              <X className="w-6 h-6 text-red-500" aria-hidden="true" />
              <h2 className="text-xl font-bold text-red-500">預約已取消</h2>
            </>
          ) : (
            <>
              <span className="text-2xl" role="img" aria-label="成功">✅</span>
              <h2 className="text-xl font-bold text-green-600">預約成功！</h2>
            </>
          )}
        </div>

        {/* 4 欄資訊（label 灰 / value 黑、時間綠強調） */}
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2">
            <span className="text-slate-500">姓名</span>
            <span className="text-slate-900 font-medium">{booking.displayName || "—"}</span>

            <span className="text-slate-500">預約碼</span>
            <span className="text-slate-900 font-mono font-bold" data-testid="booking-code">
              {booking.bookingCode}
            </span>

            <span className="text-slate-500">時間</span>
            <span className="text-green-600 font-bold">
              {dateStr} {timeStr}
            </span>

            <span className="text-slate-500">人數</span>
            <span className="text-slate-900 font-medium">{booking.partySize} 人</span>

            {booking.paymentRequired && (
              <>
                <span className="text-slate-500">金額</span>
                <span className="text-slate-900 font-medium">
                  NT$ {(booking.amountCents / 100).toLocaleString()}
                  <span className="ml-2 text-xs text-slate-500">
                    （{booking.paymentStatus === "paid" ? "✓ 已付款"
                      : booking.paymentStatus === "pending_onsite" ? "現場付款"
                      : booking.paymentStatus === "pending" ? "待付款"
                      : "—"}）
                  </span>
                </span>
                {booking.paidAt && (
                  <>
                    <span className="text-slate-500">收款時間</span>
                    <span className="text-slate-900 text-xs">
                      {new Date(booking.paidAt).toLocaleString("zh-TW", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* 🆕 2026-05-18 QR Code（給現場 POS 掃描）*/}
        {!isCancelled && qrDataUrl && (
          <div className="border-t pt-4">
            <div className="flex flex-col items-center gap-2">
              <img
                src={qrDataUrl}
                alt={`預約 ${booking.bookingCode} QR Code`}
                className="w-56 h-56 border-4 border-white rounded-lg shadow-md"
              />
              <p className="text-xs text-slate-500 text-center">
                {booking.paymentStatus === "pending_onsite"
                  ? "📱 出示此 QR 給現場工作人員核銷收款"
                  : "📱 出示此 QR 給現場工作人員以快速報到"}
              </p>
            </div>
          </div>
        )}

        {/* 備註（若有） */}
        {booking.customerNote && (
          <div className="border-t pt-3">
            <div className="text-xs text-slate-500 mb-1">您的備註</div>
            <div className="bg-slate-50 px-3 py-2 rounded text-sm text-slate-700">
              {booking.customerNote}
            </div>
          </div>
        )}

        {/* QR 提示 */}
        {!isCancelled && (
          <div className="border-t pt-3 flex items-start gap-2 text-xs text-slate-600">
            <span className="text-base" role="img" aria-label="手機">📱</span>
            <p>請於活動當天出示此預約碼或截圖</p>
          </div>
        )}

        {/* 狀態 Badge */}
        <Badge
          variant={isCancelled ? "destructive" : "default"}
          className={`w-full justify-center py-1.5 ${
            isCancelled ? "" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {isCancelled ? "已取消" : booking.status === "pending" ? "待確認" : "已確認"}
        </Badge>

        {/* 主 CTA */}
        <Link href={`/book/${fieldId}/mine`}>
          <a className="block">
            <Button
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-base py-6"
              data-testid="link-my-bookings"
            >
              查看預約詳情
            </Button>
          </a>
        </Link>

        {/* 🆕 2026-05-18 分享按鈕（Web Share API + 複製連結 fallback）*/}
        {!isCancelled && (
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              const shareUrl = `${window.location.origin}/book/${fieldId}`;
              const fieldName = fieldInfo?.name ?? fieldId;
              const shareData = {
                title: `${fieldName} - 線上預約`,
                text: `我剛預約了 ${fieldName}！你也來看看：`,
                url: shareUrl,
              };
              try {
                if (navigator.share) {
                  await navigator.share(shareData);
                } else {
                  await navigator.clipboard.writeText(shareUrl);
                  toast({ title: "✓ 連結已複製、可貼給朋友" });
                }
              } catch (err) {
                // 用戶取消分享、不顯錯
                if (err instanceof Error && err.name !== "AbortError") {
                  toast({ variant: "destructive", title: "分享失敗", description: err.message });
                }
              }
            }}
            data-testid="button-share"
          >
            📤 分享給朋友
          </Button>
        )}

        {/* 次要動作 */}
        {!isCancelled && booking.status !== "completed" && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              if (window.confirm("確定要取消此預約？")) {
                cancelMutation.mutate();
              }
            }}
            disabled={cancelMutation.isPending}
            data-testid="button-cancel"
            aria-label="取消此預約"
          >
            {cancelMutation.isPending ? "取消中..." : "取消預約"}
          </Button>
        )}

        <button
          type="button"
          onClick={() => navigate(`/book/${fieldId}`)}
          className="w-full text-sm text-slate-500 hover:text-slate-700 py-2"
          data-testid="link-back"
          aria-label="返回預約頁面"
        >
          <ArrowLeft className="w-4 h-4 inline mr-1" aria-hidden="true" />
          回預約首頁
        </button>

        {!isCancelled && (
          <p className="text-[11px] text-slate-400 text-center leading-relaxed pt-2 border-t">
            活動開始前 30 分鐘將透過 LINE 提醒您
          </p>
        )}
      </div>
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
