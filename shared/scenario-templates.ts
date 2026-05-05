// 🎯 ScenarioTemplate — 情境模板（W6 D1）
//
// 設計依據：docs/changes/2026-05-02-multiplayer-component-platform.md B2
//
// 與 GAME_TEMPLATES（shared/schema/game-templates.ts）的差異：
//   - GAME_TEMPLATES 是單一 game session 的「玩家闖關流程」（solo / multi 元件）
//   - SCENARIO_TEMPLATES 是「情境包」，可能含多個 host session + game session
//     用途是讓使用者一眼看到「這個場景要怎麼組合」，而不是建立單一遊戲
//
// 12 情境（5 大市場）：
//   公部門：street-walk / district-checkin
//   私部門：corporate-training / company-trip
//   活動：carnival-stage / icebreaker / awards-ceremony
//   空間：venue-storyline / scenic-spot
//   交誼：wedding / birthday / reunion

import type { PlayerMode } from "./multiplayer-component-types";

/** 模板中的單一元件 */
export interface ScenarioComponent {
  /** pageType（與 GAME_TEMPLATES.pages 對應）*/
  pageType: string;
  /** 顯示用名稱 */
  label: string;
  /** 元件作用 */
  role: string;
  /** 軸線 */
  axis: PlayerMode | "shared";
  /** demo 連結（ShowcaseHub demoMode）*/
  demoMode?: string;
}

/** 情境分類 */
export type ScenarioCategory =
  | "public"      // 公部門（街區、景點、空間活化）
  | "corporate"   // 私部門（企業內訓、員工旅遊）
  | "event"       // 活動（園遊會、破冰、結業典禮）
  | "venue"       // 空間（特定場域故事）
  | "social";     // 交誼（婚禮、生日、聚會）

