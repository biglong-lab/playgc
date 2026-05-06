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
