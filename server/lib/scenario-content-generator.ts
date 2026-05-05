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

- "points_auction": { title, items: [{itemId, label, description}], startingCoins: 50-200 }
  每人有固定代幣，多輪競標，每輪最高出價者獲得標的，適合優先順序決策/資源分配工作坊/趣味競賽

- "emoji_reaction": { title, prompt, maxNote: 20-50 }
  玩家選一個 Emoji 表達感受並附短備註，公布後依 Emoji 分組顯示，適合活動暖場/課程開場/情緒確認

- "confirm_it": { title, statement, showConfidence: boolean }
  玩家對一個陳述投票「正確/錯誤」並選信心程度（50-100%），公布後顯示雙方人數+平均信心，適合知識測試/事實確認/辯論前暖場

- "rate_idea": { title, prompt, ideas: [{ideaId, text}] }
  玩家對 2-6 個想法各打 1-5 星，公布後依平均分排名並顯示進度條，適合方案評選/優先順序決策/創意評鑑

- "kudos_wall": { title, prompt, maxLength: 60-100 }
  prompt 引導送出感謝卡（填對象姓名+感謝話語），揭曉後以彩色卡片呈現所有感謝，適合活動/訓練結束的感謝時間

- "progress_check": { title, prompt, showNotes: boolean }
  showNotes=true 則可附文字說明，玩家選 0/25/50/75/100% 回報進度，揭曉後顯示長條圖+團隊平均，適合訓練/專案進度追蹤

- "freeze_frame": { title, prompt, maxLength: 60-100 }
  prompt 引導描述目前工作現況（一句話），搭配🟢🟡🔴狀態選擇，公布後依狀態分群顯示，適合站立會議/活動進度確認/遠端團隊同步

- "two_column": { title, leftLabel, rightLabel, maxLength: 40-80 }
  玩家可分別新增到兩欄（如優點/缺點、挑戰/解法、同意/不同意），揭曉後左右並列，適合決策討論/回顧/pros-cons分析

- "group_mood": { title, prompt, minLabel: 低/差, maxLabel: 高/好 }
  prompt 詢問目前能量/心情，玩家按 1-10 評分，公布後顯示長條分佈圖+平均值，適合活動開場暖身/訓練前能量掌握/會後反饋

- "daily_intention": { title, prompt, maxLength: 40-80 }
  prompt 引導寫下一句今日意圖，揭曉後以卡片牆呈現所有人意圖，適合工作坊開場/企業內訓聚焦/活動共識

- "clue_reveal": { title, clues: string[], minCluesBeforeGuess: 1-2 }
  clues 陣列 3-6 條、由模糊到具體排序，minCluesBeforeGuess 設幾條線索後才開放猜答，適合破冰猜謎/知識挑戰/場域解謎

- "table_group": { title, tableCount: 2-8, tableNames: string[] }
  tableCount 是桌次數量，tableNames 是桌次名稱陣列（長度需 = tableCount），玩家自選桌次，揭曉後顯示各桌成員名單，適合世界咖啡館/小組討論/分組工作坊

- "feedback_form": { title, prompt, dimensions: string[2-6] }
  dimensions 是評分向度（如：內容/講師/環境），玩家對每個向度評 1-5 分，揭曉後顯示各向度平均分+進度條，適合課後評估/活動回饋/訓練滿意度調查

- "quote_wall": { title, prompt, maxLength: 60-120, placeholder }
  prompt 引導分享名言，placeholder 給範例提示，每人提交名言+出處，揭曉後顯示精美卡片牆，適合開場暖場/分享座右銘/價值觀討論

- "action_item": { title, prompt, maxLength: 40-80, timeOptions: string[2-4] }
  prompt 引導承諾行動，timeOptions 是時間框架（今天/本週/本月），揭曉後依時間分群顯示，適合工作坊結尾/訓練後行動計畫/共識轉化執行

- "role_play_card": { title, roles: string[3-8] }
  roles 是角色名稱陣列，玩家抽取隨機角色（不重複直到角色用完），揭曉後顯示全員角色分配，適合劇本遊戲/破冰/角色扮演工作坊

- "group_decision": { title, question, options: string[2-5] }
  question 是要決策的問題，options 是 2-5 個選項，每人選一個，揭曉後顯示票數分布+勝出選項，適合共識形成/民主決策/活動方向選擇

- "heat_map": { title, rowLabels: string[2-4], colLabels: string[2-4] }
  rowLabels/colLabels 分別是 2-4 個選項，玩家點選矩陣中的一格，揭曉後以熱圖顯示每格票數，適合重要性-緊急性矩陣/優先順序/決策工具

