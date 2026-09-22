// 🧭 玩家端路徑分類（2026-09-22 集中管理）
//
// 1. 沉浸式頁面（isImmersivePath）：沒有可捲動頁尾、底部是操作區 → 不掛全站宣告 footer
//    （原定義於 GlobalLegalFooter，CHITO c45e8915 第 2 修）
// 2. 遊玩流程頁面（isPlayFlowPath）：從掃碼 / 進場到結算的整段 → 不跳全站推銷 / 提示彈窗
//    （推薦隊伍、加到主畫面、版本更新自動重整），業主需求「開始遊戲前不要跳沒必要的資訊」

/** 可選的場域前綴 /f/:code */
const FIELD = "(?:\\/f\\/[^/]+)?";

const IMMERSIVE_PATTERNS: RegExp[] = [
  /^\/game\/[^/]+$/,                 // 遊玩中（legacy 路徑）
  /^\/f\/[^/]+\/game\/[^/]+$/,       // 遊玩中（場域路徑）
  /^\/map\//,                        // GPS 地圖導航
  /^\/f\/[^/]+\/map\//,
  /^\/host\//,                       // 活動大螢幕
  /^\/play\//,                       // 活動玩家端互動
  /^\/liff\/play\//,
  /^\/pos\/scan/,                    // POS 掃碼（相機全螢幕）
  /^\/g\//,                          // QR 短連結轉址頁
  /^\/j\//,
  /^\/b\//,
];

const PLAY_FLOW_PATTERNS: RegExp[] = [
  new RegExp(`^${FIELD}\\/game\\/`),   // 遊玩中、章節列表、章節遊玩
  new RegExp(`^${FIELD}\\/team\\/`),   // 組隊大廳
  new RegExp(`^${FIELD}\\/match\\/`),  // 賽事大廳
  new RegExp(`^${FIELD}\\/map\\/`),    // 遊戲中地圖
  /^\/g\//,                           // QR 過場頁
  /^\/host\//,
  /^\/play\//,
  /^\/liff\/play\//,
];

/** 該路徑是否為沉浸式頁面（不掛 footer） */
export function isImmersivePath(path: string): boolean {
  return IMMERSIVE_PATTERNS.some((re) => re.test(path));
}

/** 該路徑是否在遊玩流程中（不跳全站推銷 / 提示彈窗、不自動重整） */
export function isPlayFlowPath(path: string): boolean {
  return PLAY_FLOW_PATTERNS.some((re) => re.test(path));
}

/** 通關事件：結算畫面發出，讓「加到主畫面」等提示改在這個時機出現 */
export const GAME_COMPLETED_EVENT = "chito:game-completed";

export function announceGameCompleted(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GAME_COMPLETED_EVENT));
}
