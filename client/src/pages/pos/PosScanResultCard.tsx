// 📱 POS 掃描確認卡（2026-05-19）
//
// 拆出 PosScan.tsx 的結果頁、加入 5 種錯誤狀態 + 修正動作：
//   - too_early   → 「✅ 提前報到」按鈕（call force）
//   - too_late    → 「✅ 強制核銷」按鈕
//   - cancelled / no_show → 「✅ 強制核銷（重啟用）」按鈕
//   - already_checked_in  → 顯示但不擋
//   - 改梯次 → 對話框輸入新時段（call /reschedule）

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  DollarSign,
  Loader2,
  Clock,
  CalendarClock,
  ShieldAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import PosLayout from "./PosLayout";

interface BookingResult {
  type: "booking";
  booking: {
    id: number;
    bookingCode: string;
    displayName: string | null;
    phone?: string | null;
    slotStart: string;
    slotEnd?: string;
    partySize: number;
    status: string;
    paymentStatus: string;
    amountCents: number;
    checkedInAt: string | null;
    paidAt: string | null;
    activityId: string | null;
    customerNote?: string | null;
    adminNote?: string | null;
  };
  activity: { name: string; coverUrl: string | null } | null;
  timing?: "on_time" | "early" | "late";
  minutesBeforeStart?: number;
  minutesAfterEnd?: number;
  issues?: string[];
}

interface Props {
  result: BookingResult;
  onClose: () => void;
}

