// 🏁 遊戲場次完成後的紀錄寫入（2026-09-22 自 player-sessions PATCH 抽出 + 計分開關）
//
// 寫入三件事：排行榜、成就解鎖、隊伍戰績（squad_match_records → 獎勵引擎）
// 規則：
//   - 排行榜：只有「計分遊戲」且分數 > 0 才寫（不計分遊戲沒有排名意義）
//   - 成就 / 隊伍戰績：
//       計分遊戲 → 維持既有規則（分數 > 0 才寫）
//       不計分遊戲 → 完成就寫（否則分數恆 0 會連成就、戰績、獎勵都拿不到）
import type { GameSession } from "@shared/schema";
import { storage } from "../storage";
import { isScoringEnabled } from "@shared/lib/scoring";

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

/** 場次標記完成後呼叫（失敗不影響回應；排行榜寫入失敗才會往外拋，與既有行為一致） */
export async function recordSessionCompletion(
  session: GameSession,
  userId: string | undefined,
): Promise<void> {
  const game = session.gameId ? await storage.getGame(session.gameId) : undefined;
  const scoring = isScoringEnabled(game);
  const hasScore = !!session.score;

  if (scoring && hasScore) await writeLeaderboard(session, userId);
  if (scoring && !hasScore) return;

  await unlockAchievements(session, userId);
  await writeSquadRecord(session);
}
