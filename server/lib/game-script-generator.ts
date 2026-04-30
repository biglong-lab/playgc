// 🪄 AI 遊戲腳本產生器 — admin 寫腳本，AI 自動組裝模組成完整遊戲
//
// 流程：
//   admin 輸入：「玩家從廟口出發，找到 3 個古蹟拍照打卡，最後答題拿寶藏」
//                          ↓
//   DeepSeek V3.2 解析意圖，按 MODULE_CATALOG 組裝 page list
//                          ↓
//   回傳 page configs[]（admin 預覽 + 微調）
//                          ↓
//   admin 確認 → 寫入 DB
//
// 安全：
//   1. AI 只能組合「現有模組」（從 SUPPORTED_PAGE_TYPES 挑）
//   2. 所有 config 經 Zod 基礎驗證
//   3. admin 必須預覽 + 確認才發布
import { z } from "zod";
import {
  DEFAULT_VARIANT_GEN_MODEL,
  formatModuleCatalog,
  SUPPORTED_PAGE_TYPES,
} from "@shared/schema";
import { callOpenRouter, safeParseAiJson } from "./openrouter";

// ============================================================================
// Schema：AI 生成的 page 結構
// ============================================================================
export const generatedPageSchema = z.object({
  pageOrder: z.number().int().min(1),
  pageType: z.string().refine((v) => SUPPORTED_PAGE_TYPES.includes(v), {
    message: `pageType must be one of: ${SUPPORTED_PAGE_TYPES.join(", ")}`,
  }),
  customName: z.string().max(200).optional(),
  config: z.record(z.unknown()),
});

export const generatedGameSchema = z.object({
  pages: z.array(generatedPageSchema).min(1).max(20),
  estimatedDuration: z.number().int().min(1).max(600).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  summary: z.string().max(500).optional(),
});

export type GeneratedPage = z.infer<typeof generatedPageSchema>;
export type GeneratedGame = z.infer<typeof generatedGameSchema>;

// ============================================================================
// 主入口：生成遊戲
// ============================================================================
export interface GenerateGameInput {
  /** admin 寫的腳本（自然語言） */
  script: string;
  /** 場域風格（戰術 / 歷史 / 兒童 等） */
  fieldStyle?: string;
  /** 期望時長（分鐘） */
  targetMinutes?: number;
  /** 期望難度 */
  difficulty?: "easy" | "medium" | "hard";
  /** OpenRouter API key（場域 key） */
  apiKey: string;
  /** 模型（預設 DeepSeek V3.2） */
  model?: string;
}

const SYSTEM_PROMPT = `你是「賈村競技場」遊戲設計助手。將 admin 的自然語言腳本，轉換成具體的 Page 模組組合 + JSON 配置。

平台支援以下 23 種 Page 模組：

${formatModuleCatalog()}

設計原則：
1. 流程要連貫（每頁 nextPageId 對應）
2. 給每個任務點預設合理的獎勵（rewardPoints / rewardItems）
3. 拍照類任務記得設地圖標記（locationSettings）
4. 答題任務記得設答案 + 啟用 aiScoring
5. 文案要符合場域風格（戰術 / 歷史 / 賈村味）
6. 開場用 text_card 或 dialogue 介紹劇情
7. 結尾用 text_card 顯示獎勵
8. 必填欄位都要填，選填欄位酌情加

回 JSON 格式：
{
  "pages": [
    {
      "pageOrder": 1,
      "pageType": "text_card",
      "customName": "開場白",
      "config": { "title": "...", "content": "..." }
    },
    ...
  ],
  "estimatedDuration": 30,
  "difficulty": "medium",
  "summary": "..."
}

只回 JSON，不要其他說明。`;

/**
 * 從腳本生成遊戲頁面
 */
export async function generateGameFromScript(
  input: GenerateGameInput,
): Promise<GeneratedGame> {
  const {
    script,
    fieldStyle,
    targetMinutes = 30,
    difficulty = "medium",
    apiKey,
    model = DEFAULT_VARIANT_GEN_MODEL,
  } = input;

  const userPrompt = `腳本：${script}

【設定】
- 場域風格：${fieldStyle || "戶外實境遊戲"}
- 目標時長：${targetMinutes} 分鐘
- 難度：${difficulty}

請將上述腳本轉換成連貫的 Page 序列。每個 page 必須有合適的 pageType 和完整的 config。`;

  const content = await callOpenRouter(
    apiKey,
    model,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    true, // jsonResponse
  );

  // 解析 + 容錯
  const parsed = safeParseAiJson<unknown>(content, "game-generator");

  // Zod 驗證（防 AI 亂組）
  const validated = generatedGameSchema.parse(parsed);

  return validated;
}
