// AI 評分路由 — 照片驗證 + 文字語意評分 + OCR 招牌偵測（支援場域獨立 API Key）
import type { Express } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../firebaseAuth";
import { isAIConfigured as isGeminiConfigured, verifyPhoto, scoreTextAnswer, comparePhotos, detectProvider } from "../lib/ai-provider";
import { detectText, isGoogleVisionConfigured, logOcrUsage, getMonthlyOcrUsage } from "../lib/google-vision";
import { logAiUsage, getMonthlyAiUsage, withAiTimeout } from "../lib/ai-usage-logger";
import { matchAnswer } from "../lib/text-match";
import { getCached, setCached, buildCacheKey } from "../lib/ai-cache";
import { getEffectiveThresholds } from "../lib/threshold-adapter";
import { decryptApiKey } from "../lib/crypto";
import { db } from "../db";
import { games, fields, parseFieldSettings } from "@shared/schema";
import type { AuthenticatedRequest } from "./types";
import { apiError } from "./types";
// 🔐 2026-07-09 S3：掛上共用 aiLimiter（原本定義了從未使用；自寫記憶體計數保留當第二層）
import { aiLimiter } from "../utils/rate-limiters";

// ============================================================================
// Rate Limiter（記憶體計數器，每用戶每分鐘 10 次）
// ============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// 定期清理過期的 rate limit 記錄（每 5 分鐘）
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  });
}, 5 * 60_000);

// ============================================================================
// 模糊字串比對（Levenshtein distance，中文友善）
// ============================================================================

/** Levenshtein distance：計算兩字串最少編輯次數 */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // 刪除
        matrix[i][j - 1] + 1, // 插入
        matrix[i - 1][j - 1] + cost, // 替換
      );
    }
  }
  return matrix[a.length][b.length];
}

/** 字串相似度（0-1，1=完全一致） */
function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / maxLen;
}

/** 正規化字串（去空白、全形轉半形、小寫） */
function normalize(text: string): string {
  return text
    .replace(/[\s\n\r\t]+/g, "")
    .replace(/[\uFF01-\uFF5E]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    .toLowerCase();
}

/**
 * 檢查 OCR 偵測文字中是否包含任一目標
 * @param ocrText 完整 OCR 文字
 * @param expectedTexts 目標文字列表（任一命中即通過）
 * @param threshold 模糊閾值（0-1，預設 0.7）
 * @returns 最高命中分數 + 命中的目標
 */
function matchExpectedTexts(
  ocrText: string,
  expectedTexts: string[],
  threshold: number,
): { matched: boolean; bestMatch: string | null; similarity: number } {
  const normOcr = normalize(ocrText);

  let bestSim = 0;
  let bestMatch: string | null = null;

  for (const expected of expectedTexts) {
    const normExp = normalize(expected);
    if (!normExp) continue;

    // 策略 1: 完全包含（OCR 文字含有目標）
    if (normOcr.includes(normExp)) {
      return { matched: true, bestMatch: expected, similarity: 1 };
    }

    // 策略 2: 滑動視窗相似度（OCR 中每段與目標比）
    const winSize = normExp.length;
    for (let i = 0; i <= normOcr.length - winSize; i++) {
      const window = normOcr.slice(i, i + winSize);
      const sim = stringSimilarity(window, normExp);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = expected;
      }
    }

    // 策略 3: 直接全文比較（短 OCR 文字情境）
    if (normOcr.length < winSize * 2) {
      const sim = stringSimilarity(normOcr, normExp);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = expected;
      }
    }
  }

  return {
    matched: bestSim >= threshold,
    bestMatch,
    similarity: bestSim,
  };
}

// ============================================================================
// 驗證 Schema
// ============================================================================

const verifyPhotoSchema = z.object({
  imageUrl: z.string().url("無效的圖片 URL"),
  targetKeywords: z.array(z.string()).min(1, "至少需要一個目標關鍵字"),
  instruction: z.string().optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  gameId: z.string().optional(), // 非 uuid 也行（seed game 用 slug-like ID）
  /** 🆕 指定 AI 模型（若場域用 OpenRouter） */
  modelId: z.string().optional(),
  /** 🆕 P4: 任務 ID（pageId）— 用於 cache 對齊到同景點 */
  pageId: z.string().optional(),
});

