// 🏁 遊戲場次完成後的紀錄寫入（2026-09-22 自 player-sessions PATCH 抽出 + 計分開關）
//
// 寫入三件事：排行榜、成就解鎖、隊伍戰績（squad_match_records → 獎勵引擎）
// 規則：
//   - 排行榜：只有「計分遊戲」且分數 > 0 才寫（不計分遊戲沒有排名意義）
//   - 成就 / 隊伍戰績：
//       計分遊戲 → 維持既有規則（分數 > 0 才寫）
//       不計分遊戲 → 完成就寫（否則分數恆 0 會連成就、戰績、獎勵都拿不到）
//   - 🆕 2026-09-22 身份規則（業主：訪客要紀錄就要登入或註冊來歸屬）：
//       訪客完成 → 不寫排行榜 / 成就（獎勵由戰績寫入端依領獎人身份判斷）；隊伍戰績照寫
//       訪客登入認領 → backfillClaimedCompletions 補寫排行榜、成就、獎勵
import type { GameSession } from "@shared/schema";
import { storage } from "../storage";
import { isScoringEnabled } from "@shared/lib/scoring";
import { leaderboard } from "@shared/schema";
import { eq } from "drizzle-orm";

async function writeLeaderboard(session: GameSession, userId: string | undefined): Promise<void> {
  const { getPlayerDisplayName, isAnonymousPlayer } = await import("@shared/lib/playerDisplay");
  const user = userId ? await storage.getUser(userId) : null;
  const displaySource = {
    playerName: session.playerName,
    firstName: user?.firstName,
    lastName: user?.lastName,
    email: user?.email,
  };
  const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : null;
  const completedAt = session.completedAt ? new Date(session.completedAt).getTime() : null;
  await storage.createLeaderboardEntry({
    gameId: session.gameId,
    sessionId: session.id,
    teamName: session.teamName,
    playerName: getPlayerDisplayName(displaySource),
    isAnonymous: isAnonymousPlayer(displaySource) ? 1 : 0,
    totalScore: session.score,
    completionTimeSeconds:
      startedAt && completedAt ? Math.floor((completedAt - startedAt) / 1000) : undefined,
  });
}

async function unlockAchievements(session: GameSession, userId: string | undefined): Promise<void> {
  if (!userId || !session.gameId) return;
  try {
    const { checkAndUnlockAchievements } = await import("./achievement-unlock");
    const progressList = await storage.getPlayerProgress(session.id);
    const userProgress = progressList.find((p) => p.userId === userId);
    await checkAndUnlockAchievements({
      userId,
      gameId: session.gameId,
      sessionId: session.id,
      score: session.score ?? 0,
      inventory: (userProgress?.inventory as string[]) || [],
      gameCompleted: true,
    });
  } catch (err) {
    console.error("[achievement] 解鎖檢查失敗:", err);
  }
}

async function writeSquadRecord(session: GameSession): Promise<void> {
  try {
    const { writeSquadRecordFromSession } = await import("./squad-record-writer");
    await writeSquadRecordFromSession(session);
  } catch (err) {
    console.error("[squad-record] 寫入失敗（不影響 session）:", err);
  }
}

/** 依計分規則，這場完成是否該留下紀錄（計分遊戲 0 分維持既有規則：不寫） */
async function completionRules(session: GameSession) {
  const game = session.gameId ? await storage.getGame(session.gameId) : undefined;
  const scoring = isScoringEnabled(game);
  const hasScore = !!session.score;
  return { onLeaderboard: scoring && hasScore, recordable: !scoring || hasScore };
}

/** 場次標記完成後呼叫（失敗不影響回應；排行榜寫入失敗才會往外拋，與既有行為一致） */
export async function recordSessionCompletion(
  session: GameSession,
  userId: string | undefined,
  opts: { isGuest?: boolean } = {},
): Promise<void> {
  const { onLeaderboard, recordable } = await completionRules(session);
  if (!recordable) return;

  if (!opts.isGuest) {
    if (onLeaderboard) await writeLeaderboard(session, userId);
    await unlockAchievements(session, userId);
  }
  await writeSquadRecord(session);
}

/** 單次認領最多補寫幾場（訪客通常只有剛玩完的一兩場；上限避免長交易） */
const BACKFILL_LIMIT = 50;

async function hasLeaderboardEntry(sessionId: string): Promise<boolean> {
  // 用到才載入 db：本模組被場次路由引用，靜態載入會讓無 DB 的單元測試環境整個失敗
  const { db } = await import("../db");
  const rows = await db.select({ id: leaderboard.id }).from(leaderboard).where(eq(leaderboard.sessionId, sessionId)).limit(1);
  return rows.length > 0;
}

/**
 * 訪客登入認領後，補寫當初延後的紀錄（2026-09-22 身份規則）
 * - 排行榜：計分遊戲有分數、且這場還沒有排行榜紀錄（隊友已寫過就不重複）
 * - 成就：補跑解鎖（已解鎖的會略過）
 * - 獎勵：有戰績紀錄且尚未評估過才補發
 */
export async function backfillClaimedCompletions(sessionIds: string[], realUid: string): Promise<number> {
  const { triggerDeferredSessionRewards } = await import("./squad-record-writer");
  let count = 0;
  for (const sessionId of sessionIds.slice(0, BACKFILL_LIMIT)) {
    const session = await storage.getSession(sessionId);
    if (!session || session.status !== "completed") continue;
    const { onLeaderboard, recordable } = await completionRules(session);
    if (!recordable) continue;
    if (onLeaderboard && !(await hasLeaderboardEntry(sessionId))) await writeLeaderboard(session, realUid);
    await unlockAchievements(session, realUid);
    await triggerDeferredSessionRewards(sessionId, realUid);
    count++;
  }
  return count;
}
