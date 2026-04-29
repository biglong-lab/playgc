// 📊 AI 用量通用日誌記錄器
//
// 涵蓋所有 AI provider：
//   - gemini (Google Gemini API)
//   - openrouter (OpenRouter aggregator)
//   - google-vision (OCR — 已有 logOcrUsage，這裡也支援)
//   - mediapipe (臉部追蹤，client side 為主，server 不寫)
//
// 為何需要：
//   原本 ai-scoring.ts 的 3 個 Gemini 端點（verify-photo / compare-photos / score-text）
//   完全沒寫入 ai_usage_logs → 「AI 使用紀錄都是 0」的根本原因
//
import { db } from "../db";
import { aiUsageLogs } from "@shared/schema";
import type { AiProvider } from "@shared/schema";

/**
 * 🛡️ 通用 timeout wrapper — 把任何 AI 呼叫包上 timeout
 * 預設 50 秒（nginx 上游 timeout 60 秒，留 10 秒緩衝給 logger 寫入）
 *
 * 用法：
 *   const result = await withAiTimeout(
 *     () => verifyPhoto(imageUrl, keywords),
 *     { endpoint: "verify-photo", timeoutMs: 50000 }
 *   );
 */
export async function withAiTimeout<T>(
  fn: () => Promise<T>,
  options?: { endpoint?: string; timeoutMs?: number },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 50_000;
  const endpoint = options?.endpoint ?? "ai";

  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        reject(
          new Error(
            `AI_TIMEOUT: ${endpoint} 處理超時（${timeoutMs / 1000} 秒），請稍候再試`,
          ),
        );
      }, timeoutMs),
    ),
  ]);
}

export interface LogAiUsageParams {
  provider: AiProvider;
  /** 端點識別：verify-photo / compare-photos / score-text / ocr-detect 等 */
  endpoint: string;
  success: boolean;
  /** 失敗時的錯誤代碼（QUOTA_EXCEEDED / API_KEY_INVALID 等）*/
  errorCode?: string;
  errorMessage?: string;
  /** API 回應時間（毫秒）*/
  latencyMs?: number;
  gameId?: string;
  fieldId?: string;
  userId?: string;
  /** 額外結構化 metadata（不存敏感資訊）*/
  context?: Record<string, unknown>;
}

/**
 * 記錄一次 AI 呼叫到 ai_usage_logs
 * 失敗不阻斷主流程（用 try/catch 吞掉錯誤）
 */
export async function logAiUsage(params: LogAiUsageParams): Promise<void> {
  try {
    await db.insert(aiUsageLogs).values({
      provider: params.provider,
      endpoint: params.endpoint,
      success: params.success,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      latencyMs: params.latencyMs,
      gameId: params.gameId,
      fieldId: params.fieldId,
      userId: params.userId,
      context: params.context,
    });
  } catch (error) {
    // 日誌失敗不該阻斷主流程，只記錄到 console
    console.error("[ai-usage-logger] 寫入失敗:", error);
  }
}

// ============================================================================
// 📊 跨 Provider 用量統計（給管理端 Dashboard 用）
// ============================================================================

export interface ProviderUsageStats {
  provider: AiProvider;
  total: number;
  success: number;
  fail: number;
  avgLatencyMs: number | null;
  /** 各端點分布 */
  endpoints: Record<string, { total: number; success: number; fail: number }>;
}

export interface AiUsageOverview {
  /** 統計時間範圍：當月 1 號到現在 */
  fromDate: string;
  /** 各 provider 統計 */
  providers: ProviderUsageStats[];
  /** 場域聚合（可選 fieldId 過濾）*/
  fieldId?: string;
}

/**
 * 取得當月跨 provider AI 用量統計
 * @param fieldId 可選 — 只統計特定場域
 */
export async function getMonthlyAiUsage(fieldId?: string): Promise<AiUsageOverview> {
  const { sql } = await import("drizzle-orm");
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const fieldFilter = fieldId
      ? sql`AND field_id = ${fieldId}`
      : sql``;

    // 一次撈出所有 provider × endpoint 的 grouped stats
    const rows = await db.execute(sql`
      SELECT
        provider,
        endpoint,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE success = true)::int AS success,
        COUNT(*) FILTER (WHERE success = false)::int AS fail,
        ROUND(AVG(latency_ms))::int AS avg_latency
      FROM ai_usage_logs
      WHERE created_at >= ${firstDayOfMonth}
      ${fieldFilter}
      GROUP BY provider, endpoint
      ORDER BY provider, endpoint
    `);

    // Aggregate by provider
    const byProvider = new Map<string, ProviderUsageStats>();
    let totalLatencyAcrossEndpoints = new Map<string, { sum: number; count: number }>();

    for (const r of rows.rows as any[]) {
      const provider = r.provider as AiProvider;
      const endpoint = r.endpoint as string;
      const total = Number(r.total) || 0;
      const success = Number(r.success) || 0;
      const fail = Number(r.fail) || 0;
      const avgLatency = r.avg_latency != null ? Number(r.avg_latency) : null;

      if (!byProvider.has(provider)) {
        byProvider.set(provider, {
          provider,
          total: 0,
          success: 0,
          fail: 0,
          avgLatencyMs: null,
          endpoints: {},
        });
        totalLatencyAcrossEndpoints.set(provider, { sum: 0, count: 0 });
      }
      const ps = byProvider.get(provider)!;
      ps.total += total;
      ps.success += success;
      ps.fail += fail;
      ps.endpoints[endpoint] = { total, success, fail };

      if (avgLatency != null && total > 0) {
        const acc = totalLatencyAcrossEndpoints.get(provider)!;
        acc.sum += avgLatency * total;
        acc.count += total;
      }
    }

    // 計算 weighted avg latency
    totalLatencyAcrossEndpoints.forEach((acc, provider) => {
      const ps = byProvider.get(provider);
      if (ps && acc.count > 0) {
        ps.avgLatencyMs = Math.round(acc.sum / acc.count);
      }
    });

    return {
      fromDate: firstDayOfMonth.toISOString(),
      providers: Array.from(byProvider.values()),
      fieldId,
    };
  } catch (error) {
    console.error("[ai-usage-logger] getMonthlyAiUsage 查詢失敗:", error);
    return {
      fromDate: firstDayOfMonth.toISOString(),
      providers: [],
      fieldId,
    };
  }
}
