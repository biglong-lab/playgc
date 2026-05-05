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

- "team_contract": { title, contractText, pledgeLabel?, showSigners: true, targetCount?, celebrationText? }
  contractText 是全員共同承諾的宣言文字（如：我們承諾彼此尊重、積極合作），pledgeLabel 是簽署按鈕文字，targetCount 是預期簽署人數

- "priority_rank": { title, question, items: [{ id, label, emoji }...3-8個], showConsensus: true }
  question 是引導語（如：請依重要程度排列以下項目），items 是待排序的選項清單（如：提升效率、降低成本、增加收入），showConsensus 顯示群體共識排名

- "hot_seat": { title, instructions?, durationSeconds: 60-300, maxQuestionsPerRound: 3-8 }
  instructions 是說明語（如：一人上場，全場提問！），durationSeconds 是每輪時間，maxQuestionsPerRound 是每輪最多問題數

- "team_health_check": { title, dimensions: [{ id, label, emoji, description? }...3-6個], scaleMin: 1, scaleMax: 5, anonymous: true, showResults: true }
  dimensions 是評估維度（如：心理安全感/溝通透明度/互相信任/團隊能量），每個維度對應一個1-5評分，結果以進度條呈現

- "project_showcase": { title, prompt?, maxProjectsPerPerson: 1-3, maxTitleLength: 20-40, maxDescLength: 80-200, allowVoteOwn: false, emojiReactions: [...4-6個], showVoteCount: true }
  emojiReactions 是觀眾可以給出的反應 emoji（如：🔥⭐💡👏🏆），適合 Demo Day / 黑客松 / 成果發表

- "photo_caption": { title, photoUrl, prompt?, maxCaptionLength: 40-120, maxCaptionsPerPerson: 1-3, showVotes: true }
  photoUrl 是展示給所有人看的同一張照片，每人提交創意配文，互相投票，最高票桂冠標記，適合年終/旅遊/派對趣味互動

- "spectrum_line": { title, instructions?, questions: [{ id, leftLabel, rightLabel, leftEmoji?, rightEmoji? }...2-6個], showResults: true, showNames: true }
  questions 是兩極光譜問題（如：內向↔外向、計畫型↔即興型），每人拖動滑桿定位0-100，結果顯示群體分布點與平均值，適合破冰/了解工作風格/個性揭曉

- "mad_libs": { title, story, blanks: [{ id, label, hint? }...3-8個], revealWhenFull: true }
  story 是填空模板，用 {id} 代表空格位置（如「今天 {hero} 去了 {place}」），blanks 定義每個空格的說明，全填完後揭曉完整搞笑故事，適合婚禮/生日/聚會

- "agreement_matrix": { title, instructions?, statements: [{ id, text }...3-8個], showResults: true }
  statements 是多個陳述句，每人對每句評分（👍同意/😐普通/👎不同意），集體分布以橫條圖呈現，適合回顧、訓練後問卷、意見調查

- "estimation_game": { title, question, unit?, options?: [...], showAverage: true, showAllEstimates: true }
  options 是估算選項（如 Fibonacci: 1/2/3/5/8/13/21/?，T-shirt: XS/S/M/L/XL）。揭曉前保密，任何人提交後可點擊揭曉顯示分佈圖與平均值，適合規劃撲克、敏捷估點

- "hot_take": { title, instructions?, maxLength: 30-100, maxTakesPerPerson: 1-3, reactions: ["🔥","💯","🤔","❄️","💀"] }
  每人提交有爭議的觀點，他人用 emoji 反應，按反應總數排行，適合社群討論/派對/破冰辯論環節

- "knowledge_check": { title, questions: [{ id, text, options: [string...4個], correctIndex: 0-3, explanation? }], showExplanation: true, pointsPerCorrect: number }
  主持人出題→全員搶答→主持人揭曉正確答案+解析+百分比，適合企業內訓知識測驗/活動闖關/學習確認

- "most_likely": { title, questions: [string...3-10條], showResults: true }
  派對遊戲「最有可能⋯」，玩家先加入再提名他人，主持人揭曉後顯示得票排名＋桂冠，適合聚會/破冰/婚禮/員工旅遊暖場

- "presence_map": { title, xAxisLeft, xAxisRight, yAxisTop, yAxisBottom, showNames: true }
  2D 個性地圖，每人點擊放置自己的標記，即時看到所有人的位置分布，適合破冰/員工認識/個性可視化/團隊了解

