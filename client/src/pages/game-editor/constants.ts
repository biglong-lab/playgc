// 遊戲編輯器常數定義
import {
  FileText, MessageCircle, Video, Grid,
  HelpCircle, Target, Camera, MapPin, QrCode,
  Play, Clock, Zap, Gift, ArrowRight,
  Bomb, Lock, Smartphone, Vote, Puzzle, GitBranch,
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
  { value: "gps_mission", label: "GPS 任務", icon: MapPin, color: "bg-red-500/20 text-red-400" },
  { value: "qr_scan", label: "QR 掃描", icon: QrCode, color: "bg-yellow-500/20 text-yellow-400" },
  { value: "time_bomb", label: "拆彈任務", icon: Bomb, color: "bg-red-600/20 text-red-500" },
  { value: "lock", label: "密碼鎖", icon: Lock, color: "bg-amber-500/20 text-amber-400" },
  { value: "motion_challenge", label: "體感挑戰", icon: Smartphone, color: "bg-violet-500/20 text-violet-400" },
  { value: "vote", label: "隊伍投票", icon: Vote, color: "bg-emerald-500/20 text-emerald-400" },
  { value: "flow_router", label: "流程路由", icon: GitBranch, color: "bg-gray-500/20 text-gray-400" },
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
