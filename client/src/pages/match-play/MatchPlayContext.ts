// 🏁 遊戲頁的賽事資訊（2026-09-23 P1）：由 MatchPlayGate 提供，GamePlay 讀取
//   沒有賽事（一般單人 / 組隊）= null，GamePlay 行為完全不變
import { createContext, useContext } from "react";
import type { MatchPlayInfo } from "./play-phase";

const MatchPlayContext = createContext<MatchPlayInfo | null>(null);

export const MatchPlayProvider = MatchPlayContext.Provider;

export function useMatchPlay(): MatchPlayInfo | null {
  return useContext(MatchPlayContext);
}
