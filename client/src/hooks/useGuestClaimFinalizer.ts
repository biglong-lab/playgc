import { useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { finalizeGuestClaim, hasArmedGuestClaim } from "@/lib/guest-claim";

/**
 * 正式帳號登入後，自動完成訪客紀錄認領（2026-09-22 Phase 3）
 * - 每個帳號（uid）每次掛載最多自動試一次；失敗可在結算頁手動重試，下次進遊玩頁也會再試
 * - 多處同時呼叫會共用同一個請求（finalizeGuestClaim 單一執行中）
 * @returns 是否仍有「尚未嘗試 / 進行中」的認領（GuestGate 據此決定要不要先擋住頁面）
 */
export function useGuestClaimFinalizer(): boolean {
  const { firebaseUser } = useAuthContext();
  const [inProgress, setInProgress] = useState(false);
  const [attemptedUid, setAttemptedUid] = useState<string | null>(null);

  const uid = firebaseUser && !firebaseUser.isAnonymous ? firebaseUser.uid : null;
  // render 當下就判斷（不等 effect）：跳頁登入回來的第一個畫面就要擋，避免遊戲頁先幫新帳號開新局
  const mustFinalize = !!uid && attemptedUid !== uid && hasArmedGuestClaim();

  useEffect(() => {
    if (!mustFinalize || !uid) return;
    let cancelled = false;
    setInProgress(true);
    finalizeGuestClaim().finally(() => {
      if (cancelled) return;
      setInProgress(false);
      setAttemptedUid(uid);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, mustFinalize]);

  return mustFinalize || inProgress;
}
