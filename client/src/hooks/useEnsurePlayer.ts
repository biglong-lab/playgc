import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { ensureGuestIdentity } from "@/lib/guest-identity";

export type EnsurePlayerStatus = "loading" | "ready" | "error";

/**
 * 遊玩類頁面進場時確保有玩家身分（未登入 → 背景建立訪客身分）
 * @returns status：loading（Firebase 還原中 / 建立訪客中）、ready、error（可 retry）
 */
export function useEnsurePlayer(): {
  status: EnsurePlayerStatus;
  error: string | null;
  retry: () => void;
} {
  const { firebaseUser, isLoading } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isLoading || firebaseUser) return;
    let cancelled = false;
    setError(null);
    ensureGuestIdentity().catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "無法建立訪客身分，請重試");
    });
    return () => {
      cancelled = true;
    };
  }, [isLoading, firebaseUser, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (firebaseUser) return { status: "ready", error: null, retry };
  if (error) return { status: "error", error, retry };
  return { status: "loading", error: null, retry };
}
