// Admin 預約管理頁 — Phase δ W1 D4
//
// 路徑：/admin/bookings
//
// Tab 結構：
//   1. 預約列表  — filter 日期區間 + 狀態、強制取消
//   2. 場域設定  — 顯示 schedule_template、付費 / 取消政策（編輯交給 W1 D5 月曆編輯器）
//   3. 黑名單   — 列出 + 新增 + 刪除
//   4. 通知模板 — 編輯 4 種訊息
//
// 場域選擇：第一期固定用 "jiacun"（之後可改成從 user.fields 多場域選）
// 之後 multi-field admin 可用同模式擴展

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import PublicBookingLinkCard from "@/components/admin/PublicBookingLinkCard";
import { useCurrentField } from "@/providers/FieldThemeProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import {
  Calendar,
  Trash2,
  Plus,
  Save,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  UserX,
  Download,
} from "lucide-react";
import ScheduleEditor, { type ScheduleTemplate } from "./booking/ScheduleEditor";

// 🆕 2026-05-17：fallback 改成 "JIACHUN"（與 fields.code + booking_configs.field_id 一致）
// 真正生效的 fieldId 從 useCurrentField()?.code 拿、見 AdminBookings 主元件
const DEFAULT_FIELD = "JIACHUN";

interface BookingRow {
  id: number;
  bookingCode: string;
  fieldId: string;
  lineUserId: string;
  displayName?: string | null;
  phone?: string | null;
  slotStart: string;
  slotEnd: string;
  partySize: number;
  status: string;
  paymentStatus: string;
  amountCents: number;
  customerNote?: string | null;
  createdAt: string;
  // 🆕 2026-05-18 多活動
  activityId?: string | null;
  paymentMode?: string | null;
  checkedInAt?: string | null;
  paidAt?: string | null;
}

interface AdminActivityOption {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
}

interface ConfigRow {
  fieldId: string;
  isEnabled: boolean;
  isPaid: boolean;
  pricePerSlotCents: number;
  cancellable: boolean;
  cancelBeforeMinutes: number;
  reminderMinutesBefore: number;
  scheduleTemplate: unknown;
  adminNotes?: string | null;
}

interface BlackoutRow {
  id: number;
  fieldId: string;
  startAt: string;
  endAt: string;
  reason?: string | null;
}

interface TemplateRow {
  id: number;
  fieldId: string;
  templateKey: string;
  messageText: string;
  actionUrl?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
}

const TEMPLATE_KEYS_LABEL: Record<string, string> = {
  booking_confirmed: "預約成功通知",
  reminder_30min: "開始前提醒",
  game_start_keyword: "玩家「開始遊戲」回覆",
  game_completed: "遊戲完成通知",
  booking_cancelled: "預約取消通知",
};

export default function AdminBookings() {
  // 🆕 2026-05-17 #1：從 Provider 取 fieldCode、優先用真實場域代碼、fallback 才用 DEFAULT_FIELD
  // 修補業主回報「未開通預約」根因：原寫死 "jiacun" 與 booking_configs 實際 "JIACHUN" 不符
  const currentField = useCurrentField();
  const fieldCode = currentField?.code ?? null;
  const fieldId = fieldCode ?? DEFAULT_FIELD;

  return (
    <UnifiedAdminLayout title={`預約管理 · ${fieldId}`}>
      {/* 🆕 對外預約連結卡 */}
      <div className="mb-4">
        <PublicBookingLinkCard fieldCode={fieldCode} fieldId={fieldId} />
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" data-testid="tab-list">📋 預約列表</TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config">⚙️ 場域設定</TabsTrigger>
          <TabsTrigger value="blackouts" data-testid="tab-blackouts">🚫 黑名單時段</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">💬 通知模板</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <BookingListPanel fieldId={fieldId} />
        </TabsContent>
        <TabsContent value="config">
          <ConfigPanel fieldId={fieldId} />
        </TabsContent>
        <TabsContent value="blackouts">
          <BlackoutPanel fieldId={fieldId} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatePanel fieldId={fieldId} />
        </TabsContent>
      </Tabs>
    </UnifiedAdminLayout>
  );
}

// ============================================================================
// 1. 預約列表
// ============================================================================

