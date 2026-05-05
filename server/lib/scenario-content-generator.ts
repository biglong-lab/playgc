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

- "team_checklist": { title, items: [...3-8 個任務], celebrationText? }
  items 是與活動相關的具體任務清單，每項 6-20 字

- "feedback_star": { title, question, allowComment: true }
  question 是引導玩家評分的問題（如：你對這次活動的整體感受如何？）

- "team_word_cloud": { title, question, maxWordsPerPerson: 1-3 }
  question 是引導玩家輸入詞彙的提示（如：一個詞描述今天的收穫？）

- "check_in": { title, message, targetCount?: number, showNames: true }
  message 是提示語（如：歡迎簽到！），targetCount 是預期人數（如：30）

- "group_timer": { title, durationSeconds: 60-3600, completedText? }
  durationSeconds 是倒數秒數（如：300 = 5 分鐘），completedText 是結束提示

- "quick_question": { title, question, maxLength: 20-60, anonymous: true, emoji? }
  question 是所有人共同回答的問題（如：用一句話描述今天？）

- "wish_wall": { title, recipientName?, prompt?, maxLength: 50-150, showAuthor: true }
  recipientName 是收件人名稱（如：Hung 與 Anita），prompt 是引導語（如：寫下你對他們的祝福…）

- "stamp_card": { title, subtitle?, slots: [{ id, label, emoji }...4-9個], rewardText?, celebrationText? }
  slots 是需完成的任務清單，每個任務 3-10 字，emoji 選與任務相關的圖示

- "multi_vote": { title, question, options: [{ id, label, emoji }...3-6個], showResultsAfterVote: true, showVoterCount: true }
  question 是投票問題（如：哪個攤位最受歡迎？），options 是候選選項

- "photo_wall": { title, prompt?, allowCaption: true, showAuthor: true }
  prompt 是引導語（如：上傳一張今天最有意義的照片！）

- "countdown_reveal": { title, revealText, revealEmoji?, durationSeconds: 3-10, suspenseMessage? }
  revealText 是揭曉的核心訊息（如：年度最佳員工：張小明），revealEmoji 是搭配的 emoji

- "seat_draw": { title, subtitle?, slots: [{ id, label, emoji }...3-10個], shuffleText? }
  slots 是可抽到的選項（座位號/組別/角色），每個 label 清楚說明（如：A 組 / 1 號桌）

- "name_card": { title, subtitle?, fields: [{ key, label, placeholder?, maxLength? }...2-4個], emojiOptions?: string[] }
  fields 是每人要填寫的欄位（如：姓名、職位、一件有趣的事），至少一個必填欄位

- "rating_wall": { title, subtitle?, items: [{ id, label, emoji?, description? }...2-8個], maxStars: 5, showResults: true }
  items 是所有待評分的對象（如：各組作品、各個提案），label 清楚說明評分對象

- "pop_quiz": { title, questions: [{ id, prompt, options: [...4 個], correctIdx: 0-3, timeLimitSec: 15-30 }] }
  questions 至少 3 題、與活動主題高度相關的知識題或趣味題，prompt 用問號結尾

- "lucky_draw": { title, subtitle?, prizes: [{ id, name, emoji, quantity }...2-5個], drawText?, suspenseText? }
  prizes 是抽獎獎品清單，emoji 選與獎品性質相關的圖示，quantity 是數量（1等獎少、3等獎多）

- "question_box": { title, prompt?, allowAnonymous: true, maxQuestionsPerPerson: 1-5, maxQuestionLength: 50-150 }
  prompt 是引導玩家提問的句子（如：對這次訓練有什麼想法？），allowAnonymous 通常 true

- "story_chain": { title, opening, maxWordsPerContribution: 10-30, maxContributions: 5-20, finishText? }
  opening 是故事開頭句（如：從前從前，有一對相愛的人…），要與活動情境相關且有創意

- "random_team": { title, subtitle?, teams: [{ id, name, emoji, color }...2-6個], startText? }
  teams 是分組方案（如：A/B/C/D 組，或以主題命名），emoji/color 讓各組有視覺辨識度

- "dot_vote": { title, question, options: [{ id, label, emoji }...3-6個], dotsPerPerson: 3-5, showResultsLive: true }
  question 是引導玩家分配點數的問題（如：哪個議題最需要優先解決？），options 是候選選項，每個點代表一票的權重

- "timeline_wall": { title, prompt?, placeholder?, maxEntriesPerPerson: 1-3, maxTextLength: 30-80, showAuthor: true }
  prompt 是引導語（如：寫下你對新郎新娘的回憶…），placeholder 是輸入框提示（如：2015 年的那次旅行…）

- "two_truths": { title, instructions?, showScores: true }
  instructions 是引導語（如：寫下 2 個真實陳述和 1 個謊言，讓大家猜哪個是假的！）

- "retro_board": { title, prompt?, columns: [{ id, label, emoji, color }...2-4個], maxCardsPerColumn: 2-5, allowVoting: true }
  columns 是回顧欄位（如：繼續做/停止做/開始做 或 讚/可改善/建議），color 可選 green/red/blue/yellow/purple/orange

- "pledge_wall": { title, prompt?, placeholder?, maxLength: 40-100, showSupport: true, emojiOptions: [...8-12個適合場景的 emoji] }
  prompt 是引導語（如：許下你對社區的承諾…），emojiOptions 選與活動主題相關的 emoji

- "live_pulse": { title, subtitle?, prompt?: string, maxLevel: 50-500 }
  prompt 是點擊按鈕上的提示文字（如：點擊為他加油！），maxLevel 是顯示上限（依人數與預期活躍度）

- "debate_vote": { title, topic, proLabel, conLabel, proEmoji?: string, conEmoji?: string, showVoterCount: true, allowSwitch: true }
  topic 是辯論主題（如：AI 將取代大多數人類工作），proLabel/conLabel 是正反方標籤（如：正方：同意/反方：不同意）

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
