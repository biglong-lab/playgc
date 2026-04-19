// 戶外探索系新模組（廟宇文化、夜市美食、都市定向）
import type { GameModule } from "../game-modules";

// ============================================================================
// 廟宇文化巡禮
// ============================================================================
const templeCultureTour: GameModule = {
  id: "temple_culture_tour",
  name: "廟宇文化巡禮",
  description: "走訪在地廟宇，認識神明故事、建築工藝與民俗信仰的戶外導覽遊戲",
  icon: "landmark",
  estimatedTime: 50,
  maxPlayers: 15,
  difficulty: "easy",
  tags: ["戶外", "文化", "廟宇", "GPS", "拍照"],
  category: "outdoor",
  scenario: "適合廟宇導覽、宗教文化體驗、銀髮族活動、地方創生行程",
  highlights: [
    "GPS 導航帶你走訪多間廟宇",
    "拍照任務記錄屋頂剪黏與龍柱藝術",
    "神明故事問答加深文化理解",
    "QR Code 確認抵達，避免走過頭",
    "最愛廟宇投票活化地方記憶",
  ],
  flowDescription: "開場介紹 → 第一間廟 GPS 導航 → 拍屋頂剪黏 → QR 打卡 → 神明問答 → 第二間廟 → 拍龍柱 → 最愛投票 → 完成",
  coverEmoji: "⛩️",
  pages: [
    {
      pageType: "text_card",
      title: "巡禮召集",
      config: {
        title: "歡迎參加廟宇文化巡禮",
        text: "本次旅程將帶你走訪在地廟宇，感受台灣民俗之美。請跟著指引完成每項任務，用鏡頭和心靈記錄這段文化之旅。",
      },
    },
    {
      pageType: "gps_mission",
      title: "前往第一站：主祀廟",
      config: {
        instruction: "依地圖指引前往主祀廟門口",
        targetLocation: { lat: 25.035, lng: 121.564 },
        radius: 30,
      },
    },
    {
      pageType: "photo_mission",
      title: "屋頂剪黏藝術",
      config: {
        prompt: "請仰望屋頂，拍一張剪黏或交趾陶的特寫",
      },
    },
    {
      pageType: "qr_scan",
      title: "廟前 QR 打卡",
      config: {
        instruction: "掃描廟門口掛牌上的 QR Code 完成打卡",
        expectedCode: "TEMPLE-001",
      },
    },
    {
      pageType: "choice_verify",
      title: "神明小知識",
      config: {
        question: "以下哪位神明常被稱為「媽祖」？",
        options: [
          { text: "天上聖母", correct: true },
          { text: "玄天上帝", correct: false },
          { text: "關聖帝君", correct: false },
          { text: "王爺", correct: false },
        ],
      },
    },
    {
      pageType: "gps_mission",
      title: "前往第二站：陪祀廟",
      config: {
        instruction: "繼續步行前往下一間廟宇",
        targetLocation: { lat: 25.036, lng: 121.566 },
        radius: 30,
      },
    },
    {
      pageType: "photo_mission",
      title: "龍柱工藝",
      config: {
        prompt: "請拍攝一張龍柱雕刻，留下石匠的工藝紀錄",
      },
    },
    {
      pageType: "vote",
      title: "最愛廟宇投票",
      config: {
        question: "走完這趟行程，你最印象深刻的是哪一間廟？",
        options: ["第一站主祀廟", "第二站陪祀廟", "都非常精彩"],
      },
    },
    {
      pageType: "text_card",
      title: "巡禮圓滿",
      config: {
        title: "感謝你參與廟宇文化巡禮",
        text: "你用雙腳丈量了在地信仰，用相機留下了工藝之美。願這份文化記憶持續伴隨你的旅程。",
      },
    },
  ],
};

