// 🎟️ 遊玩類路由的身分閘門（2026-09-22 玩家動線優化 Phase 1）
// 取代原本各頁的「需登入」牆：未登入就在背景建立訪客身分，玩家不用做任何事。
// 正式帳號登入改到遊戲結束時再引導（結算頁「保存這次紀錄」）。
import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import GuestGateError from "./GuestGateError";
import { useEnsurePlayer } from "@/hooks/useEnsurePlayer";
import { useGuestClaimFinalizer } from "@/hooks/useGuestClaimFinalizer";

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
  // 🎟️ Phase 3：訪客按「登入保存紀錄」後改用正式帳號 → 在這裡完成認領
  const claiming = useGuestClaimFinalizer();
  const childrenShownRef = useRef(false);
  const showChildren = status === "ready" && (!claiming || childrenShownRef.current);
  useEffect(() => {
    if (showChildren) childrenShownRef.current = true;
  }, [showChildren]);

  // 已在頁面上（例如結算頁 popup 登入）→ 不打斷；跳頁登入回來 → 先保存再進頁面
  if (showChildren) return <>{children}</>;
  if (status === "ready") return <FullscreenSpinner label="保存紀錄中..." />;

  if (status === "error") return <GuestGateError error={error} onRetry={retry} />;

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
