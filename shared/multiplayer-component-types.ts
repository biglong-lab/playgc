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

  // 多人遊戲元件平台 12 週路徑 Phase 1 規劃（2026-05-02）
  "jigsaw_puzzle",      // 拼圖協作（破冰王牌）
  "treasure_hunt",      // 藏寶圖（合作搜集）
  "gps_cascade",        // 連鎖解鎖（A 到了 B 才解）
  "collective_score",   // 全體累計分
  "role_assign",        // 角色分派引擎
] as const;

/**
 * 主控大螢幕元件 — 第三軸線（HostScreen）
 *
 * 設計依據：docs/decisions/0004-host-screen-axis.md
 *
 * 判斷標準：一對多單向廣播（大螢幕對玩家群眾），無隊伍概念，無重連狀態恢復
 *
 * 路徑模型：
 *   - /host/:sessionId 大螢幕端（無登入、唯讀、自動全螢幕）
 *   - /play/:sessionId 玩家手機端（可匿名、互動）
 *
 * WebSocket 事件：host_screen_register / host_screen_pulse / host_screen_state
 *
 * 命名規則：所有 host 元件 pageType 必須以 `host_` 開頭
 */
export const HOST_ONLY_COMPONENTS = [
  // Phase 1 規劃（W2-W3）
  "host_poll_live",              // 即時民調（Phase 1 W2 首發）
  "host_emoji_react",            // 全場 emoji 雨
  "host_wave_response",          // 全場按鈕熱力圖
  "host_trivia_showdown",        // 搶答秀（園遊會主舞台）
  "host_live_leaderboard",       // 即時排行榜
  "host_crowd_gather",           // 簽到熱場
  "host_scoreboard_announcement", // 跑馬燈宣告
  "host_knowledge_map",          // 場域全景地圖

  // Phase 2 規劃（W5+ 紀念類）
  "host_polaroid_collage",       // 拍立得紀念牆（婚禮王牌）
] as const;

// ============================================================================
// 型別輔助
// ============================================================================

export type SharedComponent = (typeof SHARED_COMPONENTS)[number];
export type SoloOnlyComponent = (typeof SOLO_ONLY_COMPONENTS)[number];
export type MultiOnlyComponent = (typeof MULTI_ONLY_COMPONENTS)[number];
export type HostOnlyComponent = (typeof HOST_ONLY_COMPONENTS)[number];

/**
 * 玩家模式（v2 — 加入 host 軸線）
 *
 * - "solo"  個人遊戲
 * - "multi" 隊伍協作遊戲
 * - "host"  主控大螢幕模式（無隊伍、單向廣播）
 *
 * @see docs/decisions/0004-host-screen-axis.md
 */
export type PlayerMode = "solo" | "multi" | "host";

/**
 * 從現有 gameMode 推導 playerMode
 *
 * 設計決策：不在 games 表新增 playerMode 欄位，而是從現有的 gameMode 推導。
 *   理由：DRY 原則、零 schema 變更、既有資料無需遷移。
 *
 * 對應關係：
 *   - "individual"  → "solo"
 *   - "team"        → "multi"
 *   - "competitive" → "multi"
 *   - "relay"       → "multi"
 *
 * @param gameMode 來自 shared/schema/games.ts 的 gameModeEnum
 * @returns "solo" / "multi"
 */
export function derivePlayerModeFromGameMode(gameMode: string): PlayerMode {
  if (gameMode === "individual") return "solo";
  if (gameMode === "host") return "host"; // 🆕 ADR-0004：主控大螢幕模式
  return "multi";
}

/** 所有已知 pageType（包括規劃中尚未實作的多人元件 + host 元件） */
export type KnownPageType =
  | SharedComponent
  | SoloOnlyComponent
  | MultiOnlyComponent
  | HostOnlyComponent;

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
 * 是否為主控大螢幕元件（HostScreen 軸線）
 *
 * @see docs/decisions/0004-host-screen-axis.md
 */
export function isHostOnlyComponent(pageType: string): pageType is HostOnlyComponent {
  return (HOST_ONLY_COMPONENTS as readonly string[]).includes(pageType);
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
  if (isHostOnlyComponent(pageType)) return "host";
  // 未知 pageType：保守回 null（讓上層自行決定）
  return null;
}

