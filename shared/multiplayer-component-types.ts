// 🎮 多人遊戲元件分類常數
//
// 用途：定義「通用 / 個人專用 / 多人專用」三類元件，作為 playerMode 約束的單一真實來源。
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §3.1-3.3
//
// 規則（不可妥協）：
//   - playerMode='solo' 的遊戲只能用 SHARED_COMPONENTS + SOLO_ONLY_COMPONENTS
//   - playerMode='multi' 的遊戲只能用 SHARED_COMPONENTS + MULTI_ONLY_COMPONENTS
//   - 違反此規則的 page 必須在 server 層被拒絕儲存
//
// 元件來源：shared/schema/module-catalog.ts（23 個現有 pageType）+ §6 規劃新增 7 個

/**
 * 通用元件 — 兩種模式都可使用
 *
 * 判斷標準：完全不涉及玩家輸入或團隊協作（純展示 / 流程）
 */
export const SHARED_COMPONENTS = [
  "text_card",   // 文字卡（劇情/提示/過場）
  "dialogue",    // NPC 對話（無分支即純展示）
  "video",       // 影片播放
  "flow_router", // 流程路由（純邏輯分支）
] as const;

/**
 * 個人專用元件 — 只能用於 playerMode='solo' 的遊戲
 *
 * 判斷標準：只關心當前玩家的輸入/狀態，無團隊協作語意
 */
export const SOLO_ONLY_COMPONENTS = [
  // 互動類
  "button",              // 個人按鈕選擇
  "vote",                // 個人投票（單機計票）

  // 驗證類
  "text_verify",         // 文字答題
  "choice_verify",       // 選擇題（quiz 模式）
  "conditional_verify",  // 條件驗證（庫存/分數/位置）

  // 解謎/挑戰類
  "lock",                // 個人解鎖密碼
  "qr_scan",             // 掃描 QR
  "motion_challenge",    // 搖手機計數
  "time_bomb",           // 拆彈

  // 硬體/位置類
  "shooting_mission",    // 個人射擊
  "gps_mission",         // 個人 GPS 任務

  // 拍照類（PhotoTeam 例外，屬多人）
  "photo_mission",       // 個人拍照任務
  "photo_spot",          // 個人景點拍照
  "photo_compare",       // 個人前後對比
  "photo_before_after",  // 個人前後拍照
  "photo_burst",         // 個人連拍
  "photo_ar",            // 個人 AR 貼圖
  "photo_ocr",           // 個人文字辨識
] as const;

/**
 * 多人專用元件 — 只能用於 playerMode='multi' 的遊戲
 *
 * 判斷標準：需要隊友狀態、協作、共享進度、隊伍計分
 */
export const MULTI_ONLY_COMPONENTS = [
  // 已實作
  "photo_team", // 團體合影（隊長主控連拍 → 九宮格合成）

  // Phase 2 規劃（後端有/前端缺）
  "vote_team",         // 隊伍投票（majority/unanimous/display）
  "shooting_team",     // 隊伍射擊累計分
  "gps_team_mission",  // 隊伍 GPS 尋寶（any/all 觸發）

  // Phase 3 規劃（新類型）
  "lock_coop",          // 協作解鎖（不對稱資訊，每人不同線索）
  "choice_verify_race", // 隊伍搶答（server 權威時間）
  "relay_mission",      // 接力任務（一人完成解鎖下一人）

  // Phase 4 規劃（依需求）
  "territory_capture", // 地盤戰（多隊爭奪 GPS 點）
] as const;

// ============================================================================
// 型別輔助
// ============================================================================

export type SharedComponent = (typeof SHARED_COMPONENTS)[number];
export type SoloOnlyComponent = (typeof SOLO_ONLY_COMPONENTS)[number];
export type MultiOnlyComponent = (typeof MULTI_ONLY_COMPONENTS)[number];

export type PlayerMode = "solo" | "multi";

/** 所有已知 pageType（包括規劃中尚未實作的多人元件） */
export type KnownPageType =
  | SharedComponent
  | SoloOnlyComponent
  | MultiOnlyComponent;

// ============================================================================
// 純函式 helpers（無副作用，可在 client/server 共用）
// ============================================================================

/**
 * 是否為通用元件（兩模式都可用）
 */
export function isSharedComponent(pageType: string): pageType is SharedComponent {
  return (SHARED_COMPONENTS as readonly string[]).includes(pageType);
}