export interface ScenarioTemplate {
  id: string;
  name: string;
  /** 1 句話描述 */
  tagline: string;
  /** 詳細描述 */
  description: string;
  /** 適用情境（具體舉例）*/
  useCases: string[];
  category: ScenarioCategory;
  /** Lucide icon name */
  icon: string;
  /** 漸層底色 */
  gradient: string;
  /** 預估玩家數 */
  estimatedPlayers: string;
  /** 預估時長 */
  estimatedDuration: string;
  /** 含哪些元件 */
  components: ScenarioComponent[];
  /** 商業價值描述 */
  valueProposition: string;
  /** 完成度狀態 */
  status: "live" | "preview" | "planned";
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  // ════════════════════════════════════════════
  // 交誼類（婚禮、生日、聚會）
  // ════════════════════════════════════════════
  {
    id: "wedding",
    name: "婚禮派對情境包",
    tagline: "拍立得紀念牆 + 數位簽名簿 + 情緒池",
    description:
      "婚禮現場的數位互動完整方案。來賓掃 QR 進入後可以留下祝福、貼拍立得、按 emoji 為新人應援。\n大螢幕同步呈現所有來賓的祝福，賓客離場後仍是新人珍藏的紀念。",
    useCases: ["婚宴主桌投影", "二進場前儀式", "戶外證婚台", "迎賓區牆面"],
    category: "social",
    icon: "Heart",
    gradient: "from-rose-500/20 to-pink-500/20",
    estimatedPlayers: "30-300 人",
    estimatedDuration: "2-4 小時",
    components: [
      {
        pageType: "host_polaroid_collage",
        label: "拍立得紀念牆",
        role: "大螢幕主視覺、來賓貼祝福",
        axis: "host",
        demoMode: "polaroid-host",
      },
      {
        pageType: "host_guestbook_digital",
        label: "數位簽名簿",
        role: "保留電子留言、手寫感字體",
        axis: "host",
        demoMode: "guestbook-host",
      },
      {
        pageType: "shared_board",
        label: "來賓祝福牆",
        role: "賓客從手機張貼彩色祝福卡、即時同步",
        axis: "multi",
        demoMode: "shared-board",
      },
      {
        pageType: "host_emoji_react",
        label: "情緒池應援",
        role: "高潮時刻按 emoji（如戒指交換）",
        axis: "host",
        demoMode: "emoji-host",
      },
    ],
    valueProposition:
      "替代傳統紙本簽名簿、提供拍照分享素材、活動結束後新人可下載完整紀錄。一場婚禮 NT$ 8,000-15,000 服務費。",
    status: "live",
  },
  {
    id: "birthday",
    name: "生日派對情境包",
    tagline: "回憶相簿 + 祝福瀑布 + 全場情緒池",
    description:
      "壽星專屬的數位互動派對。賓客掃 QR 後可上傳與壽星的合照、留下祝福、為現場活動應援。\n大螢幕全程呈現氛圍，派對結束後壽星可保留所有紀錄。",
    useCases: ["壽宴主桌投影", "親友聚餐", "公司同事慶生", "兒童生日派對"],
    category: "social",
    icon: "Cake",
    gradient: "from-amber-500/20 to-orange-500/20",
    estimatedPlayers: "10-80 人",
    estimatedDuration: "1-3 小時",
    components: [
      {
        pageType: "host_polaroid_collage",
        label: "回憶相簿牆",
        role: "賓客上傳合照與祝福",
        axis: "host",
      },
      {
        pageType: "host_guestbook_digital",
        label: "生日留言簿",
        role: "電子簽名 + 文字祝福",
        axis: "host",
      },
      {
        pageType: "host_emoji_react",
        label: "派對情緒池",
        role: "切蛋糕、吹蠟燭時全場應援",
        axis: "host",
      },
    ],
    valueProposition: "輕量版婚禮模板，適合中小型私人場合。NT$ 3,000-6,000 服務費。",
    status: "live",
  },
  {
    id: "reunion",
    name: "同學會 / 聚會情境包",
    tagline: "重逢搶答 + 故事接龍 + 數位簽名簿",
    description:
      "重逢主題的破冰互動。透過搶答 ice-breaker、故事接龍、電子簽名簿，讓久未相見的朋友快速重新熟悉。",
    useCases: ["畢業 N 週年同學會", "工作老同事聚會", "社團校友會"],
    category: "social",
    icon: "Users",
    gradient: "from-purple-500/20 to-indigo-500/20",
    estimatedPlayers: "10-60 人",
    estimatedDuration: "2-3 小時",
    components: [
      {
        pageType: "host_trivia_showdown",
        label: "重逢搶答",
        role: "「誰最快結婚？」、「誰是當年校隊隊長？」",
        axis: "host",
        demoMode: "trivia-host",
      },
      {
        pageType: "host_guestbook_digital",
        label: "回憶簽名簿",
        role: "近況留言、聯絡方式更新",
        axis: "host",
      },
      {
        pageType: "host_polaroid_collage",
        label: "重逢拍立得",
        role: "現場合照即時上牆",
        axis: "host",
      },
    ],
    valueProposition: "輕量、不複雜，主辦方一人就能搞定。NT$ 2,000-5,000。",
    status: "live",
  },

