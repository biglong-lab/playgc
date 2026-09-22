// 🎟️ 遊玩類路由的身分閘門（2026-09-22 玩家動線優化 Phase 1）
// 取代原本各頁的「需登入」牆：未登入就在背景建立訪客身分，玩家不用做任何事。
// 正式帳號登入改到遊戲結束時再引導（結算頁「保存這次紀錄」）。
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEnsurePlayer } from "@/hooks/useEnsurePlayer";

export function FullscreenSpinner({ label }: { label: string }) {
  return (
    <div className="min-h-screen-dynamic bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function GuestGate({ children }: { children: ReactNode }) {
  const { status, error, retry } = useEnsurePlayer();

  if (status === "ready") return <>{children}</>;

  if (status === "error") {
    return (
      <div className="min-h-screen-dynamic bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm space-y-4" data-testid="guest-gate-error">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">暫時無法進入遊戲</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={retry} className="w-full" data-testid="btn-guest-retry">
            重試
          </Button>
        </div>
      </div>
    );
  }

  return <FullscreenSpinner label="準備遊戲中..." />;
}

/** 路由用：把頁面元件包上 GuestGate */
export function withGuestGate<P extends object>(Component: ComponentType<P>) {
  const Gated = (props: P) => (
    <GuestGate>
      <Component {...props} />
    </GuestGate>
  );
  Gated.displayName = `WithGuestGate(${Component.displayName || Component.name || "Page"})`;
  return Gated;
}
