// 客戶預約頁 — Phase δ W1 D3
//
// 路徑：/book/:fieldCode
// 流程：
//   1. LIFF 初始化 → 拿玩家 LINE 名字 / 頭像
//   2. 選日期（往後 14 天 horizontal scroll）
//   3. 看當日 slot grid（時間 / 剩餘人數）
//   4. 選 slot + 人數 + 留言
//   5. 提交 → 顯示預約碼 + 我的預約入口
//
// 設計：
//   - LIFF 失敗（桌機 / 非 LINE 環境）→ fallback 提示「請用 LINE 開啟」+ 暫不擋
//   - 後續可加 idToken verify 強化身份保證

import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Users, CheckCircle2, AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { initLiff } from "@/lib/liff";
import { useToast } from "@/hooks/use-toast";

interface AvailableSlot {
  date: string;
  startAt: string;
  endAt: string;
  capacity: number;
  booked: number;
  available: number;
  bookable: boolean;
}

interface BookingConfigPublic {
  fieldId: string;
  isEnabled: boolean;
  isPaid: boolean;
  pricePerSlotCents: number;
  currency: string;
  cancellable: boolean;
  cancelBeforeMinutes: number;
  reminderMinutesBefore: number;
}

interface CreatedBooking {
  id: number;
  bookingCode: string;
  slotStart: string;
  slotEnd: string;
  partySize: number;
  status: string;
}

const LIFF_ID = (import.meta.env.VITE_LIFF_ID_BOOK as string | undefined) || "";

