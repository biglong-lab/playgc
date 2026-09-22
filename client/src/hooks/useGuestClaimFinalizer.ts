import { useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { finalizeGuestClaim, hasArmedGuestClaim } from "@/lib/guest-claim";

/**
 * 正式帳號登入後，自動完成訪客紀錄認領（2026-09-22 Phase 3）
 * @returns 是否仍有待完成的認領（GuestGate 據此決定要不要先擋住頁面）
 */
export function useGuestClaimFinalizer(): boolean {
  const { firebaseUser } = useAuthContext();
  const { toast } = useToast();
  const [inProgress, setInProgress] = useState(false);

  const isRealUser = !!firebaseUser && !firebaseUser.isAnonymous;
  // render 當下就判斷（不等 effect）：跳頁登入回來的第一個畫面就要擋，避免遊戲頁先幫新帳號開新局
  const mustFinalize = isRealUser && hasArmedGuestClaim();

  useEffect(() => {
    if (!mustFinalize) return;
    let cancelled = false;
    setInProgress(true);
    finalizeGuestClaim().then((result) => {
      if (cancelled) return;
      setInProgress(false);
      toast(
        result.ok
          ? { title: "紀錄已保存到你的帳號" }
          : { title: "這次紀錄沒有保存成功", description: result.message, variant: "destructive" },
      );
    });
    return () => {
      cancelled = true;
    };
    // 只在帳號切換時觸發（uid 變了）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid, mustFinalize]);

  return mustFinalize || inProgress;
}
