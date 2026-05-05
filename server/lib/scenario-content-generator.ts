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

- "letter_to_self": { title, prompt, maxLength: 100-500, showAuthor: false }
  每人寫信給未來自己，主持人揭曉時集體閱讀，適合訓練結尾/年終反思/畢業典禮/退休歡送/轉型期

- "group_cheer": { title, goal: 數字, tapEmoji: "👏"|"🔥"|"⚡", celebrateMessage }
  全員瘋狂點擊累積集體應援數，達到目標觸發慶祝，顯示貢獻排行，適合暖場/能量爆發/開場熱身

- "silent_brainstorm": { title, question, maxLength: 50-200, maxIdeasPerPerson: 1-5, showAuthor: false }
  同步靜默輸入想法（揭曉前看不到他人），揭曉後可對想法投票，防止從眾效應，適合決策/回顧/問題分析

- "card_draw": { title, cards: [{ cardId, label, emoji, description? }...], allowReveal: true }
  隨機抽角色/任務牌，揭曉前只看自己，揭曉後顯示所有人的牌，適合角色扮演/任務分配/討論暖身

- "group_promise": { title, pledgeText, goalSigners?: number }
  全員點擊「我承諾」宣誓，顯示名單+進度條+達標慶祝，適合訓練結尾/團隊宣言/新年承諾/開幕誓師

- "sentence_completion": { title, starter, maxLength: 40-120, maxPerPerson: 1-2, reactions: ["❤️","😂","👏"], showAuthor: boolean }
  給一個句子開頭（starter），所有人接龍補完，揭曉後牆上顯示完整句子+emoji反應，適合反思/破冰/創意發想

- "action_pledge": { title, prompt, actionLabel, timelineOptions: string[], showAuthor: boolean }
  每人填寫自己的具體行動承諾（action）+ 期限（timeline），揭曉後牆上展示所有人的承諾卡，增加問責感，適合訓練結尾/團隊共識/新年計畫

- "thinking_hats": { title, topic, hats: [{ hatId, color, emoji, name, description }], maxLength: 60-200, showAuthor: boolean }
  六頂思考帽（白/紅/黑/黃/綠/藍），每人選一頂帽子代表思考角度，寫下對應觀點，揭曉後按帽子分組展示，適合決策分析/問題回顧/創意workshop

- "truth_or_myth": { title, statements: [{ stmtId, text, isTrue }...2-10個] }
  二選一真假題遊戲，全員投票後揭曉答案，最後計分，適合知識趣味問答/熱場/訓練測評/認識彼此的趣味挑戰

- "emoji_check_in": { title, question, emojiOptions: string[], maxNoteLength: 30-100, noteRequired: boolean, showAuthor: boolean }
  快速表情打卡，選一個 emoji 代表當下狀態，可選填一行備註，揭曉後以表情雲呈現全體分布，適合課前/課後暖場/每日站立會議/隨時心情脈搏

- "word_association": { title, words: string[], maxResponseLength: 10-30, showAuthor: boolean }
  每次出一個關鍵詞，所有人寫下第一個聯想詞，揭曉後按詞彙分組展示（相同聯想集中顯示）；多輪進行，探索群體思維模式，適合創意workshop/場域介紹/品牌聯想/破冰

- "feedback_sandwich": { title, targetName, goodPrompt, betterPrompt, goPrompt, maxLength: 80-200, showAuthor: boolean }
  三明治反饋（Good→Better→Go），每人匿名填寫三欄，揭曉後按三個面向聚合展示全體意見，適合訓練結尾評估/方案回顧/表演後反思

- "value_rank": { title, prompt, items: string[]（3-8 個），showAuthor: boolean }
  每人對同一組選項進行重要性排序，揭曉後用 Borda 計分法算出集體排名（第一名得 N-1 分…末位得 0 分，加總），適合企業文化探討/研習共識/優先級決策/破冰了解彼此價值觀

- "collective_poem": { title, prompt, starter?: string, maxLength: 20-80, showAuthor: boolean, maxLinesPerUser: 1-3 }
  每人加入一行詩句（含選填開篇句），提交後即顯示於預覽（未揭曉狀態），揭曉後呈現完整詩篇；適合創意結尾/交誼活動/詩意熱場/學習收尾儀式

- "bottle_letter": { title, prompt, maxLength: 80-300, showAuthor: boolean }
  每人寫一封匿名信，揭曉後按隨機順序展示所有漂流瓶（deterministic shuffle），打開信件有儀式感；適合聚會暖場/末日儀式/破冰書寫/交誼互動

- "time_capture": { title, prompt, openDate?: string（ISO date，選填開啟日期）, maxLength: 80-300, showAuthor: boolean }
  每人寫下給未來自己的訊息，支援設定開啟日期（倒計時顯示），揭曉後一起閱讀集體記錄；適合結業典禮收尾/年度回顧/訓練後承諾書/生日/婚禮留言牆

