// 規則觸發條件評估 — 純函式模組（不依賴 DB）
// 從 reward-engine.ts 抽出，方便單元測試
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26.5

/** 觸發事件 */
export interface RewardEvent {
  eventType: string;
  sourceId: string;
  sourceType: string;
  squadId?: string;
  userId?: string;
  fieldId?: string;
  context: Record<string, unknown>;
}

/** 觸發條件（與規則的 triggers JSON 對應）*/
export interface RuleTriggers {
  eventType: string;
  gameTypes?: string[];
  result?: string[];
  minTotalGames?: number;
  crossField?: boolean;
  firstVisit?: boolean;
  minSquadTier?: string;
  minRecruits?: number;
  fieldId?: string;
  customExpression?: string;
}

/**
 * 評估觸發條件 — 純函式
 *
 * 8 種條件，全部通過才回 true（AND 邏輯）
 */
export function matchTriggers(triggers: RuleTriggers, event: RewardEvent): boolean {
  // 1. eventType 必對
  if (triggers.eventType !== event.eventType) return false;

  // 2. 限定場域
  if (triggers.fieldId && triggers.fieldId !== event.fieldId) return false;

  // 3. 遊戲類型
  if (triggers.gameTypes && triggers.gameTypes.length > 0) {
    const gameType = event.context.gameType as string;
    if (!gameType || !triggers.gameTypes.includes(gameType)) return false;
  }

  // 4. 結果
  if (triggers.result && triggers.result.length > 0) {
    const result = event.context.result as string;
    if (!result || !triggers.result.includes(result)) return false;
  }

  // 5. 累計場次
  if (triggers.minTotalGames !== undefined) {
    const totalGames = event.context.totalGames as number;
    if (typeof totalGames !== "number" || totalGames < triggers.minTotalGames) return false;
  }

  // 6. 跨場域 / 首航
  if (triggers.crossField === true && !event.context.isCrossField) return false;
  if (triggers.firstVisit === true && !event.context.isFirstVisit) return false;

  // 7. 最低段位（bronze < silver < gold < platinum < master）
  if (triggers.minSquadTier) {
    const order = ["bronze", "silver", "gold", "platinum", "master"];
    const myTier = (event.context.tier as string) || "silver";
    if (order.indexOf(myTier) < order.indexOf(triggers.minSquadTier)) return false;
  }

  // 8. 招募數
  if (triggers.minRecruits !== undefined) {
    const recruits = event.context.recruitsCount as number;
    if (typeof recruits !== "number" || recruits < triggers.minRecruits) return false;
  }

  return true;
}
