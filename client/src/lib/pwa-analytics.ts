// 📊 PWA 使用情境統計
//
// 解決問題：使用者要求「後台統計，交叉分析使用情境，作為未來優化參考」
//
// 設計依據：docs/PWA_USER_FLOW_OPTIMIZATION_V2.md Phase D
//
// 用途：
//   - 知道 PWA 真實使用率（standalone vs browser）
//   - 哪場域 PWA 比例高
//   - QR 掃描來源（PWA 內掃 vs 瀏覽器）
//   - 留存率 / 互動深度（後台聚合查詢）
//
// 上報機制：寫入既有 client_events 表（不另建表，避免 schema 膨脹）
//   POST /api/client-logs 批次端點
//   非阻塞、失敗不影響使用者操作

export type PwaMode = "standalone" | "browser" | "twa";
export type QrScanSource = "in_pwa_scan" | "browser_camera" | "manual_input";

/** 偵測 PWA 啟動模式（client-side） */
export function detectPwaMode(): PwaMode {
  if (typeof window === "undefined") return "browser";
  // iOS Safari standalone
  if ((navigator as { standalone?: boolean }).standalone === true) {
    return "standalone";
  }
  // Android / desktop PWA
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return "standalone";
  }
  // Trusted Web Activity (Android)
  if (
    typeof document !== "undefined" &&
    document.referrer.startsWith("android-app://")
  ) {
    return "twa";
  }
  return "browser";
}

interface ClientEventPayload {
  eventType: "info" | "milestone" | "error";
  category: string;
  code: string;
  message?: string;
  severity?: "critical" | "error" | "warning" | "info" | "debug";
  context?: Record<string, unknown>;
  url?: string;
}

/** 非阻塞上報事件（失敗 silent） */
async function postEvent(payload: ClientEventPayload): Promise<void> {
  try {
    await fetch("/api/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        events: [
          {
            ...payload,
            url: payload.url || window.location.href,
            severity: payload.severity || "info",
          },
        ],
      }),
    });
  } catch {
    /* 統計失敗不影響使用者 */
  }
}

/**
 * App 啟動時 log（main.tsx 一進來就呼叫一次）
 * 區分 standalone / browser / twa + ?launch=pwa flag
 */
export function logAppLaunch(): void {
  if (typeof window === "undefined") return;

  const mode = detectPwaMode();
  const params = new URLSearchParams(window.location.search);
  const isPwaLaunch = params.get("launch") === "pwa";

  void postEvent({
    eventType: "info",
    category: "pwa",
    code: `app_launch_${mode}`,
    message: `App launched in ${mode} mode`,
    context: {
      mode,
      isPwaLaunchParam: isPwaLaunch,
      pathname: window.location.pathname,
      isMobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent),
      // 短截 userAgent 避免肥胖
      userAgent: navigator.userAgent.slice(0, 200),
      referrer: document.referrer ? document.referrer.slice(0, 200) : null,
    },
  });
}

/**
 * QR 掃描成功時 log（區分掃描來源）
 *
 * @param source in_pwa_scan = PWA 內掃 / browser_camera = 瀏覽器掃 / manual_input = 手動輸入
 */
export function logQrScan(opts: {
  source: QrScanSource;
  scannedRaw?: string;
  inferredFieldCode?: string;
  inferredGameId?: string;
  resultType?: "same-site-path" | "external-url" | "text" | "unknown";
}): void {
  const mode = detectPwaMode();
  void postEvent({
    eventType: "milestone",
    category: "qr",
    code: `qr_scan_${opts.source}`,
    message: `QR scanned via ${opts.source}`,
    context: {
      source: opts.source,
      pwaMode: mode,
      resultType: opts.resultType,
      inferredFieldCode: opts.inferredFieldCode,
      inferredGameId: opts.inferredGameId,
      // 不存完整 raw URL（隱私 + 大小考量），只存前 100 字元
      scannedRawSnippet: opts.scannedRaw?.slice(0, 100),
    },
  });
}
