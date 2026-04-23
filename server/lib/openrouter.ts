// OpenRouter API provider（OpenAI compatible）
// Supports: verifyPhoto (vision) + scoreTextAnswer (text)
// Docs: https://openrouter.ai/docs

import type { PhotoVerifyResult, TextScoreResult } from "./gemini";
import { DEFAULT_VISION_MODEL, DEFAULT_TEXT_MODEL } from "@shared/schema";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// 預設模型（若場域未指定）
const DEFAULT_MODEL_VISION =
  process.env.OPENROUTER_VISION_MODEL || DEFAULT_VISION_MODEL;
const DEFAULT_MODEL_TEXT =
  process.env.OPENROUTER_TEXT_MODEL || DEFAULT_TEXT_MODEL;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  jsonResponse = true,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: 500,
  };
  if (jsonResponse) {
    body.response_format = { type: "json_object" };
  }

  // 🕒 加 45s timeout（跟 Gemini 對稱，避免 AI 擁塞卡住整個 request）
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://game.homi.cc",
        "X-Title": "CHITO Game Platform",
      },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("OpenRouter 回應超時（45 秒）");
    }
    throw err;
  }
  clearTimeout(timer);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter 失敗 (${res.status}): ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter 回傳無內容");
  return content;
}

export async function verifyPhotoOpenRouter(
  imageUrl: string,
  targetKeywords: string[],
  instruction: string | undefined,
  apiKey: string,
  model?: string,
): Promise<PhotoVerifyResult> {
  const visionModel = model || DEFAULT_MODEL_VISION;
  const keywordsText = targetKeywords.join("、");
  const instructionText = instruction ? `\n任務說明：${instruction}` : "";
  const prompt = `你是實境遊戲的照片驗證 AI。玩家拍了一張照片，請分析照片內容。

目標關鍵字：${keywordsText}${instructionText}

判斷規則：
1. 照片中是否包含目標關鍵字所描述的物體、場景或特徵
2. confidence 為 0-1 的數值，表示照片符合目標的程度
3. feedback 用繁體中文，簡短友善地告訴玩家結果（20字以內）
4. detectedObjects 列出照片中偵測到的主要物體（繁體中文）

請嚴謹但合理地判斷，回傳 JSON 格式：
{ "verified": boolean, "confidence": number, "feedback": string, "detectedObjects": string[] }`;

  const content = await callOpenRouter(apiKey, visionModel, [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    },
  ]);

  const parsed = JSON.parse(content) as PhotoVerifyResult;
  return {
    verified: !!parsed.verified,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    feedback: parsed.feedback || (parsed.verified ? "驗證通過！" : "照片不符合要求"),
    detectedObjects: Array.isArray(parsed.detectedObjects) ? parsed.detectedObjects : [],
  };
}

export async function scoreTextAnswerOpenRouter(
  question: string,
  userAnswer: string,
  expectedAnswers: string[],
  context: string | undefined,
  passingScore: number,
  apiKey: string,
  model?: string,
): Promise<TextScoreResult> {
  const textModel = model || DEFAULT_MODEL_TEXT;
  const expectedText = expectedAnswers.join(" / ");
  const contextText = context ? `\n場景說明：${context}` : "";

  const prompt = `你是實境遊戲的語意評分 AI，負責評估玩家答案與參考答案的相似度。

問題：${question}
玩家答案：${userAnswer}
參考答案：${expectedText}${contextText}
通過門檻：${passingScore} 分

評分規則：
1. score 為 0-100 的數值
2. 語意完全相同 = 95+，語意相近但用詞不同 = 70-90，部分相關 = 40-70，無關 = 0-40
3. 允許繁簡轉換、同義詞、標點差異
4. feedback 用繁體中文，簡短告知結果（20字以內）

回傳 JSON：
{ "score": number, "isCorrect": boolean, "feedback": string }

isCorrect 必須與 (score >= ${passingScore}) 一致。`;

  const content = await callOpenRouter(apiKey, textModel, [
    { role: "user", content: prompt },
  ]);

  const parsed = JSON.parse(content) as TextScoreResult;
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
  return {
    score,
    isCorrect: score >= passingScore,
    feedback: parsed.feedback || (score >= passingScore ? "答對了！" : "還不完全正確"),
  };
}