  // ════════════════════════════════════════════
  // 活動類（園遊會、破冰、典禮）
  // ════════════════════════════════════════════
  {
    id: "carnival-stage",
    name: "園遊會主舞台",
    tagline: "搶答秀 + 即時排行 + 全場應援",
    description:
      "園遊會主舞台的觀眾互動方案。觀眾可參與搶答、為攤位應援、看即時排行。\n配合主持人腳本可串成完整 30 分鐘節目。",
    useCases: ["大學校慶園遊會", "商場開幕活動", "社區嘉年華", "夏日祭"],
    category: "event",
    icon: "PartyPopper",
    gradient: "from-orange-500/20 to-red-500/20",
    estimatedPlayers: "50-500 人",
    estimatedDuration: "20-60 分鐘",
    components: [
      {
        pageType: "host_trivia_showdown",
        label: "知識搶答",
        role: "在地知識題、品牌冷知識",
        axis: "host",
        demoMode: "trivia-host",
      },
      {
        pageType: "host_live_leaderboard",
        label: "即時排行",
        role: "金銀銅排行榜投影",
        axis: "host",
        demoMode: "leaderboard-host",
      },
      {
        pageType: "host_wave_response",
        label: "全場應援",
        role: "節目高潮時的人浪",
        axis: "host",
        demoMode: "wave-host",
      },
      {
        pageType: "host_scoreboard_announcement",
        label: "跑馬燈播報",
        role: "得分插播、活動公告",
        axis: "host",
        demoMode: "scoreboard-host",
      },
    ],
    valueProposition: "搭配主持人腳本就是一場 30 分鐘節目。場次包套 NT$ 15,000-30,000。",
    status: "live",
  },
  {
    id: "icebreaker",
    name: "破冰熱場情境包",
    tagline: "聚眾簽到 + 拼圖協作 + emoji 池",
    description:
      "新團體破冰場合的快速熱場方案。從報到開始就用簽到 banner，玩兩輪拼圖協作，最後 emoji 池讓全場互相認識。",
    useCases: ["新進員工訓練", "夏令營報到", "讀書會首次聚會", "社團迎新"],
    category: "event",
    icon: "Sparkles",
    gradient: "from-cyan-500/20 to-blue-500/20",
    estimatedPlayers: "10-80 人",
    estimatedDuration: "30-60 分鐘",
    components: [
      {
        pageType: "host_crowd_gather",
        label: "聚眾簽到",
        role: "報到熱場、達標 banner",
        axis: "host",
        demoMode: "crowd-host",
      },
      {
        pageType: "jigsaw_puzzle",
        label: "拼圖協作",
        role: "分組拼圖破冰",
        axis: "multi",
        demoMode: "jigsaw",
      },
      {
        pageType: "host_emoji_react",
        label: "情緒池",
        role: "結尾全場互動",
        axis: "host",
        demoMode: "emoji-host",
      },
    ],
    valueProposition: "顧問入場前 30 分鐘暖身。NT$ 5,000-12,000 一場。",
    status: "live",
  },
  {
    id: "awards-ceremony",
    name: "頒獎典禮情境包",
    tagline: "即時投票 + 跑馬燈 + 全場掌聲",
    description: "頒獎典禮的觀眾參與方案。觀眾可投票最佳組別、看跑馬燈得獎名單、用 emoji 為得主鼓掌。",
    useCases: ["公司年會頒獎", "競賽結果公佈", "校園金鼎獎"],
    category: "event",
    icon: "Trophy",
    gradient: "from-yellow-500/20 to-amber-500/20",
    estimatedPlayers: "50-500 人",
    estimatedDuration: "30-90 分鐘",
    components: [
      {
        pageType: "host_poll_live",
        label: "即時投票",
        role: "「人氣獎」由觀眾票選",
        axis: "host",
        demoMode: "poll-host",
      },
      {
        pageType: "host_scoreboard_announcement",
        label: "跑馬燈得獎",
        role: "輪播得獎名單",
        axis: "host",
        demoMode: "scoreboard-host",
      },
      {
        pageType: "host_emoji_react",
        label: "全場應援",
        role: "得獎時的 emoji 雨",
        axis: "host",
        demoMode: "emoji-host",
      },
    ],
    valueProposition: "頒獎場合的觀眾參與機制。NT$ 8,000-20,000。",
    status: "preview",
  },