- "open_question": { title, question, maxLength: 40-200, maxAnswersPerPerson: 1-3, showAuthor: true, placeholder? }
  所有人回答同一道開放式問題，答案即時出現在牆上（可帶名字），適合反思/分享/訓練後整合

- "countdown_challenge": { title, challenge, durationSeconds: 15-300, successLabel, failLabel, showLeaderboard: true }
  倒數計時畫面，每人自行回報完成/放棄，排行榜按完成時間排序，適合熱場/派對遊戲/破冰挑戰

- "team_poll": { title, question, options: [{ id, label, emoji? }...2-8個], multiSelect: boolean, maxSelections?: number, showResults: true, showVoterNames: true }
  multiSelect=false 為單選，true 為多選（可設 maxSelections 上限），結果顯示背景條形圖+百分比，適合快速決策/活動規劃/即時問卷

- "scaled_feedback": { title, instructions?, questions: [{ id, text, minLabel?, maxLabel? }...2-8個], scale: 5|10, showResults: true }
  scale 是量表範圍（5 分或 10 分），每題顯示數字按鈕，提交後顯示全員分布直方圖與平均值，適合訓練後測評、活動滿意度調查、團隊健康評估

- "would_you_rather": { title, optionA, emojiA?, optionB, emojiB?, showVoterNames: true }
  optionA/B 是二選一選項，揭曉前保密票數，任何人可點擊揭曉看百分比分布與投票者名單，適合破冰/派對/旅遊車上娛樂/快速了解團隊偏好

- "category_sort": { title, instructions?, items: [{ id, label }...4-8個], categories: [{ id, label, color }...2-5個], showConsensus: true }
  items 是待分類的卡片，categories 是可選分類（每個分類有 hex color），showConsensus 顯示群體分佈條形圖，適合資訊架構/工作坊/共識建立

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

- "peer_recognition": { title, prompt?, placeholder?, maxLength: 50-150, allowAnonymous: true, emojiOptions: [...8-12個 emoji] }
  prompt 是引導語（如：寫下你想感謝的人…），emojiOptions 選與場景正向氛圍相關的 emoji（如：🌟🙌💪❤️👏）

- "consensus_scale": { title, question, scaleMin: 1, scaleMax: 5-7, minLabel?, maxLabel?, showAverage: true, showDistribution: true }
  question 是要大家評分的核心議題（如：你對這個提案的支持程度？），minLabel/maxLabel 是量表兩端說明（如：完全不同意/完全同意）

- "idea_wall": { title, prompt?, placeholder?, maxLength: 40-100, maxIdeasPerPerson: 1-5, showAuthor: true, allowVoteOwn: false }
  prompt 是引導大家投稿點子的問題（如：對這次活動你有什麼建議？），placeholder 是輸入框提示

- "speed_networking": { title, prompt?, roundDurationSeconds: 60-300, questions: [...2-5個問題], showMatchedCount: true }
  questions 是每輪的話題引導問題（如：你現在最專注的一件事是什麼？），roundDurationSeconds 是每輪時間

- "photo_contest": { title, prompt?, theme?, maxPhotosPerPerson: 1-3, allowVoteOwn: false, showAuthor: true, maxCaptionLength: 40-80 }
  theme 是競賽主題（如：最美金門一角），prompt 是引導語

- "gratitude_wall": { title, prompt?, placeholder?, maxLength: 50-120, maxCardsPerPerson: 2-5, showAuthor: true, cardColors: [...] }
  prompt 是引導語（如：寫下你的感謝），placeholder 是輸入框提示（如：感謝…）

- "bucket_list": { title, prompt?, placeholder?, maxItemsPerPerson: 2-5, maxItemLength: 20-50, allowSupport: true }
  prompt 是引導語（如：寫下你想在這次活動實現的事！），allowSupport 讓他人按讚共鳴

- "challenge_board": { title, prompt?, maxChallengesPerPerson: 1-3, maxChallengeLength: 20-60, rewardEmoji?: string }
  prompt 是引導語，rewardEmoji 是每個挑戰前的裝飾（如：⚡🎯🎉）

- "emoji_battle": { title, question, emojis: [{emoji, label}...4-9個], allowMultiSelect: false, showResults: true }
  question 是要大家表達的問題（如：現在你的心情是？），emojis 選與活動氛圍相關的表情組合

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
