// 📐 Web Vitals 上報（Phase 4 / 2026-05-10）
//
// 用途：
//   - 收 Google Core Web Vitals：LCP / FID / CLS / INP / TTFB
//   - 慢頁自動標記（LCP > 2.5s / INP > 200ms / CLS > 0.1）
//   - 透過既有 reportClientEvent 上報（共用 /api/error-log + dedup + keepalive）
//
// 觸發：
//   - 頁面 load + visibilitychange hidden 時 onCLS / onLCP / onINP 發送
//   - main.tsx 入口呼叫 initWebVitals() 一次
//
// 隱私：
//   - 純 metric value、無玩家識別資訊
//   - 透過既有 redact 規範 reportClientEvent 處理

import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from "web-vitals";
import { reportClientEvent } from "./event-report";

// ── 警戒閾值（Google 建議標準）─────────────────
const THRESHOLDS = {
  LCP: 2500, // 2.5s — Largest Contentful Paint
  INP: 200,  // 200ms — Interaction to Next Paint
  CLS: 0.1,  // 0.1 — Cumulative Layout Shift
  FCP: 1800, // 1.8s — First Contentful Paint
  TTFB: 800, // 800ms — Time To First Byte
} as const;

function rating(name: keyof typeof THRESHOLDS, value: number): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name];
  if (value <= threshold) return "good";
  if (value <= threshold * 2) return "needs-improvement";
  return "poor";
}

function reportMetric(metric: Metric): void {
  const name = metric.name as keyof typeof THRESHOLDS;
  const value = metric.value;
  const rt = rating(name, value);

  // 只上報「needs-improvement」+「poor」（節省流量）
  if (rt === "good") return;

  reportClientEvent({
    event: `web_vital_${name.toLowerCase()}_${rt}`,
    message: `${name}=${Math.round(value)} (${rt})`,
    context: {
      metric: name,
      value: Math.round(value),
      rating: rt,
      navigationType: metric.navigationType,
      route: window.location.pathname,
      // device hints（無個資）
      effectiveType:
        (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
  });
}

let initialized = false;

/**
 * 啟動 Web Vitals 收集
 * - main.tsx 入口呼叫一次
 * - 重複呼叫 no-op（idempotent）
 */
export function initWebVitals(): void {
  if (initialized) return;
  initialized = true;

  try {
    onCLS(reportMetric);
    onINP(reportMetric);
    onLCP(reportMetric);
    onFCP(reportMetric);
    onTTFB(reportMetric);
  } catch {
    // 失敗不阻塞啟動
  }
}
