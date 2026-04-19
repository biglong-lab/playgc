// 室內解謎系新模組（生日派對、魔法學院）
import type { GameModule } from "../game-modules";

// ============================================================================
// 生日派對逃脫趣
// ============================================================================
const birthdayPartyEscape: GameModule = {
  id: "birthday_party_escape",
  name: "生日派對逃脫趣",
  description: "結合壽星回憶、合照收集、吹蠟燭倒數的生日主題輕量逃脫遊戲",
  icon: "cake",
  estimatedTime: 20,
  maxPlayers: 10,
  difficulty: "easy",
  tags: ["室內", "派對", "生日", "拍照", "輕鬆"],
  category: "indoor",
  scenario: "適合家庭生日派對、員工慶生、好友聚會、親子同樂",
  highlights: [
    "以壽星姓名、生日為線索的密碼鎖",
    "收集與壽星的合照作為通關碎片",
    "吹蠟燭倒數營造派對高潮",
    "最難忘回憶投票增進情感連結",
    "全程 20 分鐘不拖戲，適合派對節奏",
  ],
  flowDescription: "壽星留言 → 填入壽星名 → 拍壽星照 → 生日密碼鎖 → 吹蠟燭倒數 → 收集 3 張合照 → 最難忘回憶投票 → 切蛋糕",
  coverEmoji: "🎂",
  pages: [
    {
      pageType: "dialogue",
      title: "壽星的留言",
      config: {
        character: { name: "壽星" },
        messages: [
          { text: "嗨！謝謝你們來幫我慶生！" },
          { text: "我準備了一個小小的遊戲，需要大家一起合作才能解開。" },
          { text: "完成挑戰，你們就能一起跟我吹蠟燭、切蛋糕！" },
        ],
      },
    },
    {
      pageType: "text_verify",
      title: "輸入壽星姓名",
      config: {
        question: "請輸入今天壽星的名字（本名或暱稱皆可）",
        correctAnswer: "壽星",
        hint: "場景佈置上大大的那個名字",
      },
    },
    {
      pageType: "photo_mission",
      title: "拍張壽星照",
      config: {
        prompt: "和壽星合照一張，留下今天最開心的瞬間",
      },
    },
    {
      pageType: "lock",
      title: "生日密碼鎖",
      config: {
        instruction: "線索提示：壽星的生日月日（例 0315）",
        combination: "0315",
        digits: 4,
      },
    },
    {
      pageType: "time_bomb",
      title: "吹蠟燭倒數",
      config: {
        instruction: "剪斷正確的線，讓蠟燭同時熄滅（代表一起吹熄）",
        timeLimit: 30,
        correctSequence: ["pink", "blue", "yellow"],
      },
    },
    {
      pageType: "conditional_verify",
      title: "收集與壽星的合照",
      config: {
        instruction: "收集 3 張與壽星不同年份的合照",
        demoMode: true,
        verificationMode: "all_collected",
        fragmentType: "custom",
        fragmentCount: 3,
        fragments: [
          { id: "p1", label: "童年合照", value: "1", order: 1 },
          { id: "p2", label: "學生時期合照", value: "2", order: 2 },
          { id: "p3", label: "出社會後合照", value: "3", order: 3 },
        ],
      },
    },
    {
      pageType: "vote",
      title: "最難忘的回憶",
      config: {
        question: "跟壽星相處至今，哪段是最難忘的？",
        options: ["一起旅行", "一起加班", "一起吃大餐", "一起熬夜打電動"],
      },
    },
    {
      pageType: "text_card",
      title: "切蛋糕時間",
      config: {
        title: "恭喜順利闖關！",
        text: "現在把所有人聚到壽星身邊，一起拍手唱生日快樂歌、切下這塊屬於你們的蛋糕！",
      },
    },
  ],
};

