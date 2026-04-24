// 🔍 Google Cloud Vision API 封裝 — OCR 招牌任務
//
// 免費額度：每月 1000 次 DOCUMENT_TEXT_DETECTION
// 監控策略：
//   - 80% 用量 → 寄送 email 警告
//   - 95% 用量 → 自動 fallback（關閉功能或改用 Gemini vision）
//
// 認證：GOOGLE_APPLICATION_CREDENTIALS 環境變數指向 Service Account JSON
// 呼叫：detectText(imageUrl) — 傳入公開 Cloudinary URL，不傳個資
//
// 合規：僅做 OCR 文字擷取，不做人臉辨識、不存圖片內容
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { db } from "../db";
import { aiUsageLogs } from "@shared/schema";
import { sendEmail } from "../services/email";

// ============================================================================
// 初始化
// ============================================================================

let visionClient: ImageAnnotatorClient | null = null;

/** 取得全域客戶端（使用 GOOGLE_APPLICATION_CREDENTIALS 環境變數） */
function getClient(): ImageAnnotatorClient {
  if (!visionClient) {
    // ImageAnnotatorClient 會自動讀取 GOOGLE_APPLICATION_CREDENTIALS
    // 或用 GCP 預設 credentials（若執行在 GCP 上）
    visionClient = new ImageAnnotatorClient();
  }
  return visionClient;
}

/** 檢查 Google Vision API 是否已設定 */
export function isGoogleVisionConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      process.env.GCP_PROJECT_ID
  );
}

// ============================================================================
// OCR 文字偵測
// ============================================================================

export interface OcrDetectResult {
  /** 是否成功 */
  success: boolean;
  /** 辨識出的完整文字 */
  fullText: string;
  /** 每段文字（含位置） */
  textSegments: Array<{
    text: string;
    confidence?: number;
  }>;
  /** API 回應時間（ms） */
  latencyMs: number;
  /** 錯誤訊息（如失敗） */
  errorCode?: string;
  errorMessage?: string;
}

/**
 * 偵測圖片中的文字（OCR）
 *
 * 使用 TEXT_DETECTION（適合招牌、短文字），而非 DOCUMENT_TEXT_DETECTION（適合長文件）
 * 免費額度都是每月 1000 次
 *
 * @param imageUrl 公開的圖片 URL（例如 Cloudinary URL）
 * @returns OCR 結果 + latency
 */
export async function detectText(imageUrl: string): Promise<OcrDetectResult> {
  const startTime = Date.now();

  if (!isGoogleVisionConfigured()) {
    return {
      success: false,
      fullText: "",
      textSegments: [],
      latencyMs: 0,
      errorCode: "NOT_CONFIGURED",
      errorMessage: "Google Vision API 未設定（缺 GOOGLE_APPLICATION_CREDENTIALS）",
    };
  }

  try {
    const client = getClient();

    // 呼叫 Vision API — 只傳 URL，不傳圖片內容
    const [result] = await client.textDetection(imageUrl);
    const detections = result.textAnnotations || [];

    const latencyMs = Date.now() - startTime;

    if (detections.length === 0) {
      return {
        success: true,
        fullText: "",
        textSegments: [],
        latencyMs,
      };
    }

    // detections[0] = 完整文字，detections[1+] = 各個文字區塊
    const fullText = detections[0]?.description || "";
    const textSegments = detections.slice(1).map((d) => ({
      text: d.description || "",
      confidence: d.confidence || undefined,
    }));

    return {
      success: true,
      fullText,
      textSegments,
      latencyMs,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    const errorCode = error?.code === 8 ? "QUOTA_EXCEEDED" : error?.code === 7 ? "PERMISSION_DENIED" : "API_ERROR";
    return {
      success: false,
      fullText: "",
      textSegments: [],
      latencyMs,
      errorCode,
      errorMessage: error?.message || "未知錯誤",
    };
  }
}

// ============================================================================
// 用量記錄
// ============================================================================

export interface LogOcrUsageParams {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  latencyMs: number;
  gameId?: string;
  fieldId?: string;
  userId?: string;
  context?: Record<string, any>;
}

/** 記錄一次 Google Vision OCR 呼叫（寫入 ai_usage_logs） */
export async function logOcrUsage(params: LogOcrUsageParams): Promise<void> {
  try {
    await db.insert(aiUsageLogs).values({
      provider: "google-vision",
      endpoint: "ocr-detect",
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
    console.error("[google-vision] 用量記錄失敗:", error);
  }
}

// ============================================================================
// 用量查詢（月度統計）
// ============================================================================

export interface MonthlyUsageStats {
  provider: string;
  currentMonthCount: number;
  successCount: number;
  failCount: number;
  freeQuota: number;
  usagePercent: number;
  shouldAlert: boolean; // 80% 觸發 email alert
  shouldFallback: boolean; // 95% 觸發 fallback
}

/** 取得當月 Google Vision 用量 */
export async function getMonthlyOcrUsage(): Promise<MonthlyUsageStats> {
  const { sql } = await import("drizzle-orm");

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const results = await db
      .select({
        total: sql<number>`count(*)::int`,
        success: sql<number>`count(*) filter (where ${aiUsageLogs.success} = true)::int`,
        fail: sql<number>`count(*) filter (where ${aiUsageLogs.success} = false)::int`,
      })
      .from(aiUsageLogs)
      .where(
        sql`${aiUsageLogs.provider} = 'google-vision' and ${aiUsageLogs.createdAt} >= ${firstDayOfMonth}`
      );

    const row = results[0] || { total: 0, success: 0, fail: 0 };
    const FREE_QUOTA = 1000;
    const usagePercent = Math.round((row.total / FREE_QUOTA) * 100);

    return {
      provider: "google-vision",
      currentMonthCount: row.total,
      successCount: row.success,
      failCount: row.fail,
      freeQuota: FREE_QUOTA,
      usagePercent,
      shouldAlert: usagePercent >= 80,
      shouldFallback: usagePercent >= 95,
    };
  } catch (error) {
    console.error("[google-vision] 用量查詢失敗:", error);
    return {
      provider: "google-vision",
      currentMonthCount: 0,
      successCount: 0,
      failCount: 0,
      freeQuota: 1000,
      usagePercent: 0,
      shouldAlert: false,
      shouldFallback: false,
    };
  }
}
