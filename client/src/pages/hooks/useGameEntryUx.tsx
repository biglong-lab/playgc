// 🧭 遊戲頁進場體驗（2026-09-22 玩家動線優化）
// - QR 進場標記 entry=qr：讀一次就從網址移除（避免重整結算頁又被自動開新局）
// - 接續進度提示：非阻擋 toast「已從第 N 關繼續〔重新開始〕」，取代整頁繼續框
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { QR_ENTRY_PARAM, QR_ENTRY_VALUE } from "@/lib/game-entry";
import type { ResumeNotice } from "./useSessionManager";

/** 是否由 QR 進場；網址上的標記在讀取後移除 */
export function useQrEntryFlag(searchString: string): boolean {
  const [, setLocation] = useLocation();
  const [isQrEntry] = useState(
    () => new URLSearchParams(searchString).get(QR_ENTRY_PARAM) === QR_ENTRY_VALUE,
  );

  useEffect(() => {
    if (!isQrEntry) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has(QR_ENTRY_PARAM)) return;
    params.delete(QR_ENTRY_PARAM);
    const qs = params.toString();
    setLocation(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [isQrEntry, setLocation]);

  return isQrEntry;
}

/** 接續進度 → 顯示可反悔提示（顯示後即清除 notice，避免重複彈出） */
export function useResumeNoticeToast(
  notice: ResumeNotice | null,
  clearNotice: () => void,
  onRestartRequest: () => void,
): void {
  const { toast } = useToast();

  useEffect(() => {
    if (!notice) return;
    toast({
      title: `已從第 ${notice.pageNumber} 關繼續`,
      duration: 6000,
      action: notice.canRestart ? (
        <ToastAction altText="重新開始" onClick={onRestartRequest} data-testid="toast-restart-game">
          重新開始
        </ToastAction>
      ) : undefined,
    });
    clearNotice();
  }, [notice, clearNotice, onRestartRequest, toast]);
}
