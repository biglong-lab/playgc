// 🎟️ 全站訪客紀錄認領（2026-09-22，App 根層掛載）
// 登入回來的頁面不一定有 GuestGate（例如 LINE 回到 /f 場域列表）→ 在根層也觸發認領，
// 並統一在這裡顯示結果 toast（GuestGate 只負責擋畫面，不重複提示）。
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useGuestClaimFinalizer } from "@/hooks/useGuestClaimFinalizer";
import { GUEST_CLAIMED_EVENT, type ClaimResult } from "@/lib/guest-claim";

function toastOf(result: ClaimResult) {
  if (result.ok) return { title: "紀錄已保存到你的帳號" };
  if (result.retryable) {
    return { title: "紀錄暫時沒有保存成功", description: "稍後會自動再試，也可以在結算頁按「重試保存」" };
  }
  return { title: "這次紀錄沒有保存成功", description: result.message, variant: "destructive" as const };
}

export default function GuestClaimFinalizer() {
  useGuestClaimFinalizer();
  const { toast } = useToast();

  useEffect(() => {
    const onClaimed = (e: Event) => toast(toastOf((e as CustomEvent<ClaimResult>).detail));
    window.addEventListener(GUEST_CLAIMED_EVENT, onClaimed);
    return () => window.removeEventListener(GUEST_CLAIMED_EVENT, onClaimed);
  }, [toast]);

  return null;
}
