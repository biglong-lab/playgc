// 頁面完成後的分數/道具/變數計算（純函式、可單元測試）
// 從 GamePlay.handlePageComplete 抽出，方便獨立驗證防刷分邏輯。
import { processOnCompleteActions } from "./flow-router";
import type { OnCompleteAction } from "@shared/schema";

export interface CompletionRewardInput {
  /** 元件回傳的即時獎勵 */
  reward?: { points?: number; items?: string[] };
  /** 正在完成的頁面（undefined = 找不到頁）*/
  page: { id: string; config: Record<string, unknown> } | undefined;
  /** 本 session 已完成過的頁面 id（用來判斷是否重複給分）*/
  completedPageIds: string[];
  /** 目前累計分數 */
  score: number;
  /** 目前道具 */
  inventory: string[];
  /** 目前變數 */
  variables: Record<string, unknown>;
}

export interface CompletionRewardResult {
  score: number;
  inventory: string[];
  variables: Record<string, unknown>;
  /** 此頁先前已給過分（本次略過給分）*/
  alreadyScored: boolean;
}

/**
 * 計算頁面完成後的分數/道具/變數。
 *
 * 🐛 ProPlan CHITO #2「上一頁重複通關刷分」：
 *   同一 session 內、此頁已在 completedPageIds（= 之前已通過並給過分）→
 *   玩家點「上一頁」回頭重做時不再重複加分/發道具（回傳原值 + alreadyScored=true）。
 *   replay/再玩一次 是新 session（completedPageIds 為空）→ 正常給分。
 *
 * 純函式、不可變：一律回傳新陣列/物件、不 mutate 輸入。
 */
export function computeCompletionReward(
  input: CompletionRewardInput,
): CompletionRewardResult {
  const { reward, page, completedPageIds, score, inventory, variables } = input;

  const alreadyScored = !!page && completedPageIds.includes(page.id);
  if (alreadyScored) {
    return {
      score,
      inventory: [...inventory],
      variables: { ...variables },
      alreadyScored: true,
    };
  }

  let newScore = score;
  let newInventory = [...inventory];
  let newVariables = { ...variables };

  // 1. 即時 reward
  if (reward?.points) newScore += reward.points;
  if (reward?.items) newInventory = [...newInventory, ...reward.items];

  // 2. onCompleteActions（通用變數/道具/分數操作）
  if (page) {
    const actions = (page.config.onCompleteActions || []) as OnCompleteAction[];
    if (actions.length > 0) {
      const result = processOnCompleteActions(actions, newVariables, newInventory, newScore);
      newVariables = result.variables;
      newInventory = result.inventory;
      newScore = result.score;
    }
  }

  return { score: newScore, inventory: newInventory, variables: newVariables, alreadyScored: false };
}