- "energy_boost": { title, prompt, maxLength: 30-60, emojis: string[3-6] }
  prompt 引導送能量（如：送出你的能量鼓勵！），玩家填收件人名字+emoji+一句話，揭曉後顯示收到的能量卡，適合暖場/感謝/活動結尾

- "aha_board": { title, prompt, maxLength: 60-100 }
  prompt 引導分享學習頓悟（如：你最大的啊哈時刻是什麼？），每人提交一條，揭曉後顯示卡片牆，適合課程回顧/學習分享/工作坊結尾

- "one_line_story": { title, prompt, maxLength: 40-80 }
  prompt 引導用一句話說故事（如：用一句話說出你今天的感受），每人提交一句，揭曉後第一條顯示金色徽章，適合破冰/感想分享/聚會開場

- "speed_typing": { title, phrase, maxSeconds: 20-60 }
  phrase 是要玩家打的文字（20-60 字），maxSeconds 倒數時間，公布後依最短秒數排名，適合熱場比賽/破冰競速/活動暖場

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

- "idea_market": { title, prompt, voteLabel, votesPerPlayer: 2-5, maxLength: 50-100, submissionLabel }
  創意市場：每人提交一個點子（title + description），然後每人有固定票數（votesPerPlayer）為喜歡的點子投票，揭曉後依票數高低排名，適合創意激發/方案選擇/腦力激盪

- "consensus_map": { title, prompt, topics: string[2-6], xLabel, yLabel, axisMin: 1, axisMax: 5 }
  共識地圖：每人選一個主題並在可行性（X）× 重要性（Y）矩陣上評分，揭曉後依四象限（優先/規劃/快速/擱置）分組顯示，適合策略規劃/優先序決策/議題評估

- "speed_round": { title, question, correctAnswer, answerLabel, maxLength: 20-80, hint }
  限時搶答：主持人出一道題（question）+ 正確答案（correctAnswer），玩家搶先輸入答案，依作答順序排名，揭曉後顯示誰答對、排名第幾，適合知識競答/活動熱場/趣味競賽

- "scale_vote": { title, question, minLabel, maxLabel, scaleMin: 0, scaleMax: 100, defaultValue: 50 }
  滑桿投票：每人拖動滑桿在 scaleMin-scaleMax 間選一個值，揭曉後顯示平均分數和分佈圖，適合滿意度調查/立場測量/溫度計問題

- "wish_bucket": { title, prompt, placeholder, maxLength: 50-200, anonymous: boolean }
  許願桶：每人匿名或具名投入一個願望/期望/建議，揭曉後所有願望一次性顯示，製造驚喜感，適合結業典禮/聚會/開幕祝福

- "quick_poll": { title, question, options: string[2-6], maxLength: 20-60 }
  快速民調：提供 2-6 個選項讓每人投一票（單選），揭曉後顯示各選項票數和百分比長條圖，適合偏好調查/決策輔助/意見蒐集

- "token_vote": { title, question, options: string[2-8], totalTokens: 5-20 }
  代幣投票：每人有固定數量代幣，用加減按鈕分配給各選項，所有代幣分配完才能提交，揭曉後顯示各選項獲得總代幣，適合資源分配決策/優先序制定/預算分配討論

- "gallery_vote": { title, prompt, galleryLabel, placeholder, maxLength: 30-200 }
  作品票選：所有人提交一段創意內容（名字/標語/答案/作品描述），提交後可為別人的作品投票，揭曉後依票數排序展示，適合命名大賽/創意競賽/破冰自我介紹互評

- "personal_score": { title, prompt, criteria: string[2-8], maxScore: 3-10 }
  個人自評量表：每人對多個指標用滑桿自評分數，揭曉後顯示各指標團隊平均與分布，適合培訓後評估/技能盤點/360度回饋前置/自我反思

- "time_check": { title, question, milestones: string[2-8] }
  進度回報：每人選擇自己目前所在的進度里程碑（可自定義 2-8 個階段），揭曉後顯示全隊進度分布，適合工作坊進度確認/課程理解程度check-in/任務分工後狀態同步

- "emoji_wall": { title, prompt, emojis: string[5-12], reasonLabel, askReason: boolean }
  表情牆：每人從表情符號庫中選一個代表自己感受的表情並可附上理由，揭曉後依表情分組顯示，適合暖場/心情check-in/結束回顧

- "random_pick": { title, prompt, pickCount: 1-5, joinLabel, pickLabel }
  隨機抽選：參與者自願報名，主持人觸發隨機抽選指定人數，中獎者看到恭喜訊息，可重複抽選，適合抽獎/隨機點名/分組/挑戰邀請

