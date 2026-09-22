// 🏁 遊戲頁的賽事階段（純函式，2026-09-23 P1）
//   決定帶 ?match= 進遊戲頁時：顯示遊戲、顯示等待畫面，或回大廳（倒數 / 結算 / 不是參賽者）
import type { MyMatchState } from "@/lib/match-types";

export type MatchPlayPhase =
  | "loading"
  /** 不是參賽者 / 還沒開賽 / 已結束或取消 → 回大廳（大廳負責倒數與結算畫面） */
  | "to_lobby"
  /** 接力：還沒輪到我 */
  | "waiting_turn"
  /** 我完成了（競賽）/ 我那棒跑完了（接力），等其他人 */
  | "done_waiting"
  | "play";

export function resolvePlayPhase(me: MyMatchState | undefined): MatchPlayPhase {
  if (!me) return "loading";
  if (!me.isParticipant || me.status !== "playing") return "to_lobby";
  if (me.matchMode === "relay") {
    if (me.relay?.status === "active") return "play";
    return me.relay?.status === "completed" ? "done_waiting" : "waiting_turn";
  }
  return me.completed ? "done_waiting" : "play";
}

export interface MatchPlayInfo {
  matchId: string;
  /** 已綁定的遊戲場次（重整回來接續）；null = 開新局並綁定 */
  sessionId: string | null;
  /** 接力：只玩這段頁碼（1-based 含頭尾）；競賽 = null */
  pageRange: { fromPage: number; toPage: number } | null;
}

export function playInfoOf(me: MyMatchState): MatchPlayInfo {
  const relay = me.relay;
  const pageRange = me.matchMode === "relay" && relay?.fromPage && relay?.toPage
    ? { fromPage: relay.fromPage, toPage: relay.toPage }
    : null;
  return { matchId: me.matchId, sessionId: me.sessionId, pageRange };
}

/** 接力：只留自己那段頁面（頁碼 1-based 含頭尾）；沒有分段 = 全部 */
export function slicePagesForLeg<T>(pages: readonly T[], range: MatchPlayInfo["pageRange"]): T[] {
  if (!range) return [...pages];
  return pages.slice(Math.max(0, range.fromPage - 1), range.toPage);
}
