// 💾 結算頁「保存這次紀錄」卡（2026-09-22 玩家動線優化 Phase 3）
//
// 業主需求：「遊戲結束，有需要紀錄，再引導使用者註冊，建立身份或者登入既有的身份」
// - 只給訪客看；不強迫（可按「先不用」收起）
// - 登入方式沿用 LoginDialog（LINE / Google / Apple / Email），隱藏「訪客」按鈕
// - 登入後由 GuestGate / 根層 GuestClaimFinalizer 自動認領，這張卡顯示結果
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLoginHandlers } from "@/hooks/useLoginHandlers";
import { LoginDialog } from "@/components/landing/LoginDialog";
import { isEmbeddedBrowser } from "@/components/landing/EmbeddedBrowserWarning";
import {
  GUEST_CLAIMED_EVENT,
  armGuestClaim,
  disarmGuestClaim,
  finalizeGuestClaim,
  prefetchGuestClaimTicket,
  type ClaimResult,
} from "@/lib/guest-claim";

type CardState = "idle" | "saving" | "saved" | "failed";

interface SaveRecordState {
  wasGuest: boolean;
  state: CardState;
  failure: { message: string; retryable: boolean } | null;
  retry: () => void;
}

/** 卡片狀態：掛載時是訪客才啟用；登入後轉「保存中」；收到認領結果轉成功 / 失敗 */
function useSaveRecordState(): SaveRecordState {
  const { firebaseUser } = useAuth();
  const [wasGuest] = useState(() => !!firebaseUser?.isAnonymous);
  const [state, setState] = useState<CardState>("idle");
  const [failure, setFailure] = useState<SaveRecordState["failure"]>(null);

  // 先拿好認領憑證 → 按登入時可同步開 Google popup（不被瀏覽器擋）
  useEffect(() => {
    if (wasGuest) void prefetchGuestClaimTicket();
  }, [wasGuest]);

  const isRealUser = !!firebaseUser && !firebaseUser.isAnonymous;
  useEffect(() => {
    if (wasGuest && isRealUser) setState((s) => (s === "idle" ? "saving" : s));
  }, [wasGuest, isRealUser]);

  const onResult = useCallback((result: ClaimResult) => {
    setState(result.ok ? "saved" : "failed");
    setFailure(result.ok ? null : { message: result.message, retryable: result.retryable });
  }, []);
  useEffect(() => {
    const handler = (e: Event) => onResult((e as CustomEvent<ClaimResult>).detail);
    window.addEventListener(GUEST_CLAIMED_EVENT, handler);
    return () => window.removeEventListener(GUEST_CLAIMED_EVENT, handler);
  }, [onResult]);

  const retry = useCallback(() => {
    setState("saving");
    void finalizeGuestClaim();
  }, []);

  return { wasGuest, state, failure, retry };
}

/** 🆕 2026-09-22 身份規則：訪客的成績 / 成就 / 獎勵要登入後才歸屬 → 文案說清楚 */
function saveHint(scoringEnabled: boolean): string {
  return scoringEnabled
    ? "登入後成績才會登上排行榜，成就、獎勵和相簿也會保存到你的帳號。"
    : "登入後，成就、獎勵和相簿會保存到你的帳號，換手機也看得到。";
}

export default function SaveRecordCard({ scoringEnabled = true }: { scoringEnabled?: boolean }) {
  const { toast } = useToast();
  const { wasGuest, state, failure, retry } = useSaveRecordState();
  const [dismissed, setDismissed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const handlers = useLoginHandlers(() => setDialogOpen(false), { redirectTo: null });

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
        failure={failure}
        preparing={preparing}
        onSave={handleSaveClick}
        onRetry={retry}
        onDismiss={() => setDismissed(true)}
        hint={saveHint(scoringEnabled)}
      />
      <LoginDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          // 玩家自己關掉登入框（沒登入）→ 解除保存標記；登入成功走 onSuccess 關閉、不經過這裡
          if (!open) disarmGuestClaim();
        }}
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
  state, failure, preparing, onSave, onRetry, onDismiss, hint,
}: {
  hint: string;
  state: CardState;
  failure: SaveRecordState["failure"];
  preparing: boolean;
  onSave: () => void;
  onRetry: () => void;
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
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">這次紀錄沒有保存成功：{failure?.message}</p>
        {failure?.retryable && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onRetry} data-testid="button-save-record-retry">
            <RotateCcw className="w-4 h-4" />
            重試保存
          </Button>
        )}
      </div>
    );
  }
  return (
    <>
      <p className="font-semibold flex items-center gap-2">
        <Save className="w-4 h-4 text-primary" />
        保存這次紀錄
      </p>
      <p className="text-sm text-muted-foreground mt-1">{hint}</p>
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
