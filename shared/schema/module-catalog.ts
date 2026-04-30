// 🪄 模組能力目錄（給 AI 遊戲產生器看的「平台說明書」）
//
// 用途：當 admin 給一段腳本（自然語言），AI 解析後挑合適的 page type
// 組裝。這個 catalog 告訴 AI「平台有哪些模組可用、各自做什麼」。
//
// 為何不用 page-type-info.ts：那個是給 UI 顯示用（icon、label、color），
// 這個是給 AI prompt 用（purpose、aiSuitableFor、required/optional config）

/** 適合的場景關鍵字（讓 AI 比對腳本意圖） */
export type ModuleScenario =
  | "intro"           // 開場 / 劇情導入
  | "transition"      // 過場 / 轉場
  | "story"           // 敘事
  | "navigation"      // 導航 / 移動
  | "exploration"     // 探索 / 巡禮
  | "sightseeing"     // 觀光 / 拍照打卡
  | "recreate"        // 重現 / 比對
  | "find_match"      // 找尋對應
  | "knowledge_check" // 知識問答
  | "quiz"            // 測驗
  | "challenge"       // 挑戰 / 動作
  | "decision"        // 抉擇
  | "team_play"       // 團隊互動
  | "branching"       // 分支劇情
  | "ending";         // 結局 / 收尾

export interface ModuleSpec {
  pageType: string;
  /** 中文用途描述（給 admin / AI 看） */
  purpose: string[];
  /** required config 欄位（AI 必須提供） */
  required: string[];
  /** optional config 欄位 */
  optional: string[];
  /** AI 應在哪些情境用此模組 */
  aiSuitableFor: ModuleScenario[];
  /** 預估玩家停留時間（秒） */
  estimatedSeconds: number;
  /** 是否需要硬體 / GPS / 相機 */
  requirements?: ("camera" | "gps" | "microphone" | "device" | "qr")[];
}

/**
 * 平台所有可用模組（23 種）
 *
 * AI 在生成遊戲時，從這個清單挑合適的 pageType + 填入合理的 config
 */