export default function BookPage() {
  const params = useParams<{ fieldCode: string }>();
  const fieldId = params.fieldCode ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // LIFF / LINE 身份
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [liffError, setLiffError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // 🆕 2026-05-17 per-field LIFF：先查場域對應 LIFF ID（公開 endpoint）
      // fallback build-time env VITE_LIFF_ID_BOOK（向下相容）
      let liffIdToUse: string | null = LIFF_ID ?? null;
      if (fieldId) {
        try {
          const res = await fetch(`/api/bookings/liff/${encodeURIComponent(fieldId)}`);
          if (res.ok) {
            const j = (await res.json()) as { liffId?: string };
            if (j.liffId) liffIdToUse = j.liffId;
          }
        } catch {
          // 失敗就 fallback build-time env
        }
      }
      if (!liffIdToUse) {
        // dev fallback：localStorage 給測試用
        const stored = localStorage.getItem("__bookpage_test_lineUserId");
        if (stored) {
          setLineUserId(stored);
          setDisplayName(localStorage.getItem("__bookpage_test_displayName") || "測試玩家");
        } else {
          setLiffError("此場域尚未設定 LINE LIFF、目前使用測試模式（請業主到 admin → LINE 設定填入 LIFF ID）");
        }
        return;
      }
      try {
        const result = await initLiff(liffIdToUse);
        if (!mounted) return;
        if (result.profile) {
          setLineUserId(result.profile.userId);
          setDisplayName(result.profile.displayName);
          setPictureUrl(result.profile.pictureUrl ?? null);
        } else if (!result.isLoggedIn && result.sdk) {
          // 觸發登入
          result.sdk.login({ redirectUri: window.location.href });
        }
      } catch (err) {
        if (!mounted) return;
        setLiffError(err instanceof Error ? err.message : "LIFF 初始化失敗");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fieldId]);

  // 查詢可預約時段（14 天）
  const { data: availability, isLoading: availLoading } = useQuery({
    queryKey: ["booking-availability", fieldId],
    queryFn: async () => {
      const today = new Date();
      const fromStr = formatYMD(today);
      const toDate = new Date(today);
      toDate.setDate(toDate.getDate() + 29); // 14 → 30 天（2026-05-08 修）
      const toStr = formatYMD(toDate);
      const res = await fetch(
        `/api/bookings/availability/${fieldId}?from=${fromStr}&to=${toStr}`,
      );
      if (!res.ok) throw new Error("查詢時段失敗");
      const data = await res.json();
      return data.slots as AvailableSlot[];
    },
    enabled: !!fieldId,
  });

  const { data: config, isLoading: configLoading, error: configError } = useQuery({
    queryKey: ["booking-config", fieldId],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/config/${fieldId}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("查詢設定失敗");
      }
      return (await res.json()) as BookingConfigPublic;
    },
    enabled: !!fieldId,
    retry: false,
  });

  // 整理日期 → slot list
  const slotsByDate = useMemo(() => {
    const m = new Map<string, AvailableSlot[]>();
    (availability ?? []).forEach((s) => {
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    });
    return m;
  }, [availability]);

  const availableDates = useMemo(() => {
    return Array.from(slotsByDate.keys()).sort();
  }, [slotsByDate]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [phone, setPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  // 預設選第一個有可預約 slot 的日期
  useEffect(() => {
    if (selectedDate || availableDates.length === 0) return;
    const firstAvail = availableDates.find((d) =>
      (slotsByDate.get(d) ?? []).some((s) => s.bookable),
    );
    if (firstAvail) setSelectedDate(firstAvail);
  }, [availableDates, slotsByDate, selectedDate]);

  const slotsToday = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!lineUserId) throw new Error("尚未取得 LINE 身份");
      if (!selectedSlot) throw new Error("請先選擇時段");
      if (partySize < 1 || partySize > selectedSlot.available) {
        throw new Error(`人數須在 1-${selectedSlot.available} 之間`);
      }
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId,
          lineUserId,
          displayName,
          phone: phone || undefined,
          slotStart: selectedSlot.startAt,
          partySize,
          customerNote: customerNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "預約失敗");
      }
      return data.booking as CreatedBooking;
    },
    onSuccess: (booking) => {
      toast({
        title: "✅ 預約成功",
        description: `預約碼 ${booking.bookingCode}`,
      });
      queryClient.invalidateQueries({ queryKey: ["booking-availability"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      // 跳到完成頁
      navigate(`/book/${fieldId}/done/${booking.bookingCode}`);
    },
    onError: (err) => {
      toast({
        title: "預約失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    },
  });

  if (!fieldId) {
    return (
      <div className="p-6">
        <p className="text-destructive">場域 code 缺失</p>
      </div>
    );
  }

  // 場域 config 查不到 → 場域不存在 / 未開通預約
  if (!configLoading && config === null && !configError) {
    return (
      <div className="container-player py-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold mb-2">此場域尚未開通預約功能</h2>
        <p className="text-sm text-muted-foreground mb-4">
          場域代碼：<code>{fieldId}</code>
        </p>
        <p className="text-xs text-muted-foreground">
          若您是業主、請至 admin 後台「預約管理」初始化此場域。
        </p>
      </div>
    );
  }

  return (
    <div className="container-player py-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground"
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4" /> 返回
        </button>
        <Link href={`/book/${fieldId}/mine`}>
          <a className="text-sm text-primary underline" data-testid="link-my-bookings">
            我的預約
          </a>
        </Link>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">場次預約</CardTitle>
          <CardDescription className="text-xs">
            {config?.isPaid
              ? `每梯 NT$${(config.pricePerSlotCents / 100).toLocaleString()} × 人數`
              : "免費場次"}
            {config?.cancellable && config.cancelBeforeMinutes === 0 && " · 隨時可取消"}
            {config?.cancellable && config.cancelBeforeMinutes > 0 &&
              ` · 開始前 ${config.cancelBeforeMinutes} 分鐘可取消`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {liffError && (
            <p className="text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {liffError}
            </p>
          )}
          {lineUserId ? (
            <p className="text-muted-foreground flex items-center gap-2">
              {pictureUrl && (
                <img
                  src={pictureUrl}
                  alt={displayName}
                  className="w-6 h-6 rounded-full"
                />
              )}
              <span>已登入：{displayName}</span>
            </p>
          ) : LIFF_ID ? (
            <p className="text-muted-foreground">正在連線 LINE…</p>
          ) : (
            <DevLineSetup
              onSet={(uid, name) => {
                setLineUserId(uid);
                setDisplayName(name);
                localStorage.setItem("__bookpage_test_lineUserId", uid);
                localStorage.setItem("__bookpage_test_displayName", name);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* 日期選擇 */}
      <div className="mb-4">
        <Label className="flex items-center gap-1 mb-2 text-sm">
          <Calendar className="w-4 h-4" /> 選擇日期
        </Label>
        {availLoading ? (
          <p className="text-muted-foreground text-sm">載入中...</p>
        ) : availableDates.length === 0 ? (
          <p className="text-destructive text-sm">未來 14 天無可預約場次</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {availableDates.map((d) => {
              const slots = slotsByDate.get(d) ?? [];
              const totalAvail = slots.reduce(
                (s, x) => s + (x.bookable ? x.available : 0),
                0,
              );
              const isSelected = d === selectedDate;
              const date = parseYMD(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelectedDate(d);
                    setSelectedSlot(null);
                  }}
                  className={`shrink-0 px-3 py-2 rounded-lg border text-center min-w-[72px] transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card"
                  } ${totalAvail === 0 ? "opacity-50" : ""}`}
                  disabled={totalAvail === 0}
                  data-testid={`date-${d}`}
                >
                  <div className="text-xs text-muted-foreground">
                    {["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}
                  </div>
                  <div className="font-bold">{date.getDate()}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {totalAvail > 0 ? `剩 ${totalAvail}` : "已滿"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* slot grid */}
      {selectedDate && slotsToday.length > 0 && (
        <div className="mb-4">
          <Label className="flex items-center gap-1 mb-2 text-sm">
            <Clock className="w-4 h-4" /> 選擇時間
          </Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slotsToday.map((s) => {
              const isSelected = selectedSlot?.startAt === s.startAt;
              return (
                <button
                  key={s.startAt}
                  type="button"
                  onClick={() => s.bookable && setSelectedSlot(s)}
                  disabled={!s.bookable}
                  className={`px-2 py-2 rounded-lg border text-sm transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 font-bold"
                      : "border-border bg-card"
                  } ${!s.bookable ? "opacity-30 cursor-not-allowed" : "hover:bg-accent"}`}
                  data-testid={`slot-${s.startAt}`}
                >
                  <div>{formatTime(s.startAt)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {s.bookable ? `剩 ${s.available}` : "已滿"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 預約細節 */}
      {selectedSlot && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-1">
              <Users className="w-4 h-4" /> 預約細節
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">人數（剩餘 {selectedSlot.available}）</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPartySize(Math.max(1, partySize - 1))}
                  disabled={partySize <= 1}
                  data-testid="button-party-minus"
                >
                  −
                </Button>
                <span className="font-bold text-lg w-8 text-center" data-testid="value-party-size">
                  {partySize}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPartySize(Math.min(selectedSlot.available, partySize + 1))
                  }
                  disabled={partySize >= selectedSlot.available}
                  data-testid="button-party-plus"
                >
                  +
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="phone" className="text-xs">手機號碼（選填、利於聯繫）</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                data-testid="input-phone"
              />
            </div>
            <div>
              <Label htmlFor="note" className="text-xs">備註（特殊需求請說明）</Label>
              <Textarea
                id="note"
                placeholder="例如：嬰兒同行需嬰兒椅"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                rows={2}
                maxLength={500}
                data-testid="input-note"
              />
            </div>
            {config?.isPaid && (
              <div className="bg-amber-50 dark:bg-amber-950 px-3 py-2 rounded text-sm">
                應付金額：
                <span className="font-bold text-amber-600">
                  NT${((config.pricePerSlotCents * partySize) / 100).toLocaleString()}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  確認後將轉至付款頁面
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 提交 */}
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!lineUserId || !selectedSlot || createMutation.isPending}
        onClick={() => createMutation.mutate()}
        data-testid="button-submit"
      >
        {createMutation.isPending ? (
          "預約中..."
        ) : !lineUserId ? (
          "請先登入 LINE"
        ) : !selectedSlot ? (
          "請選擇時段"
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            確認預約 · {partySize} 人
          </>
        )}
      </Button>

      {config?.isEnabled === false && (
        <Badge variant="destructive" className="mt-2 w-full justify-center">
          場域目前未開放預約
        </Badge>
      )}
    </div>
  );
}

// ── Utility ─────────────────────────────────────────

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Dev fallback：手動填 lineUserId ─────────────────

function DevLineSetup({ onSet }: { onSet: (uid: string, name: string) => void }) {
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  return (
    <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded space-y-2">
      <p className="text-xs text-yellow-700 dark:text-yellow-300">
        ⚠️ 開發模式：請手動輸入測試身份（生產環境會用 LINE 自動帶入）
      </p>
      <Input
        placeholder="lineUserId"
        value={uid}
        onChange={(e) => setUid(e.target.value)}
        data-testid="input-dev-line-user-id"
      />
      <Input
        placeholder="顯示名稱"
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-testid="input-dev-display-name"
      />
      <Button
        type="button"
        size="sm"
        onClick={() => uid && name && onSet(uid, name)}
        disabled={!uid || !name}
        data-testid="button-dev-set-line"
      >
        套用
      </Button>
    </div>
  );
}