- "collab_canvas": { title, prompt, zones: string[2-5], maxPerUser: 1-5, maxLength: 20-60 }
  協作畫布：每人將便利貼貼在對應的分區（如 Keep/Drop/Improve 或 Now/Next/Later），揭曉後以看板形式顯示各區便利貼，適合回顧/決策/創意分類/優先排序工作坊

- "number_line": { title, question, min: 1-100, max: 1-100, unit, lowLabel, highLabel }
  數字定位：每人在數字軸上標記自己的位置（如 1-10 分），揭曉後顯示分佈直方圖與全隊平均值，適合信心調查/滿意度調查/理解程度確認/快速數字評估

- "two_by_two": { title, prompt, xLowLabel, xHighLabel, yLowLabel, yHighLabel, itemLabel }
  2x2 優先矩陣：每人將一個想法或計畫放置在 2x2 象限中，揭曉後以散點圖顯示全隊分佈，適合策略規劃/優先排序工作坊/決策分析

- "countdown_pledge": { title, challengeText, durationMinutes: 1-30, pledgePrompt }
  倒數承諾挑戰：每人寫下承諾，主持人啟動倒數計時，完成者點擊完成，適合行動計畫/學習挑戰/活動激勵

- "star_map": { title, prompt, dimensions: StarDimension[], max: 3-10 } StarDimension={ id, label }
  團隊星圖：每人在多個維度（溝通/信任/效率/士氣等）用滑桿評分，揭曉後顯示每個維度的全隊平均長條圖，適合團隊健康檢查/季度回顧/新團隊破冰評估

- "flash_card": { title, cards: FlashCardItem[] } FlashCardItem={ cardId, front, back }
  閃卡測驗：主持人準備正反面卡片，玩家先寫作答，主持人翻牌揭曉答案，玩家自評是否答對，最後顯示每人得分統計，適合教育培訓/知識測驗/學習型工作坊

- "speed_brainstorm": { title, prompt, timerSeconds: 30-180, maxIdeas: 1-10, maxLength: 20-80 }
  快速腦力激盪：設定倒數計時（60-90秒），計時期間想法全部隱藏（防止錨定效應），時間到後揭曉全隊想法牆，適合創意發想/問題解決/產品功能集思

- "signal_map": { title, prompt, greenLabel, yellowLabel, redLabel }
  交通燈狀態確認：每人選擇 🟢/🟡/🔴 三種狀態加選填評論，揭曉後顯示三色分佈統計與每人評論，適合會議前 go/no-go 確認/準備程度評估/敏捷每日站會

- "team_time_capsule": { title, prompt, openingDate: string }
  團隊時光膠囊：每人寫下留給未來的話語或心情，訊息全程隱藏，主持人在特定時刻「開啟」膠囊一次揭曉所有留言，適合離職感謝/年末回顧/里程碑紀念/新生代入職

- "warm_cool": { title, target, warmPrompt, coolPrompt, maxLength: 40-200 }
  暖涼回饋：每人提交一個「暖」（正面肯定）和一個「涼」（建設性改善）的意見，揭曉後成對顯示每人的暖涼組合，適合活動結束回顧/工作坊收尾/產品 sprint 回顧/教育培訓評估

- "give_get": { title, givePrompt, getPrompt, maxLength: 40-120 }
  技能交換板：每人填寫自己能提供什麼（Give）和需要什麼幫助（Get），揭曉後以雙欄看板顯示所有人的技能供需配對，適合內訓開場/社群聚會/跨部門協作/新創網絡活動

- "ask_me_anything": { title, prompt, maxLength: 40-200 }
  AMA 問答板：任何人隨時提問，所有問題立即公開可見，參與者可對問題按讚投票，問題自動按票數高低排序，適合講師 Q&A/主管對話/知識分享會/想法釐清

- "rose_bud_thorn": { title, rosePrompt, budPrompt, thornPrompt, maxLength: 40-120 }
  Rose-Bud-Thorn 回顧：每人填寫三個面向（Rose=好事、Bud=潛力、Thorn=問題），揭曉後以三欄格式顯示每人的完整回顧，適合 sprint 回顧/活動結束評估/學習工作坊/團隊健康檢查

- "event_timeline": { title, prompt, timePlaceholder, maxLength: 40-120 }
  共享時間軸：每人加入帶時間標記的重要事件，系統按時間排序，揭曉後呈現所有人共同構建的時間軸，適合團隊歷程回顧/個人旅程分享/年度回顧/計畫里程碑梳理

