// 遊戲編輯器常數定義
import {
  FileText, MessageCircle, Video, Grid,
  HelpCircle, Target, Camera, MapPin, QrCode,
  Play, Clock, Zap, Gift, ArrowRight,
  Bomb, Lock, Smartphone, Vote, Puzzle, GitBranch,
  ImageIcon, ScanSearch, LayoutGrid, Sparkles,
  ScanText,
  Users as UsersIcon,
  Heart, Star, Flag, Trophy, Cake, Award,
  TreePine, Utensils, BarChart3, UserCircle,
  Sparkle, MessageSquare, ThumbsUp, BookOpen,
  PartyPopper, Lightbulb, Gauge, Wand2,
  Compass, Search, Activity, ListChecks, Shuffle,
  Coffee, MessageCircleQuestion, RefreshCw, ListTodo,
  ShieldCheck, BatteryCharging, ClipboardList,
  Brain, CircleDot, BarChart, ListOrdered,
  CheckSquare, SlidersHorizontal, Network, Cloud,
  Pencil, Link2,
} from "lucide-react";

export const PAGE_TYPES = [
  { value: "text_card", label: "字卡", icon: FileText, color: "bg-blue-500/20 text-blue-400" },
  { value: "dialogue", label: "對話", icon: MessageCircle, color: "bg-purple-500/20 text-purple-400" },
  { value: "video", label: "影片", icon: Video, color: "bg-pink-500/20 text-pink-400" },
  { value: "button", label: "按鈕選擇", icon: Grid, color: "bg-indigo-500/20 text-indigo-400" },
  { value: "text_verify", label: "文字驗證", icon: HelpCircle, color: "bg-cyan-500/20 text-cyan-400" },
  { value: "choice_verify", label: "選擇驗證", icon: HelpCircle, color: "bg-teal-500/20 text-teal-400" },
  { value: "conditional_verify", label: "碎片收集", icon: Puzzle, color: "bg-lime-500/20 text-lime-400" },
  { value: "shooting_mission", label: "射擊任務", icon: Target, color: "bg-orange-500/20 text-orange-400" },
  { value: "photo_mission", label: "拍照任務", icon: Camera, color: "bg-green-500/20 text-green-400" },
  // 🆕 v2 獨立拍照類元件（2026-04-24）
  { value: "photo_spot", label: "指定拍照", icon: MapPin, color: "bg-emerald-500/20 text-emerald-400" },
  { value: "photo_compare", label: "拍照確認", icon: ScanSearch, color: "bg-sky-500/20 text-sky-400" },
  { value: "photo_before_after", label: "前後對比", icon: ImageIcon, color: "bg-fuchsia-500/20 text-fuchsia-400" },
  { value: "photo_burst", label: "連拍紀念", icon: LayoutGrid, color: "bg-rose-500/20 text-rose-400" },
  { value: "photo_ar", label: "AR 貼圖拍照", icon: Sparkles, color: "bg-yellow-500/20 text-yellow-400" },
  { value: "photo_team", label: "團體合影 👥", icon: UsersIcon, color: "bg-indigo-500/20 text-indigo-400" },
  // 🆕 A3 OCR 招牌任務（Google Vision，2026-04-25）
  { value: "photo_ocr", label: "招牌辨識", icon: ScanText, color: "bg-cyan-500/20 text-cyan-400" },
  { value: "gps_mission", label: "GPS 任務", icon: MapPin, color: "bg-red-500/20 text-red-400" },
  { value: "qr_scan", label: "QR 掃描", icon: QrCode, color: "bg-yellow-500/20 text-yellow-400" },
  { value: "time_bomb", label: "拆彈任務", icon: Bomb, color: "bg-red-600/20 text-red-500" },
  { value: "lock", label: "密碼鎖", icon: Lock, color: "bg-amber-500/20 text-amber-400" },
  { value: "motion_challenge", label: "體感挑戰", icon: Smartphone, color: "bg-violet-500/20 text-violet-400" },
  // 🆕 2026-05-07：手電筒元件（場域故事 / 解謎用）
  { value: "flashlight", label: "手電筒", icon: Sparkles, color: "bg-yellow-500/20 text-yellow-400" },
  { value: "vote", label: "投票（個人）", icon: Vote, color: "bg-emerald-500/20 text-emerald-400" },
  { value: "flow_router", label: "流程路由", icon: GitBranch, color: "bg-gray-500/20 text-gray-400" },
  // 🆕 多人專用元件（Phase 2，2026-05-02）— 只在 gameMode != "individual" 的遊戲顯示
  // 標尾「👥」讓 admin 一眼識別為多人元件
  { value: "vote_team", label: "隊伍投票（即時同步）👥", icon: Vote, color: "bg-emerald-600/30 text-emerald-300" },
  { value: "shooting_team", label: "隊伍射擊累計 👥", icon: Target, color: "bg-orange-600/30 text-orange-300" },
  { value: "gps_team_mission", label: "隊伍 GPS 任務 👥", icon: MapPin, color: "bg-red-600/30 text-red-300" },
  // Phase 3.1（2026-05-02）— 隊伍搶答（強競爭性）
  { value: "choice_verify_race", label: "隊伍搶答 👥", icon: HelpCircle, color: "bg-teal-600/30 text-teal-300" },
  // Phase 3.2（2026-05-02）— 協作解鎖（不對稱資訊，每人不同線索）
  { value: "lock_coop", label: "協作解鎖 👥", icon: Lock, color: "bg-amber-600/30 text-amber-300" },
  // Phase 3.3（2026-05-02）— 接力任務（一人完成解鎖下一人）
  { value: "relay_mission", label: "接力任務 👥", icon: ArrowRight, color: "bg-purple-600/30 text-purple-300" },
  // Phase 4（2026-05-02）— 地盤戰（多隊爭奪 GPS 點）
  { value: "territory_capture", label: "地盤戰 👥", icon: MapPin, color: "bg-rose-600/30 text-rose-300" },
  // 🎉 互動模組庫（2026-05-06）— 21 個跨情境通用互動元件 👥
  // 對應商業情境：破冰／團建／婚禮／生日／頒獎／場域反饋等
  { value: "spot_vote", label: "現場投票 👥", icon: Vote, color: "bg-emerald-500/20 text-emerald-300" },
  { value: "team_dream", label: "團隊願景 👥", icon: Sparkle, color: "bg-indigo-500/20 text-indigo-300" },
  { value: "group_nickname", label: "隊伍命名 👥", icon: UsersIcon, color: "bg-blue-500/20 text-blue-300" },
  { value: "activity_memo", label: "活動筆記 👥", icon: BookOpen, color: "bg-slate-500/20 text-slate-300" },
  { value: "peer_praise", label: "同伴讚美 👥", icon: ThumbsUp, color: "bg-pink-500/20 text-pink-300" },
  { value: "scale_check", label: "心情尺度 👥", icon: Gauge, color: "bg-cyan-500/20 text-cyan-300" },
  { value: "venue_rating", label: "場地評分 👥", icon: Star, color: "bg-yellow-500/20 text-yellow-300" },
  { value: "micro_commit", label: "微承諾 👥", icon: Flag, color: "bg-purple-500/20 text-purple-300" },
  { value: "closing_thought", label: "結語 👥", icon: MessageSquare, color: "bg-stone-500/20 text-stone-300" },
  { value: "gift_to_team", label: "給隊伍的禮物 👥", icon: Gift, color: "bg-rose-500/20 text-rose-300" },
  { value: "ability_badge", label: "能力徽章 👥", icon: Award, color: "bg-amber-500/20 text-amber-300" },
  { value: "wedding_vow", label: "婚禮祝福卡 👥", icon: Heart, color: "bg-red-500/20 text-red-300" },
  { value: "birthday_candle", label: "生日許願 👥", icon: Cake, color: "bg-fuchsia-500/20 text-fuchsia-300" },
  { value: "award_ceremony", label: "頒獎典禮 👥", icon: Trophy, color: "bg-yellow-600/20 text-yellow-300" },
  { value: "gratitude_tree", label: "感恩之樹 👥", icon: TreePine, color: "bg-green-500/20 text-green-300" },
  { value: "dinner_table", label: "餐桌話題 👥", icon: Utensils, color: "bg-orange-500/20 text-orange-300" },
  { value: "high_low_card", label: "高低時刻 👥", icon: BarChart3, color: "bg-violet-500/20 text-violet-300" },
  { value: "role_board", label: "角色板 👥", icon: UserCircle, color: "bg-teal-500/20 text-teal-300" },
  { value: "discovery_card", label: "發現卡 👥", icon: Lightbulb, color: "bg-lime-500/20 text-lime-300" },
  { value: "flag_design", label: "隊旗設計 👥", icon: Flag, color: "bg-sky-500/20 text-sky-300" },
  { value: "party_menu", label: "派對選單 👥", icon: PartyPopper, color: "bg-pink-600/20 text-pink-300" },
  // 🎯 階段 B 精選互動工具（2026-05-06）— 30 個（5 協作關卡 + 25 互動工具）
  // 協作任務遊戲關卡（Phase 3 真實規劃）
  { value: "jigsaw_puzzle", label: "拼圖協作 👥", icon: Puzzle, color: "bg-emerald-500/20 text-emerald-300" },
  { value: "treasure_hunt", label: "尋寶任務 👥", icon: Search, color: "bg-amber-500/20 text-amber-300" },
  { value: "gps_cascade", label: "GPS 連鎖 👥", icon: Network, color: "bg-red-500/20 text-red-300" },
  { value: "collective_score", label: "集體分數 👥", icon: BarChart, color: "bg-blue-500/20 text-blue-300" },
  { value: "role_assign", label: "角色分派 👥", icon: Shuffle, color: "bg-purple-500/20 text-purple-300" },
  // 工作坊／破冰經典
  { value: "never_have_i_ever", label: "我從沒... 👥", icon: MessageCircleQuestion, color: "bg-fuchsia-500/20 text-fuchsia-300" },
  { value: "would_you_rather", label: "你會選哪個 👥", icon: GitBranch, color: "bg-violet-500/20 text-violet-300" },
  { value: "two_truths", label: "兩真一假 👥", icon: HelpCircle, color: "bg-indigo-500/20 text-indigo-300" },
  { value: "check_in", label: "簽到 👥", icon: CheckSquare, color: "bg-teal-500/20 text-teal-300" },
  { value: "speed_networking", label: "快速交誼 👥", icon: Coffee, color: "bg-orange-500/20 text-orange-300" },
  // 敏捷回顧框架
  { value: "kpt_retro", label: "KPT 回顧 👥", icon: RefreshCw, color: "bg-cyan-500/20 text-cyan-300" },
  { value: "four_ls", label: "4Ls 回顧 👥", icon: ListChecks, color: "bg-sky-500/20 text-sky-300" },
  { value: "rose_bud_thorn", label: "玫瑰花苞刺 👥", icon: Activity, color: "bg-rose-500/20 text-rose-300" },
  // 團隊建構
  { value: "team_pact", label: "團隊公約 👥", icon: ListTodo, color: "bg-blue-600/20 text-blue-300" },
  { value: "team_health_check", label: "團隊健康檢查 👥", icon: Activity, color: "bg-emerald-600/20 text-emerald-300" },
  { value: "team_radar", label: "團隊雷達圖 👥", icon: Compass, color: "bg-purple-600/20 text-purple-300" },
  // 簽到能量
  { value: "safety_check", label: "心理安全檢查 👥", icon: ShieldCheck, color: "bg-green-600/20 text-green-300" },
  { value: "energy_map", label: "能量地圖 👥", icon: BatteryCharging, color: "bg-yellow-600/20 text-yellow-300" },
  // 互動牆／共筆板
  { value: "wish_wall", label: "許願牆 👥", icon: Sparkle, color: "bg-pink-500/20 text-pink-300" },
  { value: "idea_wall", label: "點子牆 👥", icon: Lightbulb, color: "bg-amber-600/20 text-amber-300" },
  { value: "story_wall", label: "故事牆 👥", icon: BookOpen, color: "bg-stone-500/20 text-stone-300" },
  { value: "brain_dump", label: "腦力傾倒 👥", icon: Brain, color: "bg-fuchsia-600/20 text-fuchsia-300" },
  // 投票工具
  { value: "dot_vote", label: "圓點投票 👥", icon: CircleDot, color: "bg-emerald-600/20 text-emerald-300" },
  { value: "rank_choice", label: "排序投票 👥", icon: ListOrdered, color: "bg-indigo-600/20 text-indigo-300" },
  { value: "multi_vote", label: "多選投票 👥", icon: ClipboardList, color: "bg-teal-600/20 text-teal-300" },
  { value: "scaled_feedback", label: "量表回饋 👥", icon: SlidersHorizontal, color: "bg-cyan-600/20 text-cyan-300" },
  // 經典思考工具
  { value: "thinking_hats", label: "六頂思考帽 👥", icon: Sparkles, color: "bg-violet-600/20 text-violet-300" },
  { value: "host_word_cloud", label: "文字雲 📺", icon: Cloud, color: "bg-blue-500/20 text-blue-300" },
  { value: "mad_libs", label: "填詞遊戲 👥", icon: Pencil, color: "bg-rose-600/20 text-rose-300" },
  { value: "quest_chain", label: "任務鏈 👥", icon: Link2, color: "bg-amber-500/20 text-amber-300" },

  // 📺 HostScreen 軸線元件（ADR-0004 大螢幕主控）— 2026-05-07 補接入 admin editor
  // 之前只有 host_word_cloud 接入、其餘 16 個只能透過 SCENARIO_TEMPLATES 用、admin 無法自由建場
  // 標尾「📺」明確區分 host 軸（無玩家登入需求、配對大螢幕展示）
  // 即時互動類
  { value: "host_poll_live", label: "即時投票 📺", icon: BarChart, color: "bg-emerald-500/20 text-emerald-400" },
  { value: "host_emoji_react", label: "Emoji 反應 📺", icon: Sparkles, color: "bg-pink-500/20 text-pink-400" },
  { value: "host_wave_response", label: "舉手熱力 📺", icon: ThumbsUp, color: "bg-orange-500/20 text-orange-400" },
  { value: "host_crowd_gather", label: "簽到熱場 📺", icon: UsersIcon, color: "bg-cyan-500/20 text-cyan-400" },
  // 競賽類
  { value: "host_trivia_showdown", label: "搶答秀 📺", icon: MessageCircleQuestion, color: "bg-amber-500/20 text-amber-400" },
  { value: "host_live_leaderboard", label: "即時排行榜 📺", icon: Trophy, color: "bg-yellow-500/20 text-yellow-400" },
  { value: "host_team_battle_score", label: "隊伍對戰計分 📺", icon: Star, color: "bg-rose-500/20 text-rose-400" },
  { value: "host_progress_quest", label: "進度任務 📺", icon: ListTodo, color: "bg-indigo-500/20 text-indigo-400" },
  // 紀念類（婚禮/生日/聚會）
  { value: "host_polaroid_collage", label: "拍立得紀念牆 📺", icon: Camera, color: "bg-fuchsia-500/20 text-fuchsia-400" },
  { value: "host_guestbook_digital", label: "數位簽名簿 📺", icon: BookOpen, color: "bg-violet-500/20 text-violet-400" },
  { value: "host_blessing_wall", label: "祝福牆 📺", icon: Heart, color: "bg-rose-500/20 text-rose-400" },
  // 場域/活動類
  { value: "host_knowledge_map", label: "場域全景圖 📺", icon: MapPin, color: "bg-teal-500/20 text-teal-400" },
  { value: "host_scoreboard_announcement", label: "跑馬燈宣告 📺", icon: Activity, color: "bg-purple-500/20 text-purple-400" },
  { value: "host_lottery_wheel", label: "抽獎轉盤 📺", icon: Shuffle, color: "bg-yellow-600/20 text-yellow-400" },
  { value: "host_bingo_board", label: "賓果牆 📺", icon: Grid, color: "bg-lime-500/20 text-lime-400" },
  { value: "host_micro_qa", label: "Q&A 微提問 📺", icon: HelpCircle, color: "bg-sky-500/20 text-sky-400" },
] as const;

