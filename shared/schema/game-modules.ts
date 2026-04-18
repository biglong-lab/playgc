// 遊戲模組庫定義 - 提供完整遊戲範本供使用者套用
// 擴展 GameTemplate 介面，增加更豐富的描述與分類

import type { TemplatePageConfig } from "./game-templates";

/** 模組分類 */
export type ModuleCategory =
  | "outdoor"    // 戶外探索
  | "indoor"     // 室內解謎
  | "education"  // 教育學習
  | "team"       // 團隊競技
  | "digital";   // 數位互動

/** 模組分類中文對照 */
export const MODULE_CATEGORY_LABELS: Record<ModuleCategory, string> = {
  outdoor: "戶外探索",
  indoor: "室內解謎",
  education: "教育學習",
  team: "團隊競技",
  digital: "數位互動",
};

/** 遊戲模組介面（擴展 GameTemplate） */
export interface GameModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  estimatedTime: number | null;
  maxPlayers: number;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  pages: TemplatePageConfig[];
  // 擴展欄位
  category: ModuleCategory;
  scenario: string;          // 適用場景描述
  highlights: string[];      // 亮點特色（3-5 項）
  flowDescription: string;   // 頁面流程簡述
  coverEmoji: string;        // 封面 emoji（用於卡片展示）
}

/** 難度中文對照 */
export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "簡單",
  medium: "中等",
  hard: "困難",
};

// ============================================================================
// 模組 1：古鎮尋寶奇遇記（戶外探索）
// ============================================================================
const outdoorTreasureHunt: GameModule = {
  id: "outdoor_treasure_hunt",
  name: "古鎮尋寶奇遇記",
  description: "結合 GPS 定位與實地探索的戶外尋寶遊戲，引導玩家走訪多個地標完成拍照、掃碼、答題任務",
  icon: "map",
  estimatedTime: 45,
  maxPlayers: 8,
  difficulty: "medium",
  tags: ["戶外", "探索", "GPS", "拍照", "QR"],
  category: "outdoor",
  scenario: "適合觀光景點、古蹟導覽、校外教學、團隊建設活動",
  highlights: [
    "GPS 導航引導玩家前往各站點",
    "拍照任務記錄探索過程",
    "QR Code 掃碼確認抵達",
    "選擇題驗證學習成果",
    "完整故事線串聯各關卡",
  ],
  flowDescription: "開場故事 → GPS 導航到站點 → 拍照記錄 → QR 確認 → 知識問答 → 第二站探索 → 最終挑戰 → 完成獎勵",
  coverEmoji: "🗺️",
  pages: [
    {
      pageType: "text_card",
      title: "探險召集令",
      config: {
        title: "歡迎來到古鎮尋寶",
        text: "傳說古鎮裡藏著一份神秘的寶藏地圖，只有完成所有站點挑戰的探險家才能揭開謎底。準備好你的相機和勇氣，出發吧！",
      },
    },
    {
      pageType: "gps_mission",
      title: "前往第一站：古井廣場",
      config: {
        instruction: "跟著地圖指引，前往古井廣場",
        targetLocation: { lat: 25.033, lng: 121.565 },
        radius: 30,
      },
    },
    {
      pageType: "photo_mission",
      title: "拍攝古井",
      config: {
        prompt: "找到古井後，拍攝一張包含古井全貌的照片",
      },
    },
    {
      pageType: "qr_scan",
      title: "掃碼確認抵達",
      config: {
        instruction: "掃描古井旁邊的 QR Code 確認你已抵達",
        expectedCode: "STATION-001",
      },
    },
    {
      pageType: "choice_verify",
      title: "古井知識問答",
      config: {
        question: "關於這口古井，以下哪個說法是正確的？",
        options: ["建於清朝年間", "建於日治時期", "建於民國初年"],
        correctIndex: 0,
      },
    },
    {
      pageType: "gps_mission",
      title: "前往第二站：老街入口",
      config: {
        instruction: "沿著古道，前往老街入口的牌坊",
        targetLocation: { lat: 25.034, lng: 121.566 },
        radius: 30,
      },
    },
    {
      pageType: "photo_mission",
      title: "老街紀錄",
      config: {
        prompt: "在老街牌坊前拍攝一張到此一遊的照片",
      },
    },
    {
      pageType: "text_card",
      title: "尋寶完成",
      config: {
        title: "恭喜完成古鎮尋寶！",
        text: "你成功走訪了所有站點，揭開了古鎮的秘密。這段旅程的回憶將永遠伴隨著你！",
      },
    },
  ],
};

