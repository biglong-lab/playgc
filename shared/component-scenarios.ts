// 📊 Component → Scenarios mapping（W3 / 2026-05-14）
//
// 紅線 #11：「新元件必須對應五大商業情境之一」
// 本檔強制每個元件標註對應情境、CI 解析驗證新元件 PR 有標註
//
// 五大商業情境（依 CLAUDE.md 與 business-model.md）：
//   1. 公部門 (gov)        — 縣市府 / 文化局 / 觀光局
//   2. 私部門活動 (private) — 企業 / 婚禮 / 學校
//   3. 活動 (event)        — 活動公司 / 旅行社（一次性大型）
//   4. 空間活化 (space)    — 民宿 / 商圈 / 場域業者（訂閱主推 ⭐）
//   5. 交誼破冰 (social)   — 同學會 / 家族聚會 / 社團
//
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (W3)

export type ScenarioKey = "gov" | "private" | "event" | "space" | "social";

export const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  gov: "公部門",
  private: "私部門活動",
  event: "活動",
  space: "空間活化",
  social: "交誼破冰",
};

export const ALL_SCENARIOS: ScenarioKey[] = ["gov", "private", "event", "space", "social"];

/**
 * 元件 → 對應情境清單
 * Key = componentType（與 component_runs.componentType / pages.componentKey 一致）
 * Value = 至少一個 scenario key
 *
 * 規則：
 *   - 每個元件至少對應 1 個情境（否則 CI 紅燈）
 *   - 對應多個情境表示「跨情境通用」（如 photo / scoreboard）
 *   - 新增元件時必須加進本表，否則 CI 拒絕合併
 */
export const COMPONENT_SCENARIOS: Record<string, ScenarioKey[]> = {
  // 拍照系統（公私通用、是平台核心）
  photo_capture: ["gov", "private", "event", "space", "social"],
  photo_polaroid_collage: ["private", "event", "social"],
  photo_album: ["gov", "private", "event", "space", "social"],

  // 條件驗證 / 任務（場域導覽必備）
  conditional_verify: ["gov", "private", "event", "space"],
  gps_mission: ["gov", "space", "event"],
  qr_verify: ["gov", "private", "event", "space"],

  // 多人對戰（破冰 / 內訓 / 親子）
  water_bomb_battle: ["private", "event", "social"],
  team_score: ["private", "event", "social"],
  shooting_range: ["private", "event", "social"],

  // 知識 / 答題（教育 + 公部門）
  trivia_showdown: ["gov", "private", "social"],
  knowledge_map: ["gov", "space", "private"],

  // 主控大螢幕（公私活動皆用）
  scoreboard_announcement: ["private", "event", "social"],
  guestbook_digital: ["private", "event", "social"],

  // 個人單元（街區 / 旅遊 / 場域）
  story_unfold: ["gov", "space", "event"],
  fragment_collect: ["gov", "space", "event", "private"],
  badge_collect: ["space", "social", "event"],

  // 表單 / 報名
  registration_form: ["gov", "private", "event", "space", "social"],
  feedback_form: ["gov", "private", "event", "space", "social"],

  // 🆕 2026-05-15 Top 10 元件真實 componentType 對齊
  photo_burst: ["private", "event", "social"],          // 連拍 → 婚禮 / 同學會 / 派對
  photo_ar: ["private", "event", "social", "space"],    // AR 貼圖 → 廣泛應用
  shooting_mission: ["event", "social", "private"],     // 單人射擊任務
  choice_verify_race: ["private", "social", "event"],   // 多人答題對戰
  photo_team: ["private", "event", "social"],           // 多人合照
  dialogue: ["gov", "space", "event", "private"],       // 劇情對話、跨情境通用
  photo_spot: ["gov", "space", "event"],                // 定點拍照
  photo_compare: ["space", "gov", "private"],           // 前後對比（街區改造 / 場域）
};

/**
 * 取得元件對應情境（找不到回 null、CI 視為紅燈）
 */
export function getScenariosForComponent(componentType: string): ScenarioKey[] | null {
  const list = COMPONENT_SCENARIOS[componentType];
  return list && list.length > 0 ? list : null;
}

/**
 * 反向查詢：某情境有哪些元件
 */
export function getComponentsForScenario(scenario: ScenarioKey): string[] {
  return Object.entries(COMPONENT_SCENARIOS)
    .filter(([, scenarios]) => scenarios.includes(scenario))
    .map(([type]) => type);
}

/**
 * 驗證 mapping 完整性 — CI 用
 * 回傳：{ valid: boolean, missing: string[] (沒對應的元件), empty: string[] (對應 [] 的元件) }
 */
export function validateScenarioMapping(
  knownComponentTypes: string[],
): { valid: boolean; missing: string[]; empty: string[] } {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const type of knownComponentTypes) {
    const scenarios = COMPONENT_SCENARIOS[type];
    if (!scenarios) missing.push(type);
    else if (scenarios.length === 0) empty.push(type);
  }

  return {
    valid: missing.length === 0 && empty.length === 0,
    missing,
    empty,
  };
}
