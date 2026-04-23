// 📊 前端日誌 / 錯誤收集 singleton
//
// 用法：
//   import { logError, logMilestone, logInfo } from "@/lib/clientLogger";
//
//   logError("camera", "start_failed", err, { gameId });
//   logMilestone("walkie", "group_created", { code });
//   logInfo("general", "page_view");
//
// 特性：
//   - 批次 flush（每 5s 或 20 筆觸發）
//   - beforeunload 最後 flush（用 sendBeacon，不阻塞離開）
//   - 失敗不重試（避免無窮請求）
//   - window.onerror + unhandledrejection 自動捕捉

export interface ClientEventPayload {
  eventType: "error" | "info" | "milestone";
  category: string;
  code?: string;
  message?: string;
  severity?: "critical" | "error" | "warning" | "info" | "debug";
  context?: Record<string, unknown>;
}

const queue: ClientEventPayload[] = [];
const MAX_BATCH = 20;
const FLUSH_DELAY_MS = 5000;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isShuttingDown = false; // beforeunload 後 skip normal flush

function doSendBeacon(batch: ClientEventPayload[]): boolean {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) return false;
  try {
    const blob = new Blob([JSON.stringify({ events: batch })], {
      type: "application/json",
    });
    return navigator.sendBeacon("/api/client-logs", blob);
  } catch {
    return false;
  }
}

async function doFetch(batch: ClientEventPayload[]): Promise<void> {
  try {
    await fetch("/api/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      credentials: "include",
      keepalive: true,
    });
  } catch {
    // 網路失敗就放棄 — 避免日誌失敗又觸發更多日誌導致雪崩
  }
}

function flush(useBeacon = false) {
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  // beforeunload 時必須用 sendBeacon（保證瀏覽器關閉時還能送）
  if (useBeacon && doSendBeacon(batch)) return;
  void doFetch(batch);

  // 若佇列還有剩（超過 MAX_BATCH）→ 再排一次
  if (queue.length > 0) scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (!isShuttingDown) flush(false);
  }, FLUSH_DELAY_MS);
}

/** 核心：推 event 進 queue */
function enqueue(ev: ClientEventPayload) {
  // 截斷過長訊息，避免單筆 payload 爆表
  if (ev.message && ev.message.length > 2000) {
    ev.message = ev.message.substring(0, 2000) + "...[truncated]";
  }
  queue.push(ev);
  if (queue.length >= MAX_BATCH) {
    flush(false);
  } else {
    scheduleFlush();
  }
}

/** 記錄錯誤（最常用）*/
export function logError(
  category: string,
  code: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  const message = error instanceof Error ? error.message : String(error);
  enqueue({
    eventType: "error",
    category,
    code,
    message,
    severity: "error",
    context: {
      ...context,
      errorName: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error
        ? error.stack?.substring(0, 1500)
        : undefined,
    },
  });
}

/** 記錄里程碑（追蹤使用漏斗）*/
export function logMilestone(
  category: string,
  code: string,
  context?: Record<string, unknown>,
) {
  enqueue({
    eventType: "milestone",
    category,
    code,
    severity: "info",
    context,
  });
}

/** 記錄一般資訊 */
export function logInfo(
  category: string,
  code: string,
  message?: string,
  context?: Record<string, unknown>,
) {
  enqueue({
    eventType: "info",
    category,
    code,
    message,
    severity: "info",
    context,
  });
}

/** 警告等級（非 fatal，值得看）*/
export function logWarning(
  category: string,
  code: string,
  message: string,
  context?: Record<string, unknown>,
) {
  enqueue({
    eventType: "error",
    category,
    code,
    message,
    severity: "warning",
    context,
  });
}

/** 手動 flush（通常不用呼叫）*/
export function flushNow(): void {
  flush(false);
}

// 🛡 全域錯誤攔截（window.onerror + unhandledrejection）
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    // 忽略 ResizeObserver loop, script error 等 noise
    const msg = e.message || "";
    if (msg.includes("ResizeObserver") || msg === "Script error.") return;
    enqueue({
      eventType: "error",
      category: "uncaught",
      code: "window_error",
      message: msg,
      severity: "error",
      context: {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const message =
      reason instanceof Error ? reason.message : String(reason || "");
    // 忽略 AbortError（iOS Safari 常見，無意義）
    if (reason instanceof Error && reason.name === "AbortError") return;
    enqueue({
      eventType: "error",
      category: "uncaught",
      code: "unhandled_rejection",
      message,
      severity: "error",
      context: {
        errorName: reason instanceof Error ? reason.name : undefined,
        stack:
          reason instanceof Error ? reason.stack?.substring(0, 1500) : undefined,
      },
    });
  });

  // 頁面關閉前 flush（sendBeacon 確保送達）
  window.addEventListener("beforeunload", () => {
    isShuttingDown = true;
    flush(true);
  });

  // 頁面切到背景時也 flush 一次（行動端常見）
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && queue.length > 0) {
      flush(true);
    }
  });
}
