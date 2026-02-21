// 賈村戰技體驗場 — 遊戲種子資料
// 使用方式: npx tsx scripts/seed-fake-village.ts
// 建立個人版 + 團隊版遊戲，含 6 章節、29+ 頁面、4 道具
import { db } from "../server/db";
import {
  games,
  pages,
  items,
  gameChapters,
  fields,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

// ============================================================================
// 頁面配置工廠 — 產生各類頁面的 config
// ============================================================================

function textCard(title: string, content: string, extras?: Record<string, unknown>) {
  return { title, content, fontSize: "medium" as const, ...extras };
}

function dialogue(
  name: string,
  msgs: Array<{ text: string; emotion?: string }>,
) {
  return {
    character: { name, avatar: "" },
    messages: msgs.map((m) => ({ text: m.text, emotion: m.emotion ?? "neutral" })),
    bubbleAnimation: true,
  };
}

function choiceVerify(
  question: string,
  opts: Array<{ text: string; correct?: boolean; explanation?: string }>,
  extras?: Record<string, unknown>,
) {
  return {
    question,
    options: opts,
    showExplanation: true,
    randomizeOptions: true,
    ...extras,
  };
}

function gpsMission(
  title: string,
  locationName: string,
  instruction: string,
  points: number,
) {
  return {
    title,
    locationName,
    instruction,
    showMap: true,
    hotZoneHints: true,
    onSuccess: { message: `到達${locationName}！+${points} 分`, points },
  };
}

function qrScan(
  title: string,
  instruction: string,
  code: string,
  rewardPoints: number,
) {
  return {
    title,
    instruction,
    primaryCode: code,
    validationMode: "case_insensitive" as const,
    rewardPoints,
    successMessage: `掃描成功！+${rewardPoints} 分`,
  };
}

function shootingMission(
  title: string,
  description: string,
  requiredHits: number,
  timeLimit: number,
  rewardPoints: number,
) {
  return {
    title,
    description,
    requiredHits,
    timeLimit,
    successReward: { points: rewardPoints },
    onSuccess: { message: `射擊完成！+${rewardPoints} 分` },
  };
}

function photoMission(
  title: string,
  instruction: string,
  points: number,
) {
  return {
    title,
    instruction,
    aiVerify: false,
    manualVerify: false,
    onSuccess: { message: `拍照完成！+${points} 分`, points },
  };
}

function motionChallenge(
  title: string,
  instruction: string,
  challengeType: "shake" | "tilt" | "jump" | "rotate",
  targetValue: number,
  rewardPoints: number,
) {
  return {
    title,
    instruction,
    challengeType,
    targetValue,
    timeLimit: 15,
    showProgress: true,
    rewardPoints,
    successMessage: `挑戰成功！+${rewardPoints} 分`,
  };
}

function gambleButton(
  prompt: string,
  buttons: Array<{ text: string; rewardPoints: number; color: string }>,
) {
  return {
    prompt,
    buttons,
    randomizeOrder: true,
    showStatistics: true,
  };
}

function lockPage(
  title: string,
  instruction: string,
  combination: string,
  hint: string,
  rewardPoints: number,
) {
  return {
    title,
    instruction,
    lockType: "number" as const,
    combination,
    digits: combination.length,
    maxAttempts: 5,
    hint,
    rewardPoints,
    successMessage: `解鎖成功！+${rewardPoints} 分`,
  };
}

function timeBomb(
  title: string,
  timeLimit: number,
  tasks: Array<Record<string, unknown>>,
  rewardPoints: number,
) {
  return {
    title,
    instruction: "限時完成所有任務！",
    timeLimit,
    tasks,
    rewardPoints,
    successMessage: `拆彈成功！+${rewardPoints} 分`,
    failureMessage: "時間到！任務失敗...",
  };
}

function textVerify(
  question: string,
  correctAnswer: string,
  hint: string,
  extras?: Record<string, unknown>,
) {
  return {
    question,
    correctAnswer,
    hint,
    caseSensitive: false,
    maxAttempts: 3,
    showExplanation: true,
    ...extras,
  };
}

// ============================================================================
// 章節頁面定義
// ============================================================================

/** 第一章：新兵報到 */
const CH1_PAGES = [
  {
    pageType: "text_card",
    config: textCard(
      "歡迎來到盤山訓練場！",
      "這裡曾是國軍的秘密訓練基地，佔地 1.2 公頃。今天，你將化身為新兵，" +
      "接受一系列軍事訓練挑戰！\n\n完成任務可以獲得點數，累積足夠點數就能兌換飲料！" +
      "\n\n⚡ 提示：有些關卡可以重複挑戰，善用策略收集更多點數！",
      { layout: "fullscreen", typewriterEffect: true, typewriterSpeed: 30 },
    ),
  },
  {
    pageType: "dialogue",
    config: dialogue("教官老陳", [
      { text: "立正！新兵，歡迎來到盤山訓練場！", emotion: "angry" },
      { text: "今天的訓練很簡單——完成各項挑戰，收集點數。", emotion: "neutral" },
      { text: "點數可以用來解鎖進階關卡，也可以拿來「賭一把」翻倍！", emotion: "happy" },
      { text: "但小心，賭輸了可是會扣分的！最後點數可以換飲料喝。", emotion: "thinking" },
      { text: "準備好了嗎？先來個小測驗看看你的實力！", emotion: "surprised" },
    ]),
  },
  {
    pageType: "choice_verify",
    config: choiceVerify(
      "暖身題：金門在歷史上最著名的戰役是哪一場？",
      [
        { text: "八二三砲戰", correct: true, explanation: "正確！1958 年的八二三砲戰是金門最著名的戰役" },
        { text: "赤壁之戰", correct: false, explanation: "赤壁之戰發生在長江流域" },
        { text: "淝水之戰", correct: false, explanation: "淝水之戰發生在安徽" },
        { text: "牡丹社事件", correct: false, explanation: "牡丹社事件發生在屏東" },
      ],
      { onSuccess: { message: "答對了！你對金門有基本認識！+20 分" } },
    ),
  },
  {
    pageType: "qr_scan",
    config: qrScan(
      "新兵報到",
      "找到入口處的 QR Code 掃描完成報到！",
      "FAKEVILLAGE-CHECKIN",
      30,
    ),
  },
];

/** 第二章：打靶訓練場 */
const CH2_PAGES = [
  {
    pageType: "text_card",
    config: textCard(
      "打靶訓練場",
      "歡迎來到射擊場！這裡配備了專業的靶場設施。\n\n" +
      "🎯 完成射擊任務可獲得分數\n" +
      "🎰 射擊後還有一個「翻倍挑戰」等著你！",
    ),
  },
  {
    pageType: "gps_mission",
    config: gpsMission("前往打靶區", "打靶訓練場", "跟著路標前往園區打靶區域", 10),
  },
  {
    pageType: "shooting_mission",
    config: shootingMission(
      "實彈射擊挑戰",
      "拿起步槍，瞄準靶心！命中越多，分數越高！",
      5, 60, 30,
    ),
  },
  {
    pageType: "button",
    config: gambleButton(
      "🎰 射擊完畢！要不要賭一把？",
      [
        { text: "🔥 全押翻倍！（+40 或 +0）", rewardPoints: 40, color: "red" },
        { text: "💰 穩穩拿 15 分", rewardPoints: 15, color: "green" },
        { text: "😎 跳過，保留現有分數", rewardPoints: 0, color: "gray" },
      ],
    ),
  },
  {
    pageType: "choice_verify",
    config: choiceVerify(
      "射擊知識：國軍制式步槍 T65K2 的口徑是多少？",
      [
        { text: "5.56mm", correct: true, explanation: "正確！T65K2 使用 5.56×45mm NATO 彈藥" },
        { text: "7.62mm", correct: false, explanation: "7.62mm 是 T57 步槍的口徑" },
        { text: "9mm", correct: false, explanation: "9mm 通常用於手槍" },
      ],
      { onSuccess: { message: "軍武知識 +15 分！" }, timeLimit: 15 },
    ),
  },
];

/** 第三章：手榴彈投擲場 */
const CH3_PAGES = [
  {
    pageType: "gps_mission",
    config: gpsMission("前往投擲場", "手榴彈投擲場", "沿著步道前往手榴彈投擲區域", 10),
  },
  {
    pageType: "text_card",
    config: textCard(
      "手榴彈投擲技巧",
      "投擲要領：\n1. 右手握彈，左手扣環\n2. 身體側向目標\n3. 手臂向後伸展\n4. 用力向前甩出\n\n" +
      "📸 先拍一張帥氣的投擲照，再來體感挑戰！",
    ),
  },
  {
    pageType: "photo_mission",
    config: photoMission(
      "投擲英姿照",
      "擺出最帥的投擲姿勢，拍一張照片！",
      20,
    ),
  },
  {
    pageType: "motion_challenge",
    config: motionChallenge(
      "體感投擲挑戰",
      "用力搖晃手機，模擬投擲手榴彈！搖晃次數越多分數越高！",
      "shake", 30, 25,
    ),
  },
  {
    pageType: "button",
    config: gambleButton(
      "🎰 你覺得你的投擲成績能排進前 50% 嗎？",
      [
        { text: "💪 當然！我超強（猜對 +30）", rewardPoints: 30, color: "blue" },
        { text: "😅 可能不行（猜對 +10）", rewardPoints: 10, color: "yellow" },
        { text: "🎲 隨便猜（+15 或 -15）", rewardPoints: -15, color: "purple" },
      ],
    ),
  },
];

/** 第四章：坑道探險（需 60 分解鎖） */
const CH4_PAGES = [
  {
    pageType: "gps_mission",
    config: gpsMission("前往坑道入口", "地下坑道", "穿過樹林，找到坑道入口", 10),
  },
  {
    pageType: "dialogue",
    config: dialogue("老兵阿伯", [
      { text: "年輕人，你來到坑道了啊...", emotion: "thinking" },
      { text: "這條坑道是當年八二三砲戰時挖的，用來躲避砲擊。", emotion: "sad" },
      { text: "坑道深處有一個秘密房間，裡面藏著寶物。", emotion: "neutral" },
      { text: "但要進去，你得先解開密碼鎖...提示就藏在牆上。", emotion: "happy" },
    ]),
  },
  {
    pageType: "lock",
    config: lockPage(
      "坑道密碼鎖",
      "觀察坑道牆壁上的數字線索，輸入 4 位數密碼",
      "1958",
      "提示：金門最著名戰役的年份",
      25,
    ),
  },
  {
    pageType: "time_bomb",
    config: timeBomb("限時拆彈", 45, [
      { type: "tap", question: "快速點擊解除保險", targetCount: 10 },
      { type: "choice", question: "紅線還是藍線？", options: ["紅線", "藍線", "綠線"], correctIndex: 1 },
      { type: "input", question: "輸入解除碼", answer: "823" },
    ], 30),
  },
  {
    pageType: "qr_scan",
    config: qrScan(
      "隱藏 QR Code",
      "在坑道深處找到隱藏的 QR Code！",
      "FAKEVILLAGE-TUNNEL-SECRET",
      20,
    ),
  },
  {
    pageType: "button",
    config: gambleButton(
      "🎰 神秘寶箱出現了！花 20 分開箱？",
      [
        { text: "🎁 開箱！（-20 分，但可能獲得 +60）", rewardPoints: 60, color: "gold" },
        { text: "💎 豪華開箱（-30 分，可能獲得 +100）", rewardPoints: 100, color: "purple" },
        { text: "🚫 不開了，保留分數", rewardPoints: 0, color: "gray" },
      ],
    ),
  },
];

/** 第五章：軍事知識挑戰（花 30 分進入） */
const CH5_PAGES = [
  {
    pageType: "text_card",
    config: textCard(
      "軍事知識競技場",
      "歡迎來到知識競技場！\n\n" +
      "⚠️ 你已花費 30 點進入此區域\n" +
      "📖 答對每題可獲得 20-25 分\n" +
      "❌ 答錯每題扣 5 分\n" +
      "🎰 最後有翻倍挑戰！\n\n準備好了嗎？",
      { textColor: "#FFD700" },
    ),
  },
  {
    pageType: "choice_verify",
    config: choiceVerify(
      "第 1 題：以下哪一個不是金門的軍事據點？",
      [
        { text: "太武山", correct: false, explanation: "太武山是金門最高點，曾設有觀測站" },
        { text: "翟山坑道", correct: false, explanation: "翟山坑道是著名的水上坑道" },
        { text: "北海坑道", correct: false, explanation: "北海坑道位於馬祖，不在金門！" },
        { text: "北海坑道", correct: true, explanation: "正確！北海坑道在馬祖，不在金門" },
      ],
      { onSuccess: { message: "答對！+20 分" }, timeLimit: 20 },
    ),
  },
  {
    pageType: "choice_verify",
    config: choiceVerify(
      "第 2 題：八二三砲戰持續了多久？",
      [
        { text: "44 天", correct: true, explanation: "正確！從 1958 年 8 月 23 日開始，持續 44 天" },
        { text: "7 天", correct: false, explanation: "實際持續了更長時間" },
        { text: "100 天", correct: false, explanation: "沒有那麼久" },
      ],
      { onSuccess: { message: "歷史達人！+20 分" }, timeLimit: 20 },
    ),
  },
  {
    pageType: "text_verify",
    config: textVerify(
      "第 3 題：填空 — 金門的縣花是什麼花？（兩個字）",
      "木棉",
      "提示：紅色的花，又叫英雄花",
      { onSuccess: { message: "知識淵博！+25 分" } },
    ),
  },
  {
    pageType: "button",
    config: gambleButton(
      "🎰 最終翻倍挑戰！你目前的成績要翻倍嗎？",
      [
        { text: "🔥 翻倍！成功 ×2，失敗 ÷2", rewardPoints: 50, color: "red" },
        { text: "💰 保守加 20 分", rewardPoints: 20, color: "green" },
        { text: "🎲 終極賭注 +80 或 -40", rewardPoints: -40, color: "black" },
      ],
    ),
  },
  {
    pageType: "choice_verify",
    config: choiceVerify(
      "第 4 題：以下哪個武器是手榴彈？",
      [
        { text: "M67 破片手榴彈", correct: true, explanation: "正確！M67 是標準破片手榴彈" },
        { text: "M72 反坦克火箭", correct: false, explanation: "M72 是反坦克武器" },
        { text: "M60 通用機槍", correct: false, explanation: "M60 是機槍" },
      ],
      { onSuccess: { message: "武器專家！+20 分" }, timeLimit: 15 },
    ),
  },
];

/** 第六章：結業典禮（需 100 分解鎖） */
const CH6_PAGES = [
  {
    pageType: "text_card",
    config: textCard(
      "🎉 恭喜完成訓練！",
      "你成功通過了賈村戰技體驗場的所有挑戰！\n\n" +
      "🏆 你的最終點數將決定可以兌換的獎勵\n\n" +
      "📋 兌換表：\n" +
      "• 100-149 分：小杯飲料\n" +
      "• 150-199 分：中杯飲料\n" +
      "• 200+ 分：大杯飲料 + 紀念貼紙\n\n" +
      "拍張結業照留念吧！",
      { layout: "center", fontSize: "large" as const },
    ),
  },
  {
    pageType: "photo_mission",
    config: photoMission(
      "結業紀念照",
      "在園區最美的地方拍一張結業照！",
      10,
    ),
  },
  {
    pageType: "text_card",
    config: textCard(
      "兌換飲料",
      "📍 兌換地點：園區出口服務台\n\n" +
      "📱 請將此畫面出示給工作人員\n\n" +
      "🎖️ 感謝您的參與！歡迎下次再來挑戰更高分！\n\n" +
      "💡 小提示：你可以重玩之前的章節來累積更多點數喔！",
      { fontSize: "large" as const },
    ),
  },
];

// ============================================================================
// 團隊版額外頁面
// ============================================================================

/** 團隊版投票頁面 — 插入各章節 */
const TEAM_VOTE_STRATEGY = {
  pageType: "vote",
  config: {
    title: "隊伍策略投票",
    question: "下一步要怎麼做？",
    options: [
      { text: "先去打靶拿基礎分", icon: "🎯" },
      { text: "直衝坑道搶高分", icon: "🕳️" },
      { text: "穩穩做知識題", icon: "📖" },
    ],
    showResults: true,
    votingTimeLimit: 30,
  },
};

const TEAM_VOTE_GAMBLE = {
  pageType: "vote",
  config: {
    title: "團隊賭注投票",
    question: "要不要用團隊點數賭一把？",
    options: [
      { text: "賭！翻倍！", icon: "🔥" },
      { text: "不賭，穩穩來", icon: "🛡️" },
    ],
    minVotes: 2,
    showResults: true,
    votingTimeLimit: 20,
  },
};

// ============================================================================
// 道具定義
// ============================================================================

const GAME_ITEMS = [
  {
    name: "新兵臂章",
    description: "完成報到後獲得的身份證明，代表你是一名合格的新兵",
    itemType: "quest_item",
    effect: {},
  },
  {
    name: "防護盾",
    description: "使用後，下次猜錯不會扣分！只能使用一次",
    itemType: "consumable",
    effect: { protectFromPenalty: true },
  },
  {
    name: "情報卡",
    description: "使用後，知識題會顯示額外提示",
    itemType: "consumable",
    effect: { showHint: true },
  },
  {
    name: "精英勳章",
    description: "累計超過 150 分時自動獲得，是榮譽的象徵",
    itemType: "collectible",
    effect: { badge: "elite" },
  },
];

// ============================================================================
// 主函式
// ============================================================================

async function seedFakeVillageGame() {
  console.log("\n" + "=".repeat(60));
  console.log("🏰 賈村戰技體驗場 — 遊戲種子資料建立");
  console.log("=".repeat(60));

  // 取得現有場域
  const existingFields = await db.select().from(fields).limit(1);
  if (existingFields.length === 0) {
    console.error("❌ 找不到場域資料，請先執行 npx tsx scripts/seed.ts");
    process.exit(1);
  }
  const fieldId = existingFields[0].id;
  console.log(`\n📍 使用場域: ${existingFields[0].name} (${fieldId})`);

  // ---- 建立個人版遊戲 ----
  console.log("\n🎮 建立個人版遊戲...");
  const soloGameId = randomUUID();
  await db.insert(games).values({
    id: soloGameId,
    title: "賈村戰技體驗場 — 軍事冒險大作戰",
    description:
      "化身新兵，在金門盤山訓練場接受軍事挑戰！打靶、投擲手榴彈、探索坑道、答題賺分，" +
      "還能「賭一把」翻倍點數！累積點數兌換飲料！",
    difficulty: "medium",
    estimatedTime: 40,
    maxPlayers: 30,
    fieldId,
    gameMode: "individual",
    gameStructure: "chapters",
    chapterUnlockMode: "all_open",
    allowChapterReplay: true,
    status: "published",
    publicSlug: "fake-village-solo",
    creatorId: null,
  });
  console.log("  ✅ 個人版遊戲已建立 (slug: fake-village-solo)");

  // 建立道具
  console.log("\n🎒 建立遊戲道具...");
  for (const item of GAME_ITEMS) {
    await db.insert(items).values({
      id: randomUUID(),
      gameId: soloGameId,
      name: item.name,
      description: item.description,
      itemType: item.itemType,
      effect: item.effect,
    });
  }
  console.log(`  ✅ ${GAME_ITEMS.length} 個道具已建立`);

  // 章節定義
  const chapterDefs = [
    { order: 1, title: "新兵報到", desc: "歡迎來到訓練場！基礎介紹與報到", unlockType: "free", unlockConfig: {}, time: 5, chPages: CH1_PAGES },
    { order: 2, title: "打靶訓練場", desc: "實彈射擊挑戰，還有翻倍賭注！", unlockType: "free", unlockConfig: {}, time: 8, chPages: CH2_PAGES },
    { order: 3, title: "手榴彈投擲場", desc: "體感投擲、拍照任務與運氣挑戰", unlockType: "free", unlockConfig: {}, time: 8, chPages: CH3_PAGES },
    { order: 4, title: "坑道探險", desc: "深入地下坑道，解密碼鎖、拆彈、尋寶", unlockType: "score_threshold", unlockConfig: { requiredScore: 60 }, time: 10, chPages: CH4_PAGES },
    { order: 5, title: "軍事知識挑戰", desc: "花 30 點進入，答題賺取豐厚獎勵", unlockType: "paid", unlockConfig: { price: 30 }, time: 7, chPages: CH5_PAGES },
    { order: 6, title: "結業典禮", desc: "結算點數，兌換飲料！", unlockType: "score_threshold", unlockConfig: { requiredScore: 100 }, time: 3, chPages: CH6_PAGES },
  ];

  console.log("\n📚 建立章節與頁面...");
  await createChaptersAndPages(soloGameId, chapterDefs);

  // ---- 建立團隊版遊戲 ----
  console.log("\n\n🤝 建立團隊版遊戲...");
  const teamGameId = randomUUID();
  await db.insert(games).values({
    id: teamGameId,
    title: "賈村戰技體驗場 — 團隊合作戰",
    description:
      "組隊挑戰！2-5 人一組，共同完成軍事訓練任務。團隊投票決策、共享點數、協力闖關！" +
      "累積點數兌換飲料！",
    difficulty: "medium",
    estimatedTime: 45,
    maxPlayers: 30,
    fieldId,
    gameMode: "team",
    gameStructure: "chapters",
    chapterUnlockMode: "all_open",
    allowChapterReplay: true,
    minTeamPlayers: 2,
    maxTeamPlayers: 5,
    enableTeamChat: true,
    enableTeamLocation: true,
    teamScoreMode: "shared",
    status: "published",
    publicSlug: "fake-village-team",
    creatorId: null,
  });
  console.log("  ✅ 團隊版遊戲已建立 (slug: fake-village-team)");

  // 團隊版道具
  for (const item of GAME_ITEMS) {
    await db.insert(items).values({
      id: randomUUID(),
      gameId: teamGameId,
      name: item.name,
      description: item.description,
      itemType: item.itemType,
      effect: item.effect,
    });
  }

  // 團隊版章節（在第一章後加策略投票，各章加團隊賭注投票）
  const teamChapterDefs = chapterDefs.map((ch) => {
    const teamPages = [...ch.chPages];
    if (ch.order === 1) {
      // 第一章最後加團隊策略投票
      teamPages.push(TEAM_VOTE_STRATEGY);
    }
    if (ch.order >= 2 && ch.order <= 5) {
      // 第 2-5 章加團隊賭注投票
      teamPages.push(TEAM_VOTE_GAMBLE);
    }
    return { ...ch, chPages: teamPages };
  });

  console.log("\n📚 建立團隊版章節與頁面...");
  await createChaptersAndPages(teamGameId, teamChapterDefs);

  // ---- 完成 ----
  console.log("\n" + "=".repeat(60));
  console.log("🎉 賈村戰技體驗場遊戲建立完成！");
  console.log("=".repeat(60));
  console.log("\n📋 遊戲資訊：");
  console.log("  個人版: http://localhost:3333/g/fake-village-solo");
  console.log("  團隊版: http://localhost:3333/g/fake-village-team");
  console.log("\n🎮 或從首頁 http://localhost:3333/home 進入\n");

  process.exit(0);
}

// ============================================================================
// 輔助函式 — 建立章節與頁面
// ============================================================================

interface ChapterDef {
  order: number;
  title: string;
  desc: string;
  unlockType: string;
  unlockConfig: Record<string, unknown>;
  time: number;
  chPages: Array<{ pageType: string; config: Record<string, unknown> }>;
}

async function createChaptersAndPages(gameId: string, chapters: ChapterDef[]) {
  let globalPageOrder = 1;

  for (const ch of chapters) {
    const chapterId = randomUUID();
    await db.insert(gameChapters).values({
      id: chapterId,
      gameId,
      chapterOrder: ch.order,
      title: ch.title,
      description: ch.desc,
      unlockType: ch.unlockType,
      unlockConfig: ch.unlockConfig,
      estimatedTime: ch.time,
      status: "published",
    });

    for (const page of ch.chPages) {
      await db.insert(pages).values({
        id: randomUUID(),
        gameId,
        pageOrder: globalPageOrder++,
        pageType: page.pageType,
        config: page.config,
        chapterId,
      });
    }

    console.log(`  ✅ 第 ${ch.order} 章「${ch.title}」(${ch.chPages.length} 頁, ${ch.unlockType})`);
  }
}

// ============================================================================
// 執行
// ============================================================================

seedFakeVillageGame().catch((err) => {
  console.error("❌ 種子資料建立失敗:", err);
  process.exit(1);
});