export const PAGE_TEMPLATES = [
  {
    id: "intro_sequence",
    label: "開場序列",
    description: "故事開場 + 指引對話 + 確認開始",
    icon: Play,
    color: "bg-emerald-500/20 text-emerald-400",
    pages: [
      { pageType: "text_card", config: { title: "歡迎來到賈村", content: "一場驚心動魄的冒險即將開始..." } },
      { pageType: "dialogue", config: { character: { name: "指揮官" }, messages: [{ text: "戰士，你準備好了嗎？" }] } },
      { pageType: "button", config: { prompt: "準備開始任務？", buttons: [{ text: "出發！", rewardPoints: 0 }, { text: "需要更多說明", rewardPoints: 0 }] } },
    ],
  },
  {
    id: "combat_mission",
    label: "戰鬥任務",
    description: "任務簡報 + 射擊目標 + 完成獎勵",
    icon: Target,
    color: "bg-orange-500/20 text-orange-400",
    pages: [
      { pageType: "text_card", config: { title: "作戰指令", content: "敵軍據點已被發現，消滅所有目標！" } },
      { pageType: "shooting_mission", config: { requiredHits: 10, timeLimit: 120, targetScore: 100 } },
      { pageType: "text_card", config: { title: "任務完成", content: "目標已全數消滅，幹得好！" } },
    ],
  },
  {
    id: "exploration_quest",
    label: "探索任務",
    description: "GPS導航 + 拍照記錄 + QR確認",
    icon: MapPin,
    color: "bg-red-500/20 text-red-400",
    pages: [
      { pageType: "text_card", config: { title: "偵查任務", content: "前往指定地點進行偵查。" } },
      { pageType: "gps_mission", config: { targetLocation: { lat: 25.033, lng: 121.565 }, radius: 30, instruction: "前往目標位置" } },
      { pageType: "photo_mission", config: { instruction: "拍攝目標區域的照片作為證據" } },
      { pageType: "qr_scan", config: { qrCodeId: "CHECKPOINT-001", instruction: "掃描檢查站QR碼確認抵達" } },
    ],
  },
  {
    id: "puzzle_challenge",
    label: "解謎挑戰",
    description: "謎題說明 + 多選驗證 + 文字密碼",
    icon: HelpCircle,
    color: "bg-cyan-500/20 text-cyan-400",
    pages: [
      { pageType: "text_card", config: { title: "密碼謎題", content: "破解敵軍的加密通訊，找出隱藏的密碼。" } },
      { pageType: "choice_verify", config: { question: "根據線索，哪個是正確答案？", options: [{ text: "選項A", correct: false }, { text: "選項B", correct: true }, { text: "選項C", correct: false }] } },
      { pageType: "text_verify", config: { question: "輸入解密後的密碼", answers: ["密碼", "PASSWORD"] } },
    ],
  },
  {
    id: "branching_story",
    label: "分支劇情",
    description: "對話劇情 + 選擇分支 + 結果展示",
    icon: ArrowRight,
    color: "bg-indigo-500/20 text-indigo-400",
    pages: [
      { pageType: "dialogue", config: { character: { name: "神秘人" }, messages: [{ text: "你想知道真相嗎？" }, { text: "選擇你的道路..." }] } },
      { pageType: "button", config: { prompt: "你的選擇將決定命運", buttons: [{ text: "追尋真相", rewardPoints: 10 }, { text: "保持距離", rewardPoints: 5 }] } },
      { pageType: "text_card", config: { title: "命運已定", content: "你的選擇將帶來不同的結果..." } },
    ],
  },
] as const;

