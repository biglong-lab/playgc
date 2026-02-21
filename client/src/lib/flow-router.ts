// 流程路由評估引擎 — 純函式，負責條件評估和路由解析
import type { FlowCondition, FlowRoute, FlowRouterConfig, OnCompleteAction } from "@shared/schema";

// ============================================================================
// 條件評估
// ============================================================================

/** 評估單一條件 */
export function evaluateCondition(
  condition: FlowCondition,
  variables: Record<string, unknown>,
  inventory: string[],
  score: number,
): boolean {
  switch (condition.type) {
    case 'variable_equals':
      return variables[condition.variableName || ''] === condition.variableValue;
    case 'variable_gt':
      return Number(variables[condition.variableName || ''] ?? 0) > Number(condition.variableValue ?? 0);
    case 'variable_lt':
      return Number(variables[condition.variableName || ''] ?? 0) < Number(condition.variableValue ?? 0);
    case 'variable_gte':
      return Number(variables[condition.variableName || ''] ?? 0) >= Number(condition.variableValue ?? 0);
    case 'variable_lte':
      return Number(variables[condition.variableName || ''] ?? 0) <= Number(condition.variableValue ?? 0);
    case 'has_item':
      return inventory.includes(condition.itemId || '');
    case 'not_has_item':
      return !inventory.includes(condition.itemId || '');
    case 'score_above':
      return score >= (condition.scoreThreshold ?? 0);
    case 'score_below':
      return score < (condition.scoreThreshold ?? 0);
    case 'random':
      return true; // random 模式不走條件評估路徑
    default:
      return false;
  }
}

/** 評估單一路由規則（多條件組合） */
export function evaluateRoute(
  route: FlowRoute,
  variables: Record<string, unknown>,
  inventory: string[],
  score: number,
): boolean {
  if (route.conditions.length === 0) return true; // 無條件 → 永遠通過
  const results = route.conditions.map(c => evaluateCondition(c, variables, inventory, score));
  return route.conditionLogic === 'and'
    ? results.every(Boolean)
    : results.some(Boolean);
}

// ============================================================================
// 路由解析
// ============================================================================

/** 加權隨機選擇路由 */
export function pickRandomRoute(routes: FlowRoute[]): string | null {
  if (routes.length === 0) return null;
  const weights = routes.map(r => r.conditions[0]?.weight ?? 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return routes[0]?.nextPageId ?? null;

  let rand = Math.random() * total;
  for (let i = 0; i < routes.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return routes[i].nextPageId;
  }
  return routes[routes.length - 1].nextPageId;
}

/** 評估流程路由器，回傳目標頁面 ID */
export function evaluateFlowRouter(
  config: FlowRouterConfig,
  variables: Record<string, unknown>,
  inventory: string[],
  score: number,
): string | null {
  if (config.mode === 'random') {
    return pickRandomRoute(config.routes);
  }

  // conditional 模式：按順序評估，第一個滿足的立即回傳
  for (const route of config.routes) {
    if (evaluateRoute(route, variables, inventory, score)) {
      return route.nextPageId;
    }
  }
  return config.defaultNextPageId ?? null;
}

/** 解析連續的 flow_router 頁面，回傳最終目標 index（-1 表示遊戲結束） */
export function resolveFlowRouter(
  pages: Array<{ id: string; pageType: string; config: unknown }>,
  startIndex: number,
  variables: Record<string, unknown>,
  inventory: string[],
  score: number,
): number {
  let index = startIndex;
  const maxHops = 10; // 防止無限迴圈
  let hops = 0;

  while (hops < maxHops && index >= 0 && index < pages.length) {
    const page = pages[index];
    if (page.pageType !== 'flow_router') break;

    const config = page.config as FlowRouterConfig;
    const nextPageId = evaluateFlowRouter(config, variables, inventory, score);

    if (nextPageId === '_end') return -1;

    if (nextPageId) {
      const foundIndex = pages.findIndex(p => p.id === nextPageId);
      if (foundIndex !== -1) {
        index = foundIndex;
        hops++;
        continue;
      }
    }

    // 無匹配也無 default → 跳到下一頁
    index++;
    break;
  }

  return index;
}

// ============================================================================
// onCompleteActions 處理
// ============================================================================

/** 處理頁面完成時的變數/道具/分數操作（純函式） */
export function processOnCompleteActions(
  actions: OnCompleteAction[],
  variables: Record<string, unknown>,
  inventory: string[],
  score: number,
): { variables: Record<string, unknown>; inventory: string[]; score: number } {
  let newVars = { ...variables };
  let newInv = [...inventory];
  let newScore = score;

  for (const action of actions) {
    switch (action.type) {
      case 'set_variable':
        if (action.variableName) {
          newVars = { ...newVars, [action.variableName]: action.value };
        }
        break;
      case 'increment_variable':
        if (action.variableName) {
          const current = Number(newVars[action.variableName] ?? 0);
          newVars = { ...newVars, [action.variableName]: current + (Number(action.value) || 1) };
        }
        break;
      case 'decrement_variable':
        if (action.variableName) {
          const current = Number(newVars[action.variableName] ?? 0);
          newVars = { ...newVars, [action.variableName]: current - (Number(action.value) || 1) };
        }
        break;
      case 'toggle_variable':
        if (action.variableName) {
          newVars = { ...newVars, [action.variableName]: !newVars[action.variableName] };
        }
        break;
      case 'add_item':
        if (action.itemId && !newInv.includes(action.itemId)) {
          newInv = [...newInv, action.itemId];
        }
        break;
      case 'remove_item':
        if (action.itemId) {
          newInv = newInv.filter(id => id !== action.itemId);
        }
        break;
      case 'add_score':
        newScore += (action.points ?? 0);
        break;
    }
  }

  return { variables: newVars, inventory: newInv, score: newScore };
}