const scoreTextSchema = z.object({
  question: z.string().min(1, "缺少問題"),
  userAnswer: z.string().min(1, "缺少使用者答案"),
  expectedAnswers: z.array(z.string()).min(1, "至少需要一個參考答案"),
  context: z.string().optional(),
  passingScore: z.number().min(0).max(100).optional(),
  gameId: z.string().uuid().optional(),
  /** 🆕 指定 AI 模型（若場域用 OpenRouter，與 verify-photo / compare-photos 對齊） */
  modelId: z.string().optional(),
  /** 🆕 P13-5: 任務 ID（pageId）— 用於取自適應 fuzzyTolerance */
  pageId: z.string().optional(),
});

// 🆕 OCR 招牌偵測 schema
const ocrDetectSchema = z.object({
  imageUrl: z.string().url("無效的圖片 URL"),
  expectedTexts: z
    .array(z.string().min(1))
    .min(1, "至少需要一個目標文字"),
  /** 模糊比對門檻（0-1，0=完全一致、0.3=寬鬆）*/
  fuzzyThreshold: z.number().min(0).max(1).optional(),
  gameId: z.string().optional(),
});

// 🆕 v2: 照片比對 schema（compare-photos endpoint）
const comparePhotosSchema = z.object({
  playerImageUrl: z.string().url("無效的玩家照片 URL"),
  referenceImageUrl: z.string().url("無效的參考照片 URL"),
  referenceDescription: z.string().optional(),
  compareMode: z.enum(["object", "scene", "composition", "color"]).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  gameId: z.string().optional(),
  modelId: z.string().optional(),
  /** 🆕 P4: 任務 ID（pageId）— 用於 cache 對齊到同景點 */
  pageId: z.string().optional(),
  /** 🆕 P6: 是否用素材庫範本當參考（is_curated=true 優先；找不到時 fallback 到 referenceImageUrl） */
  useExemplar: z.boolean().optional(),
});

// ============================================================================
// 場域 AI Key 解析：gameId → fieldId → fieldSettings → 解密 API Key
// ============================================================================

interface AiContextResolved {
  apiKey?: string;
  fieldId?: string;
}

async function resolveAiApiKey(gameId?: string): Promise<string | undefined> {
  const ctx = await resolveAiContext(gameId);
  return ctx.apiKey;
}

/** 同時取得 apiKey + fieldId（給 logger 用）*/
async function resolveAiContext(gameId?: string): Promise<AiContextResolved> {
  if (!gameId) return {};

  // 🛡️ 預覽模式安全：admin 預覽未儲存的遊戲時 client 會傳 gameId="preview-game"
  // 不該用全域 key 計費，明確拒絕（前端會 catch 並顯示「預覽模式不支援 AI」）
  if (gameId === "preview-game" || gameId === "new") {
    throw new Error("預覽模式不支援 AI（請先儲存遊戲後測試）");
  }

  try {
    // 查 game → fieldId
    const [game] = await db.select({ fieldId: games.fieldId })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    if (!game?.fieldId) return {};

    // 查 field → settings
    const [field] = await db.select({ settings: fields.settings })
      .from(fields)
      .where(eq(fields.id, game.fieldId))
      .limit(1);

    if (!field) return { fieldId: game.fieldId };

    const settings = parseFieldSettings(field.settings);

    // 檢查 AI 是否啟用
    if (settings.enableAI === false) {
      throw new Error("FIELD_AI_DISABLED");
    }

    // 有加密 Key 就解密回傳
    if (settings.geminiApiKey) {
      return {
        apiKey: decryptApiKey(settings.geminiApiKey),
        fieldId: game.fieldId,
      };
    }

    return { fieldId: game.fieldId }; // fallback 到全域
  } catch (error) {
    // FIELD_AI_DISABLED 需要向上拋
    if (error instanceof Error && error.message === "FIELD_AI_DISABLED") {
      throw error;
    }
    // 預覽模式錯誤要向上拋（不要 fallback）
    if (error instanceof Error && error.message.includes("預覽模式")) {
      throw error;
    }
    // 其他查詢錯誤 → fallback 到全域
    return {};
  }
}

// ============================================================================
// 路由註冊
// ============================================================================