export const EVENT_TYPES = [
  { value: "qrcode", label: "QR Code 掃描", icon: QrCode, description: "掃描特定 QR Code 時觸發" },
  { value: "gps", label: "GPS 抵達", icon: MapPin, description: "抵達指定地點時觸發" },
  { value: "shooting", label: "射擊達標", icon: Target, description: "射擊任務完成時觸發" },
  { value: "photo", label: "拍照完成", icon: Camera, description: "完成特定拍照任務時觸發" },
  { value: "timer", label: "計時器", icon: Clock, description: "經過指定時間後觸發" },
] as const;

export const REWARD_TYPES = [
  { value: "points", label: "獲得分數", icon: Zap },
  { value: "item", label: "獲得道具", icon: Gift },
  { value: "unlock_page", label: "解鎖頁面", icon: ArrowRight },
  { value: "message", label: "顯示訊息", icon: MessageCircle },
] as const;

/** 根據 pageType 取得類型資訊 */
export function getPageTypeInfo(type: string) {
  return PAGE_TYPES.find(t => t.value === type) || { label: type, icon: FileText, color: "bg-gray-500/20 text-gray-400" };
}

// 🆕 D3 (2026-05-07) — 元件三軸 category 分組
// 把 page_type 依「功能類型」分 6 大類，admin editor 側邊欄按組顯示
// 2026-05-07 補：加 host_screen 第 6 類（ADR-0004 host 軸線、無需玩家登入）
export type PageCategory =
  | "narrative" // 📝 敘事呈現（5）
  | "mission" // ✅ 驗證任務（10，含 vote）
  | "photo" // 📷 拍照系列（7）
  | "multi_coop" // 👥 多人協作關卡（13）
  | "host_screen" // 📺 大螢幕主控（17，2026-05-07 加）
  | "interactive"; // 🎉 活動互動（46）