// ============================================================================
// 夜市美食偵探
// ============================================================================
const nightMarketFoodDetective: GameModule = {
  id: "night_market_food_detective",
  name: "夜市美食偵探",
  description: "走訪夜市攤位，搜集美食線索、完成打卡與知識問答的在地美食探險",
  icon: "utensils",
  estimatedTime: 60,
  maxPlayers: 12,
  difficulty: "easy",
  tags: ["戶外", "美食", "夜市", "打卡"],
  category: "outdoor",
  scenario: "適合地方觀光局、觀光夜市推廣、大學迎新、家庭同樂",
  highlights: [
    "GPS 導航帶你穿梭夜市每條巷弄",
    "QR Code 打卡各家店家",
    "選擇分支可自訂品嘗路線",
    "美食知識問答增加樂趣",
    "最愛美食投票，統計團隊口味",
  ],
  flowDescription: "任務簡報 → GPS 到夜市 → 拍招牌 → 店家 QR 打卡 → 美食問答 → 選下一站 → GPS 下一攤 → 拍美食 → 最愛投票 → 完成",
  coverEmoji: "🍜",
  pages: [
    {
      pageType: "text_card",
      title: "偵探任務簡報",
      config: {
        title: "夜市美食偵探登場",
        text: "今晚的任務，是穿梭夜市、找出這裡最值得一試的三樣美食。跟著線索走，別忘了邊吃邊記錄！",
      },
    },
    {
      pageType: "gps_mission",
      title: "前往夜市入口",
      config: {
        instruction: "依地圖指引抵達夜市牌樓入口",
        targetLocation: { lat: 25.041, lng: 121.543 },
        radius: 40,
      },
    },
    {
      pageType: "photo_mission",
      title: "招牌取景",
      config: {
        prompt: "在夜市入口拍下一張能辨認夜市名稱的招牌照",
      },
    },
    {
      pageType: "qr_scan",
      title: "第一家店打卡",
      config: {
        instruction: "找到第一家指定店家，掃描桌上的 QR Code",
        expectedCode: "NIGHTMKT-SHOP-01",
      },
    },
    {
      pageType: "choice_verify",
      title: "夜市美食小知識",
      config: {
        question: "以下哪一道是台灣夜市常見的經典小吃？",
        options: [
          { text: "蚵仔煎", correct: true },
          { text: "披薩", correct: false },
          { text: "可頌", correct: false },
          { text: "壽司卷", correct: false },
        ],
      },
    },
    {
      pageType: "button",
      title: "選擇下一站類型",
      config: {
        prompt: "你想朝哪個方向繼續探索？",
        buttons: [
          { text: "鹹食小吃", rewardPoints: 5 },
          { text: "甜點冰品", rewardPoints: 5 },
          { text: "特色飲料", rewardPoints: 5 },
        ],
      },
    },
    {
      pageType: "gps_mission",
      title: "前往下一攤",
      config: {
        instruction: "依你的選擇前往相對應的攤位區",
        targetLocation: { lat: 25.042, lng: 121.544 },
        radius: 30,
      },
    },
    {
      pageType: "photo_mission",
      title: "美食特寫",
      config: {
        prompt: "拍下你買到的美食特寫，讓它看起來最誘人！",
      },
    },
    {
      pageType: "vote",
      title: "最愛美食投票",
      config: {
        question: "整晚探險下來，你最推薦哪一樣？",
        options: ["鹹食小吃", "甜點冰品", "特色飲料", "都好好吃"],
      },
    },
    {
      pageType: "text_card",
      title: "偵探結案",
      config: {
        title: "夜市偵探任務完成",
        text: "恭喜你走遍夜市、找到屬於你的美食清單。願這些滋味成為這次行程最美的回憶！",
      },
    },
  ],
};

// ============================================================================
// 都市定向越野賽
// ============================================================================
const urbanOrienteering: GameModule = {
  id: "urban_orienteering",
  name: "都市定向越野賽",
  description: "結合 GPS、打卡與體感的都市競速遊戲，比誰先跑完所有站點",
  icon: "flag",
  estimatedTime: 45,
  maxPlayers: 30,
  difficulty: "medium",
  tags: ["戶外", "競速", "定向", "體感"],
  category: "outdoor",
  scenario: "適合社團活動、企業團建、運動週末、校園新生訓練",
  highlights: [
    "多站點 GPS 定向挑戰",
    "QR Code 打卡防作弊",
    "體感挑戰加入趣味節點",
    "拍照任務留下團隊記憶",
    "競速排名刺激熱血",
  ],
  flowDescription: "任務簡報 → GPS A 站 → QR 打卡 → 體感熱身 → GPS B 站 → 拍地標 → GPS C 站 → 終點 QR → 完成",
  coverEmoji: "🚩",
  pages: [
    {
      pageType: "text_card",
      title: "越野簡報",
      config: {
        title: "都市定向越野賽開跑",
        text: "本次比賽共 3 個站點。每抵達一站請立刻完成任務，用最短時間回到終點者勝出！",
      },
    },
    {
      pageType: "gps_mission",
      title: "前進第一站 A",
      config: {
        instruction: "依指引跑向 A 站",
        targetLocation: { lat: 25.034, lng: 121.564 },
        radius: 25,
      },
    },
    {
      pageType: "qr_scan",
      title: "A 站打卡",
      config: {
        instruction: "掃描 A 站告示牌上的 QR Code",
        expectedCode: "CHECKPOINT-A",
      },
    },
    {
      pageType: "motion_challenge",
      title: "熱身：快速搖動",
      config: {
        challengeType: "shake",
        instruction: "原地搖動手機 20 次熱身！",
        targetCount: 20,
        timeLimit: 15,
      },
    },
    {
      pageType: "gps_mission",
      title: "前進第二站 B",
      config: {
        instruction: "跑向 B 站，路上注意安全",
        targetLocation: { lat: 25.036, lng: 121.566 },
        radius: 25,
      },
    },
    {
      pageType: "photo_mission",
      title: "B 站地標照",
      config: {
        prompt: "在 B 站地標前拍一張帥氣的到此一遊照",
      },
    },
    {
      pageType: "gps_mission",
      title: "前進終點 C",
      config: {
        instruction: "衝刺到終點 C 站",
        targetLocation: { lat: 25.038, lng: 121.568 },
        radius: 25,
      },
    },
    {
      pageType: "qr_scan",
      title: "終點打卡",
      config: {
        instruction: "掃描終點處的 QR Code 完成比賽",
        expectedCode: "CHECKPOINT-FINISH",
      },
    },
    {
      pageType: "text_card",
      title: "完賽",
      config: {
        title: "恭喜完成都市定向越野",
        text: "你用雙腳征服了整條路線，請查看排行榜看看自己的名次！",
      },
    },
  ],
};

export const OUTDOOR_MODULES: GameModule[] = [
  templeCultureTour,
  nightMarketFoodDetective,
  urbanOrienteering,
];
