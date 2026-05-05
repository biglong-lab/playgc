// 📡 event-report — 主動上報「非錯誤但重要」事件（與 useErrorReport 相同 endpoint）
//
// 用途：
//   - WS 多次重連失敗 → 系統知道網路不穩
//   - Cloudinary 合成 timeout → 系統知道哪些活動有上傳問題
//   - 玩家答題 race conflict → 系統知道有 bug 嫌疑
//   - 任何業務層面想記錄的 client 事件
//
// 設計：
//   - 共用 /api/error-log（有 rate limit + fingerprint dedup）
//   - source 用 "client_event:xxx" 區分業務事件 vs uncaught error
//   - keepalive flag 確保 unload 前也送
//   - fail-silent（上報失敗不能再觸發 error）

const inflightSignatures = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000;

interface ReportEventArgs {
  /** 事件名 — 用來分類（如 "ws_reconnect_failed", "cloudinary_timeout"） */
  event: string;
  /** 詳細描述（人類可讀）*/
  message: string;
  /** 額外 context（自由 key-value）*/
  context?: Record<string, unknown>;
}

export function reportClientEvent(args: ReportEventArgs): void {
  const now = Date.now();
  const signature = `${args.event}::${args.message}`;
  const lastSeen = inflightSignatures.get(signature);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) return;
  inflightSignatures.set(signature, now);

  // 清理過期 signatures
  inflightSignatures.forEach((v, k) => {
    if (now - v > DEDUP_WINDOW_MS * 5) inflightSignatures.delete(k);
  });

  const payload = {
    message: args.message.slice(0, 2000),
    source: `client_event:${args.event}`.slice(0, 100),
    url: typeof window !== "undefined" ? window.location.href.slice(0, 500) : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : "",
    timestamp: new Date().toISOString(),
    stack: args.context ? JSON.stringify(args.context).slice(0, 10_000) : undefined,
  };

  try {
    fetch("/api/error-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* fail-silent */
    });
  } catch {
    /* fail-silent */
  }
}
