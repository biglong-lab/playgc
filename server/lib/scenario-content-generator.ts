// 🤖 Scenario Content Generator — AI 為情境生成客製化內容（W9 D1）
//
// 用途：admin 一鍵建場前，可以先輸入 context（如「Hung 與 Anita 的婚禮」）
//      AI 為每個 host_* 元件生成客製化 config，取代 generic default
//
// 設計：
//   - 用 OpenRouter（DeepSeek V3.2）— 與既有 variant-generator 一致
//   - 結果結構化為 { pageType: configObject } map
//   - JSON parsing 失敗時 fallback 到 default config
//   - 失敗 retry 1 次後 raise

import { callOpenRouter, safeParseAiJson } from "./openrouter";
import type { ScenarioComponent } from "@shared/scenario-templates";

const DEFAULT_MODEL = "deepseek/deepseek-chat";

interface GenerateContentInput {
  apiKey: string;
  scenarioName: string;
  context: string;
  components: ScenarioComponent[];
  /** 模型 override */
  model?: string;
}

export interface GeneratedContent {
  /** pageType → config 的對應 */
  configs: Record<string, Record<string, unknown>>;
  /** AI 思考摘要（給 admin 看是否合理）*/
  rationale: string;
}

/**
 * 為情境的所有元件生成客製化 config
 *
 * @example
 *   const result = await generateScenarioContent({
 *     apiKey,
 *     scenarioName: "婚禮派對",
 *     context: "Hung 與 Anita 的婚禮，5/15 晶華酒店",
 *     components: [
 *       { pageType: "host_polaroid_collage", label: "拍立得紀念牆", role: "...", axis: "host" },
 *     ],
 *   });
 */
export async function generateScenarioContent(
  input: GenerateContentInput,
): Promise<GeneratedContent> {
  const { apiKey, scenarioName, context, components, model = DEFAULT_MODEL } = input;

  const componentDescriptions = components
    .map((c) => `- pageType="${c.pageType}", label="${c.label}", role="${c.role}"`)
    .join("\n");

  const prompt = `你是活動內容創意 AI。為以下情境的每個元件生成客製化 config。

情境：${scenarioName}
活動描述：${context}

元件列表：
${componentDescriptions}

請為每個元件回傳 config 物件。各 pageType 的 config 結構：

- "host_polaroid_collage": { title, subtitle?, emojis?: string[] }
  emojis 是 6-10 個適合此活動的 emoji 字元

- "host_guestbook_digital": { title, subtitle? }

- "host_emoji_react": { title, emojis?: string[] }
  emojis 是 6-12 個適合應援的 emoji

- "host_trivia_showdown": { title, questions: [{ id, prompt, options: [...4 個], correctIdx: 0-3, timeLimitSec: 15 }] }
  questions 至少 3 題、適合活動主題的知識題或趣味題

- "host_live_leaderboard": { title, topN: 5-10 }

- "host_wave_response": { title }

- "host_crowd_gather": { title, targetCount: 10-100（依活動規模）}

- "host_scoreboard_announcement": { title, subtitle? }

- "host_knowledge_map": { title, subtitle? }

- "host_poll_live": { title, question, options: [{ id, label }, ...] }
  question 是適合此活動的開放問題

- "treasure_hunt": { title, finalReward, clues: [{ id, prompt, answer }, ...] }
  clues 至少 3 條、與活動相關

- "jigsaw_puzzle": { title, rows: 2, cols: 2, prompts: [...4 個] }

- "collective_score": { title, targetScore }

- "role_assign": { title, subtitle?, roles: [{ id, name, emoji, description, color, isSecret? }] }

- "gps_cascade": { title, points: [{ id, name, hint, story? }] }

- "shared_board": { title, prompt, maxCardsPerPerson: 2-5 }
  prompt 是引導玩家張貼的問題（如：寫下一件關於你的有趣事實）

- "bingo": { title, subtitle?, items: [...9-16 個詞彙], gridSize: 3-4, winCondition: "line"|"full", celebrationText? }
  items 必須與活動/場域相關，每個詞彙 4-10 字

- "mood_meter": { title, question }
  question 是引導玩家選擇活力的提問（如：你現在的狀態是？）

要求：
1. 內容必須跟 ${context} 緊密相關（提及人名、地點、活動性質）
2. 文字溫度感、避免機械感
3. emoji / icon 用繁體中文情境（喜慶用 💖🎉 / 莊嚴用 🏆⭐ / 知性用 📚🎓）
4. 回傳 JSON：{ "configs": { "<pageType>": {...}, ... }, "rationale": "為什麼這樣設計" }

直接回 JSON、不要 markdown code block：`;

  const messages = [
    { role: "user" as const, content: prompt },
  ];

  const raw = await callOpenRouter(apiKey, model, messages, true);

  try {
    const parsed = safeParseAiJson<GeneratedContent>(raw, "scenario-content");
    if (!parsed.configs || typeof parsed.configs !== "object") {
      throw new Error("AI 回傳缺少 configs 欄位");
    }
    return {
      configs: parsed.configs,
      rationale: parsed.rationale ?? "（AI 未提供說明）",
    };
  } catch (err) {
    console.error("[scenario-content-generator] JSON 解析失敗:", err);
    throw new Error(`AI 內容解析失敗：${err instanceof Error ? err.message : "未知錯誤"}`);
  }
}