// ============================================================================
// 魔法學院入學試
// ============================================================================
const magicAcademyEntrance: GameModule = {
  id: "magic_academy_entrance",
  name: "魔法學院入學試",
  description: "以奇幻魔法為主題的多關卡室內挑戰，通過分院、咒語、符文、元素收集成為魔法師",
  icon: "wand",
  estimatedTime: 35,
  maxPlayers: 12,
  difficulty: "medium",
  tags: ["室內", "奇幻", "魔法", "解謎"],
  category: "indoor",
  scenario: "適合主題餐廳、沉浸式劇場、家長日活動、兒童營隊",
  highlights: [
    "分院測驗依性格分派陣營",
    "咒語拼寫與符文密碼雙重考驗",
    "揮動魔杖體感挑戰加強沉浸感",
    "收集火風水土四元素晉級",
    "道德選擇題引導魔法師倫理",
  ],
  flowDescription: "院長歡迎 → 分院問答 → 咒語拼寫 → 符文密碼鎖 → 揮魔杖體感 → 收集四元素 → 道德選擇 → 入學通過",
  coverEmoji: "🪄",
  pages: [
    {
      pageType: "dialogue",
      title: "院長歡迎詞",
      config: {
        character: { name: "院長" },
        messages: [
          { text: "歡迎各位新生來到魔法學院。" },
          { text: "入學前你必須通過五項試煉，證明你的勇氣與智慧。" },
          { text: "拿起你的魔杖，讓我們開始吧。" },
        ],
      },
    },
    {
      pageType: "choice_verify",
      title: "分院測驗",
      config: {
        question: "你在森林中迷路，會先做什麼？",
        options: [
          { text: "尋找高處觀察地形", correct: false },
          { text: "召喚生物求助", correct: false },
          { text: "點亮魔杖找路", correct: false },
          { text: "沉著冷靜就地休息", correct: true },
        ],
      },
    },
    {
      pageType: "text_verify",
      title: "咒語拼寫",
      config: {
        question: "照亮黑暗的光明咒語是？（請用英文拼寫）",
        correctAnswer: "LUMOS",
        hint: "L 開頭，5 個字母",
      },
    },
    {
      pageType: "lock",
      title: "符文密碼鎖",
      config: {
        instruction: "觀察牆上四個符文排列，對應數字為 7、3、1、4",
        combination: "7314",
        digits: 4,
      },
    },
    {
      pageType: "motion_challenge",
      title: "揮動魔杖",
      config: {
        challengeType: "shake",
        instruction: "用力揮動魔杖（手機）15 次釋放魔力！",
        targetCount: 15,
        timeLimit: 10,
      },
    },
    {
      pageType: "conditional_verify",
      title: "收集四元素",
      config: {
        instruction: "在學院各處收集火、風、水、土四大元素碎片",
        demoMode: true,
        verificationMode: "all_collected",
        fragmentType: "custom",
        fragmentCount: 4,
        fragments: [
          { id: "fire", label: "火之結晶", value: "1", order: 1 },
          { id: "wind", label: "風之羽毛", value: "2", order: 2 },
          { id: "water", label: "水之淚滴", value: "3", order: 3 },
          { id: "earth", label: "土之礦石", value: "4", order: 4 },
        ],
      },
    },
    {
      pageType: "choice_verify",
      title: "道德試煉",
      config: {
        question: "你發現同學違反禁咒規定，你會？",
        options: [
          { text: "裝作沒看到", correct: false },
          { text: "向院長報告", correct: false },
          { text: "私下勸阻同學", correct: true },
          { text: "加入他一起違規", correct: false },
        ],
      },
    },
    {
      pageType: "text_card",
      title: "入學通過",
      config: {
        title: "恭喜通過入學試",
        text: "你已展現了足以成為魔法師的資質與品格。歡迎加入魔法學院，願你用魔法守護這個世界。",
      },
    },
  ],
};

export const INDOOR_MODULES: GameModule[] = [
  birthdayPartyEscape,
  magicAcademyEntrance,
];