/**
 * 是否為個人專用元件
 */
export function isSoloOnlyComponent(pageType: string): pageType is SoloOnlyComponent {
  return (SOLO_ONLY_COMPONENTS as readonly string[]).includes(pageType);
}

/**
 * 是否為多人專用元件
 */
export function isMultiOnlyComponent(pageType: string): pageType is MultiOnlyComponent {
  return (MULTI_ONLY_COMPONENTS as readonly string[]).includes(pageType);
}

/**
 * 給定 pageType 推導必需的 playerMode（若無限制則回 null）
 *
 * @returns "solo" / "multi" / null（通用元件）
 * @example
 *   getRequiredPlayerMode("text_card")  // null（通用）
 *   getRequiredPlayerMode("lock")       // "solo"
 *   getRequiredPlayerMode("photo_team") // "multi"
 */
export function getRequiredPlayerMode(pageType: string): PlayerMode | null {
  if (isSharedComponent(pageType)) return null;
  if (isSoloOnlyComponent(pageType)) return "solo";
  if (isMultiOnlyComponent(pageType)) return "multi";
  // 未知 pageType：保守回 null（讓上層自行決定）
  return null;
}

/**
 * 驗證 pageType 是否允許在指定 playerMode 的遊戲中使用
 *
 * @param pageType 元件類型（如 "lock"、"photo_team"）
 * @param gamePlayerMode 遊戲的 playerMode（"solo" / "multi"）
 * @returns true = 允許，false = 違反約束
 *
 * @example
 *   isComponentAllowedForPlayerMode("lock", "solo")        // true（個人元件用在個人遊戲）
 *   isComponentAllowedForPlayerMode("lock", "multi")       // false（個人元件不能用在多人遊戲）
 *   isComponentAllowedForPlayerMode("photo_team", "multi") // true
 *   isComponentAllowedForPlayerMode("photo_team", "solo")  // false（多人元件不能用在個人遊戲）
 *   isComponentAllowedForPlayerMode("text_card", "solo")   // true（通用元件兩種都行）
 *   isComponentAllowedForPlayerMode("text_card", "multi")  // true
 */
export function isComponentAllowedForPlayerMode(
  pageType: string,
  gamePlayerMode: PlayerMode,
): boolean {
  // 通用元件：兩種模式都允許
  if (isSharedComponent(pageType)) return true;

  // 個人專用元件：只允許 solo
  if (isSoloOnlyComponent(pageType)) return gamePlayerMode === "solo";

  // 多人專用元件：只允許 multi
  if (isMultiOnlyComponent(pageType)) return gamePlayerMode === "multi";

  // 未知 pageType：保守允許（避免擋住未來新增的元件，
  //   但建議未來新增元件時同步加進這個常數檔案）
  return true;
}

/**
 * 取得指定 playerMode 可用的所有 pageType（給 admin UI 過濾用）
 *
 * @example
 *   getAllowedComponentsForPlayerMode("solo")
 *   // → ['text_card', 'dialogue', 'video', 'flow_router', 'button', 'vote', ...]
 *
 *   getAllowedComponentsForPlayerMode("multi")
 *   // → ['text_card', 'dialogue', 'video', 'flow_router', 'photo_team', 'vote_team', ...]
 */
export function getAllowedComponentsForPlayerMode(
  playerMode: PlayerMode,
): readonly string[] {
  return playerMode === "solo"
    ? [...SHARED_COMPONENTS, ...SOLO_ONLY_COMPONENTS]
    : [...SHARED_COMPONENTS, ...MULTI_ONLY_COMPONENTS];
}

/**
 * 元件分類描述（給錯誤訊息 / admin UI 顯示用）
 */
export const COMPONENT_CATEGORY_LABELS = {
  shared: "通用元件",
  solo: "個人專用元件",
  multi: "多人專用元件",
  unknown: "未分類元件",
} as const;

/**
 * 取得元件分類（給 UI 顯示用）
 *
 * @returns "shared" / "solo" / "multi" / "unknown"
 */
export function getComponentCategory(
  pageType: string,
): "shared" | "solo" | "multi" | "unknown" {
  if (isSharedComponent(pageType)) return "shared";
  if (isSoloOnlyComponent(pageType)) return "solo";
  if (isMultiOnlyComponent(pageType)) return "multi";
  return "unknown";
}