// ============================================================================
// 模組 2：密室危機倒數（室內解謎）
// ============================================================================
const escapeRoomCountdown: GameModule = {
  id: "escape_room_countdown",
  name: "密室危機倒數",
  description: "結合密碼鎖、拆彈計時、碎片收集的高緊張度室內解謎遊戲",
  icon: "puzzle",
  estimatedTime: 25,
  maxPlayers: 6,
  difficulty: "hard",
  tags: ["室內", "解謎", "密碼", "拆彈", "團隊"],
  category: "indoor",
  scenario: "適合密室逃脫場館、主題派對、企業團建、休閒娛樂場所",
  highlights: [
    "對話劇情營造沉浸式氛圍",
    "多種解謎類型交替挑戰",
    "拆彈計時增加緊張感",
    "碎片收集確保完整通關",
    "密碼鎖關卡考驗觀察力",
  ],
  flowDescription: "劇情開場 → 文字謎題 → 密碼鎖 → 拆彈倒數 → 碎片收集 → 選擇題 → 最終解密 → 逃脫成功",
  coverEmoji: "🔐",
  pages: [
    {
      pageType: "dialogue",
      title: "神秘來電",
      config: {
        character: { name: "神秘人" },
        messages: [
          { text: "你好，被選中的人..." },
          { text: "你被困在這個房間裡，炸彈將在 25 分鐘後引爆。" },
          { text: "唯一的出路就是解開所有謎題。祝你好運。" },
        ],
      },
    },
    {
      pageType: "text_verify",
      title: "牆上的謎語",
      config: {
        question: "牆上刻著一段文字：「日出東方，月落西山。東西南北，答案在中。」請輸入答案",
        correctAnswer: "中",
        hint: "仔細閱讀每句話的最後一個字",
      },
    },
    {
      pageType: "lock",
      title: "保險箱密碼",
      config: {
        instruction: "根據房間裡的線索，輸入 4 位數密碼打開保險箱",
        correctCode: "2580",
        codeLength: 4,
      },
    },
    {
      pageType: "time_bomb",
      title: "拆除炸彈",
      config: {
        instruction: "剪斷正確的線路來拆除炸彈！選錯會加速倒數",
        timeLimit: 60,
        correctSequence: ["red", "blue", "green"],
      },
    },
    {
      pageType: "conditional_verify",
      title: "收集逃脫碎片",
      config: {
        instruction: "收集分散在房間各處的 3 塊鑰匙碎片",
        requiredFragments: 3,
        fragments: ["鑰匙碎片A", "鑰匙碎片B", "鑰匙碎片C"],
      },
    },
    {
      pageType: "choice_verify",
      title: "最終問答",
      config: {
        question: "根據你收集到的所有線索，神秘人的真實身份是？",
        options: ["前任屋主", "未來的你", "AI 管家"],
        correctIndex: 2,
      },
    },
    {
      pageType: "lock",
      title: "最終大門密碼",
      config: {
        instruction: "輸入最終密碼打開逃生門",
        correctCode: "1234",
        codeLength: 4,
      },
    },
    {
      pageType: "text_card",
      title: "成功逃脫！",
      config: {
        title: "恭喜成功逃脫！",
        text: "你在時限內解開了所有謎題，成功逃出了密室。你的智慧和勇氣令人佩服！",
      },
    },
  ],
};

// ============================================================================
// 模組 3：校園知識王爭霸戰（教育學習）
// ============================================================================
const campusQuizBattle: GameModule = {
  id: "campus_quiz_battle",
  name: "校園知識王爭霸戰",
  description: "寓教於樂的知識問答遊戲，結合選擇題、填空題、投票互動，適合教學評量",
  icon: "help-circle",
  estimatedTime: 20,
  maxPlayers: 40,
  difficulty: "easy",
  tags: ["教育", "問答", "投票", "學習", "互動"],
  category: "education",
  scenario: "適合學校課堂、培訓課程、讀書會、知識競賽活動",
  highlights: [
    "選擇題快速測驗知識點",
    "填空題加深理解記憶",
    "投票互動增進班級參與",
    "按鈕分支提供不同學習路徑",
    "大人數同時參與（最多 40 人）",
  ],
  flowDescription: "遊戲說明 → 暖身選擇題 → 進階選擇題 → 填空挑戰 → 趣味投票 → 分支選擇 → 總結回顧",
  coverEmoji: "📚",
  pages: [
    {
      pageType: "text_card",
      title: "知識王開場",
      config: {
        title: "歡迎來到知識王爭霸戰",
        text: "準備好挑戰你的知識極限了嗎？回答問題越多越快，排名越高。全班一起比拼，看誰是真正的知識王！",
      },
    },
    {
      pageType: "choice_verify",
      title: "暖身題：常識",
      config: {
        question: "以下哪個是台灣最高的山？",
        options: ["玉山", "雪山", "南湖大山", "秀姑巒山"],
        correctIndex: 0,
      },
    },
    {
      pageType: "choice_verify",
      title: "進階題：歷史",
      config: {
        question: "台灣在哪一年正式實施全民健保？",
        options: ["1990 年", "1993 年", "1995 年", "1998 年"],
        correctIndex: 2,
      },
    },
    {
      pageType: "text_verify",
      title: "填空挑戰",
      config: {
        question: "台灣的國花是什麼？（請填入中文名稱）",
        correctAnswer: "梅花",
        hint: "冬天盛開的花",
      },
    },
    {
      pageType: "vote",
      title: "趣味投票",
      config: {
        question: "你覺得哪個科目最有趣？",
        options: ["國文", "數學", "自然科學", "社會"],
      },
    },
    {
      pageType: "button",
      title: "學習路徑選擇",
      config: {
        prompt: "你想要挑戰哪個領域的進階題目？",
        buttons: [
          { text: "科學探究", rewardPoints: 5 },
          { text: "歷史人文", rewardPoints: 5 },
          { text: "藝術文化", rewardPoints: 5 },
        ],
      },
    },
    {
      pageType: "text_card",
      title: "知識王結算",
      config: {
        title: "挑戰完成！",
        text: "恭喜你完成了知識王爭霸戰！檢視排行榜，看看你的成績如何。持續學習，下次你一定能更上一層樓！",
      },
    },
  ],
};