export const CATEGORY_INFO: Record<
  PageCategory,
  { label: string; emoji: string; description: string }
> = {
  narrative: {
    label: "敘事呈現",
    emoji: "📝",
    description: "字卡、對話、影片、按鈕、流程路由",
  },
  mission: {
    label: "驗證任務",
    emoji: "✅",
    description: "驗證、射擊、GPS、QR、拆彈、密碼鎖、體感、投票",
  },
  photo: {
    label: "拍照系列",
    emoji: "📷",
    description: "拍照任務、指定點、前後對比、AR、團體合影、招牌辨識",
  },
  multi_coop: {
    label: "多人協作關卡",
    emoji: "👥",
    description: "隊伍投票/搶答/解鎖/接力/地盤戰、拼圖、尋寶、集體分數",
  },
  host_screen: {
    label: "大螢幕主控",
    emoji: "📺",
    description: "投票/Emoji/排行榜/拍立得/簽名簿/賓果/搶答/抽獎（活動現場、玩家匿名可）",
  },
  interactive: {
    label: "活動互動",
    emoji: "🎉",
    description: "婚禮/破冰/團建/頒獎/工作坊/敏捷回顧/投票工具",
  },
};

// page_type → category 映射表
const PAGE_TYPE_CATEGORY: Record<string, PageCategory> = {
  // 📝 敘事呈現（5）
  text_card: "narrative",
  dialogue: "narrative",
  video: "narrative",
  button: "narrative",
  flow_router: "narrative",

  // ✅ 驗證任務（10）
  text_verify: "mission",
  choice_verify: "mission",
  conditional_verify: "mission",
  shooting_mission: "mission",
  gps_mission: "mission",
  qr_scan: "mission",
  time_bomb: "mission",
  lock: "mission",
  motion_challenge: "mission",
  vote: "mission",

  // 📷 拍照系列（7）
  photo_mission: "photo",
  photo_spot: "photo",
  photo_compare: "photo",
  photo_before_after: "photo",
  photo_burst: "photo",
  photo_ar: "photo",
  photo_ocr: "photo",

  // 👥 多人協作關卡（13）
  photo_team: "multi_coop",
  vote_team: "multi_coop",
  shooting_team: "multi_coop",
  gps_team_mission: "multi_coop",
  choice_verify_race: "multi_coop",
  lock_coop: "multi_coop",
  relay_mission: "multi_coop",
  territory_capture: "multi_coop",
  jigsaw_puzzle: "multi_coop",
  treasure_hunt: "multi_coop",
  gps_cascade: "multi_coop",
  collective_score: "multi_coop",
  role_assign: "multi_coop",

  // 📺 大螢幕主控（17）— 2026-05-07 補入 admin editor，ADR-0004 host 軸線
  host_poll_live: "host_screen",
  host_emoji_react: "host_screen",
  host_wave_response: "host_screen",
  host_crowd_gather: "host_screen",
  host_trivia_showdown: "host_screen",
  host_live_leaderboard: "host_screen",
  host_team_battle_score: "host_screen",
  host_progress_quest: "host_screen",
  host_polaroid_collage: "host_screen",
  host_guestbook_digital: "host_screen",
  host_blessing_wall: "host_screen",
  host_knowledge_map: "host_screen",
  host_scoreboard_announcement: "host_screen",
  host_lottery_wheel: "host_screen",
  host_bingo_board: "host_screen",
  host_micro_qa: "host_screen",
  host_word_cloud: "host_screen", // 從 multi_coop 改 host_screen（屬第三軸、不是隊伍協作）

  // 🎉 活動互動（46）— 預設 fallback，所有未列入上方的都歸這類
};

