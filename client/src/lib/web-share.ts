// 🔗 web-share — 統一分享 API
//
// 用法：
//   await share({ title: "遊戲邀請", text: "一起來玩賈村探險", url: window.location.href })
//
// 三層 fallback：
//   1. navigator.share() — iOS / Android 原生分享 sheet
//   2. navigator.clipboard.writeText() — 複製連結到剪貼簿
//   3. 失敗 → 回傳 false、呼叫端可改顯示 QR 或 toast

import { reportClientEvent } from "./event-report";

export interface ShareOptions {
  title: string;
  text?: string;
  url?: string;
  /** 不支援 / 失敗時是否複製到剪貼簿（預設 true） */
  fallbackToClipboard?: boolean;
}

export interface ShareResult {
  ok: boolean;
  method: "native" | "clipboard" | "failed";
  error?: string;
}

export function canShare(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof navigator.share === "function";
}

export function canCopy(): boolean {
  if (typeof navigator === "undefined") return false;
  return !!navigator.clipboard?.writeText;
}

export async function share(opts: ShareOptions): Promise<ShareResult> {
  const url = opts.url ?? (typeof window !== "undefined" ? window.location.href : "");
  const fallback = opts.fallbackToClipboard ?? true;

  if (canShare()) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url });
      reportClientEvent({
        event: "web_share_invoked",
        message: "native share completed",
        context: { method: "native", title: opts.title },
      });
      return { ok: true, method: "native" };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      // 使用者取消（AbortError）不算失敗、不 fallback
      if (error.includes("Abort") || error.includes("cancel")) {
        return { ok: false, method: "native", error: "user-cancelled" };
      }
      // 其他錯誤往下走 clipboard fallback
    }
  }

  if (fallback && canCopy()) {
    try {
      await navigator.clipboard.writeText(`${opts.title}\n${opts.text ?? ""}\n${url}`.trim());
      reportClientEvent({
        event: "web_share_invoked",
        message: "fallback to clipboard",
        context: { method: "clipboard", title: opts.title },
      });
      return { ok: true, method: "clipboard" };
    } catch (err) {
      return { ok: false, method: "failed", error: err instanceof Error ? err.message : String(err) };
    }
  }

  return { ok: false, method: "failed", error: "no available method" };
}