function BookingListPanel({ fieldId }: { fieldId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(formatDateInput(new Date()));
  const [to, setTo] = useState(formatDateInput(addDays(new Date(), 14)));
  const [statusFilter, setStatusFilter] = useState<string>("");
  // 🆕 2026-05-18：活動篩選（""=全部、"none"=未綁活動、其他=activityId）
  const [activityFilter, setActivityFilter] = useState<string>("");

  // 拉場域的所有活動（給 filter 用）
  const { data: activities } = useQuery({
    queryKey: ["admin-activities-options"],
    queryFn: async () => {
      const res = await fetchWithAdminAuth("/api/admin/activities");
      return (res.activities ?? []) as AdminActivityOption[];
    },
  });

  const queryKey = ["admin-bookings-list", fieldId, from, to, statusFilter, activityFilter];
  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const url = new URL(`/api/admin/bookings/${fieldId}/list`, window.location.origin);
      if (from) url.searchParams.set("from", new Date(from).toISOString());
      if (to) url.searchParams.set("to", new Date(`${to}T23:59:59`).toISOString());
      if (statusFilter) url.searchParams.set("status", statusFilter);
      const res = await fetchWithAdminAuth(url.toString());
      const list = (res.bookings || []) as BookingRow[];
      // 前端過濾 activity（後端等下個版本加 query param）
      if (!activityFilter) return list;
      if (activityFilter === "none") return list.filter((b) => !b.activityId);
      return list.filter((b) => b.activityId === activityFilter);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ code, reason }: { code: string; reason: string }) => {
      return await fetchWithAdminAuth(`/api/admin/bookings/${code}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      toast({ title: "已取消、玩家已收到 LINE 通知" });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast({
        title: "取消失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ code, customActionUrl }: { code: string; customActionUrl?: string }) => {
      return await fetchWithAdminAuth(`/api/admin/bookings/${code}/mark-completed`, {
        method: "POST",
        body: JSON.stringify({ sendNotification: true, customActionUrl }),
      });
    },
    onSuccess: () => {
      toast({ title: "已標記完成、玩家已收到 LINE 訊息（含優惠券連結）" });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      toast({
        title: "標記失敗",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      }),
  });

  const noShowMutation = useMutation({
    mutationFn: async (code: string) => {
      return await fetchWithAdminAuth(`/api/admin/bookings/${code}/mark-no-show`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "已標記未到場" });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      toast({
        title: "標記失敗",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      }),
  });

  // 🆕 2026-06-13 人工登記（電話預約）
  const [manualOpen, setManualOpen] = useState(false);
  const [bindLink, setBindLink] = useState(""); // 建單後產生的 LINE 綁定短連結
  const [mName, setMName] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mDate, setMDate] = useState(formatDateInput(new Date()));
  const [mTime, setMTime] = useState("14:00");
  const [mParty, setMParty] = useState(2);
  const [mActivity, setMActivity] = useState("");
  const [mNote, setMNote] = useState("");

  const manualMutation = useMutation({
    mutationFn: async () => {
      const slotStart = new Date(`${mDate}T${mTime}:00`).toISOString();
      return await fetchWithAdminAuth(`/api/admin/bookings/${fieldId}/manual`, {
        method: "POST",
        body: JSON.stringify({
          displayName: mName.trim(),
          phone: mPhone.trim() || undefined,
          slotStart,
          partySize: mParty,
          activityId: mActivity || undefined,
          customerNote: mNote.trim() || undefined,
        }),
      });
    },
    onSuccess: (res: { booking?: { bookingCode?: string } }) => {
      const code = res?.booking?.bookingCode;
      // 產生短連結讓現場傳給顧客綁定 LINE
      setBindLink(code ? `${window.location.origin}/b/${code}` : "");
      toast({ title: "✅ 已人工登記預約", description: "已通報賈村群組" });
      setMName("");
      setMPhone("");
      setMParty(2);
      setMActivity("");
      setMNote("");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      toast({
        title: "登記失敗",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      }),
  });

  // 🆕 2026-06-13 快速檢視：今日 / 本月 / 未來 / 全部
  function setRange(kind: "today" | "month" | "future" | "all") {
    const now = new Date();
    if (kind === "today") {
      setFrom(formatDateInput(now));
      setTo(formatDateInput(now));
    } else if (kind === "month") {
      setFrom(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
      setTo(formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (kind === "future") {
      setFrom(formatDateInput(now));
      setTo(formatDateInput(addDays(now, 90)));
    } else {
      setFrom(formatDateInput(addDays(now, -365)));
      setTo(formatDateInput(addDays(now, 365)));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-4 h-4" /> 預約列表
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 🆕 快速檢視 + 人工登記 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Button size="sm" variant="outline" onClick={() => setRange("today")} data-testid="chip-today">今日</Button>
          <Button size="sm" variant="outline" onClick={() => setRange("month")} data-testid="chip-month">本月</Button>
          <Button size="sm" variant="outline" onClick={() => setRange("future")} data-testid="chip-future">未來</Button>
          <Button size="sm" variant="outline" onClick={() => setRange("all")} data-testid="chip-all">全部</Button>
          <Button size="sm" className="ml-auto" onClick={() => setManualOpen(true)} data-testid="btn-manual-booking">➕ 人工登記</Button>
        </div>

        {/* 🆕 人工登記 dialog */}
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>➕ 人工登記預約（電話預約）</DialogTitle>
            </DialogHeader>
            {bindLink ? (
              <div className="space-y-3">
                <p className="text-sm">
                  ✅ 預約已建立。把這個連結傳給顧客（LINE / 簡訊），點了用 LINE 綁定就會自動收到提醒：
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={bindLink}
                    className="font-mono text-xs"
                    data-testid="bind-link"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard?.writeText(bindLink);
                      toast({ title: "已複製連結" });
                    }}
                    data-testid="copy-bind-link"
                  >
                    複製
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">顧客不綁也沒關係，預約一樣有效，只是不會收到提醒。</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setBindLink("");
                    setManualOpen(false);
                  }}
                >
                  完成
                </Button>
              </div>
            ) : (
            <>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">客戶名稱 *</Label>
                <Input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="王小明" data-testid="manual-name" />
              </div>
              <div>
                <Label className="text-xs">電話</Label>
                <Input value={mPhone} onChange={(e) => setMPhone(e.target.value)} placeholder="09xx-xxx-xxx" data-testid="manual-phone" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">日期 *</Label>
                  <Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} data-testid="manual-date" />
                </div>
                <div>
                  <Label className="text-xs">時間 *</Label>
                  <Input type="time" value={mTime} onChange={(e) => setMTime(e.target.value)} data-testid="manual-time" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">人數 *</Label>
                  <Input type="number" min={1} value={mParty} onChange={(e) => setMParty(Math.max(1, parseInt(e.target.value) || 1))} data-testid="manual-party" />
                </div>
                <div>
                  <Label className="text-xs">活動（選填）</Label>
                  <select className="w-full h-10 px-3 rounded-md border bg-background" value={mActivity} onChange={(e) => setMActivity(e.target.value)} data-testid="manual-activity">
                    <option value="">不綁活動</option>
                    {(activities ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs">備註</Label>
                <Textarea value={mNote} onChange={(e) => setMNote(e.target.value)} placeholder="電話預約、其他需求…" rows={2} data-testid="manual-note" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManualOpen(false)}>取消</Button>
              <Button onClick={() => manualMutation.mutate()} disabled={!mName.trim() || manualMutation.isPending} data-testid="manual-submit">
                {manualMutation.isPending ? "登記中…" : "確認登記"}
              </Button>
            </DialogFooter>
            </>
            )}
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div>
            <Label className="text-xs">起始日期</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              data-testid="input-from"
            />
          </div>
          <div>
            <Label className="text-xs">結束日期</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              data-testid="input-to"
            />
          </div>
          <div>
            <Label className="text-xs">狀態</Label>
            <select
              className="w-full h-10 px-3 rounded-md border bg-background"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="select-status"
            >
              <option value="">全部</option>
              <option value="confirmed">已確認</option>
              <option value="pending">待確認</option>
              <option value="cancelled">已取消</option>
              <option value="completed">已完成</option>
              <option value="no_show">未到場</option>
            </select>
          </div>
          {/* 🆕 2026-05-18：活動篩選 */}
          {activities && activities.length > 0 && (
            <div>
              <Label className="text-xs">活動</Label>
              <select
                className="w-full h-10 px-3 rounded-md border bg-background"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                data-testid="select-activity"
              >
                <option value="">全部活動</option>
                <option value="none">未綁活動（舊版）</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {!a.isActive ? "（停用）" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end gap-1">
            <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 mr-1" /> 更新
            </Button>
            <Button
              onClick={() => {
                const list = data ?? [];
                if (!list.length) return;
                const headers = ["時間", "預約碼", "玩家", "電話", "活動", "人數", "狀態", "金額", "備註"];
                const actMap = new Map((activities ?? []).map((a) => [a.id, a.name]));
                const rows = list.map((b) => {
                  const t = new Date(b.slotStart);
                  return [
                    t.toLocaleString("zh-TW"),
                    b.bookingCode,
                    b.displayName ?? "",
                    b.phone ?? "",
                    b.activityId ? actMap.get(b.activityId) ?? "" : "",
                    String(b.partySize),
                    b.status,
                    String((b.amountCents ?? 0) / 100),
                    (b.customerNote ?? "").replace(/"/g, '""'),
                  ].map((v) => `"${v}"`).join(",");
                });
                const csv = "﻿" + [headers.join(","), ...rows].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `bookings-${from}-${to}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              variant="outline"
              title="匯出 CSV 給會計"
              disabled={!data?.length}
            >
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">載入中...</p>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">無符合條件的預約</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-2">時間</th>
                  <th className="text-left py-2 px-2">代碼</th>
                  <th className="text-left py-2 px-2">玩家</th>
                  <th className="text-left py-2 px-2">活動</th>
                  <th className="text-right py-2 px-2">人</th>
                  <th className="text-left py-2 px-2">狀態</th>
                  <th className="text-left py-2 px-2">電話</th>
                  <th className="text-left py-2 px-2">備註</th>
                  <th className="text-left py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((b) => {
                  const startDate = new Date(b.slotStart);
                  return (
                    <tr key={b.id} className="border-b hover:bg-muted/30" data-testid={`row-${b.bookingCode}`}>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {startDate.toLocaleString("zh-TW", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          weekday: "short",
                        })}
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">{b.bookingCode}</td>
                      <td className="py-2 px-2 truncate max-w-[120px]">{b.displayName || "—"}</td>
                      <td className="py-2 px-2 text-xs">
                        {b.activityId
                          ? activities?.find((a) => a.id === b.activityId)?.name ?? "—"
                          : <span className="text-muted-foreground italic">舊版</span>}
                      </td>
                      <td className="py-2 px-2 text-right">{b.partySize}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge status={b.status} />
                          {b.checkedInAt && (
                            <span className="text-[10px] text-green-600">✓ 到場</span>
                          )}
                          {(b.paidAt || b.paymentStatus === "paid") && (
                            <span className="text-[10px] text-blue-600">✓ 已收</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-xs">
                        {b.phone ? (
                          <a href={`tel:${b.phone}`} className="text-primary hover:underline" title="撥打電話">
                            📞 {b.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 px-2 text-xs max-w-[200px]" title={b.customerNote || ""}>
                        {b.customerNote ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 truncate max-w-full">
                            💬 {b.customerNote}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {(b.status === "confirmed" || b.status === "pending") && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="標記完成（推 LINE 含優惠券）"
                              onClick={() => {
                                const customUrl = window.prompt(
                                  "活動專屬優惠券連結（選填、空白則用預設模板的）：",
                                  "",
                                );
                                if (customUrl === null) return;
                                completeMutation.mutate({
                                  code: b.bookingCode,
                                  customActionUrl: customUrl || undefined,
                                });
                              }}
                              data-testid={`button-complete-${b.bookingCode}`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="標記未到場"
                              onClick={() => {
                                if (window.confirm("確定標記未到場？")) {
                                  noShowMutation.mutate(b.bookingCode);
                                }
                              }}
                              data-testid={`button-noshow-${b.bookingCode}`}
                            >
                              <UserX className="w-3 h-3 text-amber-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="取消預約（推 LINE 通知）"
                              onClick={() => {
                                const reason = window.prompt(`取消原因（玩家會看到）`);
                                if (reason !== null) {
                                  cancelMutation.mutate({ code: b.bookingCode, reason });
                                }
                              }}
                              data-testid={`button-cancel-${b.bookingCode}`}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          總計 {data?.length ?? 0} 筆
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    confirmed: { label: "已確認", variant: "default" },
    pending: { label: "待確認", variant: "outline" },
    cancelled: { label: "已取消", variant: "destructive" },
    completed: { label: "已完成", variant: "secondary" },
    no_show: { label: "未到場", variant: "destructive" },
  };
  const m = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

// ============================================================================
// 2. 場域設定
// ============================================================================

function ConfigPanel({ fieldId }: { fieldId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showInit, setShowInit] = useState(false);

  const queryKey = ["admin-booking-config", fieldId];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return (await fetchWithAdminAuth(`/api/admin/bookings/${fieldId}/config`)) as ConfigRow;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("not_initialized")) {
          setShowInit(true);
          return null;
        }
        throw e;
      }
    },
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      return await fetchWithAdminAuth(`/api/admin/bookings/${fieldId}/init`, {
        method: "POST",
        body: JSON.stringify({ preset: "jiacun" }),
      });
    },
    onSuccess: () => {
      toast({ title: "已初始化（賈村預設模板）" });
      setShowInit(false);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      toast({
        title: "初始化失敗",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<ConfigRow>) => {
      return await fetchWithAdminAuth(`/api/admin/bookings/${fieldId}/config`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: () => {
      toast({ title: "已儲存" });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      toast({
        title: "儲存失敗",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      }),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">載入中...</p>;
  if (showInit || !data) {
    return (
      <Card>
        <CardContent className="text-center py-10">
          <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="mb-4 text-muted-foreground">此場域尚未開通預約</p>
          <Button onClick={() => initMutation.mutate()} disabled={initMutation.isPending}>
            {initMutation.isPending ? "初始化中..." : "用賈村預設模板初始化"}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            模板：平日 14-18 / 假日 10-18 / 30 分一梯 / 12 人
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>場域設定</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>啟用預約</Label>
            <p className="text-xs text-muted-foreground">關閉後玩家無法新預約</p>
          </div>
          <Switch
            checked={data.isEnabled}
            onCheckedChange={(v) => updateMutation.mutate({ isEnabled: v })}
            data-testid="switch-enabled"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>需付費</Label>
            <p className="text-xs text-muted-foreground">啟用後預約需先付款（status=pending）</p>
          </div>
          <Switch
            checked={data.isPaid}
            onCheckedChange={(v) => updateMutation.mutate({ isPaid: v })}
            data-testid="switch-paid"
          />
        </div>

        {data.isPaid && (
          <div>
            <Label>單梯次費用（元）</Label>
            <Input
              type="number"
              defaultValue={Math.round(data.pricePerSlotCents / 100)}
              onBlur={(e) => {
                const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                updateMutation.mutate({ pricePerSlotCents: v * 100 });
              }}
              data-testid="input-price"
            />
            <p className="text-xs text-muted-foreground mt-1">
              實付金額 = 此費用 × 預約人數
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <Label>可取消</Label>
            <p className="text-xs text-muted-foreground">關閉後玩家不能自助取消</p>
          </div>
          <Switch
            checked={data.cancellable}
            onCheckedChange={(v) => updateMutation.mutate({ cancellable: v })}
          />
        </div>

        <div>
          <Label>取消最晚時限（開始前 N 分鐘）</Label>
          <Input
            type="number"
            defaultValue={data.cancelBeforeMinutes}
            onBlur={(e) => {
              const v = Math.max(0, parseInt(e.target.value, 10) || 0);
              updateMutation.mutate({ cancelBeforeMinutes: v });
            }}
            data-testid="input-cancel-before"
          />
          <p className="text-xs text-muted-foreground mt-1">0 = 隨時可取消</p>
        </div>

        <div>
          <Label>LINE 提醒（開始前 N 分鐘）</Label>
          <Input
            type="number"
            defaultValue={data.reminderMinutesBefore}
            onBlur={(e) => {
              const v = Math.max(0, parseInt(e.target.value, 10) || 0);
              updateMutation.mutate({ reminderMinutesBefore: v });
            }}
            data-testid="input-reminder-before"
          />
          <p className="text-xs text-muted-foreground mt-1">0 = 不發提醒（省 quota）</p>
        </div>

        <div>
          <Label>場域備註（私人）</Label>
          <Textarea
            defaultValue={data.adminNotes ?? ""}
            onBlur={(e) => updateMutation.mutate({ adminNotes: e.target.value })}
            rows={2}
            data-testid="input-admin-notes"
          />
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            📅 場次規則編輯器
          </h3>
          <ScheduleEditor
            template={data.scheduleTemplate as ScheduleTemplate}
            onChange={(t) => updateMutation.mutate({ scheduleTemplate: t as unknown as ConfigRow["scheduleTemplate"] })}
            isSaving={updateMutation.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 3. 黑名單時段
// ============================================================================

function BlackoutPanel({ fieldId }: { fieldId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ startAt: "", endAt: "", reason: "" });

  const queryKey = ["admin-blackouts", fieldId];
  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetchWithAdminAuth(`/api/admin/bookings/${fieldId}/blackouts`);
      return (res.blackouts || []) as BlackoutRow[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      return await fetchWithAdminAuth(`/api/admin/bookings/${fieldId}/blackouts`, {
        method: "POST",
        body: JSON.stringify({
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          reason: form.reason,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "已新增黑名單" });
      setOpen(false);
      setForm({ startAt: "", endAt: "", reason: "" });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      toast({
        title: "新增失敗",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await fetchWithAdminAuth(`/api/admin/bookings/${fieldId}/blackouts/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "已刪除" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>黑名單時段</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-add-blackout">
          <Plus className="w-4 h-4 mr-1" /> 新增
        </Button>
      </CardHeader>
      <CardContent>
        {(data ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center">尚無黑名單</p>
        ) : (
          <div className="space-y-2">
            {(data ?? []).map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 p-3 border rounded"
                data-testid={`blackout-${b.id}`}
              >
                <div className="flex-1 text-sm">
                  <div>
                    {new Date(b.startAt).toLocaleString("zh-TW")} →{" "}
                    {new Date(b.endAt).toLocaleString("zh-TW")}
                  </div>
                  <div className="text-xs text-muted-foreground">{b.reason || "—"}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(b.id)}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增黑名單時段</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>開始時間</Label>
              <Input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </div>
            <div>
              <Label>結束時間</Label>
              <Input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </div>
            <div>
              <Label>原因（選填）</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="例：休假、設備維護"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addMutation.mutate()} disabled={!form.startAt || !form.endAt}>
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================================
// 4. 通知模板
// ============================================================================

function TemplatePanel({ fieldId }: { fieldId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ["admin-templates", fieldId];
  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetchWithAdminAuth(`/api/admin/bookings/${fieldId}/templates`);
      return res as { templates: TemplateRow[]; availableKeys: string[] };
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>通知模板</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          可用變數：<code>{"{playerName}"}</code> <code>{"{bookingCode}"}</code>{" "}
          <code>{"{slotTime}"}</code> <code>{"{partySize}"}</code>{" "}
          <code>{"{actionUrl}"}</code>
        </p>
        {(data?.availableKeys ?? Object.keys(TEMPLATE_KEYS_LABEL)).map((key) => {
          const existing = data?.templates.find((t) => t.templateKey === key);
          return (
            <TemplateEditor
              key={key}
              fieldId={fieldId}
              templateKey={key}
              existing={existing}
              onSaved={() => queryClient.invalidateQueries({ queryKey })}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

function TemplateEditor({
  fieldId,
  templateKey,
  existing,
  onSaved,
}: {
  fieldId: string;
  templateKey: string;
  existing: TemplateRow | undefined;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState(existing?.messageText ?? "");
  const [actionUrl, setActionUrl] = useState(existing?.actionUrl ?? "");
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await fetchWithAdminAuth(
        `/api/admin/bookings/${fieldId}/templates/${templateKey}`,
        {
          method: "PUT",
          body: JSON.stringify({
            messageText: text,
            actionUrl: actionUrl || undefined,
            imageUrl: imageUrl || undefined,
            isActive,
          }),
        },
      );
    },
    onSuccess: () => {
      toast({ title: "已儲存" });
      onSaved();
    },
    onError: (err) =>
      toast({
        title: "儲存失敗",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      }),
  });

  return (
    <details className="border rounded p-3" open={!existing}>
      <summary className="cursor-pointer font-medium flex items-center justify-between">
        <span>{TEMPLATE_KEYS_LABEL[templateKey] || templateKey}</span>
        <Badge variant={existing?.isActive ? "default" : "outline"} className="text-xs">
          {existing ? (existing.isActive ? "啟用中" : "未啟用") : "未設定（用 default）"}
        </Badge>
      </summary>
      <div className="space-y-2 mt-3">
        <div>
          <Label className="text-xs">訊息內容</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="輸入訊息（可用變數）"
            data-testid={`textarea-${templateKey}`}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">附帶連結（選填）</Label>
            <Input
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="https://..."
              data-testid={`input-action-${templateKey}`}
            />
          </div>
          <div>
            <Label className="text-xs">附帶圖片 URL（選填）</Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              data-testid={`input-image-${templateKey}`}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              data-testid={`switch-active-${templateKey}`}
            />
            <Label className="text-xs">啟用</Label>
          </div>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !text.trim()}
            data-testid={`button-save-${templateKey}`}
          >
            <Save className="w-3 h-3 mr-1" /> 儲存
          </Button>
        </div>
      </div>
    </details>
  );
}

// ============================================================================
// Helper
// ============================================================================

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
}