// ============================================================================
// 模組 4：野外生存大挑戰（團隊競技）
// ============================================================================
const wildSurvivalChallenge: GameModule = {
  id: "wild_survival_challenge",
  name: "野外生存大挑戰",
  description: "團隊合作的戶外競技遊戲，結合射擊、體感挑戰、GPS 導航和拍照任務",
  icon: "target",
  estimatedTime: 40,
  maxPlayers: 20,
  difficulty: "medium",
  tags: ["團隊", "競技", "射擊", "體感", "戶外"],
  category: "team",
  scenario: "適合漆彈場、露營區、戶外運動中心、企業團建活動",
  highlights: [
    "射擊任務考驗精準度",
    "體感挑戰測試反應力",
    "GPS 導航增加探索樂趣",
    "拍照任務留下珍貴回憶",
    "團隊模式鼓勵合作溝通",
  ],
  flowDescription: "作戰簡報 → 射擊訓練 → GPS 前進基地 → 體感挑戰 → 拍照記錄 → 射擊對戰 → 生存任務 → GPS 撤退 → 勝利宣言",
  coverEmoji: "🏕️",
  pages: [
    {
      pageType: "text_card",
      title: "作戰簡報",
      config: {
        title: "野外生存大挑戰",
        text: "歡迎來到野外生存訓練營！你的團隊將面臨射擊、體能、導航等多重挑戰。團結合作是勝利的關鍵！",
      },
    },
    {
      pageType: "shooting_mission",
      title: "射擊訓練",
      config: {
        requiredHits: 5,
        timeLimit: 60,
        targetScore: 50,
      },
    },
    {
      pageType: "gps_mission",
      title: "前往前進基地",
      config: {
        instruction: "跟著指引前往前進基地集合",
        targetLocation: { lat: 25.035, lng: 121.567 },
        radius: 20,
      },
    },
    {
      pageType: "motion_challenge",
      title: "體感挑戰：快速反應",
      config: {
        challengeType: "shake",
        instruction: "用力搖晃手機 30 次！越快越好",
        targetCount: 30,
        timeLimit: 15,
      },
    },
    {
      pageType: "photo_mission",
      title: "團隊合照",
      config: {
        prompt: "全隊在前進基地前拍一張帥氣的戰鬥合照",
      },
    },
    {
      pageType: "shooting_mission",
      title: "正式對戰",
      config: {
        requiredHits: 15,
        timeLimit: 180,
        targetScore: 150,
      },
    },
    {
      pageType: "choice_verify",
      title: "生存知識測驗",
      config: {
        question: "在野外迷路時，以下哪個做法最正確？",
        options: ["隨意找方向走", "留在原地等待救援", "大聲呼喊求救", "爬到最高處觀察"],
        correctIndex: 1,
      },
    },
    {
      pageType: "gps_mission",
      title: "安全撤退",
      config: {
        instruction: "任務完成！跟著指引回到出發點",
        targetLocation: { lat: 25.033, lng: 121.565 },
        radius: 30,
      },
    },
    {
      pageType: "text_card",
      title: "挑戰完成",
      config: {
        title: "恭喜完成野外生存大挑戰！",
        text: "你的團隊展現了過人的戰鬥力和團隊精神。今天的經歷將成為你們最棒的回憶！",
      },
    },
  ],
};