  // ════════════════════════════════════════════
  // 公部門（街區、景點、空間活化）
  // ════════════════════════════════════════════
  {
    id: "street-walk",
    name: "街區走讀情境包",
    tagline: "GPS 連鎖點 + 場域全景 + 簽到牆",
    description: "讓觀光客 / 居民邊走邊探索街區故事。每到一站解鎖下一站，最後在大螢幕看到自己走過的軌跡。",
    useCases: ["金門後浦老街", "台南神農街", "迪化街文創導覽", "校園歷史散步"],
    category: "public",
    icon: "MapPin",
    gradient: "from-emerald-500/20 to-teal-500/20",
    estimatedPlayers: "5-100 人",
    estimatedDuration: "30-90 分鐘",
    components: [
      {
        pageType: "gps_cascade",
        label: "連鎖點解鎖",
        role: "強制走訪每一站",
        axis: "multi",
        demoMode: "gps-cascade",
      },
      {
        pageType: "host_knowledge_map",
        label: "場域全景地圖",
        role: "大螢幕呈現所有人軌跡",
        axis: "host",
        demoMode: "knowledgemap-host",
      },
      {
        pageType: "host_crowd_gather",
        label: "簽到熱場",
        role: "起點集合、達標解鎖",
        axis: "host",
        demoMode: "crowd-host",
      },
    ],
    valueProposition: "公部門委辦案、觀光局街區活化。NT$ 80,000-200,000 / 季。",
    status: "live",
  },
  {
    id: "district-checkin",
    name: "商圈打卡情境包",
    tagline: "尋寶任務 + 場域全景 + 排行榜",
    description: "讓客人為商圈集點、打卡、累積回饋。多家商家串聯，全程在大螢幕看到熱度。",
    useCases: ["夜市導覽", "商圈集章", "美食街尋寶", "市集 X 活動"],
    category: "public",
    icon: "ShoppingBag",
    gradient: "from-lime-500/20 to-green-500/20",
    estimatedPlayers: "20-200 人",
    estimatedDuration: "1-3 小時",
    components: [
      {
        pageType: "treasure_hunt",
        label: "尋寶任務",
        role: "店家線索拼密碼",
        axis: "multi",
        demoMode: "treasure",
      },
      {
        pageType: "host_knowledge_map",
        label: "商圈全景",
        role: "店家熱度視覺化",
        axis: "host",
        demoMode: "knowledgemap-host",
      },
      {
        pageType: "host_live_leaderboard",
        label: "尋寶排行",
        role: "前 10 名上榜",
        axis: "host",
        demoMode: "leaderboard-host",
      },
    ],
    valueProposition: "商圈聯合活動。NT$ 30,000-100,000 / 場。",
    status: "preview",
  },

  // ════════════════════════════════════════════
  // 私部門（企業內訓、員工旅遊）
  // ════════════════════════════════════════════
  {
    id: "corporate-training",
    name: "企業內訓情境包",
    tagline: "搶答 + 即時投票 + 角色分派 + 任務清單",
    description: "企業內訓的互動模組。搶答測驗、決策投票、模擬情境角色扮演、任務清單驗收 — 講師輕鬆、學員投入。",
    useCases: ["新進員工訓練", "中階主管培訓", "業務技能訓練", "顧問講座"],
    category: "corporate",
    icon: "Briefcase",
    gradient: "from-blue-500/20 to-indigo-500/20",
    estimatedPlayers: "10-50 人",
    estimatedDuration: "2-4 小時",
    components: [
      {
        pageType: "mood_meter",
        label: "開場活力確認",
        role: "訓練前先確認學員狀態，讓講師掌握現場",
        axis: "multi",
        demoMode: "mood-meter",
      },
      {
        pageType: "host_trivia_showdown",
        label: "知識搶答",
        role: "驗收 + 競賽氛圍",
        axis: "host",
        demoMode: "trivia-host",
      },
      {
        pageType: "host_poll_live",
        label: "即時投票",
        role: "決策模擬、議題討論",
        axis: "host",
        demoMode: "poll-host",
      },
      {
        pageType: "role_assign",
        label: "角色分派",
        role: "情境模擬、劇本演練",
        axis: "multi",
        demoMode: "role-assign",
      },
      {
        pageType: "team_checklist",
        label: "訓練任務驗收",
        role: "全員勾選完成的學習任務或課後行動",
        axis: "multi",
        demoMode: "team-checklist",
      },
      {
        pageType: "shared_board",
        label: "學習心得牆",
        role: "每人貼出一個今天最大的收穫",
        axis: "multi",
        demoMode: "shared-board",
      },
      {
        pageType: "mood_meter",
        label: "結尾能量回顧",
        role: "對比開場活力，看訓練成效",
        axis: "multi",
        demoMode: "mood-meter",
      },
    ],
    valueProposition: "顧問 / 講師端的 SaaS。月訂閱 NT$ 1,500-5,000 / 帳號。",
    status: "live",
  },
  {
    id: "company-trip",
    name: "員工旅遊情境包",
    tagline: "團體合影 + GPS 任務 + 聚會留念",
    description: "員工旅遊現場的數位互動。分組合影、GPS 拓荒任務、最後簽名簿留念。HR 一人就能搞定。",
    useCases: ["年度員工旅遊", "部門團建", "Off-site Workshop"],
    category: "corporate",
    icon: "Plane",
    gradient: "from-sky-500/20 to-cyan-500/20",
    estimatedPlayers: "20-100 人",
    estimatedDuration: "半天 - 1 天",
    components: [
      {
        pageType: "mood_meter",
        label: "開場活力確認",
        role: "旅途開始前確認全員狀態",
        axis: "multi",
        demoMode: "mood-meter",
      },
      {
        pageType: "team_checklist",
        label: "旅遊任務清單",
        role: "全員一起勾選完成的景點與任務",
        axis: "multi",
        demoMode: "team-checklist",
      },
      {
        pageType: "photo_team",
        label: "團體合影",
        role: "分組拍照、自動合成",
        axis: "multi",
      },
      {
        pageType: "gps_team_mission",
        label: "GPS 隊伍任務",
        role: "拓荒、找特定地標",
        axis: "multi",
      },
      {
        pageType: "shared_board",
        label: "旅遊心得牆",
        role: "每人貼出今天最有趣的瞬間",
        axis: "multi",
        demoMode: "shared-board",
      },
      {
        pageType: "host_guestbook_digital",
        label: "團隊簽名簿",
        role: "活動結束時的留念",
        axis: "host",
      },
    ],
    valueProposition: "HR 一人就能搞定整天活動。NT$ 10,000-30,000 / 場。",
    status: "preview",
  },

