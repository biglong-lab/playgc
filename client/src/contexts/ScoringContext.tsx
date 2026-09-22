// 🎯 計分開關 Context（2026-09-22）
// GamePlay 依 games.scoring_enabled 提供；深層元件（例如按鈕選項的「+N 分」）
// 用 useScoringEnabled() 判斷要不要顯示分數，不必一層層傳 props。
// 預設 true：沒有 Provider 的地方（預覽、測試）維持既有行為。
import { createContext, useContext } from "react";

const ScoringContext = createContext(true);

export const ScoringProvider = ScoringContext.Provider;

export function useScoringEnabled(): boolean {
  return useContext(ScoringContext);
}
