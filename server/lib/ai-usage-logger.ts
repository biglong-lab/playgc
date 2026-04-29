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
