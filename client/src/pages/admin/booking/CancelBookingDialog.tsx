// 🚫 後台取消預約對話框（2026-09-23）
//
// 危險操作 L2（影響他人：玩家會收到 LINE 通知與原因）：
//   步驟 1 填原因（必填 ≥5 字、即時提示）→ 步驟 2 確認影響範圍 → 送出
// 原因規則與後端共用 shared/lib/booking-cancel-reason。不用原生 prompt / confirm。
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkCancelReason, CANCEL_REASON_MAX_LENGTH } from "@shared/lib/booking-cancel-reason";

export interface CancelTargetBooking {
  bookingCode: string;
  displayName?: string | null;
  slotStart: string;
}

interface CancelBookingDialogProps {
  readonly open: boolean;
  readonly booking: CancelTargetBooking | null;
  readonly isPending: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** 使用者確認後回傳去頭尾空白的原因 */
  readonly onConfirm: (reason: string) => void;
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
}

export default function CancelBookingDialog({
  open,
  booking,
  isPending,
  onOpenChange,
  onConfirm,
}: CancelBookingDialogProps) {
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"reason" | "confirm">("reason");

  // 每次開啟（或換一筆預約）都從空白原因開始
  useEffect(() => {
    if (open) {
      setReason("");
      setStep("reason");
    }
  }, [open, booking?.bookingCode]);

  const checked = checkCancelReason(reason);
  const who = booking?.displayName || "玩家";

  return (
    <Dialog open={open && !!booking} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>取消預約 {booking?.bookingCode}</DialogTitle>
          <DialogDescription>
            {who} · {booking ? formatSlot(booking.slotStart) : ""}
          </DialogDescription>
        </DialogHeader>

        {step === "reason" ? (
          <ReasonStep reason={reason} onChange={setReason} hint={checked.ok ? null : checked.message} />
        ) : (
          <ConfirmSummary bookingCode={booking?.bookingCode ?? ""} who={who} reason={checked.ok ? checked.reason : ""} />
        )}

        <DialogActions
          step={step}
          canProceed={checked.ok}
          isPending={isPending}
          onDismiss={() => onOpenChange(false)}
          onNext={() => setStep("confirm")}
          onBack={() => setStep("reason")}
          onConfirm={() => checked.ok && onConfirm(checked.reason)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface DialogActionsProps {
  step: "reason" | "confirm";
  canProceed: boolean;
  isPending: boolean;
  onDismiss: () => void;
  onNext: () => void;
  onBack: () => void;
  onConfirm: () => void;
}

/** 按鈕列：填寫步驟「先不取消 / 下一步」、確認步驟「返回修改 / 確定取消預約」 */
function DialogActions({ step, canProceed, isPending, onDismiss, onNext, onBack, onConfirm }: DialogActionsProps) {
  if (step === "reason") {
    return (
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onDismiss} data-testid="button-cancel-dismiss">
          先不取消
        </Button>
        <Button onClick={onNext} disabled={!canProceed} data-testid="button-cancel-next">
          下一步
        </Button>
      </DialogFooter>
    );
  }
  return (
    <DialogFooter className="gap-2">
      <Button variant="outline" onClick={onBack} data-testid="button-cancel-back">
        返回修改
      </Button>
      <Button
        variant="destructive"
        onClick={onConfirm}
        disabled={!canProceed || isPending}
        data-testid="button-cancel-confirm"
      >
        {isPending ? "取消中…" : "確定取消預約"}
      </Button>
    </DialogFooter>
  );
}

/** 確認步驟：寫明影響範圍（玩家收 LINE、不可復原）與玩家會看到的原因 */
function ConfirmSummary({ bookingCode, who, reason }: { bookingCode: string; who: string; reason: string }) {
  return (
    <div
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-2"
      data-testid="cancel-confirm-summary"
    >
      <p>
        確定取消預約 <b>{bookingCode}</b>（{who}）？取消後{who}會收到 LINE 取消通知，此動作無法復原。
      </p>
      <p className="text-muted-foreground">玩家會看到的原因：「{reason}」</p>
    </div>
  );
}

function ReasonStep({
  reason,
  onChange,
  hint,
}: {
  reason: string;
  onChange: (value: string) => void;
  hint: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="cancel-reason">取消原因（玩家會看到）</Label>
      <Textarea
        id="cancel-reason"
        value={reason}
        onChange={(e) => onChange(e.target.value)}
        placeholder="例：颱風停止營業、場地臨時維修"
        maxLength={CANCEL_REASON_MAX_LENGTH}
        rows={3}
        data-testid="input-cancel-reason"
      />
      <p
        className={`text-xs ${hint ? "text-destructive" : "text-muted-foreground"}`}
        data-testid="cancel-reason-hint"
        aria-live="polite"
      >
        {hint ?? "原因會附在 LINE 取消通知中"}
      </p>
    </div>
  );
}
