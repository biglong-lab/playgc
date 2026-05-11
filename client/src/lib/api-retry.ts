// 🔁 apiRequestWithRetry — fetch 自動重試（Phase 2 / 2026-05-12）
//
// 設計：
//   - 5xx 自動 retry（最多 3 次、exp backoff + jitter）
//   - 4xx 不 retry（業務錯誤不該重試）
//   - network error / abort 視為 retry-able
//   - 用法：apiRequestWithRetry("POST", "/api/foo", body, { retries: 3 })
//
// 配合 reportClientEvent 上報 retry 統計給 observability

import { apiRequest } from "@/lib/queryClient";
import { reportClientEvent } from "@/lib/event-report";

export interface RetryOptions {
  /** 重試次數（預設 3）*/
  retries?: number;
  /** base backoff ms（預設 500）*/
  baseDelayMs?: number;
  /** 最大 backoff ms（預設 5000）*/
  maxDelayMs?: number;
  /** 元件類型（給 telemetry 用、選填）*/
  componentType?: string;
  /** 上報 retry callback（給 Phase 1 telemetry hook 用）*/
  onRetry?: (attempt: number, error: unknown) => void;
}

function isRetryableError(err: unknown, status?: number): boolean {
  // HTTP 5xx 可重試
  if (status !== undefined && status >= 500 && status < 600) return true;
  // network error / abort
  if (err instanceof TypeError) return true;
  // 其他不 retry
  return false;
}

function computeBackoff(attempt: number, baseMs: number, maxMs: number): number {
  const ms = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  const jitter = ms * 0.2 * (Math.random() * 2 - 1);
  return Math.max(100, Math.floor(ms + jitter));
}

/**
 * 包裝 apiRequest 加自動 retry
 * 用法跟 apiRequest 相同、第 4 個參數加 RetryOptions
 */
export async function apiRequestWithRetry(
  method: string,
  url: string,
  body?: unknown,
  opts: RetryOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    componentType,
    onRetry,
  } = opts;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await apiRequest(method, url, body);
      // 5xx 視為 retry
      if (res.status >= 500 && res.status < 600 && attempt < retries) {
        lastError = new Error(`HTTP ${res.status}`);
        const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
        onRetry?.(attempt + 1, lastError);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      // 4xx / 2xx / 3xx 直接回
      return res;
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt >= retries) {
        // 不可重試 / 已達上限
        throw err;
      }
      const delay = computeBackoff(attempt, baseDelayMs, maxDelayMs);
      onRetry?.(attempt + 1, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // 理論上不會走到（迴圈內 return / throw）
  try {
    reportClientEvent({
      event: "api_retry_exhausted",
      message: `${method} ${url} 重試 ${retries} 次後仍失敗`,
      context: {
        method,
        url: url.slice(0, 200),
        retries,
        componentType,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      },
    });
  } catch {
    /* ignore */
  }
  throw lastError ?? new Error("api retry exhausted");
}
