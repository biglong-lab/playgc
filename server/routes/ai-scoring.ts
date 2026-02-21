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
});

const scoreTextSchema = z.object({
  question: z.string().min(1, "缺少問題"),
  userAnswer: z.string().min(1, "缺少使用者答案"),
  expectedAnswers: z.array(z.string()).min(1, "至少需要一個參考答案"),
  context: z.string().optional(),
  passingScore: z.number().min(0).max(100).optional(),
});

// ============================================================================
// 路由註冊
// ============================================================================

export function registerAiScoringRoutes(app: Express): void {
  // POST /api/ai/verify-photo — AI 照片驗證
  app.post("/api/ai/verify-photo", isAuthenticated, async (req: AuthenticatedRequest, res) => {
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
      const parsed = verifyPhotoSchema.safeParse(req.body);
      if (!parsed.success) {
        return apiError(res, 400, parsed.error.errors[0]?.message || "輸入驗證失敗");
      }

      const { imageUrl, targetKeywords, instruction, confidenceThreshold } = parsed.data;
      const threshold = confidenceThreshold ?? 0.6;

      const result = await verifyPhoto(imageUrl, targetKeywords, instruction);

      // 根據閾值判斷是否通過
      const verified = result.confidence >= threshold;

      return res.json({
        verified,
        confidence: result.confidence,
        feedback: result.feedback,
        detectedObjects: result.detectedObjects,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 驗證失敗";
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
