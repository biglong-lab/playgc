// AI 評分路由 — 照片驗證 + 文字語意評分（支援場域獨立 API Key）
import type { Express } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../firebaseAuth";
import { isGeminiConfigured, verifyPhoto, scoreTextAnswer } from "../lib/gemini";
import { decryptApiKey } from "../lib/crypto";
import { db } from "../db";
import { games, fields, parseFieldSettings } from "@shared/schema";
import type { AuthenticatedRequest } from "./types";
import { apiError } from "./types";

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
// 驗證 Schema
// ============================================================================

const verifyPhotoSchema = z.object({
  imageUrl: z.string().url("無效的圖片 URL"),
  targetKeywords: z.array(z.string()).min(1, "至少需要一個目標關鍵字"),
  instruction: z.string().optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  gameId: z.string().uuid().optional(),
});

const scoreTextSchema = z.object({
  question: z.string().min(1, "缺少問題"),
  userAnswer: z.string().min(1, "缺少使用者答案"),
  expectedAnswers: z.array(z.string()).min(1, "至少需要一個參考答案"),
  context: z.string().optional(),
  passingScore: z.number().min(0).max(100).optional(),
  gameId: z.string().uuid().optional(),
});

// ============================================================================
// 場域 AI Key 解析：gameId → fieldId → fieldSettings → 解密 API Key
// ============================================================================

async function resolveAiApiKey(gameId?: string): Promise<string | undefined> {
  if (!gameId) return undefined;

  try {
    // 查 game → fieldId
    const [game] = await db.select({ fieldId: games.fieldId })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    if (!game?.fieldId) return undefined;

    // 查 field → settings
    const [field] = await db.select({ settings: fields.settings })
      .from(fields)
      .where(eq(fields.id, game.fieldId))
      .limit(1);

    if (!field) return undefined;

    const settings = parseFieldSettings(field.settings);

    // 檢查 AI 是否啟用
    if (settings.enableAI === false) {
      throw new Error("FIELD_AI_DISABLED");
    }

    // 有加密 Key 就解密回傳
    if (settings.geminiApiKey) {
      return decryptApiKey(settings.geminiApiKey);
    }

    return undefined; // fallback 到全域
  } catch (error) {
    // FIELD_AI_DISABLED 需要向上拋
    if (error instanceof Error && error.message === "FIELD_AI_DISABLED") {
      throw error;
    }
    // 其他查詢錯誤 → fallback 到全域
    return undefined;
  }
}

// ============================================================================
// 路由註冊
// ============================================================================

export function registerAiScoringRoutes(app: Express): void {
  // POST /api/ai/verify-photo — AI 照片驗證
  app.post("/api/ai/verify-photo", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      // 驗證輸入
      const parsed = verifyPhotoSchema.safeParse(req.body);
      if (!parsed.success) {
        return apiError(res, 400, parsed.error.errors[0]?.message || "輸入驗證失敗");
      }

      const { imageUrl, targetKeywords, instruction, confidenceThreshold, gameId } = parsed.data;

      // 解析場域 API Key（有場域 Key 就用場域的，否則 fallback 全域）
      const fieldApiKey = await resolveAiApiKey(gameId);

      // 檢查 Gemini 是否已設定
      if (!isGeminiConfigured(fieldApiKey)) {
        return apiError(res, 503, "AI 服務未設定");
      }

      // Rate limit 檢查
      const userId = req.user?.dbUser?.id || req.user?.claims?.sub || "unknown";
      if (!checkRateLimit(userId)) {
        return apiError(res, 429, "AI 呼叫次數過多，請稍後再試");
      }

      const threshold = confidenceThreshold ?? 0.6;
      const result = await verifyPhoto(imageUrl, targetKeywords, instruction, fieldApiKey);

      // 根據閾值判斷是否通過
      const verified = result.confidence >= threshold;

      return res.json({
        verified,
        confidence: result.confidence,
        feedback: result.feedback,
        detectedObjects: result.detectedObjects,
      });
    } catch (error) {
      // 場域 AI 被停用
      if (error instanceof Error && error.message === "FIELD_AI_DISABLED") {
        return apiError(res, 503, "此場域的 AI 功能已停用");
      }
      // AI 失敗不應阻斷遊戲，回傳 fallback
      return res.json({
        verified: true,
        confidence: 0,
        feedback: "AI 服務暫時無法使用，已自動通過",
        detectedObjects: [],
        fallback: true,
      });
    }
  });

  // POST /api/ai/score-text — AI 文字語意評分
  app.post("/api/ai/score-text", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      // 檢查 Gemini 是否已設定
      if (!isGeminiConfigured()) {
        return apiError(res, 503, "AI 服務未設定");
      }

      // Rate limit 檢查
      const userId = req.user?.dbUser?.id || req.user?.claims?.sub || "unknown";
      if (!checkRateLimit(userId)) {
        return apiError(res, 429, "AI 呼叫次數過多，請稍後再試");
      }

      // 驗證輸入
      const parsed = scoreTextSchema.safeParse(req.body);
      if (!parsed.success) {
        return apiError(res, 400, parsed.error.errors[0]?.message || "輸入驗證失敗");
      }

      const { question, userAnswer, expectedAnswers, context, passingScore } = parsed.data;

      const result = await scoreTextAnswer(
        question,
        userAnswer,
        expectedAnswers,
        context,
        passingScore ?? 70,
      );

      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 評分失敗";
      // AI 失敗時回傳 fallback，讓前端使用原始精確匹配
      return res.json({
        score: 0,
        isCorrect: false,
        feedback: "AI 服務暫時無法使用",
        fallback: true,
      });
    }
  });
}