- "yes_no_maybe": { title, question }
  快速共識確認：針對一個問題，每人選擇 ✅ 同意 / ❌ 不同意 / 🤔 待定，揭曉後顯示三色分佈長條圖，適合快速決策/方向確認/提案投票/會議前對齊

- "group_norm": { title, prompt, maxLength: 40-100 }
  團隊工作約定：每人提出希望共同遵守的工作規範，所有人可對規範按讚表示認同，揭曉後按讚數排序，適合新團隊破冰/工作坊開場/跨部門協作建立共識/新成員融入

- "hope_fear": { title, hopePrompt, fearPrompt, maxLength: 40-150 }
  希望與恐懼：每人填寫對即將發生的事（專案/變化/活動）的一個希望和一個恐懼，揭曉後以雙欄格式展示所有人的期待與擔憂，適合專案啟動/組織變革/新計畫對齊/轉型工作坊

- "story_wall": { title, prompt, maxTitleLength: 20-60, maxLength: 100-300 }
  故事牆：每人貢獻一個帶標題的小故事或親身經歷，揭曉後以彩色卡片牆展示所有故事，適合個人旅程分享/文化建設/入職融入/年度回顧/破冰聚會

- "quick_reaction": { title, prompt }
  快速反應：每人從 8 個 emoji 中選一個表達對問題/聲明的即時感受，揭曉後以橫向長條圖顯示各 emoji 的票數比例，適合即興調查/氛圍確認/快速投票/暖場活動

- "personal_highlight": { title, prompt, detailLabel }
  個人亮點：每人分享一個自己在該主題下的成就或亮點（標題必填 + 補充說明選填），揭曉後以漸層彩色卡片牆展示全隊亮點，適合成就慶祝/年度回顧/成就展示/增強團隊信心

- "kpt_retro": { title, keepLabel, problemLabel, tryLabel }
  KPT 回顧：每人填寫 Keep（繼續保持）/ Problem（遇到問題）/ Try（下次嘗試）三欄，至少填一欄即可，揭曉後以三欄對比格式展示全隊回饋，適合敏捷衝刺回顧/工作坊收尾/專案複盤/學習回顧

- "confidence_vote": { title, question, maxScore: 3-10 }
  信心投票：每人以 1-5 星為決定/行動/計畫打出信心分數，揭曉後顯示團隊平均信心及分佈長條圖，適合決策確認/計畫審核/風險評估/共識建立

- "team_goal": { title, prompt, placeholder }
  團隊目標：每人提交一個他們認為最重要的季度/專案目標，揭曉後以彩色卡片牆展示所有目標，促進優先順序對話，適合季度規劃/OKR 設定/新專案啟動/策略對齊

- "start_stop_continue": { title, startLabel, stopLabel, continueLabel }
  Start/Stop/Continue：每人在三欄填寫「開始做」「停止做」「繼續做」（至少一欄即可），揭曉後以三欄對比格式展示，適合組織行為改善/敏捷回顧/學習回顧/文化建設

- "plus_even_better": { title, plusLabel, evenBetterLabel }
  Plus/Even Better：每人填寫「做得好的地方」和「可以更好的地方」（至少一欄即可），揭曉後以雙欄對比展示，適合輕量回顧/工作坊收尾/培訓後反饋/演講後評估

- "meeting_check": { title, prompt, takeawayLabel }
  會議結束確認：每人以 1-5 星評分本次會議 + 一句最大收穫，揭曉後顯示平均分及所有收穫清單，適合會議復盤/工作坊收尾/培訓後評估/活動反饋

- "curiosity_map": { title, prompt, placeholder, maxLength: 30-120 }
  好奇心地圖：每人提交一個好奇心問題或想深入探索的主題，揭曉後以彩色卡片牆顯示全隊集體好奇心全貌，適合學習型工作坊/知識分享會/團隊探索

- "vibe_check": { title, prompt, dimensions: VibeDimension[] } VibeDimension={ id, label, lowEmoji, highEmoji }
  氛圍感測：每人在多個維度（能量/專注/連結/信心等）用滑桿標記自己的感受，揭曉後顯示每個維度的全隊平均值長條圖，適合工作坊開場/會議前確認/情緒健康追蹤

- "cascade_vote": { title, questions: CascadeQuestion[] } CascadeQuestion={ questionId, text, options: string[2-5] }
  連續投票：主持人預設多輪問題，每輪開放玩家選擇，主持人控制進度推進到下一題，最後顯示所有問題的匯總統計，適合快速調查/情緒掃描/多面向回饋

