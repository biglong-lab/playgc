// Gemini AI 服務封裝 — 照片驗證 + 文字語意評分
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// ============================================================================
// 初始化
// ============================================================================

let genAI: GoogleGenerativeAI | null = null;

/** 取得全域客戶端（使用 env var） */
function getGlobalClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY 環境變數未設定");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/** 取得客戶端：有場域 Key 就用場域的，否則 fallback 到全域 */
function getClient(apiKey?: string): GoogleGenerativeAI {
  if (apiKey) {
    return new GoogleGenerativeAI(apiKey);
  }
  return getGlobalClient();
}

/** 檢查 Gemini API 是否已設定（全域或場域級） */
export function isGeminiConfigured(fieldApiKey?: string): boolean {
  return Boolean(fieldApiKey || process.env.GEMINI_API_KEY);
}

// ============================================================================
// 照片驗證
// ============================================================================

export interface PhotoVerifyResult {
  verified: boolean;
  confidence: number;
  feedback: string;
  detectedObjects: string[];
}

/** 用 Gemini Vision 驗證照片內容是否符合目標關鍵字 */
export async function verifyPhoto(
  imageUrl: string,
  targetKeywords: string[],
  instruction?: string,
  apiKey?: string,
): Promise<PhotoVerifyResult> {
  const client = getClient(apiKey);
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          verified: { type: SchemaType.BOOLEAN },
          confidence: { type: SchemaType.NUMBER },
          feedback: { type: SchemaType.STRING },
          detectedObjects: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ["verified", "confidence", "feedback", "detectedObjects"],
      },
    },
  });

  // 下載圖片轉 base64
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString("base64");
  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

  const keywordsText = targetKeywords.join("、");
  const instructionText = instruction ? `\n任務說明：${instruction}` : "";

  const prompt = `你是實境遊戲的照片驗證 AI。玩家拍了一張照片，請分析照片內容。

目標關鍵字：${keywordsText}${instructionText}

判斷規則：
1. 照片中是否包含目標關鍵字所描述的物體、場景或特徵
2. confidence 為 0-1 的數值，表示照片符合目標的程度
3. feedback 用繁體中文，簡短友善地告訴玩家結果（20字以內）
4. detectedObjects 列出照片中偵測到的主要物體（繁體中文）

請嚴謹但合理地判斷，只要照片明顯包含關鍵字描述的主題即可通過。`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: base64Image } },
  ]);

  const text = result.response.text();
  const parsed = JSON.parse(text) as PhotoVerifyResult;

  return {
    verified: parsed.verified,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    feedback: parsed.feedback || (parsed.verified ? "驗證通過！" : "照片不符合要求"),
    detectedObjects: parsed.detectedObjects || [],
  };
}

// ============================================================================
// 文字語意評分
// ============================================================================

export interface TextScoreResult {
  score: number;
  isCorrect: boolean;
  feedback: string;
}

/** 用 Gemini 評估使用者答案與參考答案的語意相似度 */
export async function scoreTextAnswer(
  question: string,
  userAnswer: string,
  expectedAnswers: string[],
  context?: string,
  passingScore: number = 70,
  apiKey?: string,
): Promise<TextScoreResult> {
  const client = getClient(apiKey);
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          score: { type: SchemaType.NUMBER },
          feedback: { type: SchemaType.STRING },
        },
        required: ["score", "feedback"],
      },
    },
  });

  const answersText = expectedAnswers.join("、");
  const contextText = context ? `\n場景描述：${context}` : "";

  const prompt = `你是實境遊戲的答案評分 AI。請評估玩家的答案是否語意上正確。

問題：${question}
參考答案：${answersText}
玩家答案：${userAnswer}${contextText}

評分規則：
1. score 為 0-100 的數值
2. 完全正確或語意相同 → 90-100 分
3. 部分正確或方向對但不完整 → 50-80 分
4. 完全不相關 → 0-30 分
5. feedback 用繁體中文，簡短友善地告訴玩家結果（20字以內）
6. 注意同義詞、不同表達方式也應給高分（例如「太陽」和「日頭」語意相同）`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text) as { score: number; feedback: string };

  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  return {
    score,
    isCorrect: score >= passingScore,
    feedback: parsed.feedback || (score >= passingScore ? "答對了！" : "再想想看"),
  };
}