// ============================================================================
// 模組 5：線上推理偵探社（數位互動）
// ============================================================================
const onlineDetectiveClub: GameModule = {
  id: "online_detective_club",
  name: "線上推理偵探社",
  description: "結合影片線索、對話推理、碎片收集的數位偵探遊戲，無需到場即可遊玩",
  icon: "search",
  estimatedTime: 30,
  maxPlayers: 10,
  difficulty: "hard",
  tags: ["推理", "偵探", "影片", "互動", "線上"],
  category: "digital",
  scenario: "適合線上團建、遠端教學、社團活動、雨天備案",
  highlights: [
    "影片呈現案件現場線索",
    "對話劇情推進偵探故事",
    "碎片收集串聯零散證據",
    "分支選擇影響推理方向",
    "不受地點限制的線上遊戲",
  ],
  flowDescription: "案件影片 → NPC 對話 → 碎片收集 → 嫌疑人問答 → 分支推理 → 文字解密 → 選擇真兇 → 結案報告",
  coverEmoji: "🔍",
  pages: [
    {
      pageType: "video",
      title: "案件現場影片",
      config: {
        title: "離奇失蹤案",
        videoUrl: "",
        description: "觀看案件現場的監視器畫面，注意每個細節",
      },
    },
    {
      pageType: "dialogue",
      title: "警探簡報",
      config: {
        character: { name: "李警探" },
        messages: [
          { text: "偵探，這個案件非常棘手。" },
          { text: "受害者在昨晚 10 點失蹤，目前有三位嫌疑人。" },
          { text: "我需要你收集證據，找出真兇。" },
        ],
      },
    },
    {
      pageType: "conditional_verify",
      title: "收集關鍵證據",
      config: {
        instruction: "在案件資料中找出 3 件關鍵證據",
        requiredFragments: 3,
        fragments: ["監視器截圖", "目擊者證詞", "手機通話紀錄"],
      },
    },
    {
      pageType: "choice_verify",
      title: "審問嫌疑人",
      config: {
        question: "根據目前的證據，以下哪位嫌疑人的說詞有矛盾？",
        options: ["嫌疑人 A：管家", "嫌疑人 B：鄰居", "嫌疑人 C：同事"],
        correctIndex: 1,
      },
    },
    {
      pageType: "button",
      title: "推理方向選擇",
      config: {
        prompt: "你想從哪個方向繼續調查？",
        buttons: [
          { text: "追查手機紀錄", rewardPoints: 10 },
          { text: "重訪案發現場", rewardPoints: 10 },
          { text: "深入審問嫌疑人", rewardPoints: 10 },
        ],
      },
    },
    {
      pageType: "text_verify",
      title: "破解密碼訊息",
      config: {
        question: "受害者手機裡有一則加密訊息：「USVUI」（每個字母前移一位）。解密後是什麼？",
        correctAnswer: "TRUTH",
        hint: "A 的前一個字母是 Z",
      },
    },
    {
      pageType: "choice_verify",
      title: "指認真兇",
      config: {
        question: "綜合所有證據，你認為真兇是誰？",
        options: ["管家（動機：財產糾紛）", "鄰居（動機：長年不和）", "同事（動機：商業競爭）"],
        correctIndex: 2,
      },
    },
    {
      pageType: "text_card",
      title: "結案報告",
      config: {
        title: "案件偵破！",
        text: "恭喜偵探，你成功找出了真兇並破獲了這起離奇案件。你的推理能力令人讚嘆！案件已正式結案。",
      },
    },
  ],
};

// ============================================================================
// 匯出模組列表
// ============================================================================

import { OUTDOOR_MODULES } from "./modules/outdoor";
import { INDOOR_MODULES } from "./modules/indoor";
import { EDUCATION_MODULES } from "./modules/education";
import { TEAM_MODULES } from "./modules/team";
import { DIGITAL_MODULES } from "./modules/digital";

export const GAME_MODULES: GameModule[] = [
  outdoorTreasureHunt,
  escapeRoomCountdown,
  campusQuizBattle,
  wildSurvivalChallenge,
  onlineDetectiveClub,
  ...OUTDOOR_MODULES,
  ...INDOOR_MODULES,
  ...EDUCATION_MODULES,
  ...TEAM_MODULES,
  ...DIGITAL_MODULES,
];

/** 根據模組 ID 取得模組 */
export function getModuleById(id: string): GameModule | undefined {
  return GAME_MODULES.find((m) => m.id === id);
}

/** 取得所有模組 */
export function getAllModules(): GameModule[] {
  return GAME_MODULES;
}

/** 根據分類篩選模組 */
export function getModulesByCategory(category: ModuleCategory): GameModule[] {
  return GAME_MODULES.filter((m) => m.category === category);
}