export default function PosScanResultCard({ result, onClose }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const b = result.booking;
  const issues = result.issues ?? [];

  const t = new Date(b.slotStart);
  const dateStr = `${t.getMonth() + 1}/${t.getDate()} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
  const alreadyArrived = !!b.checkedInAt;
  const alreadyPaid = b.paymentStatus === "paid" || !!b.paidAt;
  const needsPayment = !alreadyPaid && b.amountCents > 0;

  const hasIssue = issues.length > 0 && !(issues.length === 1 && issues[0] === "already_checked_in");
  const needsForce = issues.some((i) =>
    ["cancelled", "no_show", "too_early", "too_late"].includes(i),
  );

  // 改梯次 dialog
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newSlot, setNewSlot] = useState(toLocalInput(new Date()));
  const [reason, setReason] = useState("客人提前到場、現場有位置");

  const checkInMutation = useMutation({
    mutationFn: async (opts: { force: boolean; note?: string }) => {
      return await fetchWithAdminAuth(`/api/pos/bookings/${b.id}/check-in`, {
        method: "POST",
        body: JSON.stringify(opts),
      });
    },
    onSuccess: (_, vars) => {
      toast({ title: vars.force ? "✅ 已強制核銷" : "✅ 已報到" });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "操作失敗";
      toast({ variant: "destructive", title: "失敗", description: msg });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      const slotStart = new Date(newSlot).toISOString();
      return await fetchWithAdminAuth(`/api/pos/bookings/${b.id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ slotStart, durationMinutes: 30, reason }),
      });
    },
    onSuccess: () => {
      toast({ title: "✅ 已改梯次", description: "可繼續報到 / 收款" });
      setRescheduleOpen(false);
      // 重整：關卡片讓 user 重新掃 / 查
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "改梯次失敗";
      toast({ variant: "destructive", title: "失敗", description: msg });
    },
  });

  return (
    <PosLayout title="掃描結果" backTo="/pos/scan">
      <Card className="mb-4">
        {result.activity?.coverUrl && (
          <img
            src={result.activity.coverUrl}
            alt={result.activity.name}
            className="w-full h-32 object-cover rounded-t-lg"
          />
        )}
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" aria-hidden="true" />
            <h2 className="text-lg font-bold">{b.displayName || "—"}</h2>
          </div>
          {result.activity && <p className="text-sm font-semibold">{result.activity.name}</p>}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <Kv label="預約碼" value={b.bookingCode} />
            <Kv label="時間" value={dateStr} />
            <Kv label="人數" value={`${b.partySize} 人`} />
            <Kv label="金額" value={b.amountCents ? `NT$${(b.amountCents / 100).toFixed(0)}` : "—"} />
          </div>

          {b.phone && (
            <a href={`tel:${b.phone}`} className="text-sm text-primary hover:underline flex items-center gap-1">
              📞 {b.phone}
            </a>
          )}
          {b.customerNote && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 px-2 py-1.5 rounded text-xs">
              <span className="font-semibold">玩家備註：</span>
              {b.customerNote}
            </div>
          )}

          {/* 🆕 2026-05-19 五種狀態 banner */}
          {issues.includes("too_early") && (
            <IssueBanner
              icon={<Clock className="w-4 h-4" />}
              tone="amber"
              text={`還沒到時段（早 ${result.minutesBeforeStart ?? "?"} 分鐘）。現場有位置可直接提前報到、或改梯次。`}
            />
          )}
          {issues.includes("too_late") && (
            <IssueBanner
              icon={<AlertTriangle className="w-4 h-4" />}
              tone="red"
              text={`已過時段（晚 ${result.minutesAfterEnd ?? "?"} 分鐘）。可強制核銷收尾、或改梯次。`}
            />
          )}
          {issues.includes("cancelled") && (
            <IssueBanner
              icon={<ShieldAlert className="w-4 h-4" />}
              tone="red"
              text="此預約已取消、需強制核銷才能報到。"
            />
          )}
          {issues.includes("no_show") && (
            <IssueBanner
              icon={<ShieldAlert className="w-4 h-4" />}
              tone="red"
              text="此預約已標記為未到、需強制核銷才能報到。"
            />
          )}
          {alreadyArrived && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 px-3 py-2 rounded text-xs text-green-700 dark:text-green-300">
              ✓ 已於 {new Date(b.checkedInAt!).toLocaleTimeString("zh-TW")} 報到
            </div>
          )}
          {alreadyPaid && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 px-3 py-2 rounded text-xs text-blue-700 dark:text-blue-300">
              ✓ 已收款
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {!alreadyArrived && !needsForce && (
          <Button
            className="w-full h-14 text-base"
            onClick={() => checkInMutation.mutate({ force: false })}
            disabled={checkInMutation.isPending}
          >
            {checkInMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5 mr-1" />
            )}
            標記到場
          </Button>
        )}

        {!alreadyArrived && needsForce && (
          <Button
            className="w-full h-14 text-base bg-red-600 hover:bg-red-700"
            onClick={() => {
              if (!confirm(buildForceConfirmMessage(issues, result))) return;
              checkInMutation.mutate({
                force: true,
                note: forceNote(issues, result),
              });
            }}
            disabled={checkInMutation.isPending}
          >
            {checkInMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldAlert className="w-5 h-5 mr-1" />
            )}
            強制核銷
          </Button>
        )}

        {(issues.includes("too_early") || issues.includes("too_late") || hasIssue) && (
          <Button
            variant="outline"
            className="w-full h-14 text-base border-amber-500 text-amber-700 hover:bg-amber-50"
            onClick={() => setRescheduleOpen(true)}
          >
            <CalendarClock className="w-5 h-5 mr-1" />
            改梯次
          </Button>
        )}

        {needsPayment && (
          <Button
            variant="default"
            className="w-full h-14 text-base bg-amber-600 hover:bg-amber-700"
            onClick={() => navigate(`/pos/checkout?bookingId=${b.id}`)}
          >
            <DollarSign className="w-5 h-5 mr-1" />
            現場收款
          </Button>
        )}

        <Button variant="outline" className="w-full h-14 text-base col-span-2" onClick={onClose}>
          繼續掃描
        </Button>
      </div>

      {/* 改梯次對話框 */}
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>改梯次 — {b.bookingCode}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              原時段：{new Date(b.slotStart).toLocaleString("zh-TW")}
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-slot">新時段（30 分鐘）</Label>
              <Input
                id="new-slot"
                type="datetime-local"
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">原因（會寫進 admin note）</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ 此操作不檢查容量、請現場確認位置足夠
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => rescheduleMutation.mutate()}
              disabled={rescheduleMutation.isPending}
            >
              {rescheduleMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <CalendarClock className="w-4 h-4 mr-1" />
              )}
              確認改梯次
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function IssueBanner({
  icon,
  text,
  tone,
}: {
  icon: React.ReactNode;
  text: string;
  tone: "amber" | "red";
}) {
  const cls =
    tone === "red"
      ? "bg-red-50 dark:bg-red-900/20 border-red-200 text-red-700 dark:text-red-300"
      : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-700 dark:text-amber-300";
  return (
    <div className={`px-3 py-2 rounded border text-xs flex items-start gap-2 ${cls}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function buildForceConfirmMessage(issues: string[], r: BookingResult): string {
  const lines: string[] = ["⚠️ 強制核銷確認"];
  if (issues.includes("too_early")) lines.push(`• 早 ${r.minutesBeforeStart ?? "?"} 分鐘到`);
  if (issues.includes("too_late")) lines.push(`• 已過時段 ${r.minutesAfterEnd ?? "?"} 分鐘`);
  if (issues.includes("cancelled")) lines.push("• 此預約原本是「已取消」");
  if (issues.includes("no_show")) lines.push("• 此預約原本是「未到」");
  lines.push("", "確定要核銷？此動作會留紀錄到 admin note。");
  return lines.join("\n");
}

function forceNote(issues: string[], r: BookingResult): string {
  const parts: string[] = [];
  if (issues.includes("too_early")) parts.push(`早到 ${r.minutesBeforeStart}min`);
  if (issues.includes("too_late")) parts.push(`遲 ${r.minutesAfterEnd}min`);
  if (issues.includes("cancelled")) parts.push("原已取消");
  if (issues.includes("no_show")) parts.push("原 no-show");
  return parts.join(" / ");
}