  // ════════════════════════════════════════════
  // 空間（特定場域故事）
  // ════════════════════════════════════════════
  {
    id: "kids-adventure",
    name: "親子冒險情境包",
    tagline: "尋寶任務 + 拼圖協作 + 應援池",
    description:
      "為孩子量身打造的親子冒險體驗。家長帶孩子完成尋寶、拼圖協作；終點集合時用 emoji 池一起慶祝。\n適合假日商場、親子館、主題樂園、暑期營隊。",
    useCases: [
      "百貨親子節活動",
      "親子館主題日",
      "主題樂園定點互動",
      "暑期夏令營",
      "兒童節市集",
    ],
    category: "social",
    icon: "Baby",
    gradient: "from-yellow-500/20 to-orange-500/20",
    estimatedPlayers: "5-50 組親子",
    estimatedDuration: "60-120 分鐘",
    components: [
      {
        pageType: "treasure_hunt",
        label: "尋寶任務",
        role: "親子一起找線索、解謎",
        axis: "multi",
        demoMode: "treasure",
      },
      {
        pageType: "jigsaw_puzzle",
        label: "拼圖協作",
        role: "孩子貼拼圖、家長拍照",
        axis: "multi",
        demoMode: "jigsaw",
      },
      {
        pageType: "host_emoji_react",
        label: "終點應援池",
        role: "完賽時全場 emoji 慶祝",
        axis: "host",
        demoMode: "emoji-host",
      },
    ],
    valueProposition:
      "親子市場高黏著度活動。可日常常駐主題館使用 + 節慶包裝活動。NT$ 8,000-25,000 / 場 + 月訂閱。",
    status: "live",
  },
  {
    id: "venue-storyline",
    name: "場域故事情境包",
    tagline: "NPC 對話 + 任務鏈 + 紀念牆",
    description: "為特定空間（民宿、咖啡廳、博物館）打造的玩家故事。客人邊吃邊玩、留下影像紀念。",
    useCases: ["主題民宿", "故事咖啡廳", "小型博物館", "AR 互動展"],
    category: "venue",
    icon: "Home",
    gradient: "from-fuchsia-500/20 to-purple-500/20",
    estimatedPlayers: "1-20 人",
    estimatedDuration: "30-90 分鐘",
    components: [
      {
        pageType: "dialogue",
        label: "NPC 對話",
        role: "場域主人公開場介紹",
        axis: "shared",
      },
      {
        pageType: "treasure_hunt",
        label: "任務鏈",
        role: "解謎找密碼、解鎖故事",
        axis: "multi",
        demoMode: "treasure",
      },
      {
        pageType: "host_polaroid_collage",
        label: "紀念牆",
        role: "客人離開前留念",
        axis: "host",
        demoMode: "polaroid-host",
      },
    ],
    valueProposition: "民宿 / 餐廳長期訂閱。月費 NT$ 800-2,500 + 活動分潤。",
    status: "live",
  },

