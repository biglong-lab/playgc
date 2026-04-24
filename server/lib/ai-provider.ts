// AI Provider facade — 依 apiKey 前綴自動選用 Gemini 或 OpenRouter
//
// 偵測規則：
//   - `AIza...`（40 字元）→ Google Gemini
//   - `sk-or-...` → OpenRouter
//   - 其他預設走 Gemini（相容性）
//
// 兩者都支援：
//   - verifyPhoto  — 照片 AI 驗證（vision）
//   - scoreTextAnswer — 文字語意評分

import {
  verifyPhoto as verifyPhotoGemini,
  scoreTextAnswer as scoreTextAnswerGemini,
  comparePhotos as comparePhotosGemini,
  isGeminiConfigured,
  type PhotoVerifyResult,
  type TextScoreResult,
  type PhotoCompareResult,
} from "./gemini";
import {
  verifyPhotoOpenRouter,
  scoreTextAnswerOpenRouter,
  comparePhotosOpenRouter,
} from "./openrouter";

export type AIProvider = "gemini" | "openrouter";

export function detectProvider(apiKey?: string): AIProvider {
  if (apiKey?.startsWith("sk-or-")) return "openrouter";
  return "gemini"; // 預設 / AIza
}

export function isAIConfigured(apiKey?: string): boolean {
  if (apiKey?.startsWith("sk-or-")) return true; // OpenRouter key 直接可用
  return isGeminiConfigured(apiKey);
}

export async function verifyPhoto(
  imageUrl: string,
  targetKeywords: string[],
  instruction: string | undefined,
  apiKey?: string,
  model?: string,
): Promise<PhotoVerifyResult> {
  const provider = detectProvider(apiKey);
  if (provider === "openrouter" && apiKey) {
    return verifyPhotoOpenRouter(imageUrl, targetKeywords, instruction, apiKey, model);
  }
  return verifyPhotoGemini(imageUrl, targetKeywords, instruction, apiKey);
}

export async function scoreTextAnswer(
  question: string,
  userAnswer: string,
  expectedAnswers: string[],
  context: string | undefined,
  passingScore: number,
  apiKey?: string,
  model?: string,
): Promise<TextScoreResult> {
  const provider = detectProvider(apiKey);
  if (provider === "openrouter" && apiKey) {
    return scoreTextAnswerOpenRouter(
      question,
      userAnswer,
      expectedAnswers,
      context,
      passingScore,
      apiKey,
      model,
    );
  }
  return scoreTextAnswerGemini(
    question,
    userAnswer,
    expectedAnswers,
    context,
    passingScore,
    apiKey,
  );
}

export type { PhotoVerifyResult, TextScoreResult };
