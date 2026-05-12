// 🍞 useToastDedup — 5s 內同訊息自動 dedup（Phase 3 / 2026-05-12）
//
// 設計：
//   - 包裝 useToast、回傳同樣 API 但加 dedup
//   - 同 title + description 5 秒內只發 1 次（避免 toast 飆出）
//   - 失敗、API 錯誤、ws 斷線等場景特別需要
//
// 用法：
//   const toast = useToastDedup();
//   toast({ title: "上傳失敗", description: "請檢查網路" });
//   // 5 秒內再呼叫同訊息 → 不發第 2 次

import { useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

type ToastInput = Parameters<ReturnType<typeof useToast>["toast"]>[0];

const DEDUP_WINDOW_MS = 5_000;

export function useToastDedup() {
  const { toast: rawToast, ...rest } = useToast();
  const lastShownRef = useRef<Map<string, number>>(new Map());

  const dedupedToast = useCallback(
    (opts: ToastInput): ReturnType<typeof rawToast> | null => {
      const key = `${opts.title ?? ""}::${opts.description ?? ""}::${opts.variant ?? ""}`;
      const now = Date.now();
      const lastShown = lastShownRef.current.get(key);
      if (lastShown && now - lastShown < DEDUP_WINDOW_MS) {
        // 重複、跳過
        return null;
      }
      lastShownRef.current.set(key, now);
      // 清過期 entries（防 map 無限增長）
      if (lastShownRef.current.size > 50) {
        lastShownRef.current.forEach((t, k) => {
          if (now - t > DEDUP_WINDOW_MS * 4) {
            lastShownRef.current.delete(k);
          }
        });
      }
      return rawToast(opts);
    },
    [rawToast],
  );

  return { ...rest, toast: dedupedToast };
}