/** 根據 pageType 取得 category（fallback 為 interactive） */
export function getPageCategory(pageType: string): PageCategory {
  return PAGE_TYPE_CATEGORY[pageType] ?? "interactive";
}

/** 把 PAGE_TYPES 按 category 分組 */
export function groupPageTypesByCategory(
  types: typeof PAGE_TYPES | readonly (typeof PAGE_TYPES)[number][],
): Array<{ category: PageCategory; types: (typeof PAGE_TYPES)[number][] }> {
  const groups: Record<PageCategory, (typeof PAGE_TYPES)[number][]> = {
    narrative: [],
    mission: [],
    photo: [],
    multi_coop: [],
    host_screen: [],
    interactive: [],
  };
  for (const t of types) {
    groups[getPageCategory(t.value)].push(t);
  }
  // 依固定順序：敘事 → 驗證 → 拍照 → 多人協作 → 大螢幕主控 → 活動互動
  return (["narrative", "mission", "photo", "multi_coop", "host_screen", "interactive"] as PageCategory[])
    .map((cat) => ({ category: cat, types: groups[cat] }))
    .filter((g) => g.types.length > 0);
}

// 🆕 軟分流階段 1（2026-05-07）— 依 editor_mode 過濾元件
// game     路線 I：narrative + mission + photo + multi_coop（35 個）
// activity 路線 II/III：narrative + host_screen + interactive（68 個）
// 共用：narrative（5 個）— 兩個 mode 都看得到
//
// 設計原則：嚴格分流、不留模糊地帶
//   - photo_team 等隊伍協作元件 → 純 game（要登入要組隊）
//   - host_word_cloud 等大螢幕主控 → 純 activity（玩家匿名）
//   - 模糊地帶會回到「混在一起」的混亂
export type EditorMode = "game" | "activity";

export const EDITOR_MODE_VISIBLE_CATEGORIES: Record<EditorMode, PageCategory[]> = {
  game: ["narrative", "mission", "photo", "multi_coop"],
  activity: ["narrative", "host_screen", "interactive"],
};

export const EDITOR_MODE_INFO: Record<EditorMode, { label: string; emoji: string; description: string }> = {
  game: {
    label: "遊戲",
    emoji: "🎮",
    description: "玩家手機闖關 / 副本 / 多人協作（要 Firebase 登入、可組隊）",
  },
  activity: {
    label: "活動",
    emoji: "🎉",
    description: "活動現場互動 / 大螢幕配對（玩家匿名掃 QR、不登入）",
  },
};

/** 依 editorMode 過濾 PAGE_TYPES、回傳該 mode 可見的元件 */
export function filterPageTypesByEditorMode(
  types: typeof PAGE_TYPES | readonly (typeof PAGE_TYPES)[number][],
  editorMode: EditorMode,
): (typeof PAGE_TYPES)[number][] {
  const visibleCategories = new Set(EDITOR_MODE_VISIBLE_CATEGORIES[editorMode]);
  return types.filter((t) => visibleCategories.has(getPageCategory(t.value)));
}
