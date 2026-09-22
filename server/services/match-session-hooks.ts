// 🏁 場次 API ↔ 賽事的掛勾（2026-09-23 P1 競賽 / 接力接線）
//
// 由 routes/player-sessions.ts 呼叫：
//   - 開局（POST /api/sessions 帶 matchId）→ 綁定到賽事
//   - 進度（PATCH /progress 帶 score）   → 同步賽事分數、廣播即時排名
//   - 完成（PATCH /sessions/:id completed）→ 標記完成；接力自動交棒；全員完成自動結算
// 原則：賽事是加值功能 → 這裡任何失敗只記錄，不讓玩家的場次 / 進度存不了
import { z } from "zod";
import type { MatchBroadcast } from "./match-lifecycle";

const matchIdSchema = z.string().uuid();

export function parseMatchId(raw: unknown): string | null {
  const parsed = matchIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** 開局綁定；回傳是否綁上（不是參賽者 / 賽事不在進行中 = false） */
export async function linkSessionToMatch(rawMatchId: unknown, userId: string, sessionId: string): Promise<boolean> {
  const matchId = parseMatchId(rawMatchId);
  if (!matchId) return false;
  try {
    const { linkMatchSession } = await import("./match-lifecycle");
    return await linkMatchSession(matchId, userId, sessionId);
  } catch (err) {
    console.error("[match] 場次綁定賽事失敗:", err);
    return false;
  }
}

/** 進度分數同步（不等待，失敗只記錄）；pageId 給接力用來確認是自己那一段的頁面 */
export function syncMatchScore(
  sessionId: string, userId: string, score: number | undefined, broadcast: MatchBroadcast | undefined,
  pageId?: string,
): void {
  if (typeof score !== "number" || !broadcast) return;
  import("./match-lifecycle")
    .then(({ syncMatchScoreFromSession }) => syncMatchScoreFromSession(sessionId, userId, score, broadcast, pageId))
    .catch((err) => console.error("[match] 同步賽事分數失敗:", err));
}

/** 這個場次是不是接力賽的一棒（只玩部分頁面 → 不寫個人排行榜 / 成就 / 隊伍戰績） */
export async function isRelayLeg(sessionId: string, userId: string): Promise<boolean> {
  try {
    const { isRelayLegSession } = await import("./match-lifecycle");
    return await isRelayLegSession(sessionId, userId);
  } catch (err) {
    console.error("[match] 判斷接力棒次失敗:", err);
    return false;
  }
}

/** 場次完成 → 賽事完成 / 交棒 / 結算 */
export async function completeMatchForSession(
  sessionId: string, userId: string, finalScore: number, broadcast: MatchBroadcast | undefined,
): Promise<void> {
  if (!broadcast) return;
  try {
    const { completeMatchParticipant } = await import("./match-lifecycle");
    await completeMatchParticipant(sessionId, userId, finalScore, broadcast);
  } catch (err) {
    console.error("[match] 賽事完成處理失敗:", err);
  }
}