  // ════════════════════════════════════════════
  // W22 新增 — 用 BingoBoard + BlessingWall
  // ════════════════════════════════════════════
  {
    id: "wedding-deluxe",
    name: "婚禮派對 ✨ 升級版",
    tagline: "祝福瀑布 + 拍立得牆 + 賓客 Bingo + 情緒池",
    description:
      "婚禮現場的數位互動完整升級方案。除了拍立得 + 簽名簿，加上「祝福瀑布」讓賓客留言即時飛上大螢幕、賓客 Bingo（如「找到穿紅衣的賓客」）讓現場互動更熱絡。\n適合大型婚宴、海外婚禮、戶外證婚等高互動需求場合。",
    useCases: ["大型婚宴主桌投影", "海外婚禮現場直播", "戶外證婚台", "二次戶外婚禮"],
    category: "social",
    icon: "Heart",
    gradient: "from-rose-500/30 to-fuchsia-500/30",
    estimatedPlayers: "50-300 人",
    estimatedDuration: "3-5 小時",
    components: [
      {
        pageType: "host_blessing_wall",
        label: "祝福瀑布牆",
        role: "賓客留言即時飛上螢幕、戒指交換時刻全場飄",
        axis: "host",
      },
      {
        pageType: "host_polaroid_collage",
        label: "拍立得紀念牆",
        role: "賓客合照即時上牆",
        axis: "host",
        demoMode: "polaroid-host",
      },
      {
        pageType: "host_bingo_board",
        label: "賓客 Bingo",
        role: "「找到穿紅衣賓客」「跟新郎合照」等情境集章",
        axis: "host",
      },
      {
        pageType: "host_emoji_react",
        label: "情緒池應援",
        role: "戒指交換、拋捧花時的 emoji 雨",
        axis: "host",
        demoMode: "emoji-host",
      },
    ],
    valueProposition: "婚禮升級版 — 4 元件互動體驗、適合追求記憶深刻的新人。NT$ 12,000-20,000 / 場。",
    status: "live",
  },
  {
    id: "carnival-bingo",
    name: "園遊會 Bingo 集章嘉年華",
    tagline: "Bingo 集章 + 即時排行 + 跑馬燈 + 全場應援",
    description:
      "園遊會主舞台升級版本。把分散的攤位用 Bingo 連起來、賓客必須走訪不同攤位才能集章解鎖獎勵。\n大螢幕呈現所有人 Bingo 進度、達成連線的賓客排上前 10。",
    useCases: ["大學校慶園遊會", "百貨週年慶活動", "夜市夏日祭", "社區園遊嘉年華"],
    category: "event",
    icon: "PartyPopper",
    gradient: "from-orange-500/30 to-yellow-500/30",
    estimatedPlayers: "100-500 人",
    estimatedDuration: "2-4 小時",
    components: [
      {
        pageType: "host_bingo_board",
        label: "Bingo 集章板",
        role: "25 個攤位、走訪不同攤位即時打勾",
        axis: "host",
      },
      {
        pageType: "host_live_leaderboard",
        label: "Bingo 排行榜",
        role: "達成連線的賓客排前 10",
        axis: "host",
        demoMode: "leaderboard-host",
      },
      {
        pageType: "host_scoreboard_announcement",
        label: "跑馬燈播報",
        role: "「X 攤位剛達成連線」插播",
        axis: "host",
        demoMode: "scoreboard-host",
      },
      {
        pageType: "host_wave_response",
        label: "全場應援",
        role: "節目高潮時人浪湧現",
        axis: "host",
        demoMode: "wave-host",
      },
    ],
    valueProposition: "園遊會升級版 — 把分散攤位串起來、提升賓客整場參與率。包套 NT$ 25,000-50,000 / 場。",
    status: "live",
  },
  {
    id: "escape-room",
    name: "密室逃脫情境包",
    tagline: "協作解鎖 + 任務鏈 + 線索拼密碼 + 隊伍搶答",
    description:
      "為密室主題場域打造的多元件協作體驗。隊伍進入後需共同解鎖、解謎、找線索、搶答、最終逃出。\n適合主題密室、實境解謎遊戲、企業 team building、學校歷史尋寶。",
    useCases: ["主題密室遊戲", "實境解謎", "企業 team building", "校園尋寶活動", "夏令營解謎"],
    category: "venue",
    icon: "Lock",
    gradient: "from-purple-500/30 to-indigo-500/30",
    estimatedPlayers: "4-30 人 / 場",
    estimatedDuration: "60-120 分鐘",
    components: [
      {
        pageType: "lock_coop",
        label: "協作解鎖",
        role: "每人持密碼片段、合作開鎖",
        axis: "multi",
      },
      {
        pageType: "treasure_hunt",
        label: "線索拼密碼",
        role: "解謎找出最終答案",
        axis: "multi",
        demoMode: "treasure",
      },
      {
        pageType: "quest_chain",
        label: "任務鏈",
        role: "故事 + 解謎多階段",
        axis: "multi",
      },
      {
        pageType: "choice_verify_race",
        label: "隊伍搶答",
        role: "對戰場景的緊張感",
        axis: "multi",
      },
    ],
    valueProposition: "密室主題店面長期訂閱 + 一次性活動雙軌。月費 NT$ 1,500-3,500 + 一次性 NT$ 8K-25K。",
    status: "live",
  },
  {
    id: "team-building",
    name: "企業團建活動情境包",
    tagline: "角色分派 + 接力任務 + 全場應援 + 即時排行",
    description:
      "私部門員工團建升級版。劇本式角色扮演 + 接力強制互動 + emoji 池 + 排行榜、HR 一人就能搞定整天活動。\n適合年度員工旅遊、季度部門團建、新進主管 workshop。",
    useCases: ["年度員工旅遊", "季度部門團建", "新進主管 workshop", "Off-site 共識營", "尾牙活動"],
    category: "corporate",
    icon: "Users2",
    gradient: "from-blue-500/30 to-cyan-500/30",
    estimatedPlayers: "20-80 人 / 場",
    estimatedDuration: "半天 - 1 天",
    components: [
      {
        pageType: "shared_board",
        label: "開場共識牆",
        role: "每人寫下對今天的一個期待或關鍵字",
        axis: "multi",
        demoMode: "shared-board",
      },
      {
        pageType: "bingo",
        label: "人物特徵賓果",
        role: "找到符合描述的隊友就標記、快速認識彼此",
        axis: "multi",
        demoMode: "bingo",
      },
      {
        pageType: "role_assign",
        label: "角色分派",
        role: "劇本式分組（含 DISC / 能力互補）",
        axis: "multi",
        demoMode: "role-assign",
      },
      {
        pageType: "relay_mission",
        label: "接力任務",
        role: "強制每人完成、團隊互動深度",
        axis: "multi",
      },
      {
        pageType: "host_emoji_react",
        label: "全場應援",
        role: "高潮時刻 emoji 雨",
        axis: "host",
        demoMode: "emoji-host",
      },
      {
        pageType: "host_live_leaderboard",
        label: "即時排行",
        role: "組別積分排行榜",
        axis: "host",
        demoMode: "leaderboard-host",
      },
    ],
    valueProposition: "私部門年度團建活動主推。HR 不用準備、一鍵建場。NT$ 15,000-40,000 / 場。",
    status: "live",
  },
  {
    id: "lecture-conference",
    name: "講座研討會情境包",
    tagline: "即時 Q&A + 投票 + 文字雲 + emoji 池",
    description:
      "為學術 / 企業 / 政府講座 / 研討會打造的觀眾互動完整方案。MicroQa 觀眾匿名提問、講者依按讚數回答熱門問題；中段穿插 PollLive 投票決策、結尾 WordCloud 凝聚共識。\n聽眾不舉手就能參與、講者掌握真實民意。",
    useCases: [
      "學術研討會",
      "企業大會 / 全員會議",
      "產品發表會",
      "市政說明會",
      "顧問講座 / TED 式演講",
    ],
    category: "corporate",
    icon: "Mic",
    gradient: "from-indigo-500/30 to-blue-500/30",
    estimatedPlayers: "30-300 人",
    estimatedDuration: "1-3 小時",
    components: [
      {
        pageType: "host_micro_qa",
        label: "即時 Q&A",
        role: "觀眾匿名提問、按讚推熱門、講者標記已回答",
        axis: "host",
      },
      {
        pageType: "host_poll_live",
        label: "即時投票",
        role: "中段共識調查、決策模擬",
        axis: "host",
        demoMode: "poll-host",
      },
      {
        pageType: "host_word_cloud",
        label: "結尾文字雲",
        role: "「請給今天的關鍵字」凝聚共識",
        axis: "host",
      },
      {
        pageType: "host_emoji_react",
        label: "全場應援",
        role: "認同金句即時應援",
        axis: "host",
        demoMode: "emoji-host",
      },
    ],
    valueProposition: "講者輕鬆、觀眾投入、主辦掌握民意。NT$ 8,000-25,000 / 場 + 大型場域包套。",
    status: "live",
  },
  {
    id: "icebreaker-workshop",
    name: "破冰工作坊情境包",
    tagline: "共識牆 + 賓果 + 集體達標",
    description:
      "適合新組成的團隊或研習工作坊。先用共識牆讓每個人寫下「一件別人不知道的事」，所有卡片即時展示；接著玩人物特徵賓果深化認識；最後集體達標強化凝聚感。\n純手機操作，主持人零準備，30 分鐘輕鬆破冰。",
    useCases: [
      "企業新人訓練",
      "研習工作坊開場",
      "讀書會 / 社群首次聚會",
      "夏令營分組活動",
      "校園班級破冰",
    ],
    category: "event",
    icon: "Sparkles",
    gradient: "from-pink-500/20 to-purple-500/20",
    estimatedPlayers: "10-60 人",
    estimatedDuration: "20-45 分鐘",
    components: [
      {
        pageType: "mood_meter",
        label: "開場活力確認",
        role: "進場時先確認每個人的能量，讓主持人掌握現場狀態",
        axis: "multi",
        demoMode: "mood-meter",
      },
      {
        pageType: "shared_board",
        label: "共識牆",
        role: "每人寫下一件別人不知道的事，即時展示",
        axis: "multi",
        demoMode: "shared-board",
      },
      {
        pageType: "bingo",
        label: "人物賓果",
        role: "格子填寫特徵，找到符合的人就標記",
        axis: "multi",
        demoMode: "bingo",
      },
      {
        pageType: "collective_score",
        label: "集體達標",
        role: "全班一起衝積分強化凝聚感",
        axis: "multi",
        demoMode: "collective-score",
      },
      {
        pageType: "mood_meter",
        label: "結尾活力回顧",
        role: "活動結束後再量一次，對比開場分佈看成效",
        axis: "multi",
        demoMode: "mood-meter",
      },
    ],
    valueProposition: "30 分鐘破冰神器 — 不尷尬、不無聊、全員參與。NT$ 3,000-8,000 / 場。",
    status: "live",
  },
];

// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

export function getScenarioById(id: string): ScenarioTemplate | undefined {
  return SCENARIO_TEMPLATES.find((s) => s.id === id);
}

export function getScenariosByCategory(
  category: ScenarioCategory,
): ScenarioTemplate[] {
  return SCENARIO_TEMPLATES.filter((s) => s.category === category);
}

/** 反向索引：給定 pageType，回傳所有含這個元件的情境 */
export function getScenariosForPageType(pageType: string): ScenarioTemplate[] {
  return SCENARIO_TEMPLATES.filter((s) =>
    s.components.some((c) => c.pageType === pageType),
  );
}

export const SCENARIO_CATEGORY_LABELS: Record<ScenarioCategory, string> = {
  public: "🏛 公部門｜空間活化",
  corporate: "💼 私部門｜企業內訓",
  event: "🎉 活動｜園遊會 / 破冰 / 典禮",
  venue: "🏠 空間｜民宿 / 咖啡廳 / 博物館",
  social: "💝 交誼｜婚禮 / 生日 / 聚會",
};