- "glow_grow": { title, prompt, glowLabel, glowPrompt, growLabel, growPrompt, maxLength: 80-200, showAuthor: boolean }
  每人填寫個人閃光點（Glow）與成長點（Grow）兩欄，揭曉後分組聚合展示，幫助團隊看見整體模式；適合訓練結業/团隊回顧/績效反思/季末總結

- "word_ladder": { title, prompt, startWord, maxWordLength: 4-15 }
  經典詞語接龍，每人填入一個詞（必須以上一個詞的最後一字開頭），形成一條集體創作的詞鏈；適合輕鬆熱場/中文語文課/語言學習/派對遊戲

- "hope_fear": { title, topic, hopeLabel, hopePrompt, fearLabel, fearPrompt, maxLength: 80-200, showAuthor: boolean }
  專案/活動啟動前，每人填寫「期待」與「擔憂」兩欄，揭曉後分兩側展示全體聲音；適合新專案啟動/課程開場/團隊合作前的心理契約

- "number_guess": { title, question, unit?: string, minValue: number, maxValue: number, showAuthor: boolean }
  每人對一個量化問題提交數字，揭曉後顯示直方圖分布 + 平均/中位/最小/最大值統計；適合揭示團隊認知差距/工作習慣調查/趣味猜謎/自我評估

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

- "never_have_i_ever": { title, prompt?, statements: [...3-8個], showWhoAdmitted: boolean }
  statements 是「我從來沒有…」後的句子（如：在會議中偷滑手機），showWhoAdmitted=true 揭曉後顯示誰有做過，適合聚會/破冰/輕鬆派對場景

- "reaction_wall": { title, content, emojis: [...4-8個 emoji], showNames: boolean }
  content 是展示的問題/情境描述（如：聽到這個消息你的第一反應是？），emojis 選與活動氛圍相關的表情，showNames=true 顯示誰選了什麼

- "desert_island": { title, scenario, numItems: 3-5, maxItemLength: 15-25, showAuthor: boolean }
  scenario 是荒島求生的假設情境（如：如果你被困在荒島 3 天，你會帶哪 3 樣東西？），與活動主題相關，showAuthor=true 顯示誰帶了什麼

- "category_challenge": { title, category, prompt, maxItemsPerPerson: 3-8, maxItemLength: 10-20, showCommon: true }
  category 是挑戰的分類主題（如：台灣在地美食），prompt 引導大家列出項目，showCommon=true 揭曉時標示多人共選的項目

- "word_bid": { title, topic, prompt, maxWordLength: 6-10, maxVotesPerPerson: 1-3 }
  topic 是競標的主題詞（如：今天的活動），prompt 引導大家提交代表詞語，最後投票選最佳代言詞

- "memory_lane": { title, question, maxLength: 80-200, showAuthor: boolean }
  question 是引導分享回憶的問題（如：你最難忘的一個瞬間是什麼？），適合溫馨活動/聚會/婚禮/畢業，showAuthor=true 顯示是誰的回憶

- "emoji_story": { title, prompt, emojiOptions: string[], maxEmojis: 2-5, captionMaxLength: 20-50, showAuthor: boolean }
  prompt 引導大家用 emoji 說故事（如：用 3 個 emoji 描述你今天的心情），emojiOptions 為空陣列代表使用預設 emoji 庫，showAuthor=true 顯示創作者名字

- "mind_sync": { title, description, questions: string[], maxAnswerLength: 10-20 }
  questions 是 2-4 個獨立作答的問題（如：最想去哪？最愛什麼食物？），揭曉時顯示誰的答案一樣，description 引導玩家獨立作答

- "color_pulse": { title, prompt, colors: [], maxNoteLength: 15-30, showAuthor: boolean }
  prompt 引導選色（如：選一個代表你今天心情的顏色），colors 為空陣列代表用預設 10 色盤，適合開場暖身/心情溫度計/活動結尾

- "celebration_wall": { title, prompt, maxLength: 50-100, showAuthor: boolean }
  prompt 引導分享成就（如：分享一件你想慶祝的事），揭曉後大家可以點愛心，適合訓練結尾/聚會/成果展示

- "group_contract": { title, prompt, maxRuleLength: 30-50, topN: 3-5 }
  prompt 引導提出規則（如：提出你認為最重要的一條團隊規範），三階段：提案→投票→確立公約，適合工作坊/新團隊建立共識

- "silent_debate": { title, topic, proLabel: 正方, conLabel: 反方, maxLength: 80-150 }
  topic 辯論主題（如：遠端工作讓人更有效率嗎？），玩家選正反方並靜默輸入論點，公布後可互相點愛心，適合工作坊/議題討論/課堂辯論

- "skill_swap": { title, offerPrompt, wantPrompt, maxLength: 15-25, showAuthor: boolean }
  offerPrompt 引導說明自己的技能（如：我能提供什麼？），wantPrompt 引導說明想學什麼，揭曉後自動顯示配對，適合網絡活動/企業訓練

- "anonymous_voice": { title, prompt, maxLength: 80-150 }
  prompt 引導匿名發言（如：有什麼話想說？），完全匿名（不顯示作者），適合匿名回饋/安全發言空間/活動後評價