- "team_manifesto": { title, stem, placeholder, maxLength: 5-30, maxPerUser: 1-5 }
  團隊宣言：以「我們是...」為句子開頭，每人貢獻 1-N 個關鍵詞或短句，揭曉後以彩色標籤雲形式拼出全隊共同宣言，適合開場凝聚/團隊建立/文化塑造

- "sentence_stem": { title, stemText, placeholder, maxLength: 40-120 }
  句子接龍：主持人提供句子開頭（如「如果我能飛，我要...」），每人完成句子，揭曉後顯示所有人的創意答案，適合破冰/創意發想/自我揭示/情感共鳴

- "pixel_mood": { title, prompt, moods: MoodOption[] } MoodOption={ id, emoji, label, color }
  心情馬賽克：每人選一個顏色/心情選項，揭曉後以彩色像素格拼成馬賽克，並顯示各心情人數統計，適合開場心情確認/團隊情緒觀察/活動結尾回顧

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

- "pair_share": { title, prompt, pairingMode: "random" }
  配對分享：玩家加入後系統隨機配對，兩人一組互相分享指定話題，奇數人單獨留下，適合破冰/內訓討論/拓展人際

- "team_snapshot": { title, fields: string[3-5], maxLength: 40-60 }
  團隊快照：每位玩家填寫多個欄位（如 開心/擔心/需要支援），揭曉後形成全隊情緒速覽，適合每日站立/回顧/情感核對

- "brain_dump": { title, prompt, maxItems: 3-7, maxLength: 30-60 }
  腦力傾瀉：每人輸入 1 至 maxItems 條想法（可動態新增），揭曉後按人分組顯示，適合集思廣益/工作坊開場/快速發散

- "checkbox_vote": { title, question, options: string[3-6], maxChoices: 1-N }
  複選投票：每人可選多個選項（上限 maxChoices），揭曉後顯示各選項被選人數與比例，適合多維度偏好調查/方案篩選

- "song_wall": { title, prompt, maxLength: 40-60, songPlaceholder, artistPlaceholder }
  歌曲牆：每人選一首代表心情/主題的歌，填寫歌名+歌手+可選備注，揭曉後顯示全員歌單，適合派對暖場/情感核對/聚會破冰

- "personal_compass": { title, northLabel, southLabel, eastLabel, westLabel }
  個人指南針：每人在四個方向（優勢/挑戰/機會/障礙）各填一項，形成個人 SWOT 快照，揭曉後呈現全員四方向分析

- "learning_check": { title, prompt, topics: string[2-5], selfRateLabel, maxLength: 60-120 }
  學習確認：每人對一組主題（topics）自評掌握度 1-5，揭曉後顯示各主題平均分布圖，適合培訓結尾/知識評估/技能盤點

- "stand_point": { title, issue, stances: string[2-5], reasonLabel, maxLength: 80-200 }
  立場陳述：每人選一個立場（支持/中立/反對等）並說明理由，揭曉後依立場分組展示，適合辯論熱場/政策討論/議題探索

- "skill_map": { title, prompt, offerLabel, needLabel, maxLength: 50-100 }
  技能地圖：每人填「我能提供」和「我需要」兩欄，揭曉後形成全隊技能互補圖，適合新專案組隊/跨部門合作啟動/工作坊開場

- "mood_board": { title, prompt, emojiPool: string[8-16], notePlaceholder, maxLength: 40-80 }
  情緒看板：每人從 emoji 池選一個代表心情並附一句話，揭曉後展示全員情緒分布與統計，適合會議開場/工作坊熱身/日常關懷

- "value_card": { title, prompt, cardPool: string[6-12], maxSelect: 2-4 }
  價值卡選單：每人從預設卡片池中選出最重要的幾張，揭曉後統計各張票數分布，適合企業文化建立/入職破冰/年度方向確認

- "thank_you_note": { title, prompt, recipientLabel, messageLabel, maxLength: 80-200, anonymous: boolean }
  感謝便條：每人指定一位收件人並寫下感謝語，揭曉後依收件人分組展示，適合培訓結尾/旅遊感謝/表彰儀式

- "success_story": { title, prompt, achievementLabel, detailLabel, maxLength: 80-200 }
  成功故事牆：每人分享一個成就（標題 + 可選細節），揭曉後呈現全員成就牆，適合培訓結尾/旅遊回顧/激勵頒獎

- "future_idea": { title, prompt, horizon, maxLength: 100-250 }
  未來願景：每人描述對未來（horizon 如「半年後」「一年後」）的想像，揭曉後展示全員未來圖景，適合年度規劃/目標啟動/工作坊收尾

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
