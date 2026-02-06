// 遊戲模板定義 - 用於遊戲建立精靈
// 前後端共用的模板定義

export interface TemplatePageConfig {
  pageType: string;
  title: string;
  config: Record<string, unknown>;
}

export interface GameTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  estimatedTime: number | null;  // 分鐘，null 表示不適用
  maxPlayers: number;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  pages: TemplatePageConfig[];
}

export const GAME_TEMPLATES: GameTemplate[] = [
  {
    id: "city_treasure",
    name: "城市尋寶",
    description: "戶外探索遊戲，結合 GPS 導航和實地任務",
    icon: "map",
    estimatedTime: 30,
    maxPlayers: 6,
    difficulty: "medium",
    tags: ["戶外", "探索", "拍照"],
    pages: [
      {
        pageType: "text_card",
        title: "任務開始",
        config: {
          title: "歡迎參加城市尋寶",
          text: "準備好開始一場城市探險了嗎？跟著指引，完成所有任務！",
        },
      },
      {
        pageType: "gps_mission",
        title: "前往第一站",
        config: {
          instruction: "前往指定地點",
          targetLocation: { lat: 25.033, lng: 121.565 },
          radius: 30,
        },
      },
      {
        pageType: "photo_mission",
        title: "拍照記錄",
        config: {
          prompt: "拍攝指定地點的照片",
        },
      },
      {
        pageType: "qr_scan",
        title: "掃碼確認",
        config: {
          instruction: "掃描現場的 QR Code 確認完成",
          expectedCode: "CHECKPOINT-001",
        },
      },
      {
        pageType: "text_card",
        title: "任務完成",
        config: {
          title: "恭喜完成任務！",
          text: "你已經成功完成所有挑戰，真是太棒了！",
        },
      },
    ],
  },
  {
    id: "escape_room",
    name: "密室解謎",
    description: "室內解謎遊戲，適合團隊合作挑戰",
    icon: "puzzle",
    estimatedTime: 20,
    maxPlayers: 6,
    difficulty: "medium",
    tags: ["室內", "解謎", "團隊"],
    pages: [
      {
        pageType: "text_card",
        title: "故事開場",
        config: {
          title: "歡迎來到密室",
          text: "你被困在這個神秘的房間裡，必須在時間內找到出路！",
        },
      },
      {
        pageType: "text_verify",
        title: "文字謎題",
        config: {
          question: "牆上寫著一段謎語，答案是什麼？",
          correctAnswer: "答案",
          hint: "仔細觀察周圍的線索",
        },
      },
      {
        pageType: "lock",
        title: "密碼鎖",
        config: {
          instruction: "輸入正確的密碼打開保險箱",
          correctCode: "1234",
          codeLength: 4,
        },
      },
      {
        pageType: "choice_verify",
        title: "選擇題",
        config: {
          question: "根據線索，哪個是正確答案？",
          options: ["選項 A", "選項 B", "選項 C"],
          correctIndex: 1,
        },
      },
      {
        pageType: "text_card",
        title: "成功逃脫",
        config: {
          title: "恭喜逃脫成功！",
          text: "你成功解開所有謎題，逃出了密室！",
        },
      },
    ],
  },
  {
    id: "quiz_game",
    name: "知識問答",
    description: "教育導向遊戲，測試知識和學習成果",
    icon: "help-circle",
    estimatedTime: 15,
    maxPlayers: 30,
    difficulty: "easy",
    tags: ["教育", "問答", "學習"],
    pages: [
      {
        pageType: "text_card",
        title: "遊戲說明",
        config: {
          title: "知識問答大挑戰",
          text: "回答以下問題，看看你能答對幾題！",
        },
      },
      {
        pageType: "choice_verify",
        title: "第一題",
        config: {
          question: "這是第一個問題？",
          options: ["選項 A", "選項 B", "選項 C", "選項 D"],
          correctIndex: 0,
        },
      },
      {
        pageType: "choice_verify",
        title: "第二題",
        config: {
          question: "這是第二個問題？",
          options: ["選項 A", "選項 B", "選項 C"],
          correctIndex: 1,
        },
      },
      {
        pageType: "choice_verify",
        title: "第三題",
        config: {
          question: "這是第三個問題？",
          options: ["選項 A", "選項 B", "選項 C"],
          correctIndex: 2,
        },
      },
      {
        pageType: "text_verify",
        title: "填空題",
        config: {
          question: "請填入正確的答案",
          correctAnswer: "正確答案",
        },
      },
      {
        pageType: "text_card",
        title: "測驗結束",
        config: {
          title: "測驗完成！",
          text: "感謝你的參與，希望你學到了新知識！",
        },
      },
    ],
  },
  {
    id: "shooting_challenge",
    name: "射擊挑戰",
    description: "競技對戰遊戲，適合搭配硬體射擊設備",
    icon: "target",
    estimatedTime: 15,
    maxPlayers: 4,
    difficulty: "medium",
    tags: ["競技", "射擊", "硬體"],
    pages: [
      {
        pageType: "text_card",
        title: "作戰指令",
        config: {
          title: "射擊任務開始",
          text: "準備好你的武器，消滅所有目標！",
        },
      },
      {
        pageType: "shooting_mission",
        title: "射擊任務 1",
        config: {
          requiredHits: 5,
          timeLimit: 60,
          targetScore: 50,
        },
      },
      {
        pageType: "shooting_mission",
        title: "射擊任務 2",
        config: {
          requiredHits: 10,
          timeLimit: 120,
          targetScore: 100,
        },
      },
      {
        pageType: "text_card",
        title: "任務完成",
        config: {
          title: "任務完成！",
          text: "幹得好，目標已全數消滅！",
        },
      },
    ],
  },
  {
    id: "team_competition",
    name: "團隊競賽",
    description: "多人合作遊戲，適合團隊活動和企業團建",
    icon: "users",
    estimatedTime: 30,
    maxPlayers: 20,
    difficulty: "easy",
    tags: ["團隊", "合作", "競賽"],
    pages: [
      {
        pageType: "text_card",
        title: "遊戲說明",
        config: {
          title: "團隊競賽開始",
          text: "和你的隊友一起合作，完成挑戰！",
        },
      },
      {
        pageType: "vote",
        title: "隊長投票",
        config: {
          question: "請投票選出你們的隊長",
          options: ["隊員 1", "隊員 2", "隊員 3"],
        },
      },
      {
        pageType: "photo_mission",
        title: "團隊任務",
        config: {
          prompt: "拍一張全隊的創意合照",
        },
      },
      {
        pageType: "text_verify",
        title: "團隊問答",
        config: {
          question: "請回答團隊問題",
          correctAnswer: "團隊答案",
        },
      },
      {
        pageType: "text_card",
        title: "競賽結束",
        config: {
          title: "競賽結束！",
          text: "恭喜完成所有團隊挑戰！",
        },
      },
    ],
  },
  {
    id: "blank",
    name: "空白遊戲",
    description: "從零開始，完全自訂你的遊戲",
    icon: "plus",
    estimatedTime: null,
    maxPlayers: 6,
    difficulty: "medium",
    tags: ["自訂"],
    pages: [],
  },
];

// 根據模板 ID 取得模板
export function getTemplateById(id: string): GameTemplate | undefined {
  return GAME_TEMPLATES.find((t) => t.id === id);
}
