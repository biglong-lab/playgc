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
        pageType: "wish_wall",
        label: "新人祝福卡牆",
        role: "每位賓客送出一張專屬祝福卡，附 emoji 與署名",
        axis: "multi",
      },
      {
        pageType: "story_chain",
        label: "愛情接龍故事",
        role: "所有賓客合力創作新人愛情故事，留下獨一無二的紀念",
        axis: "multi",
      },
      {
        pageType: "timeline_wall",
        label: "相識時間軸",
        role: "賓客寫下「第一次認識新人」的年份與故事，拼出一段有溫度的集體記憶",
        axis: "multi",
      },
      {
        pageType: "gratitude_wall",
        label: "感恩塗鴉牆",
        role: "賓客用彩色卡片寫下對新人的感謝與祝福，貼滿整面感恩牆",
        axis: "multi",
      },
      {
        pageType: "host_emoji_react",
        label: "情緒池應援",
        role: "高潮時刻按 emoji（如戒指交換）",
        axis: "host",
        demoMode: "emoji-host",
      },
      {
        pageType: "mad_libs",
        label: "瘋狂祝福故事",
        role: "賓客合力填入空格，完成一篇搞笑溫馨的婚禮故事，成為最特別的紀念品",
        axis: "multi",
      },
      {
        pageType: "open_question",
        label: "給新人的一句話",
        role: "每位賓客提交一句祝福或人生建議，形成獨一無二的集體智慧牆",
        axis: "multi",
      },
      {
        pageType: "bottle_letter",
        label: "漂流瓶祝福",
        role: "每位賓客匿名寫一封信，揭曉後隨機打開一個個漂流瓶，讀到意外的真誠祝福，讓婚禮更有溫度與驚喜",
        axis: "multi",
      },
      {
        pageType: "emoji_story",
        label: "Emoji 愛情故事",
        role: "用 3 個 emoji 說出你眼中的新人愛情故事，揭曉後大家投愛心選最甜蜜的詮釋",
        axis: "multi",
      },
      {
        pageType: "mind_sync",
        label: "新人默契測試",
        role: "賓客猜猜新人的答案，揭曉後看看誰最了解新人！笑點十足",
        axis: "multi",
      },
      {
        pageType: "time_vault",
        label: "婚禮時光膠囊",
        role: "賓客寫下對新人的話，婚禮當天封存，等到一週年或十週年再開啟，跨越時間的祝福讓婚禮更有意義",
        axis: "multi",
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
        pageType: "wish_wall",
        label: "壽星祝福卡牆",
        role: "每位賓客送出一張祝福卡給壽星，附 emoji 與署名",
        axis: "multi",
      },
      {
        pageType: "host_emoji_react",
        label: "派對情緒池",
        role: "切蛋糕、吹蠟燭時全場應援",
        axis: "host",
      },
      {
        pageType: "countdown_challenge",
        label: "派對限時挑戰",
        role: "30 秒說出壽星 5 個特色！全員計時比賽，完成者排行榜，氣氛瞬間炸裂",
        axis: "multi",
      },
      {
        pageType: "time_capture",
        label: "時空膠囊",
        role: "每位賓客寫下對壽星的話，封存至下個生日再開啟，每年都有跨越時間的驚喜",
        axis: "multi",
      },
      {
        pageType: "spin_wheel",
        label: "派對轉盤",
        role: "全員加入名字，主持人轉盤隨機選出幸運兒負責唱生日歌或完成小任務，笑聲連連",
        axis: "multi",
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
      {
        pageType: "timeline_wall",
        label: "集體回憶軸",
        role: "每人寫下「那一年我們一起做過的事」，按年份排序展示集體故事",
        axis: "multi",
      },
      {
        pageType: "wish_wall",
        label: "許願牆",
        role: "離別前每人留下一句話或祝福，作為聚會的溫暖結尾",
        axis: "multi",
      },
      {
        pageType: "hot_take",
        label: "老同學熱議話題",
        role: "誰說畢業後誰最成功？誰最意外？大家匿名發表大膽看法，emoji 表態，笑聲不斷",
        axis: "multi",
      },
      {
        pageType: "most_likely",
        label: "最有可能王者",
        role: "「最有可能在 10 年後當老闆的人？」全員投票，揭曉瞬間歡笑連連",
        axis: "multi",
      },
      {
        pageType: "emoji_check_in",
        label: "重逢心情打卡",
        role: "見到老朋友的第一個 emoji 是什麼？一鍵打卡，揭曉後超溫馨的表情雲讓全場感受重逢的喜悅",
        axis: "multi",
      },
      {
        pageType: "emoji_reaction",
        label: "Emoji 情緒反應",
        role: "用一個 emoji 加一句話，記錄當下的真實感受，比打卡更豐富，聚會開場最輕鬆的熱身",
        axis: "multi",
      },
      {
        pageType: "collective_poem",
        label: "集體詩",
        role: "每人寫一行，共同完成一首聚會詩篇，揭曉後朗讀儀式感十足，成為這場聚會最獨特的紀念",
        axis: "multi",
      },
      {
        pageType: "never_have_i_ever",
        label: "我從來沒有",
        role: "同學會必玩！「我從來沒有在課堂上睡著過」讓大家舉手承認，笑聲不斷、陳年秘密一一揭露",
        axis: "multi",
      },
      {
        pageType: "memory_lane",
        label: "記憶走廊",
        role: "每人分享一個最難忘的共同回憶，揭曉後大家點愛心，溫馨感動收場",
        axis: "multi",
      },
      {
        pageType: "word_bid",
        label: "字詞競標",
        role: "用一個詞代表這次聚會，大家投票選最佳代言詞，結果公布後笑聲連連",
        axis: "multi",
      },
      {
        pageType: "emoji_story",
        label: "Emoji 故事創作",
        role: "用 3 個 emoji 說出你的同學會心情，揭曉後大家點愛心選最有共鳴的故事",
        axis: "multi",
      },
      {
        pageType: "mind_sync",
        label: "默契大考驗",
        role: "各自回答同一組問題，揭曉時看看誰和你答案一樣，默契度一目了然",
        axis: "multi",
      },
      {
        pageType: "prediction_poll",
        label: "老同學預測投票",
        role: "「你猜大家最想去哪裡下次聚會？」先預測再作答，看誰最了解這群老朋友",
        axis: "multi",
      },
      {
        pageType: "audience_q",
        label: "聚會現場提問",
        role: "有什麼想問大家或主辦人的？即時提問、按讚排序，最多人想知道的問題優先回答",
        axis: "multi",
      },
      {
        pageType: "personal_fact",
        label: "趣味自我揭秘",
        role: "說一件關於自己、讓大家驚訝的小事，揭曉後按愛心選最驚喜的事實，聚會快速增進了解",
        axis: "multi",
      },
      {
        pageType: "open_mic",
        label: "尾聲開放麥克風",
        role: "聚會結尾開放發言，每人登記想說的話，主持人依序呼叫，溫馨收場有始有終",
        axis: "multi",
      },
      {
        pageType: "scene_vote",
        label: "你是哪種同學",
        role: "「現在的你最像哪個角色？」全員選出，揭曉後看大家分類，笑點和話題瞬間湧現",
        axis: "multi",
      },
      {
        pageType: "emoji_slider",
        label: "久別重逢心情計",
        role: "拖動滑桿表達今天重逢的心情有多激動，揭曉後看全場能量，溫暖又有趣的開場",
        axis: "multi",
      },
      {
        pageType: "story_branch",
        label: "集體冒險故事",
        role: "主持人設計一個聚會主題的分支故事，全員投票決定走向，笑點連連讓氣氛爆棚",
        axis: "multi",
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
        pageType: "multi_vote",
        label: "最佳攤位票選",
        role: "現場掃 QR 投票、即時看結果",
        axis: "multi",
      },
      {
        pageType: "live_pulse",
        label: "全場活力爆發",
        role: "節目高潮讓所有人同步點擊，活力計即時拉升，感受集體爆發！",
        axis: "multi",
      },
      {
        pageType: "host_scoreboard_announcement",
        label: "跑馬燈播報",
        role: "得分插播、活動公告",
        axis: "host",
        demoMode: "scoreboard-host",
      },
      {
        pageType: "reaction_wall",
        label: "全場 Emoji 反應",
        role: "節目中途讓觀眾用 emoji 表達即時感受，即時統計讓主持人掌握全場氛圍",
        axis: "multi",
      },
      {
        pageType: "timed_challenge",
        label: "限時挑戰關卡",
        role: "舞台節目高潮：30 秒內完成任務，按鈕搶佔名次，現場觀眾高喊倒數，緊張刺激爆棚",
        axis: "multi",
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
      {
        pageType: "spectrum_line",
        label: "個性光譜定位",
        role: "拖動滑桿揭曉自己的工作風格，群體分布一目瞭然，立刻打開話匣子",
        axis: "multi",
      },
      {
        pageType: "group_cheer",
        label: "集體應援衝刺",
        role: "全員瘋狂點擊達成目標數，能量爆棚，笑聲連連，把氣氛拉到最高點",
        axis: "multi",
      },
      {
        pageType: "sentence_completion",
        label: "句子接龍",
        role: "給出一個句子開頭，所有人接龍補完，揭曉後牆上顯示完整句子讓大家看見彼此的想法",
        axis: "multi",
      },
      {
        pageType: "truth_or_myth",
        label: "真偽大考驗",
        role: "一系列趣味真假題，全員搶答投票，揭曉答案後看誰答對最多，笑聲連連熱場超快",
        axis: "multi",
      },
      {
        pageType: "confirm_it",
        label: "信心投票",
        role: "主持人丟出一個真假陳述，玩家投票並標記信心度，公布後對比群體認知差異，比一般問卷更有深度",
        axis: "multi",
      },
      {
        pageType: "word_ladder",
        label: "詞語接龍",
        role: "每人輪流接龍一個詞，限時完成整條鏈；輕鬆趣味，讓陌生人瞬間找到共同話題",
        axis: "multi",
      },
      {
        pageType: "prediction_poll",
        label: "破冰預測投票",
        role: "「你猜這群人最多人選哪個？」先預測後作答，揭曉誰最了解這個團體，超適合破冰熱場",
        axis: "multi",
      },
      {
        pageType: "audience_q",
        label: "開場現場提問",
        role: "有任何問題想問主辦人或對這次活動的疑問？按讚排序，最多人想知道的優先回答",
        axis: "multi",
      },
      {
        pageType: "personal_fact",
        label: "破冰自我揭秘",
        role: "每人說一件關於自己的趣味小事，揭曉後大家按愛心，陌生人快速找到共同話題",
        axis: "multi",
      },
      {
        pageType: "idea_market",
        label: "創意點子市集",
        role: "每人提出一個想法，用有限代幣投資最看好的點子，揭曉最受歡迎的創意",
        axis: "multi",
      },
      {
        pageType: "open_mic",
        label: "破冰開放發言",
        role: "熱場尾聲開放麥克風，有感想有分享的人輪流上場，讓每個人都有被聽見的機會",
        axis: "multi",
      },
      {
        pageType: "fast_buzz",
        label: "破冰搶答趣問",
        role: "主持人出幾道趣味小問答，全員搶著按鈴，答對得分，一輪下來大家都嗨起來",
        axis: "multi",
      },
      {
        pageType: "crowd_answer",
        label: "集體猜謎",
        role: "猜猜這個活動有幾人報名？或其他趣味數字，全員提交猜測，公布正解後看誰最準",
        axis: "multi",
      },
      {
        pageType: "emoji_slider",
        label: "開場情緒確認",
        role: "拖動滑桿說出今天的心情狀態，揭曉後主持人一眼掌握全場能量，快速破冰超有效",
        axis: "multi",
      },
      {
        pageType: "scene_vote",
        label: "場景自我揭示",
        role: "選一個最像自己的角色場景，揭曉後大家發現驚人的共同點，打開話匣子不費力",
        axis: "multi",
      },
      {
        pageType: "mood_map",
        label: "心情地圖",
        role: "在 2D 座標地圖點擊標記今天的心情（高能/低能 × 正面/負面），主持人即刻掌握全場狀態",
        axis: "multi",
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
        pageType: "rating_wall",
        label: "作品評分牆",
        role: "觀眾為每組作品評 1-5 顆星，即時顯示平均分",
        axis: "multi",
        demoMode: "rating-wall",
      },
      {
        pageType: "live_pulse",
        label: "全場鼓掌活力計",
        role: "得獎揭曉後，全場同步點擊衝活力值，感受集體能量爆發",
        axis: "multi",
      },
      {
        pageType: "host_emoji_react",
        label: "全場應援",
        role: "得獎時的 emoji 雨",
        axis: "host",
        demoMode: "emoji-host",
      },
      {
        pageType: "word_cloud",
        label: "活動文字雲",
        role: "典禮結束前每人送出 1-3 個詞描述今天的感受，揭曉共同心聲，溫馨收場",
        axis: "multi",
      },
    ],
    valueProposition: "頒獎場合的觀眾參與機制。NT$ 8,000-20,000。",
    status: "live",
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
        pageType: "stamp_card",
        label: "商家集章卡",
        role: "每到一家店完成任務蓋章，集滿兌換獎勵",
        axis: "multi",
      },
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
        pageType: "random_team",
        label: "隨機分組",
        role: "公平隨機分配學員到各組，一鍵完成",
        axis: "multi",
      },
      {
        pageType: "mood_meter",
        label: "開場活力確認",
        role: "訓練前先確認學員狀態，讓講師掌握現場",
        axis: "multi",
        demoMode: "mood-meter",
      },
      {
        pageType: "hope_fear",
        label: "開訓希望與擔憂",
        role: "訓前每人填寫對本次訓練的期待與擔憂，揭曉後讓講師了解全場心態，調整課程節奏",
        axis: "multi",
      },
      {
        pageType: "pop_quiz",
        label: "知識快問快答",
        role: "全員同步搶答，即時掌握學習狀況",
        axis: "multi",
      },
      {
        pageType: "host_trivia_showdown",
        label: "螢幕知識搶答",
        role: "搭配大螢幕的競賽搶答",
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
      {
        pageType: "team_word_cloud",
        label: "學習詞雲",
        role: "每人用一個詞描述今日最大收穫，集體詞雲即時呈現",
        axis: "multi",
        demoMode: "team-word-cloud",
      },
      {
        pageType: "retro_board",
        label: "課程回顧版",
        role: "分別在「繼續做/停止做/開始做」三欄寫下想法，投票找出最有共識的行動",
        axis: "multi",
      },
      {
        pageType: "silent_brainstorm",
        label: "靜默腦力激盪",
        role: "同步靜默輸入想法，揭曉前看不到他人，防止從眾，揭曉後對想法投票，真實反映集體智慧",
        axis: "multi",
      },
      {
        pageType: "dot_vote",
        label: "議題點點投票",
        role: "每人分配 3 個點給最重要的學習議題或改善方向，共識即時呈現",
        axis: "multi",
      },
      {
        pageType: "question_box",
        label: "課程提問箱",
        role: "學員匿名提問，最多 3 題，其他人可對問題按讚推高優先",
        axis: "multi",
      },
      {
        pageType: "idea_wall",
        label: "改善點子投票",
        role: "學員提出課程改善或業務創新點子，大家投票選最有價值的方向",
        axis: "multi",
      },
      {
        pageType: "feedback_star",
        label: "課程評分",
        role: "學員為整場訓練評分並留下意見，講師即時掌握滿意度",
        axis: "multi",
        demoMode: "feedback-star",
      },
      {
        pageType: "team_contract",
        label: "學習承諾書",
        role: "訓練結束後全員共同簽署行動承諾，讓學習成果落地",
        axis: "multi",
      },
      {
        pageType: "priority_rank",
        label: "議題優先化排名",
        role: "每人獨立排列最重要的改善議題，集體共識即時呈現",
        axis: "multi",
      },
      {
        pageType: "estimation_game",
        label: "規劃撲克估點",
        role: "各成員隱藏估算後同時揭曉，差異一目瞭然，有效推動討論共識",
        axis: "multi",
      },
      {
        pageType: "scaled_feedback",
        label: "課後量表評分",
        role: "1-5 分量表快速收集學員對課程各面向的滿意度，即時呈現全員分布圖",
        axis: "multi",
      },
      {
        pageType: "knowledge_check",
        label: "知識確認測驗",
        role: "主持人出選擇題，全員搶答，揭曉正確答案+解析+百分比，即時確認學習成效",
        axis: "multi",
      },
      {
        pageType: "letter_to_self",
        label: "給自己的信",
        role: "課程結束前，每人寫信給三個月後的自己，主持人揭曉，感性收尾讓學員帶著承諾離開",
        axis: "multi",
      },
      {
        pageType: "group_promise",
        label: "集體承諾宣言",
        role: "全員同步點擊承諾，即時看到所有人的名字出現在宣言牆，達標觸發慶祝，讓承諾有儀式感",
        axis: "multi",
      },
      {
        pageType: "action_pledge",
        label: "行動宣誓牆",
        role: "每人填寫自己的行動承諾 + 期限，揭曉後全員看見彼此的承諾牆，增加問責感讓學習延伸到工作中",
        axis: "multi",
      },
      {
        pageType: "thinking_hats",
        label: "六頂思考帽",
        role: "每人選一頂帽子從不同角度思考課題，揭曉後按帽子分組呈現多元觀點，激發深度討論",
        axis: "multi",
      },
      {
        pageType: "feedback_sandwich",
        label: "三明治反饋",
        role: "Good→Better→Go 三欄結構化反饋，揭曉後按三個面向聚合展示全體意見，讓改進方向一目瞭然",
        axis: "multi",
      },
      {
        pageType: "value_rank",
        label: "價值排序",
        role: "每人對同一組價值觀/優先項目進行排序，揭曉後用 Borda 計分算出集體排名，引導共識討論",
        axis: "multi",
      },
      {
        pageType: "glow_grow",
        label: "閃光點成長點",
        role: "每人填寫個人閃光點（Glow）與成長點（Grow），揭曉後分組展示全體模式，讓訓練效果得以沉澱",
        axis: "multi",
      },
      {
        pageType: "celebration_wall",
        label: "勝利分享牆",
        role: "訓練結尾每人分享一件想慶祝的成就，點愛心互相鼓勵，留下激勵感",
        axis: "multi",
      },
      {
        pageType: "color_pulse",
        label: "色彩心情牆",
        role: "訓練前後各做一次色彩心情，對比群體情緒變化，讓效果視覺化",
        axis: "multi",
      },
      {
        pageType: "group_contract",
        label: "共識公約制定",
        role: "三階段：提案規則→投票→確立公約，讓團隊共同制定工作規範，承諾感更強",
        axis: "multi",
      },
      {
        pageType: "silent_debate",
        label: "靜默辯論",
        role: "提出議題讓成員選正反方並靜默輸入論點，公布後對比觀點差異，適合訓練前議題暖場",
        axis: "multi",
      },
      {
        pageType: "points_auction",
        label: "虛擬競標",
        role: "每人有等量代幣競標資源/優先權，反映真實偏好；優先順序決策工作坊用此取代舉手投票更直覺",
        axis: "multi",
      },
      {
        pageType: "rate_idea",
        label: "想法評分",
        role: "列出 3-5 個解決方案或創意，玩家各別打星星；公布後依平均分排名，快速找出最受歡迎的方向",
        axis: "multi",
      },
      {
        pageType: "kudos_wall",
        label: "感謝牆",
        role: "活動/訓練結束時，每人向特定對象送感謝卡，揭曉後彩色卡片呈現所有感謝，適合創造正向結尾",
        axis: "multi",
      },
      {
        pageType: "progress_check",
        label: "進度確認",
        role: "每人回報 0-100% 進度，揭曉後顯示長條圖+團隊平均，讓主持人快速掌握整體完成情況，適合訓練/任務追蹤",
        axis: "multi",
      },
      {
        pageType: "table_group",
        label: "桌組分配",
        role: "玩家自選桌次（世界咖啡館風格），揭曉後顯示各桌成員名單，適合小組討論/分組工作坊/世界咖啡館",
        axis: "multi",
      },
      {
        pageType: "feedback_form",
        label: "多向度回饋單",
        role: "主持人設定評分向度（如內容/講師/環境），玩家各評 1-5 分，揭曉後顯示各向度平均，適合課後評估/活動回饋",
        axis: "multi",
      },
      {
        pageType: "quote_wall",
        label: "名言牆",
        role: "每人分享一句名言+出處，揭曉後精美卡片牆呈現，適合開場暖場/分享座右銘/價值觀討論/活動開幕",
        axis: "multi",
      },
      {
        pageType: "action_item",
        label: "行動承諾",
        role: "每人填一個行動承諾+時間框架（今天/本週/本月），揭曉後依時間分群，適合工作坊結尾/訓練後行動計畫",
        axis: "multi",
      },
      {
        pageType: "role_play_card",
        label: "角色扮演卡",
        role: "玩家隨機抽取角色（領導者/觀察者等），揭曉後顯示全員分配，適合劇本遊戲/角色扮演工作坊/破冰活動",
        axis: "multi",
      },
      {
        pageType: "group_decision",
        label: "群體決策",
        role: "提出問題讓大家選擇（2-5 選項），揭曉後顯示票數分布與勝出選項，適合共識形成/民主決策/活動方向選擇",
        axis: "multi",
      },
      {
        pageType: "heat_map",
        label: "熱區投票",
        role: "玩家點選矩陣格（如重要/不重要 × 緊急/不緊急），揭曉後熱圖顯示每格票數，適合優先順序決策/共識形成",
        axis: "multi",
      },
      {
        pageType: "energy_boost",
        label: "能量加速器",
        role: "每人填寫收件人+emoji+一句鼓勵，揭曉後顯示各人收到的能量卡，適合暖場/感謝/活動結尾創造正向氛圍",
        axis: "multi",
      },
      {
        pageType: "aha_board",
        label: "啊哈時刻牆",
        role: "每人提交一條學習頓悟，揭曉後以卡片牆呈現，適合課程回顧/工作坊結尾/學習分享場合",
        axis: "multi",
      },
      {
        pageType: "one_line_story",
        label: "一句故事",
        role: "每人用一句話說故事，揭曉後按提交順序排列，第一條顯示金色徽章，適合破冰感想/聚會開場/活動結尾",
        axis: "multi",
      },
      {
        pageType: "freeze_frame",
        label: "現況快照",
        role: "每人選 🟢🟡🔴 狀態 + 一句現況描述，公布後依狀態分群，讓主持人快速掌握全場進度，適合站會或活動中期確認",
        axis: "multi",
      },
      {
        pageType: "two_column",
        label: "雙欄分類",
        role: "玩家自由新增内容到兩欄（優缺點、挑戰解法等），揭曉後左右並列對比，適合回顧討論/集體決策/訓練後反思",
        axis: "multi",
      },
      {
        pageType: "group_mood",
        label: "團隊能量儀表",
        role: "活動前用 1-10 量表測量團隊整體能量/心情，公布分佈+平均值，讓主持人掌握現場氛圍並即時調整節奏",
        axis: "multi",
      },
      {
        pageType: "daily_intention",
        label: "今日意圖",
        role: "每人寫下一句今天的意圖或聚焦點，公布後呈現彩色卡片牆，適合工作坊開場/企業訓練凝聚共識",
        axis: "multi",
      },
      {
        pageType: "clue_reveal",
        label: "線索解謎",
        role: "主持人逐條揭示線索，玩家猜答案；主持人可標記正確/錯誤，適合訓練前知識暖場或場域解謎活動",
        axis: "multi",
      },
      {
        pageType: "speed_typing",
        label: "競速打字",
        role: "所有人同時輸入指定文字，比誰最快又最準；公布後依秒數排名，適合熱場破冰競速挑戰",
        axis: "multi",
      },
      {
        pageType: "skill_swap",
        label: "技能交換牆",
        role: "每人寫下能提供的技能和想學的技能，揭曉自動配對，引發後續交流",
        axis: "multi",
      },
      {
        pageType: "anonymous_voice",
        label: "匿名心聲",
        role: "訓練結尾匿名收集真實回饋，揭曉後主持人可當場回應，比問卷更即時",
        axis: "multi",
      },
      {
        pageType: "pitch_vote",
        label: "創意提案評分",
        role: "每人提出一個改善點子，進入評分階段後用 1-5 星評選，冠軍提案獲得認可",
        axis: "multi",
      },
      {
        pageType: "tasting_notes",
        label: "研討品鑑",
        role: "培訓課程中試用產品或案例素材後，每人填寫品鑑筆記，揭曉後按愛心投票，讓學習更有記憶點",
        axis: "multi",
      },
      {
        pageType: "idea_market",
        label: "創意市集",
        role: "培訓結尾每人提出一個改善點子，用有限代幣投資最看好的方案，揭曉後直接選出最受支持的行動方向",
        axis: "multi",
      },
      {
        pageType: "quiz_blitz",
        label: "知識快問快答",
        role: "培訓課程後馬上出題驗收，全員同時作答競賽，排行榜揭曉最強學員",
        axis: "multi",
      },
      {
        pageType: "word_cloud",
        label: "課後感受雲",
        role: "每人用 1-3 個詞總結今天學到的核心概念，揭曉後形成集體知識地圖",
        axis: "multi",
      },
      {
        pageType: "fast_buzz",
        label: "搶答競賽",
        role: "培訓課後的知識搶答，主持人逐題開放，最快按鈴答對的學員得分，適合活絡課堂氣氛",
        axis: "multi",
      },
      {
        pageType: "rank_choice",
        label: "議題優先排序",
        role: "每人依重要性排列今天培訓議題，公布 Borda 積分聚合結果，讓主管一眼看見團隊共識",
        axis: "multi",
      },
      {
        pageType: "timed_challenge",
        label: "限時任務挑戰",
        role: "培訓課中加入限時小挑戰，按時完成的學員立刻上榜，讓學習過程充滿競技感",
        axis: "multi",
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
        pageType: "check_in",
        label: "集合簽到",
        role: "出發前全員簽到確認人數到齊",
        axis: "multi",
        demoMode: "check-in",
      },
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
        pageType: "photo_wall",
        label: "旅遊照片牆",
        role: "每人上傳一張今天最有意義的照片，形成共同相簿",
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
        pageType: "challenge_board",
        label: "旅遊挑戰公告欄",
        role: "發布景點或趣味任務挑戰，接受並完成後記錄，讓旅遊更有趣",
        axis: "multi",
      },
      {
        pageType: "photo_contest",
        label: "最佳旅遊照片競賽",
        role: "每人上傳今日最佳照片說明，全員投票選出最具代表性的旅遊瞬間",
        axis: "multi",
      },
      {
        pageType: "photo_caption",
        label: "搞笑配文大賽",
        role: "展示一張旅遊趣味照，全員搶著提交最佳配文，投票角逐最佳創意獎",
        axis: "multi",
      },
      {
        pageType: "would_you_rather",
        label: "旅途選擇題",
        role: "輕鬆二選一：沙灘還是山林？一個人旅行還是揪團出發？邊搭車邊玩邊認識彼此",
        axis: "multi",
      },
      {
        pageType: "card_draw",
        label: "角色抽牌",
        role: "抽到什麼角色就扮什麼，今天的隊長/嚮導/搞笑咖由天決定，氣氛超輕鬆",
        axis: "multi",
      },
      {
        pageType: "host_guestbook_digital",
        label: "團隊簽名簿",
        role: "活動結束時的留念",
        axis: "host",
      },
      {
        pageType: "spin_wheel",
        label: "活動抽獎轉盤",
        role: "旅遊尾聲全員加入轉盤，隨機選出誰來分享今日最難忘時刻或抽取小禮物",
        axis: "multi",
      },
      {
        pageType: "crowd_answer",
        label: "猜猜看",
        role: "猜猜今天走了幾步？景點幾年建成？全員提交猜測，公布正解後看誰最厲害，破冰又有趣",
        axis: "multi",
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
        pageType: "stamp_card",
        label: "冒險集章卡",
        role: "每完成一站任務獲得一枚章，集滿領獎",
        axis: "multi",
      },
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
      {
        pageType: "team_health_check",
        label: "團隊健康評估",
        role: "匿名評估心理安全/溝通/信任/能量四個維度，結果報告幫 HR 掌握團隊現況",
        axis: "multi",
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
        pageType: "consensus_scale",
        label: "觀點共識量表",
        role: "對某一核心論點讓每位觀眾從 1-5 打分，即時看分佈和平均，讓講者掌握聽眾真實立場",
        axis: "multi",
      },
      {
        pageType: "feedback_star",
        label: "講座評分",
        role: "結束後玩家對整場評分並留下心得",
        axis: "multi",
        demoMode: "feedback-star",
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
        pageType: "check_in",
        label: "報到簽到",
        role: "玩家點擊「我到了！」，主持人即時掌握到場人數",
        axis: "multi",
        demoMode: "check-in",
      },
      {
        pageType: "name_card",
        label: "自我介紹名牌",
        role: "每人建立名牌（姓名 + 角色 + 有趣事實），形成名牌牆",
        axis: "multi",
      },
      {
        pageType: "quick_question",
        label: "一句話破冰",
        role: "用一句話介紹自己，匿名展示，輕鬆開場",
        axis: "multi",
        demoMode: "quick-question",
      },
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
      {
        pageType: "team_word_cloud",
        label: "一詞回顧",
        role: "活動結束每人貢獻 1-3 個詞，形成今日集體詞雲",
        axis: "multi",
        demoMode: "team-word-cloud",
      },
      {
        pageType: "two_truths",
        label: "兩真一假破冰",
        role: "每人寫 2 個真實陳述 + 1 個謊言，大家互相猜測，笑聲中快速認識彼此",
        axis: "multi",
      },
      {
        pageType: "dot_vote",
        label: "後續重點投票",
        role: "每人分配 3 個點給最想繼續深入的主題，群體共識即時可見",
        axis: "multi",
      },
      {
        pageType: "debate_vote",
        label: "觀點辯論熱身",
        role: "主持人提出一個有趣問題（如：遠端工作比進辦公室更有效率？），正反即時表態，活絡討論氣氛",
        axis: "multi",
      },
      {
        pageType: "emoji_battle",
        label: "Emoji 開場熱身",
        role: "用 emoji 表達現在的心情，即時統計讓主持人掌握全場狀態",
        axis: "multi",
      },
      {
        pageType: "speed_networking",
        label: "速配社交",
        role: "計時輪流配對，每人和不同人聊 2 分鐘，快速認識全場",
        axis: "multi",
      },
      {
        pageType: "idea_wall",
        label: "共創點子牆",
        role: "每人提出活動改善建議或下次想玩的主題，大家投票讓最好的點子浮現",
        axis: "multi",
      },
      {
        pageType: "feedback_star",
        label: "活動評分",
        role: "玩家為整場破冰活動評分，讓主持人看到成效",
        axis: "multi",
        demoMode: "feedback-star",
      },
      {
        pageType: "hot_seat",
        label: "熱烤椅",
        role: "自願上場者接受全場 5 個問題，透明分享讓大家更了解你",
        axis: "multi",
      },
      {
        pageType: "agreement_matrix",
        label: "破冰後問卷",
        role: "活動結束前快速收集參與者對各面向的感受，即時看見群體共識",
        axis: "multi",
      },
      {
        pageType: "team_poll",
        label: "即時決策投票",
        role: "需要快速決定活動走向時，全員即時投票，背景條形圖呈現共識走向",
        axis: "multi",
      },
      {
        pageType: "presence_map",
        label: "個性地圖",
        role: "全員在 2D 軸線圖放置自己的標記，一眼看出團隊個性分布，引發有趣討論",
        axis: "multi",
      },
      {
        pageType: "word_association",
        label: "自由聯想破冰",
        role: "主持人出一個詞，大家寫第一個聯想，揭曉後看群體思維模式，笑點多、話題多",
        axis: "multi",
      },
      {
        pageType: "number_guess",
        label: "數字競猜破冰",
        role: "主持人出一個問題（如：你每週開幾小時的會？），全員輸入數字後揭曉分布圖，差異引發討論",
        axis: "multi",
      },
      {
        pageType: "desert_island",
        label: "荒島求生清單",
        role: "每人列出帶去荒島的 3 樣東西，揭曉後看大家的選擇，話題十足",
        axis: "multi",
      },
      {
        pageType: "category_challenge",
        label: "分類大挑戰",
        role: "大家搶著列出同一分類下的項目，揭曉共同選擇，引發共鳴",
        axis: "multi",
      },
      {
        pageType: "color_pulse",
        label: "色彩心情牆",
        role: "開場用色彩表達今天的心情，10 秒完成，揭曉後看群體情緒地圖",
        axis: "multi",
      },
      {
        pageType: "mind_sync",
        label: "默契大考驗",
        role: "同樣問題各自回答，揭曉誰和你最有默契，自然引發對話",
        axis: "multi",
      },
    ],
    valueProposition: "30 分鐘破冰神器 — 不尷尬、不無聊、全員參與。NT$ 3,000-8,000 / 場。",
    status: "live",
  },
  {
    id: "space-activation",
    name: "公共空間活化情境包",
    tagline: "簽到 + 場域探索 + 集體分享 + 評分",
    description:
      "適合街區商圈、景點走讀、社區活動。玩家到場簽到，GPS 引導逐點探索，最後在共識牆分享在地故事，讓公共空間重新被看見。",
    useCases: [
      "街區商圈推廣活動",
      "社區空間活化",
      "景點走讀體驗",
      "藝術節場域導覽",
      "文化路線體驗",
    ],
    category: "public",
    icon: "MapPin",
    gradient: "from-green-500/20 to-teal-500/20",
    estimatedPlayers: "20-100 人",
    estimatedDuration: "1-2 小時",
    components: [
      {
        pageType: "check_in",
        label: "參與者簽到",
        role: "活動開始時確認到場人數，主持人一目了然",
        axis: "multi",
        demoMode: "check-in",
      },
      {
        pageType: "mood_meter",
        label: "開場活力確認",
        role: "活動前掌握現場參與者的能量狀態",
        axis: "multi",
        demoMode: "mood-meter",
      },
      {
        pageType: "gps_cascade",
        label: "場域點位探索",
        role: "依指引前往各個空間點位，完成地圖任務",
        axis: "multi",
      },
      {
        pageType: "collective_score",
        label: "集體參與積分",
        role: "全場一起累積探索積分，達標共同慶祝",
        axis: "multi",
        demoMode: "collective-score",
      },
      {
        pageType: "shared_board",
        label: "在地故事牆",
        role: "每人分享一個關於此場域的記憶或故事",
        axis: "multi",
        demoMode: "shared-board",
      },
      {
        pageType: "team_word_cloud",
        label: "場域印象詞雲",
        role: "一個詞描述這個空間，集體詞雲展現在地認同",
        axis: "multi",
        demoMode: "team-word-cloud",
      },
      {
        pageType: "pledge_wall",
        label: "在地承諾牆",
        role: "每位參與者公開許下一個對社區 / 空間的承諾，彼此見證、互相支持",
        axis: "multi",
      },
      {
        pageType: "feedback_star",
        label: "活動評分",
        role: "收集參與者對本次活動的評分與回饋",
        axis: "multi",
        demoMode: "feedback-star",
      },
    ],
    valueProposition: "公部門空間活化標配。單場 NT$ 5,000-15,000 / 場，月訂閱方案另議。",
    status: "live",
  },
  {
    id: "employee-onboarding",
    name: "新員工入職情境包",
    tagline: "簽到 + 認識同事 + 角色配對 + 心得分享",
    description:
      "讓新員工入職日不再只有填表和看投影片。數位簽到、自我介紹牆、賓果認識同事、角色分派破冰，讓第一天留下深刻印象。",
    useCases: [
      "企業新人入職日",
      "批次新生訓練",
      "跨部門認識活動",
      "實習生開訓",
      "志工招募培訓",
    ],
    category: "corporate",
    icon: "UserPlus",
    gradient: "from-violet-500/20 to-purple-500/20",
    estimatedPlayers: "5-50 人",
    estimatedDuration: "30-60 分鐘",
    components: [
      {
        pageType: "check_in",
        label: "新員工簽到",
        role: "入職日報到，HR 即時掌握到場名單",
        axis: "multi",
        demoMode: "check-in",
      },
      {
        pageType: "name_card",
        label: "數位名牌",
        role: "填寫姓名、部門、一件有趣的事，自我介紹名牌牆",
        axis: "multi",
      },
      {
        pageType: "random_team",
        label: "隨機分組破冰",
        role: "新舊員工隨機混組，打破部門隔閡",
        axis: "multi",
      },
      {
        pageType: "role_assign",
        label: "部門角色分配",
        role: "隨機或指定分配部門代表角色，增添趣味感",
        axis: "multi",
        demoMode: "role-assign",
      },
      {
        pageType: "shared_board",
        label: "自我介紹牆",
        role: "每位新人寫下「一個你不會猜到的特點」，全牆展示",
        axis: "multi",
        demoMode: "shared-board",
      },
      {
        pageType: "bingo",
        label: "認識同事賓果",
        role: "找出符合格子描述的同事，交朋友闖關",
        axis: "multi",
        demoMode: "bingo",
      },
      {
        pageType: "team_word_cloud",
        label: "入職心情詞雲",
        role: "一個詞描述今天的感受，凝聚第一天的記憶",
        axis: "multi",
        demoMode: "team-word-cloud",
      },
      {
        pageType: "feedback_star",
        label: "入職體驗評分",
        role: "讓 HR 即時了解新員工對第一天的感受",
        axis: "multi",
        demoMode: "feedback-star",
      },
    ],
    valueProposition: "HR 的必備神器。月訂閱 NT$ 1,500-5,000 / 帳號，活動數不限。",
    status: "live",
  },

  // ════════════════════════════════════════════
  // 尾牙 / 年會
  // ════════════════════════════════════════════
  {
    id: "annual-meeting",
    name: "尾牙 / 年會情境包",
    tagline: "熱場破冰 + 集體簽到 + 大獎揭曉 + 全員投票",
    description:
      "台灣年度最重要的企業活動。從開場熱場、集體簽到、年度回顧投票，到最後的最佳員工倒數揭曉，\n讓全員參與、大螢幕同步呈現，留下最難忘的尾牙記憶。",
    useCases: ["企業尾牙", "年度頒獎典禮", "部門年度回顧", "公司週年紀念"],
    category: "corporate",
    icon: "Trophy",
    gradient: "from-amber-500/20 to-yellow-500/20",
    estimatedPlayers: "30-500 人",
    estimatedDuration: "2-4 小時",
    components: [
      {
        pageType: "check_in",
        label: "入場簽到",
        role: "全員掃 QR 簽到，大螢幕顯示到場人數",
        axis: "multi",
        demoMode: "check-in",
      },
      {
        pageType: "seat_draw",
        label: "座位抽籤",
        role: "現場抽座位號或桌次，公平分配",
        axis: "multi",
      },
      {
        pageType: "host_crowd_gather",
        label: "人氣熱場",
        role: "倒數集齊，大螢幕 banner 升起",
        axis: "host",
        demoMode: "crowd-host",
      },
      {
        pageType: "multi_vote",
        label: "年度最佳票選",
        role: "全員投票選出今年最有成就感的時刻",
        axis: "multi",
      },
      {
        pageType: "wish_wall",
        label: "對公司的話",
        role: "每人寫下對公司 / 同事的一句話",
        axis: "multi",
      },
      {
        pageType: "lucky_draw",
        label: "幸運大抽獎",
        role: "全員加入抽獎池，現場即時抽出幸運兒",
        axis: "multi",
      },
      {
        pageType: "countdown_reveal",
        label: "大獎倒數揭曉",
        role: "緊張刺激的倒數揭曉最佳員工 / 年度獎項",
        axis: "multi",
      },
      {
        pageType: "host_emoji_react",
        label: "全場慶祝",
        role: "揭曉後全場 emoji 應援",
        axis: "host",
        demoMode: "emoji-host",
      },
      {
        pageType: "peer_recognition",
        label: "同事感謝牆",
        role: "感謝過去一年幫助過你的同事，公開表揚，溫暖收尾",
        axis: "multi",
      },
      {
        pageType: "live_pulse",
        label: "全場活力爆發",
        role: "尾牙 high 點讓全場同步點擊，能量衝爆！",
        axis: "multi",
      },
      {
        pageType: "bucket_list",
        label: "新年願望清單",
        role: "每人寫下對明年的期許，同事互相加一共鳴，迎接新年",
        axis: "multi",
      },
      {
        pageType: "photo_wall",
        label: "年終合影牆",
        role: "每人上傳今晚最難忘的照片，共同留念",
        axis: "multi",
      },
    ],
    valueProposition: "尾牙市場每年 11-12 月爆量。一場 NT$ 15,000-50,000 服務費，月訂閱制每帳號 NT$ 3,000-8,000。",
    status: "live",
  },
  {
    id: "demo-day",
    name: "成果發表日情境包",
    tagline: "作品評分 + 快問快答 + 心得詞雲 + 最佳作品揭曉",
    description:
      "企業 Demo Day、成果展、競賽決賽的全流程互動方案。觀眾即時為各組評分，快問快答測試學習成果，最後倒數揭曉最佳作品，讓每個人都成為評審。",
    useCases: ["企業內部 Demo Day", "訓練課程結訓展示", "競賽決賽投票", "學校成果展評分"],
    category: "corporate",
    icon: "Star",
    gradient: "from-purple-500/20 to-violet-500/20",
    estimatedPlayers: "20-100 人",
    estimatedDuration: "60-120 分鐘",
    components: [
      {
        pageType: "check_in",
        label: "入場簽到",
        role: "記錄到場評審 / 觀眾人數",
        axis: "multi",
        demoMode: "check-in",
      },
      {
        pageType: "pop_quiz",
        label: "知識熱身",
        role: "正式評分前，用快問快答測試相關知識，炒熱氣氛",
        axis: "multi",
      },
      {
        pageType: "rating_wall",
        label: "即時評分牆",
        role: "每位觀眾為各組作品評 1-5 顆星，即時顯示平均分",
        axis: "multi",
      },
      {
        pageType: "team_word_cloud",
        label: "學習心得詞雲",
        role: "每人用一個詞描述最大收穫，即時詞雲浮現",
        axis: "multi",
        demoMode: "team-word-cloud",
      },
      {
        pageType: "question_box",
        label: "評審提問箱",
        role: "評審 / 觀眾匿名向各組提問，最熱門問題浮到最上面",
        axis: "multi",
      },
      {
        pageType: "countdown_reveal",
        label: "最佳作品揭曉",
        role: "緊張刺激的倒數，揭曉最高分作品",
        axis: "multi",
      },
      {
        pageType: "host_emoji_react",
        label: "全場慶賀",
        role: "揭曉後全場 emoji 為最佳作品鼓掌",
        axis: "host",
        demoMode: "emoji-host",
      },
      {
        pageType: "feedback_star",
        label: "活動評分",
        role: "對整場 Demo Day 評分並留下建議",
        axis: "multi",
        demoMode: "feedback-star",
      },
      {
        pageType: "project_showcase",
        label: "專案展示牆",
        role: "各組提交專案摘要，觀眾用 emoji 即時反應，人氣最高的置頂高亮",
        axis: "multi",
      },
      {
        pageType: "category_sort",
        label: "成果分類整理",
        role: "Demo Day 後共同整理成果類別，看群體對專案性質的共識分佈",
        axis: "multi",
      },
    ],
    valueProposition: "企業 Demo Day / 成果展每季舉辦。一場 NT$ 8,000-20,000，月訂閱顧問 NT$ 3,000-6,000。",
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