export const MODULE_CATALOG: ModuleSpec[] = [
  // === 劇情類 ===
  {
    pageType: "text_card",
    purpose: ["劇情導入", "提示", "獎勵展示", "過場"],
    required: ["title", "content"],
    optional: ["backgroundImage", "audio", "locationSettings"],
    aiSuitableFor: ["intro", "transition", "story", "ending"],
    estimatedSeconds: 30,
  },
  {
    pageType: "dialogue",
    purpose: ["NPC 對話", "角色互動"],
    required: ["lines"],
    optional: ["characters", "backgroundImage", "audio"],
    aiSuitableFor: ["story", "intro"],
    estimatedSeconds: 60,
  },
  {
    pageType: "video",
    purpose: ["影片播放", "教學影片"],
    required: ["videoUrl"],
    optional: ["title", "description", "skipAfterSeconds"],
    aiSuitableFor: ["intro", "story"],
    estimatedSeconds: 90,
  },

  // === 互動 / 答題類 ===
  {
    pageType: "button",
    purpose: ["按鈕選擇", "簡單導航"],
    required: ["buttons"],
    optional: ["title", "instruction"],
    aiSuitableFor: ["decision", "navigation"],
    estimatedSeconds: 15,
  },
  {
    pageType: "text_verify",
    purpose: ["填空題", "問答"],
    required: ["question", "answers"],
    optional: ["aiScoring", "aiContext", "hints"],
    aiSuitableFor: ["knowledge_check", "quiz"],
    estimatedSeconds: 60,
  },
  {
    pageType: "choice_verify",
    purpose: ["選擇題"],
    required: ["question", "options", "correctAnswer"],
    optional: ["explanation"],
    aiSuitableFor: ["knowledge_check", "quiz"],
    estimatedSeconds: 30,
  },
  {
    pageType: "conditional_verify",
    purpose: ["碎片收集", "條件解鎖"],
    required: ["fragments"],
    optional: ["targetCode", "verificationMode", "conditions"],
    aiSuitableFor: ["challenge", "exploration"],
    estimatedSeconds: 120,
  },
  {
    pageType: "vote",
    purpose: ["團體投票", "民主決策"],
    required: ["question", "options"],
    optional: ["minVotes"],
    aiSuitableFor: ["team_play", "decision"],
    estimatedSeconds: 60,
  },

  // === 拍照類 ===
  {
    pageType: "photo_mission",
    purpose: ["通用拍照任務"],
    required: ["instruction"],
    optional: ["aiVerify", "referenceKeywords", "rewardItems"],
    aiSuitableFor: ["sightseeing", "exploration"],
    estimatedSeconds: 90,
    requirements: ["camera"],
  },
  {
    pageType: "photo_spot",
    purpose: ["定點拍照", "古蹟打卡", "尋寶"],
    required: ["instruction"],
    optional: ["aiVerify", "referenceKeywords", "spotConfig"],
    aiSuitableFor: ["sightseeing", "exploration"],
    estimatedSeconds: 90,
    requirements: ["camera"],
  },
  {
    pageType: "photo_compare",
    purpose: ["照片比對", "重現場景"],
    required: ["referenceImageUrl"],
    optional: ["referenceDescription", "compareMode", "similarityThreshold"],
    aiSuitableFor: ["recreate", "find_match"],
    estimatedSeconds: 90,
    requirements: ["camera"],
  },
  {
    pageType: "photo_ocr",
    purpose: ["招牌辨識", "文字 OCR"],
    required: ["targetText"],
    optional: ["maxRetries", "fuzzyThreshold"],
    aiSuitableFor: ["sightseeing", "knowledge_check"],
    estimatedSeconds: 60,
    requirements: ["camera"],
  },
  {
    pageType: "photo_team",
    purpose: ["團體合照"],
    required: ["teamConfig"],
    optional: ["enableComposite", "minMembers", "maxMembers"],
    aiSuitableFor: ["team_play", "ending"],
    estimatedSeconds: 180,
    requirements: ["camera"],
  },
  {
    pageType: "photo_before_after",
    purpose: ["前後對比拍照", "變化記錄"],
    required: ["instruction"],
    optional: ["aiVerify"],
    aiSuitableFor: ["recreate", "challenge"],
    estimatedSeconds: 120,
    requirements: ["camera"],
  },
  {
    pageType: "photo_burst",
    purpose: ["連拍挑戰"],
    required: ["instruction", "burstCount"],
    optional: [],
    aiSuitableFor: ["challenge"],
    estimatedSeconds: 60,
    requirements: ["camera"],
  },
  {
    pageType: "photo_ar",
    purpose: ["AR 貼紙合影"],
    required: ["arSticker"],
    optional: ["instruction"],
    aiSuitableFor: ["sightseeing", "ending"],
    estimatedSeconds: 90,
    requirements: ["camera"],
  },

  // === 移動 / 定位類 ===
  {
    pageType: "gps_mission",
    purpose: ["GPS 導航", "前往特定地點"],
    required: ["latitude", "longitude", "radius"],
    optional: ["locationName", "instructions"],
    aiSuitableFor: ["navigation", "exploration"],
    estimatedSeconds: 300,
    requirements: ["gps"],
  },
  {
    pageType: "qr_scan",
    purpose: ["QR Code 掃描"],
    required: ["expectedCode"],
    optional: ["hints"],
    aiSuitableFor: ["navigation", "exploration"],
    estimatedSeconds: 60,
    requirements: ["camera", "qr"],
  },

  // === 動作 / 挑戰類 ===
  {
    pageType: "shooting_mission",
    purpose: ["射擊靶機", "戰術挑戰"],
    required: ["requiredHits", "timeLimit"],
    optional: ["targetScore", "deviceId", "allowSimulation"],
    aiSuitableFor: ["challenge", "team_play"],
    estimatedSeconds: 90,
    requirements: ["device"],
  },
  {
    pageType: "motion_challenge",
    purpose: ["體感挑戰", "動作辨識"],
    required: ["motion"],
    optional: ["timeLimit", "requiredCount"],
    aiSuitableFor: ["challenge"],
    estimatedSeconds: 90,
    requirements: ["camera"],
  },
  {
    pageType: "time_bomb",
    purpose: ["時間限制挑戰"],
    required: ["timeLimit"],
    optional: ["successAction", "failAction"],
    aiSuitableFor: ["challenge"],
    estimatedSeconds: 60,
  },
  {
    pageType: "lock",
    purpose: ["密碼鎖", "解謎"],
    required: ["correctCode"],
    optional: ["hint", "maxAttempts"],
    aiSuitableFor: ["challenge", "exploration"],
    estimatedSeconds: 90,
  },

  // === 流程類 ===
  {
    pageType: "flow_router",
    purpose: ["流程分支", "條件路由"],
    required: ["routes"],
    optional: ["defaultRoute"],
    aiSuitableFor: ["branching", "decision"],
    estimatedSeconds: 0,
  },
];

/**
 * 把 catalog 格式化成 AI prompt 用的字串
 */
export function formatModuleCatalog(): string {
  return MODULE_CATALOG.map((m) => {
    const purposes = m.purpose.join(" / ");
    const scenarios = m.aiSuitableFor.join(", ");
    const reqs = m.required.length > 0 ? `必填: ${m.required.join(", ")}` : "";
    const opts = m.optional.length > 0 ? `選填: ${m.optional.join(", ")}` : "";
    const hardware = m.requirements && m.requirements.length > 0 ? `硬體: ${m.requirements.join(", ")}` : "";
    return `- ${m.pageType} (${m.estimatedSeconds}s): ${purposes}\n  情境: ${scenarios}\n  ${[reqs, opts, hardware].filter(Boolean).join(" | ")}`;
  }).join("\n");
}

export const SUPPORTED_PAGE_TYPES = MODULE_CATALOG.map((m) => m.pageType);
