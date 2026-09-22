// ⚠️ 無法建立訪客身分時的畫面（2026-09-22 審查 MEDIUM）
// 大型活動同一網路大量訪客可能撞到 Firebase 匿名註冊配額 → 除了重試，也給「改用帳號登入」的出路。
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoginDialog } from "@/components/landing/LoginDialog";
import { isEmbeddedBrowser } from "@/components/landing/EmbeddedBrowserWarning";
import { useLoginHandlers } from "@/hooks/useLoginHandlers";

export default function GuestGateError({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const [loginOpen, setLoginOpen] = useState(false);
  // 登入成功後留在原頁：GuestGate 偵測到身分就會直接進入
  const handlers = useLoginHandlers(() => setLoginOpen(false), { redirectTo: null });

  return (
    <div className="min-h-screen-dynamic bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-4" data-testid="guest-gate-error">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">暫時無法進入遊戲</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex flex-col gap-2">
          <Button onClick={onRetry} className="w-full" data-testid="btn-guest-retry">
            重試
          </Button>
          <Button variant="outline" onClick={() => setLoginOpen(true)} className="w-full" data-testid="btn-guest-login-instead">
            改用帳號登入
          </Button>
        </div>
      </div>
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        isEmbeddedBrowser={isEmbeddedBrowser()}
        handlers={handlers}
        hideGuest
      />
    </div>
  );
}