/**
 * 驗證 pageType 是否允許在指定 playerMode 的遊戲中使用
 *
 * 不對稱約束規則（v1.2 修訂）：
 *   - solo 元件：兩種模式都允許（多人遊戲穿插個人挑戰是正常做法，業界皆如此）
 *   - multi 元件：只允許 multi 模式（必須多人才有意義）
 *   - shared 元件：兩種模式都允許
 *
 * 修訂背景（2026-05-01）：盤點線上 28 個 team 遊戲時發現全部都是「solo 元件 +
 * 隊伍基礎建設（Walkie/WebSocket/TeamLobby）」的混合模式，原本的對稱約束
 * 會擋下所有現有 team 遊戲，故改為不對稱約束。
 *
 * @param pageType 元件類型（如 "lock"、"photo_team"）
 * @param gamePlayerMode 遊戲的 playerMode（"solo" / "multi"）
 * @returns true = 允許，false = 違反約束
 *
 * @example
 *   isComponentAllowedForPlayerMode("lock", "solo")        // true（個人元件用在個人遊戲）
 *   isComponentAllowedForPlayerMode("lock", "multi")       // true（個人元件可用在多人遊戲，v1.2 修訂）
 *   isComponentAllowedForPlayerMode("photo_team", "multi") // true
 *   isComponentAllowedForPlayerMode("photo_team", "solo")  // false（多人元件不能用在個人遊戲）
 *   isComponentAllowedForPlayerMode("text_card", "solo")   // true（通用元件兩種都行）
 *   isComponentAllowedForPlayerMode("text_card", "multi")  // true
 */
export function isComponentAllowedForPlayerMode(
  pageType: string,
  gamePlayerMode: PlayerMode,
): boolean {
  // 通用元件：solo / multi 模式都允許；host 模式不允許（host 全自己管）
  if (isSharedComponent(pageType)) return gamePlayerMode !== "host";

  // 個人專用元件：solo / multi 都允許（v1.2 不對稱約束）；host 不允許
  if (isSoloOnlyComponent(pageType)) return gamePlayerMode !== "host";

  // 多人專用元件：只允許 multi（嚴格）
  if (isMultiOnlyComponent(pageType)) return gamePlayerMode === "multi";

  // 主控大螢幕元件：只允許 host（嚴格，ADR-0004）
  if (isHostOnlyComponent(pageType)) return gamePlayerMode === "host";

  // 未知 pageType：保守允許
  return true;
}

/**
 * 驗證 pageType 是否允許在指定 gameMode 的遊戲中使用（便利函式）
 *
 * 內部會先 derivePlayerModeFromGameMode 再呼叫 isComponentAllowedForPlayerMode。
 * server 端 page 儲存約束直接用這個函式更方便（不必先做兩步轉換）。
 *
 * @example
 *   isComponentAllowedForGameMode("lock", "individual")    // true
 *   isComponentAllowedForGameMode("lock", "team")          // false
 *   isComponentAllowedForGameMode("photo_team", "team")    // true
 *   isComponentAllowedForGameMode("photo_team", "individual") // false
 */
export function isComponentAllowedForGameMode(
  pageType: string,
  gameMode: string,
): boolean {
  return isComponentAllowedForPlayerMode(
    pageType,
    derivePlayerModeFromGameMode(gameMode),
  );
}

/**
 * 取得指定 playerMode 可用的所有 pageType（給 admin UI 過濾用）
 *
 * v1.2 不對稱約束：
 *   - solo 模式：shared + solo
 *   - multi 模式：shared + solo + multi（個人元件也允許）
 *
 * @example
 *   getAllowedComponentsForPlayerMode("solo")
 *   // → 4 + 18 = 22 個（shared + solo）
 *
 *   getAllowedComponentsForPlayerMode("multi")
 *   // → 4 + 18 + 8 = 30 個（shared + solo + multi）
 */
export function getAllowedComponentsForPlayerMode(
  playerMode: PlayerMode,
): readonly string[] {
  if (playerMode === "solo") {
    return [...SHARED_COMPONENTS, ...SOLO_ONLY_COMPONENTS];
  }
  if (playerMode === "multi") {
    return [...SHARED_COMPONENTS, ...SOLO_ONLY_COMPONENTS, ...MULTI_ONLY_COMPONENTS];
  }
  // host 模式只允許 host 元件（ADR-0004：契約獨立）
  return [...HOST_ONLY_COMPONENTS];
}

/**
 * 元件分類描述（給錯誤訊息 / admin UI 顯示用）
 */
export const COMPONENT_CATEGORY_LABELS = {
  shared: "通用元件",
  solo: "個人專用元件",
  multi: "多人專用元件",
  host: "主控大螢幕元件",
  unknown: "未分類元件",
} as const;

/**
 * 取得元件分類（給 UI 顯示用）
 *
 * @returns "shared" / "solo" / "multi" / "unknown"
 */
export function getComponentCategory(
  pageType: string,
): "shared" | "solo" | "multi" | "host" | "unknown" {
  if (isSharedComponent(pageType)) return "shared";
  if (isSoloOnlyComponent(pageType)) return "solo";
  if (isMultiOnlyComponent(pageType)) return "multi";
  if (isHostOnlyComponent(pageType)) return "host";
  return "unknown";
}
