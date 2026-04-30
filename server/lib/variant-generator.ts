// 🎨 變體池生成器 — 用 DeepSeek V3.2 為任務生成多樣訊息變體
//
// 用途：
//   admin 編輯任務時點「✨ AI 一鍵生成 8 個變體」
//   一次性呼叫 DeepSeek，把 success / fail / nearMiss 訊息生成好存進 pages.variant_pool
//   玩家觸發任務時直接從 pool 隨機抽（不再呼叫 AI）
//
// 設計重點：
//   - 用 DeepSeek V3.2（中文文采最佳，實測比 Claude Haiku 強）
//   - 一次生成多類別（success + fail + nearMiss + hint），單次呼叫
//   - 容錯：JSON 解析失敗 → safeParseAiJson 抽 balanced object
//   - 失敗 fallback：呼叫 OpenRouter chain（mistral / llama）
import { DEFAULT_VARIANT_GEN_MODEL } from "@shared/schema";
import {
  variantPoolSchema,
  type VariantPool,
  type VariantKey,
} from "@shared/schema";
import { callOpenRouter, safeParseAiJson } from "./openrouter";

interface GenerateVariantsInput {
  /** 任務情境描述（給 AI 參考）— 例：「拍照確認玩家找到賈村古牌坊」 */
  taskContext: string;
  /** 每個類別生成幾個變體 */
  count: number;
  /** 場域風格 — 例：「戰術 + 歷史」 */
  fieldStyle?: string;
  /** 要生成的類別（預設 success + fail） */
  categories: VariantKey[];
  /** OpenRouter API key（場域 key） */
  apiKey: string;
  /** 模型（預設 DEFAULT_VARIANT_GEN_MODEL = deepseek-v3.2） */
  model?: string;
}

const CATEGORY_DESCRIPTIONS: Record<VariantKey, string> = {
  success: "玩家成功通過任務時顯示的訊息（要有溫度、有故事感、不機械）",
  fail: "玩家失敗時的鼓勵訊息（不打擊、引導重試、可幽默）",
  nearMiss: "玩家接近通過但未到位的訊息（給具體建議）",
  hint: "玩家卡住時的提示訊息（不直接給答案，給方向）",
};

/**
 * 為單一任務生成完整變體池
 * @returns VariantPool 物件，已通過 Zod 驗證
 */
export async function generateVariantPool(
  input: GenerateVariantsInput,
): Promise<VariantPool> {
  const {
    taskContext,
    count,
    fieldStyle,
    categories,
    apiKey,
    model = DEFAULT_VARIANT_GEN_MODEL,
  } = input;

  // 構造 prompt：要求一次回多類別 JSON
  const styleHint = fieldStyle ? `場域風格：${fieldStyle}` : "場域風格：戶外實境遊戲";
  const categoryHints = categories
    .map((c) => `- ${c}: ${CATEGORY_DESCRIPTIONS[c]}`)
    .join("\n");

  const prompt = `你是實境遊戲文案 AI。為以下任務生成多樣化的訊息變體。

任務情境：${taskContext}
${styleHint}

需要生成的訊息類別：
${categoryHints}

要求：
1. 每個類別生成 ${count} 個變體
2. 每個訊息 12-30 個繁體中文字（含標點）
3. 風格多元（俏皮 / 戰友 / 教官 / 文青 / 熱血 / 古風 / 溫柔）
4. 不要機械化（避免「答對了」「成功了」這種乾巴巴）
5. 要有「人味」、有溫度、有想像空間
6. 保留戰術或故事氛圍

回 JSON：
{
${categories.map((c) => `  "${c}": ["訊息1", "訊息2", ...共 ${count} 個]`).join(",\n")}
}

只回 JSON，不要其他說明。`;

  const content = await callOpenRouter(
    apiKey,
    model,
    [{ role: "user", content: prompt }],
    true, // jsonResponse
  );

  // 解析 + 容錯
  const parsed = safeParseAiJson<Record<string, unknown>>(content, "variant-pool");

  // 過濾每個類別只保留 string 陣列
  const result: Record<string, string[]> = {};
  for (const cat of categories) {
    const arr = parsed[cat];
    if (Array.isArray(arr)) {
      result[cat] = arr
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .slice(0, count);
    }
  }

  // 加 metadata
  const pool: VariantPool = {
    ...result,
    generatedAt: new Date().toISOString(),
    model,
  };

  // Zod 驗證（防呆）
  return variantPoolSchema.parse(pool);
}