- "pitch_vote": { title, prompt, maxLength: 40-80, showAuthor: boolean }
  prompt 引導提案（如：用一句話說出你的創意點子），三階段：提案→星星評分（1-5）→排名結果，適合創意工作坊/創業活動/腦力激盪

- "prediction_poll": { title, question, options: [{ optionId, label }] }
  question 是問「大家最常選哪個？」的問題，options 3-5 個選項（需有 optionId 與 label），三階段：預測→作答→揭曉誰猜對，適合破冰/熱場/趣味猜題

- "audience_q": { title, prompt, maxLength: 80-150, showAuthor: boolean }
  prompt 引導觀眾提問（如：有什麼想問的嗎？），支援按讚排序 + 標記已回答，適合演講/工作坊/說明會/Q&A 環節

- "tasting_notes": { title, prompt, itemLabel: string, showItemName: boolean, maxNotesLength: 80-150, showAuthor: boolean }
  品鑑/試吃活動記錄，每人填品項名稱 + 1-5 星評分 + 文字描述，揭曉後按愛心排序，適合品酒/美食/產品試用活動

- "time_vault": { title, prompt, revealLabel: string, maxLength: 100-200, showAuthor: boolean }
  時光膠囊：大家寫訊息後封存，等到特定時機由主持人開封揭曉，revealLabel 說明何時開封，適合聚會/畢業/跨年/年會

- "idea_market": { title, prompt, tokenBudget: 3-7, maxIdeaLength: 40-80, showAuthor: boolean }
  創意市集：每人提出一個點子，然後每人有固定代幣可分配投資各點子，最後揭曉哪個點子獲得最多支持，適合創意激發/腦力激盪/活動規劃

- "personal_fact": { title, prompt, maxLength: 50-100, showAuthor: boolean }
  趣味自我揭秘：每人說一個關於自己的趣事/特點，揭曉後大家按愛心投票最驚喜的事實，適合破冰/認識新朋友/聚會

- "quiz_blitz": { title, questions: [{ questionId, text, options: string[4], correctIndex }], showLeaderboard: boolean }
  快問快答：主持人預設問題，全員同時作答，最後排行榜揭曉誰最厲害，適合知識競賽/學習驗收/趣味問答

- "word_cloud": { title, prompt, maxWords: 1-5, maxWordLength: 5-15, showAuthor: boolean }
  文字雲：每人送出 1-N 個詞，揭曉後按出現頻率顯示大小不同的詞語雲，適合收集感受/集體總結/活動回顧

- "spin_wheel": { title, prompt, allowPlayerAdd: boolean }
  幸運轉盤：玩家自行加入名字/項目，主持人點轉動隨機選出一個，歷史紀錄保留所有選中過的結果，適合抽獎/分配任務/隨機點名

- "open_mic": { title, prompt, maxTopicLength: 30-80 }
  開放麥克風：任何人可登記搶麥，說明想分享的主題，主持人按順序呼叫上場，講完後移至已完成，適合聚會/工作坊結尾分享/年會

- "fast_buzz": { title, questions: string[] }
  搶答競賽：主持人逐題開放搶答，玩家競相按鈴，最快者由主持人判斷答對/答錯，適合知識問答競賽/破冰問答/教育訓練評估

- "crowd_answer": { title, question: string, unit: string, correctAnswer: number }
  猜猜看：全員提交一個數字猜測，公布正確答案後排列由近到遠，適合猜年份/猜數量/猜里程/破冰暖場

- "emoji_slider": { title, question: string, leftEmoji, rightEmoji, leftLabel, rightLabel }
  情緒滑桿：玩家拖動 0-100 滑桿表達情緒強度，揭曉後顯示分佈長條圖和平均值，適合開場暖身/情緒確認/滿意度調查

- "scene_vote": { title, question: string, scenes: SceneOption[] }
  場景投票：玩家選一個最符合自己的場景描述，揭曉後顯示各選項票數排行，適合破冰自我揭示/性格分類/故事情境選擇

- "timed_challenge": { title, challengeText: string, durationSeconds: 60-300 }
  限時挑戰：主持人設定倒數計時，玩家在時限內完成任務後按「完成」，結算時顯示完成順序排名，適合體能挑戰/任務競速/創意發揮計時

- "rank_choice": { title, question: string, items: RankItem[] }
  排序投票：每人拖排 N 個項目的優先順序，公布後以 Borda 積分法聚合全員偏好，適合議程優先排序/功能需求排序/價值觀討論

- "story_branch": { title, segments: StorySegment[] }
  故事分支：主持人設計有分叉的故事段落，玩家集體投票決定故事走向，適合派對創意遊戲/教育情境模擬/品牌故事體驗

- "mood_map": { title, prompt, xLow, xHigh, yLow, yHigh }
  心情地圖：玩家在 2D 座標地圖上點擊標記自己的心情位置（X=能量，Y=情緒），揭曉後主持人一眼看見全員情緒分布，適合開場暖身/工作坊情緒確認/心理健康活動

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
