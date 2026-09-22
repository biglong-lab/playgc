// 💾 結算頁「保存這次紀錄」卡（2026-09-22 玩家動線優化 Phase 3）
//
// 業主需求：「遊戲結束，有需要紀錄，再引導使用者註冊，建立身份或者登入既有的身份」
// - 只給訪客看；不強迫（可按「先不用」收起）
// - 登入方式沿用 LoginDialog（LINE / Google / Apple / Email），隱藏「訪客」按鈕
// - 登入後由 GuestGate 自動認領，這張卡顯示結果
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLoginHandlers } from "@/hooks/useLoginHandlers";
import { LoginDialog } from "@/components/landing/LoginDialog";
import { isEmbeddedBrowser } from "@/components/landing/EmbeddedBrowserWarning";
import {
  GUEST_CLAIMED_EVENT,
  armGuestClaim,
  prefetchGuestClaimTicket,
  type ClaimResult,
} from "@/lib/guest-claim";

type CardState = "idle" | "saving" | "saved" | "failed";

function useClaimResult(onResult: (r: ClaimResult) => void) {
  useEffect(() => {
    const handler = (e: Event) => onResult((e as CustomEvent<ClaimResult>).detail);
    window.addEventListener(GUEST_CLAIMED_EVENT, handler);
    return () => window.removeEventListener(GUEST_CLAIMED_EVENT, handler);
  }, [onResult]);
}

export default function SaveRecordCard() {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();
  // 掛載當下是訪客才顯示（登入後仍保留這張卡顯示保存結果）
  const [wasGuest] = useState(() => !!firebaseUser?.isAnonymous);
  const [state, setState] = useState<CardState>("idle");
  const [failMessage, setFailMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const handlers = useLoginHandlers(() => setDialogOpen(false), { redirectTo: null });

  // 先拿好認領憑證 → 按登入時可同步開 Google popup（不被瀏覽器擋）
  useEffect(() => {
    if (wasGuest) void prefetchGuestClaimTicket();
  }, [wasGuest]);

  // 登入成功（不再是訪客）→ 顯示保存中，等 GuestGate 認領完成
  const isRealUser = !!firebaseUser && !firebaseUser.isAnonymous;
  useEffect(() => {
    if (wasGuest && isRealUser) setState((s) => (s === "idle" ? "saving" : s));
  }, [wasGuest, isRealUser]);

  const onClaimResult = useCallback((result: ClaimResult) => {
    if (result.ok) {
      setState("saved");
    } else {
      setState("failed");
      setFailMessage(result.message);
    }
  }, []);
  useClaimResult(onClaimResult);

  const handleSaveClick = async () => {
    setPreparing(true);
    const ready = armGuestClaim() || ((await prefetchGuestClaimTicket()) && armGuestClaim());
    setPreparing(false);
    if (!ready) {
      toast({ title: "暫時無法保存紀錄", description: "請檢查網路後再試一次", variant: "destructive" });
      return;
    }
    setDialogOpen(true);
  };

  if (!wasGuest || dismissed) return null;

  return (
    <div className="mb-4 rounded-xl border border-primary/40 bg-primary/5 p-4 text-left" data-testid="save-record-card">
      <SaveRecordBody
        state={state}
        failMessage={failMessage}
        preparing={preparing}
        onSave={handleSaveClick}
        onDismiss={() => setDismissed(true)}
      />
      <LoginDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isEmbeddedBrowser={isEmbeddedBrowser()}
        handlers={handlers}
        title="登入保存紀錄"
        description="用既有帳號登入或註冊新帳號，這次的紀錄都會保存下來"
        hideGuest
      />
    </div>
  );
}

function SaveRecordBody({
  state, failMessage, preparing, onSave, onDismiss,
}: {
  state: CardState;
  failMessage: string;
  preparing: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  if (state === "saved") {
    return (
      <p className="flex items-center gap-2 font-medium text-success" data-testid="save-record-done">
        <CheckCircle2 className="w-5 h-5" />
        紀錄已保存到你的帳號
      </p>
    );
  }
  if (state === "saving") {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        保存紀錄中...
      </p>
    );
  }
  if (state === "failed") {
    return <p className="text-sm text-destructive">這次紀錄沒有保存成功：{failMessage}</p>;
  }
  return (
    <>
      <p className="font-semibold flex items-center gap-2">
        <Save className="w-4 h-4 text-primary" />
        保存這次紀錄
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        登入後，成績、成就和相簿會存到你的帳號，換手機也看得到。
      </p>
      <div className="flex gap-2 mt-3">
        <Button className="flex-1 gap-2" onClick={onSave} disabled={preparing} data-testid="button-save-record">
          {preparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          登入保存紀錄
        </Button>
        <Button variant="ghost" onClick={onDismiss} data-testid="button-save-record-dismiss">
          先不用
        </Button>
      </div>
    </>
  );
}
