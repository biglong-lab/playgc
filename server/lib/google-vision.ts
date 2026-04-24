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

/** 記錄一次 Google Vision OCR 呼叫（寫入 ai_usage_logs）+ 檢查是否要發警告 */
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

    // 記錄後檢查是否跨過 80% → 發警告 email（只發一次／月）
    await maybeSendUsageAlert();
  } catch (error) {
    // 日誌失敗不該阻斷主流程，只記錄到 console
    console.error("[google-vision] 用量記錄失敗:", error);
  }
}

/**
 * 檢查當月用量是否達 80% → 若尚未寄警告 email 則寄（每月僅寄 1 次）
 * 透過 ai_usage_logs 的 endpoint='usage-alert-80pct' 當作「已寄過」標記
 */
async function maybeSendUsageAlert(): Promise<void> {
  try {
    const usage = await getMonthlyOcrUsage();
    if (!usage.shouldAlert) return;

    const { sql } = await import("drizzle-orm");

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 查本月是否已寄過 80% 警告
    const alreadySent = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(aiUsageLogs)
      .where(
        sql`${aiUsageLogs.provider} = 'google-vision' and ${aiUsageLogs.endpoint} = 'usage-alert-80pct' and ${aiUsageLogs.createdAt} >= ${firstDayOfMonth}`,
      );

    if ((alreadySent[0]?.cnt ?? 0) > 0) return;

    // 寄信給管理員
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || "twfam4@gmail.com";
    const subject = `⚠️ CHITO 平台 Google Vision OCR 用量達 ${usage.usagePercent}%`;
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
        <h2 style="color: #ea580c;">⚠️ Google Vision OCR 用量警告</h2>
        <p>目前用量已達 <strong>${usage.usagePercent}%</strong>（${usage.currentMonthCount} / ${usage.freeQuota} 次）。</p>
        <ul>
          <li>成功：${usage.successCount} 次</li>
          <li>失敗：${usage.failCount} 次</li>
        </ul>
        <p><strong>當前策略</strong>：達 80% 寄此警告、達 95% 自動停用 OCR 功能。</p>
        <p>建議動作：</p>
        <ol>
          <li>到 <a href="https://game.homi.cc/admin">CHITO 管理後台</a> 查看儀表板</li>
          <li>若確認需求強烈，可考慮升級 Google Vision 付費方案（$1.50 / 1000 次）</li>
          <li>或暫停 OCR 招牌任務，等下月 1 日重置</li>
        </ol>
        <hr />
        <small>此 email 每月僅寄一次。本月不再重複寄送。</small>
      </div>
    `;
    const text = `Google Vision OCR 用量警告 - 已達 ${usage.usagePercent}%（${usage.currentMonthCount}/${usage.freeQuota}）。達 95% 將自動停用。`;

    await sendEmail({
      to: adminEmail,
      subject,
      html,
      text,
    });

    // 記錄「已寄警告」標記（使用 ai_usage_logs 當紀錄表）
    await db.insert(aiUsageLogs).values({
      provider: "google-vision",
      endpoint: "usage-alert-80pct",
      success: true,
      context: {
        percent: usage.usagePercent,
        count: usage.currentMonthCount,
        sentTo: adminEmail,
      },
    });

    console.log(`[google-vision] 已寄 80% 警告 email 給 ${adminEmail}`);
  } catch (error) {
    // 警告流程出錯不應阻斷主業務
    console.error("[google-vision] 警告寄送失敗:", error);
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