export function registerAiScoringRoutes(app: Express): void {
  // POST /api/ai/verify-photo — AI 照片驗證
  app.post("/api/ai/verify-photo", isAuthenticated, aiLimiter, async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.dbUser?.id || req.user?.claims?.sub || "unknown";
    const startedAt = Date.now();
    let resolvedFieldId: string | undefined;
    let resolvedProvider: ReturnType<typeof detectProvider> = "gemini";
    let bodyGameId: string | undefined;

    try {
      // 驗證輸入
      const parsed = verifyPhotoSchema.safeParse(req.body);
      if (!parsed.success) {
        return apiError(res, 400, parsed.error.errors[0]?.message || "輸入驗證失敗");
      }

      const { imageUrl, targetKeywords, instruction, confidenceThreshold, gameId, modelId, pageId } = parsed.data;
      bodyGameId = gameId;

      // 解析場域 API Key + fieldId（log 用）
      const ctx = await resolveAiContext(gameId);
      const fieldApiKey = ctx.apiKey;
      resolvedFieldId = ctx.fieldId;
      resolvedProvider = detectProvider(fieldApiKey);

      // 🆕 P13-6: 取自適應閾值（admin 傳入 confidenceThreshold 優先；否則用 task 自適應；最後 fallback DEFAULT 0.6）
      const adaptiveThresholds = pageId ? await getEffectiveThresholds(pageId) : null;
      const threshold = confidenceThreshold ?? adaptiveThresholds?.aiConfidenceThreshold ?? 0.6;

      // 📸 P4 Cache 查找：先看有沒有相似圖的 cache
      const cacheLookup = await getCached<{ verified: boolean; confidence: number; feedback: string; detectedObjects: string[] }>({
        endpoint: "verify-photo",
        taskId: pageId,
        imageUrl,
        identityHint: targetKeywords,
      });

      if (cacheLookup.hit) {
        // 命中！記 log（標 cached），直接回傳
        await logAiUsage({
          provider: "cache" as never, // 自訂 provider 標籤
          endpoint: "verify-photo",
          success: true,
          latencyMs: Date.now() - startedAt,
          gameId,
          fieldId: resolvedFieldId,
          userId,
          context: {
            cached: true,
            distance: cacheLookup.distance,
            pHash: cacheLookup.pHash,
            verified: cacheLookup.result.verified,
          },
        });
        const cachedResult = cacheLookup.result;
        return res.json({
          ...cachedResult,
          // 重新套用 threshold（cache 結果可能用過去的閾值算過 verified）
          verified: cachedResult.confidence >= threshold,
          cached: true,
          cacheDistance: cacheLookup.distance,
        });
      }

      // 檢查 Gemini 是否已設定
      if (!isGeminiConfigured(fieldApiKey)) {
        await logAiUsage({
          provider: resolvedProvider,
          endpoint: "verify-photo",
          success: false,
          errorCode: "AI_NOT_CONFIGURED",
          errorMessage: "AI 服務未設定",
          latencyMs: Date.now() - startedAt,
          gameId,
          fieldId: resolvedFieldId,
          userId,
        });
        return apiError(res, 503, "AI 服務未設定");
      }

      // Rate limit 檢查
      if (!checkRateLimit(userId)) {
        await logAiUsage({
          provider: resolvedProvider,
          endpoint: "verify-photo",
          success: false,
          errorCode: "RATE_LIMITED",
          errorMessage: "AI 呼叫次數過多",
          latencyMs: Date.now() - startedAt,
          gameId,
          fieldId: resolvedFieldId,
          userId,
        });
        return apiError(res, 429, "AI 呼叫次數過多，請稍後再試");
      }

      // 🆕 若 page config 指定了 modelId 就傳下去（OpenRouter 會用指定模型，Gemini 會忽略）
      // 🛡️ 加 timeout 防 nginx 上游 502
      const result = await withAiTimeout(
        () => verifyPhoto(imageUrl, targetKeywords, instruction, fieldApiKey, modelId),
        { endpoint: "verify-photo", timeoutMs: 50_000 },
      );

      // 根據閾值判斷是否通過
      const verified = result.confidence >= threshold;

      // 📊 記錄成功
      await logAiUsage({
        provider: resolvedProvider,
        endpoint: "verify-photo",
        success: true,
        latencyMs: Date.now() - startedAt,
        gameId,
        fieldId: resolvedFieldId,
        userId,
        context: {
          verified,
          confidence: result.confidence,
          threshold,
          modelId: modelId || null,
          detectedCount: result.detectedObjects?.length ?? 0,
        },
      });

      // 📸 P4: 寫入 cache（30 天 TTL）— 下次相似圖直接命中
      if (cacheLookup.pHash && pageId) {
        const cacheKey = cacheLookup.cacheKey ?? buildCacheKey(pageId, cacheLookup.pHash, targetKeywords);
        if (cacheKey) {
          await setCached({
            endpoint: "verify-photo",
            cacheKey,
            taskId: pageId,
            pHash: cacheLookup.pHash,
            imageUrl, // 🆕 P6: 給 cron 策展用
            fieldId: resolvedFieldId,
            gameId,
            result,
          });
        }
      }

      return res.json({
        verified,
        confidence: result.confidence,
        feedback: result.feedback,
        detectedObjects: result.detectedObjects,
        cached: false,
      });
    } catch (error) {
      // 預覽模式（preview-game）→ 明確拒絕
      if (error instanceof Error && error.message.includes("預覽模式")) {
        return apiError(res, 503, "預覽模式不支援 AI（請先儲存遊戲後測試）");
      }
      // 🛡️ AI timeout → 504（不阻塞 nginx）+ 友善訊息給前端
      if (error instanceof Error && error.message.includes("AI_TIMEOUT")) {
        return apiError(res, 504, "AI 處理超時，請稍候再試（圖片過大或服務繁忙）");
      }
      // 場域 AI 被停用
      if (error instanceof Error && error.message === "FIELD_AI_DISABLED") {
        await logAiUsage({
          provider: resolvedProvider,
          endpoint: "verify-photo",
          success: false,
          errorCode: "FIELD_AI_DISABLED",
          errorMessage: "此場域 AI 功能已停用",
          latencyMs: Date.now() - startedAt,
          gameId: bodyGameId,
          fieldId: resolvedFieldId,
          userId,
        });
        return apiError(res, 503, "此場域的 AI 功能已停用");
      }
      console.error("[ai-scoring] verify-photo 失敗:", error);

      const errMsg = error instanceof Error ? error.message : String(error);
      // 推測 errorCode（QUOTA / API_KEY / 其他）
      let errorCode = "UNHANDLED_ERROR";
      if (/quota|429|rate.?limit/i.test(errMsg)) errorCode = "QUOTA_EXCEEDED";
      else if (/API.?key|invalid.?key|401/i.test(errMsg)) errorCode = "API_KEY_INVALID";
      else if (/timeout|ECONN|fetch/i.test(errMsg)) errorCode = "NETWORK_ERROR";

      await logAiUsage({
        provider: resolvedProvider,
        endpoint: "verify-photo",
        success: false,
        errorCode,
        errorMessage: errMsg.slice(0, 500),
        latencyMs: Date.now() - startedAt,
        gameId: bodyGameId,
        fieldId: resolvedFieldId,
        userId,
      });

      // 🛡️ AI 失敗不阻斷遊戲，但 verified=false（不自動通過）
      // 前端會偵測 fallback 旗標，讓玩家繼續但不給 points（避免被濫用）
      return res.json({
        verified: false,
        confidence: 0,
        feedback: "AI 暫時無法驗證，可繼續遊戲但不計分",
        detectedObjects: [],
        fallback: true,
      });
    }
  });

  // 🆕 v2: POST /api/ai/compare-photos — AI 雙圖相似度比對
  app.post("/api/ai/compare-photos", isAuthenticated, aiLimiter, async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.dbUser?.id || req.user?.claims?.sub || "unknown";
    const startedAt = Date.now();
    let resolvedFieldId: string | undefined;
    let resolvedProvider: ReturnType<typeof detectProvider> = "gemini";
    let bodyGameId: string | undefined;

    try {
      const parsed = comparePhotosSchema.safeParse(req.body);
      if (!parsed.success) {
        return apiError(res, 400, parsed.error.errors[0]?.message || "輸入驗證失敗");
      }

      const {
        playerImageUrl,
        referenceImageUrl: rawRefUrl,
        referenceDescription,
        compareMode,
        similarityThreshold,
        gameId,
        modelId,
        pageId,
        useExemplar,
      } = parsed.data;
      bodyGameId = gameId;

      const ctx = await resolveAiContext(gameId);
      const fieldApiKey = ctx.apiKey;
      resolvedFieldId = ctx.fieldId;
      resolvedProvider = detectProvider(fieldApiKey);

      // 🆕 P13-6: 取自適應 similarity 閾值
      const adaptiveCmpThresholds = pageId ? await getEffectiveThresholds(pageId) : null;
      const threshold = similarityThreshold ?? adaptiveCmpThresholds?.similarityThreshold ?? 0.6;
      const mode = compareMode ?? "scene";

      // 🖼️ P6: 若指定 useExemplar 且有 pageId，優先用素材庫 is_curated 範本
      let referenceImageUrl = rawRefUrl;
      let referenceSource: "admin" | "exemplar" = "admin";
      if (useExemplar && pageId && resolvedFieldId) {
        try {
          const { fieldExemplarPhotos } = await import("@shared/schema");
          const { and: andOp, eq: eqOp, desc: descOp } = await import("drizzle-orm");
          const [exemplar] = await db
            .select()
            .from(fieldExemplarPhotos)
            .where(
              andOp(
                eqOp(fieldExemplarPhotos.fieldId, resolvedFieldId),
                eqOp(fieldExemplarPhotos.pageId, pageId),
                eqOp(fieldExemplarPhotos.isCurated, true),
              ),
            )
            .orderBy(descOp(fieldExemplarPhotos.confidence))
            .limit(1);
          if (exemplar?.photoUrl) {
            referenceImageUrl = exemplar.photoUrl;
            referenceSource = "exemplar";
          }
        } catch (err) {
          console.warn("[compare-photos] 素材庫查詢失敗，fallback admin reference:", err);
        }
      }

      // 📸 P4 Cache 查找：identityHint 用 referenceImageUrl + mode（同任務同參考圖才能 hit）
      const cacheLookup = await getCached<{ verified: boolean; similarity: number; matchedFeatures: string[]; missingFeatures: string[]; feedback: string }>({
        endpoint: "compare-photos",
        taskId: pageId,
        imageUrl: playerImageUrl,
        identityHint: [referenceImageUrl, mode],
      });

      if (cacheLookup.hit) {
        await logAiUsage({
          provider: "cache" as never,
          endpoint: "compare-photos",
          success: true,
          latencyMs: Date.now() - startedAt,
          gameId,
          fieldId: resolvedFieldId,
          userId,
          context: {
            cached: true,
            distance: cacheLookup.distance,
            pHash: cacheLookup.pHash,
            similarity: cacheLookup.result.similarity,
          },
        });
        const cachedResult = cacheLookup.result;
        return res.json({
          ...cachedResult,
          verified: cachedResult.similarity >= threshold,
          cached: true,
          cacheDistance: cacheLookup.distance,
        });
      }

      if (!isGeminiConfigured(fieldApiKey)) {
        await logAiUsage({
          provider: resolvedProvider,
          endpoint: "compare-photos",
          success: false,
          errorCode: "AI_NOT_CONFIGURED",
          errorMessage: "AI 服務未設定",
          latencyMs: Date.now() - startedAt,
          gameId,
          fieldId: resolvedFieldId,
          userId,
        });
        return apiError(res, 503, "AI 服務未設定");
      }

      if (!checkRateLimit(userId)) {
        await logAiUsage({
          provider: resolvedProvider,
          endpoint: "compare-photos",
          success: false,
          errorCode: "RATE_LIMITED",
          errorMessage: "AI 呼叫次數過多",
          latencyMs: Date.now() - startedAt,
          gameId,
          fieldId: resolvedFieldId,
          userId,
        });
        return apiError(res, 429, "AI 呼叫次數過多，請稍後再試");
      }

      // 🛡️ 加 timeout 防 nginx 上游 502
      const result = await withAiTimeout(
        () => comparePhotos(
          playerImageUrl,
          referenceImageUrl,
          referenceDescription,
          mode,
          threshold,
          fieldApiKey,
          modelId,
        ),
        { endpoint: "compare-photos", timeoutMs: 50_000 },
      );

      // 使用 AI 回傳的 verified，並以 threshold 複核
      const verified = result.similarity >= threshold;

      // 📊 記錄成功
      await logAiUsage({
        provider: resolvedProvider,
        endpoint: "compare-photos",
        success: true,
        latencyMs: Date.now() - startedAt,
        gameId,
        fieldId: resolvedFieldId,
        userId,
        context: {
          verified,
          similarity: result.similarity,
          threshold,
          mode,
          modelId: modelId || null,
          matchedCount: result.matchedFeatures?.length ?? 0,
          missingCount: result.missingFeatures?.length ?? 0,
        },
      });

      // 📸 P4: 寫入 cache（30 天 TTL）
      if (cacheLookup.pHash && pageId) {
        const cacheKey = cacheLookup.cacheKey ?? buildCacheKey(pageId, cacheLookup.pHash, [referenceImageUrl, mode]);
        if (cacheKey) {
          await setCached({
            endpoint: "compare-photos",
            cacheKey,
            taskId: pageId,
            pHash: cacheLookup.pHash,
            imageUrl: playerImageUrl, // 🆕 P6: 給 cron 策展用
            fieldId: resolvedFieldId,
            gameId,
            result,
          });
        }
      }

      return res.json({
        verified,
        similarity: result.similarity,
        matchedFeatures: result.matchedFeatures,
        missingFeatures: result.missingFeatures,
        feedback: result.feedback,
        cached: false,
        referenceSource, // 'admin' | 'exemplar'
      });
    } catch (error) {
      // 預覽模式（preview-game）→ 明確拒絕
      if (error instanceof Error && error.message.includes("預覽模式")) {
        return apiError(res, 503, "預覽模式不支援 AI（請先儲存遊戲後測試）");
      }
      // 🛡️ AI timeout → 504（不阻塞 nginx）+ 友善訊息給前端
      if (error instanceof Error && error.message.includes("AI_TIMEOUT")) {
        return apiError(res, 504, "AI 處理超時，請稍候再試（圖片過大或服務繁忙）");
      }
      if (error instanceof Error && error.message === "FIELD_AI_DISABLED") {
        await logAiUsage({
          provider: resolvedProvider,
          endpoint: "compare-photos",
          success: false,
          errorCode: "FIELD_AI_DISABLED",
          errorMessage: "此場域 AI 功能已停用",
          latencyMs: Date.now() - startedAt,
          gameId: bodyGameId,
          fieldId: resolvedFieldId,
          userId,
        });
        return apiError(res, 503, "此場域的 AI 功能已停用");
      }
      console.error("[ai-scoring] compare-photos 失敗:", error);

      const errMsg = error instanceof Error ? error.message : String(error);
      let errorCode = "UNHANDLED_ERROR";
      if (/quota|429|rate.?limit/i.test(errMsg)) errorCode = "QUOTA_EXCEEDED";
      else if (/API.?key|invalid.?key|401/i.test(errMsg)) errorCode = "API_KEY_INVALID";
      else if (/timeout|ECONN|fetch/i.test(errMsg)) errorCode = "NETWORK_ERROR";

      await logAiUsage({
        provider: resolvedProvider,
        endpoint: "compare-photos",
        success: false,
        errorCode,
        errorMessage: errMsg.slice(0, 500),
        latencyMs: Date.now() - startedAt,
        gameId: bodyGameId,
        fieldId: resolvedFieldId,
        userId,
      });

      return res.json({
        verified: false,
        similarity: 0,
        matchedFeatures: [],
        missingFeatures: [],
        feedback: "AI 暫時無法比對，可繼續遊戲但不計分",
        fallback: true,
      });
    }
  });

  // POST /api/ai/score-text — AI 文字語意評分
  app.post("/api/ai/score-text", isAuthenticated, aiLimiter, async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.dbUser?.id || req.user?.claims?.sub || "unknown";
    const startedAt = Date.now();
    let resolvedFieldId: string | undefined;
    let resolvedProvider: ReturnType<typeof detectProvider> = "gemini";
    let bodyGameId: string | undefined;

    try {
      // 驗證輸入
      const parsed = scoreTextSchema.safeParse(req.body);
      if (!parsed.success) {
        return apiError(res, 400, parsed.error.errors[0]?.message || "輸入驗證失敗");
      }

      const { question, userAnswer, expectedAnswers, context, passingScore, gameId, modelId, pageId } = parsed.data;
      bodyGameId = gameId;
      const passing = passingScore ?? 70;

      // 🧠 P3 智慧分流：先試本地比對（exact / fuzzy），命中就直接回傳不呼叫 AI
      // 🆕 P13-5: fuzzyTolerance 改用自適應值（pageId 有設定時）
      const adaptiveTextThresholds = pageId ? await getEffectiveThresholds(pageId) : null;
      const fuzzyTolerance = adaptiveTextThresholds?.fuzzyTolerance ?? 2;
      const localMatch = matchAnswer(userAnswer, expectedAnswers, { fuzzyTolerance });
      if (localMatch.match) {
        const score = localMatch.score ?? 100;
        const isCorrect = score >= passing;
        // 📊 記錄（不耗 AI 但仍記錄分流結果，方便後台看 hit 率）
        await logAiUsage({
          provider: "local-match" as never, // 自訂 provider 標籤
          endpoint: "score-text",
          success: true,
          latencyMs: Date.now() - startedAt,
          gameId,
          fieldId: undefined,
          userId,
          context: {
            score,
            isCorrect,
            passingScore: passing,
            layer: localMatch.layer, // 'exact' | 'fuzzy'
            distance: localMatch.distance,
            aiSkipped: true,
          },
        });
        return res.json({
          score,
          isCorrect,
          feedback:
            localMatch.layer === "exact"
              ? "答對了！"
              : `近似答對（編輯距離 ${localMatch.distance}）`,
          layer: localMatch.layer,
          aiUsed: false,
        });
      }

      // 解析場域 API Key + fieldId
      const ctx = await resolveAiContext(gameId);
      const fieldApiKey = ctx.apiKey;
      resolvedFieldId = ctx.fieldId;
      resolvedProvider = detectProvider(fieldApiKey);

      // 檢查 Gemini 是否已設定
      if (!isGeminiConfigured(fieldApiKey)) {
        await logAiUsage({
          provider: resolvedProvider,
          endpoint: "score-text",
          success: false,
          errorCode: "AI_NOT_CONFIGURED",
          errorMessage: "AI 服務未設定",
          latencyMs: Date.now() - startedAt,
          gameId,
          fieldId: resolvedFieldId,
          userId,
        });
        return apiError(res, 503, "AI 服務未設定");
      }

      // Rate limit 檢查
      if (!checkRateLimit(userId)) {
        await logAiUsage({
          provider: resolvedProvider,
          endpoint: "score-text",
          success: false,
          errorCode: "RATE_LIMITED",
          errorMessage: "AI 呼叫次數過多",
          latencyMs: Date.now() - startedAt,
          gameId,
          fieldId: resolvedFieldId,
          userId,
        });
        return apiError(res, 429, "AI 呼叫次數過多，請稍後再試");
      }

      // 🛡️ 加 timeout 防 nginx 上游 502
      const result = await withAiTimeout(
        () => scoreTextAnswer(
          question,
          userAnswer,
          expectedAnswers,
          context,
          passing,
          fieldApiKey,
          modelId, // 🆕 與 verify-photo / compare-photos 對齊（Gemini 路線會忽略，OpenRouter 會用）
        ),
        { endpoint: "score-text", timeoutMs: 50_000 },
      );

      // 📊 記錄成功
      await logAiUsage({
        provider: resolvedProvider,
        endpoint: "score-text",
        success: true,
        latencyMs: Date.now() - startedAt,
        gameId,
        fieldId: resolvedFieldId,
        userId,
        context: {
          score: result.score,
          isCorrect: result.isCorrect,
          passingScore: passing,
          questionLength: question.length,
          answerLength: userAnswer.length,
          expectedCount: expectedAnswers.length,
          layer: "ai",
        },
      });

      // 🧠 P3-4: 加 layer 欄位讓前端知道這次走 AI（有別於 local-match）
      return res.json({ ...result, layer: "ai", aiUsed: true });
    } catch (error) {
      // 預覽模式（preview-game）→ 明確拒絕
      if (error instanceof Error && error.message.includes("預覽模式")) {
        return apiError(res, 503, "預覽模式不支援 AI（請先儲存遊戲後測試）");
      }
      // 🛡️ AI timeout → 504（不阻塞 nginx）+ 友善訊息給前端
      if (error instanceof Error && error.message.includes("AI_TIMEOUT")) {
        return apiError(res, 504, "AI 處理超時，請稍候再試（圖片過大或服務繁忙）");
      }
      // 場域 AI 被停用
      if (error instanceof Error && error.message === "FIELD_AI_DISABLED") {
        await logAiUsage({
          provider: resolvedProvider,
          endpoint: "score-text",
          success: false,
          errorCode: "FIELD_AI_DISABLED",
          errorMessage: "此場域 AI 功能已停用",
          latencyMs: Date.now() - startedAt,
          gameId: bodyGameId,
          fieldId: resolvedFieldId,
          userId,
        });
        return apiError(res, 503, "此場域的 AI 功能已停用");
      }

      const errMsg = error instanceof Error ? error.message : String(error);
      let errorCode = "UNHANDLED_ERROR";
      if (/quota|429|rate.?limit/i.test(errMsg)) errorCode = "QUOTA_EXCEEDED";
      else if (/API.?key|invalid.?key|401/i.test(errMsg)) errorCode = "API_KEY_INVALID";
      else if (/timeout|ECONN|fetch/i.test(errMsg)) errorCode = "NETWORK_ERROR";

      console.error("[ai-scoring] score-text 失敗:", error);
      await logAiUsage({
        provider: resolvedProvider,
        endpoint: "score-text",
        success: false,
        errorCode,
        errorMessage: errMsg.slice(0, 500),
        latencyMs: Date.now() - startedAt,
        gameId: bodyGameId,
        fieldId: resolvedFieldId,
        userId,
      });

      // AI 失敗時回傳 fallback，讓前端使用原始精確匹配
      return res.json({
        score: 0,
        isCorrect: false,
        feedback: "AI 服務暫時無法使用",
        fallback: true,
      });
    }
  });

  // 🆕 POST /api/ai/ocr-detect — Google Vision OCR 招牌偵測
  //   - 傳入公開 imageUrl（Cloudinary）
  //   - 做模糊比對目標文字
  //   - 記錄用量到 ai_usage_logs
  //   - 免費額度不足時自動 fallback
  app.post("/api/ai/ocr-detect", isAuthenticated, aiLimiter, async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.dbUser?.id || req.user?.claims?.sub || "unknown";

    try {
      // 驗證輸入
      const parsed = ocrDetectSchema.safeParse(req.body);
      if (!parsed.success) {
        return apiError(res, 400, parsed.error.errors[0]?.message || "輸入驗證失敗");
      }
      const { imageUrl, expectedTexts, fuzzyThreshold, gameId } = parsed.data;

      // 檢查 Google Vision 設定
      if (!isGoogleVisionConfigured()) {
        return apiError(res, 503, "OCR 服務未設定，請聯絡管理員");
      }

      // Rate limit
      if (!checkRateLimit(userId)) {
        return apiError(res, 429, "OCR 呼叫次數過多，請稍後再試");
      }

      // 95% 配額自動 fallback（避免透支）
      const usage = await getMonthlyOcrUsage();
      if (usage.shouldFallback) {
        await logOcrUsage({
          success: false,
          errorCode: "QUOTA_FALLBACK",
          errorMessage: `當月用量 ${usage.usagePercent}% 已達 95%，自動暫停`,
          latencyMs: 0,
          gameId,
          userId,
        });
        return res.json({
          matched: false,
          bestMatch: null,
          similarity: 0,
          fullText: "",
          feedback: `OCR 本月用量將滿（${usage.currentMonthCount}/${usage.freeQuota}），已暫停避免超額`,
          fallback: true,
        });
      }

      // 解析 gameId → fieldId（做分場域用量統計）
      let fieldId: string | undefined;
      if (gameId) {
        try {
          const [game] = await db
            .select({ fieldId: games.fieldId })
            .from(games)
            .where(eq(games.id, gameId))
            .limit(1);
          fieldId = game?.fieldId || undefined;
        } catch {
          // gameId 查不到不阻斷
        }
      }

      // 呼叫 Google Vision
      const ocrResult = await detectText(imageUrl);

      // 記錄用量（成功 / 失敗都記）
      await logOcrUsage({
        success: ocrResult.success,
        errorCode: ocrResult.errorCode,
        errorMessage: ocrResult.errorMessage,
        latencyMs: ocrResult.latencyMs,
        gameId,
        fieldId,
        userId,
      });

      if (!ocrResult.success) {
        return res.json({
          matched: false,
          bestMatch: null,
          similarity: 0,
          fullText: "",
          feedback: "OCR 暫時無法辨識",
          fallback: true,
          errorCode: ocrResult.errorCode,
        });
      }

      // 模糊比對
      const threshold = fuzzyThreshold ?? 0.7;
      const match = matchExpectedTexts(
        ocrResult.fullText,
        expectedTexts,
        threshold,
      );

      return res.json({
        matched: match.matched,
        bestMatch: match.bestMatch,
        similarity: match.similarity,
        fullText: ocrResult.fullText,
        latencyMs: ocrResult.latencyMs,
        feedback: match.matched
          ? `成功辨識目標：${match.bestMatch}`
          : `未找到目標文字（最高相似度 ${Math.round(match.similarity * 100)}%）`,
      });
    } catch (error) {
      console.error("[ai-scoring] ocr-detect 失敗:", error);
      await logOcrUsage({
        success: false,
        errorCode: "UNHANDLED_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
        latencyMs: 0,
        userId,
      });
      return res.json({
        matched: false,
        bestMatch: null,
        similarity: 0,
        fullText: "",
        feedback: "OCR 服務暫時無法使用",
        fallback: true,
      });
    }
  });

  // 🆕 GET /api/ai/ocr-usage — 查詢當月 OCR 用量（給 Admin 儀表板用）
  app.get("/api/ai/ocr-usage", isAuthenticated, async (_req, res) => {
    try {
      const usage = await getMonthlyOcrUsage();
      return res.json(usage);
    } catch (error) {
      console.error("[ai-scoring] ocr-usage 失敗:", error);
      return apiError(res, 500, "查詢用量失敗");
    }
  });

  // 🆕 GET /api/ai/usage-stats — 查詢跨 provider AI 用量統計
  //   - gemini / openrouter / google-vision / mediapipe
  //   - 可選 ?fieldId=xxx 過濾單一場域
  //   - 給管理端 dashboard 用
  app.get("/api/ai/usage-stats", isAuthenticated, async (req, res) => {
    try {
      const fieldId = typeof req.query.fieldId === "string" ? req.query.fieldId : undefined;
      const overview = await getMonthlyAiUsage(fieldId);
      return res.json(overview);
    } catch (error) {
      console.error("[ai-scoring] usage-stats 失敗:", error);
      return apiError(res, 500, "查詢 AI 用量統計失敗");
    }
  });
}
