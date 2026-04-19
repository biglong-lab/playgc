// 團隊競技系新模組（企業年會、戶外求生極限）
import type { GameModule } from "../game-modules";

// ============================================================================
// 企業年會挑戰賽
// ============================================================================
const corporateAnnualChallenge: GameModule = {
  id: "corporate_annual_challenge",
  name: "企業年會挑戰賽",
  description: "結合年度回顧影片、投票、抽獎體感與射擊關卡的企業年會大型互動遊戲",
  icon: "trophy",
  estimatedTime: 40,
  maxPlayers: 50,
  difficulty: "easy",
  tags: ["團隊", "企業", "年會", "抽獎"],
  category: "team",
  scenario: "適合企業年會、部門尾牙、新春團拜、團隊表揚晚會",
  highlights: [
    "年度回顧影片開場溫馨感人",
    "最佳員工投票互動參與高",
    "搖動抽獎讓氣氛熱起來",
    "射擊幸運數字挑戰運氣",
    "領獎合影為活動留下記憶",
  ],
  flowDescription: "年度回顧影片 → 最佳員工投票 → 搖動抽獎 → 射擊幸運數字 → 領獎 QR → 選獎項 → 領獎合影 → 祝福",
  coverEmoji: "🏆",
  pages: [
    {
      pageType: "video",
      title: "年度回顧",
      config: {
        title: "這一年我們一起走過",
        videoUrl: "",
        description: "讓我們一起回顧過去一年的點點滴滴",
      },
    },
    {
      pageType: "vote",
      title: "最佳員工投票",
      config: {
        question: "今年最讓你感謝的同事是？",
        options: ["工程團隊", "業務團隊", "客服團隊", "行政後勤"],
      },
    },
    {
      pageType: "motion_challenge",
      title: "搖動抽獎",
      config: {
        challengeType: "shake",
        instruction: "使勁搖動手機 25 次啟動抽獎！",
        targetCount: 25,
        timeLimit: 15,
      },
    },
    {
      pageType: "shooting_mission",
      title: "射擊幸運數字",
      config: {
        requiredHits: 3,
        timeLimit: 30,
        targetScore: 30,
      },
    },
    {
      pageType: "qr_scan",
      title: "領獎區報到",
      config: {
        instruction: "掃描領獎區桌上的 QR Code 報到",
        expectedCode: "AWARD-ZONE-01",
      },
    },
    {
      pageType: "button",
      title: "選擇獎項",
      config: {
        prompt: "你想挑戰哪種獎項？",
        buttons: [
          { text: "實用家電組", rewardPoints: 15 },
          { text: "美食禮盒組", rewardPoints: 15 },
          { text: "旅遊券禮券", rewardPoints: 15 },
        ],
      },
    },
    {
      pageType: "photo_mission",
      title: "領獎合影",
      config: {
        prompt: "請和你的主管或老闆拍一張領獎合影",
      },
    },
    {
      pageType: "text_card",
      title: "年會圓滿",
      config: {
        title: "感謝今年大家的努力",
        text: "新的一年，讓我們繼續攜手努力。祝福每位同仁身體健康、家庭美滿！",
      },
    },
  ],
};

// ============================================================================
// 戶外求生極限賽
// ============================================================================
const outdoorSurvivalExtreme: GameModule = {
  id: "outdoor_survival_extreme",
  name: "戶外求生極限賽",
  description: "結合熱身、射擊、GPS、物資收集的戶外團隊極限挑戰",
  icon: "tent",
  estimatedTime: 55,
  maxPlayers: 20,
  difficulty: "hard",
  tags: ["團隊", "戶外", "求生", "競技"],
  category: "team",
  scenario: "適合漆彈場、露營區、體能訓練、企業領導培訓",
  highlights: [
    "體感熱身啟動團隊默契",
    "GPS 帶領各組前進基地",
    "射擊訓練考驗精準度",
    "收集四件求生物資通關",
    "求生知識題目強化常識",
  ],
  flowDescription: "作戰簡報 → 體感熱身 → GPS 前進基地 → 射擊訓練 → 收集求生物資 → 求生知識 → GPS 撤退 → 凱旋合照 → 任務達成",
  coverEmoji: "🏔️",
  pages: [
    {
      pageType: "text_card",
      title: "作戰簡報",
      config: {
        title: "戶外求生極限賽",
        text: "歡迎來到極限挑戰！今天你的隊伍將面對多重考驗，請保持冷靜、互相支援，爭取最終勝利。",
      },
    },
    {
      pageType: "motion_challenge",
      title: "出發前熱身",
      config: {
        challengeType: "shake",
        instruction: "原地跳動並搖動手機 30 次熱身！",
        targetCount: 30,
        timeLimit: 20,
      },
    },
    {
      pageType: "gps_mission",
      title: "前進基地",
      config: {
        instruction: "跑向前進基地集合",
        targetLocation: { lat: 25.040, lng: 121.570 },
        radius: 25,
      },
    },
    {
      pageType: "shooting_mission",
      title: "射擊訓練",
      config: {
        requiredHits: 8,
        timeLimit: 90,
        targetScore: 80,
      },
    },
    {
      pageType: "conditional_verify",
      title: "收集求生物資",
      config: {
        instruction: "在場地各處收集 4 件關鍵求生物資",
        demoMode: true,
        verificationMode: "all_collected",
        fragmentType: "custom",
        fragmentCount: 4,
        fragments: [
          { id: "s1", label: "淨水瓶", value: "1", order: 1 },
          { id: "s2", label: "火種盒", value: "2", order: 2 },
          { id: "s3", label: "繩索", value: "3", order: 3 },
          { id: "s4", label: "求生刀", value: "4", order: 4 },
        ],
      },
    },
    {
      pageType: "choice_verify",
      title: "求生知識試煉",
      config: {
        question: "在野外取得飲用水最安全的做法是？",
        options: [
          { text: "直接喝溪水", correct: false },
          { text: "以濾網過濾即喝", correct: false },
          { text: "煮沸後再飲用", correct: true },
          { text: "用衣服過濾就好", correct: false },
        ],
      },
    },
    {
      pageType: "gps_mission",
      title: "安全撤退",
      config: {
        instruction: "完成任務！跟著指引撤退到出發點",
        targetLocation: { lat: 25.033, lng: 121.565 },
        radius: 30,
      },
    },
    {
      pageType: "photo_mission",
      title: "凱旋合照",
      config: {
        prompt: "全隊在出發點拍一張凱旋合照",
      },
    },
    {
      pageType: "text_card",
      title: "任務達成",
      config: {
        title: "恭喜完成戶外求生極限賽",
        text: "你的隊伍展現了過人的體能、智慧與默契。這段經歷將是你們最難忘的回憶！",
      },
    },
  ],
};

export const TEAM_MODULES: GameModule[] = [
  corporateAnnualChallenge,
  outdoorSurvivalExtreme,
];
