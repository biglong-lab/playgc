// 🧹 Demo Cleanup Cron（2026-07-05）
//
// 每 30 分鐘清理過期的訪客 demo 遊戲（isDemo=true 且 demoExpiresAt < now）。
// 訪客在 template-market 一鍵免登入體驗（POST /api/scenarios/:id/demo）建的臨時遊戲，
// 2 小時 TTL、到期即清，避免污染 DB。
//
// 刪除順序（外鍵）：
//   pages → games onDelete cascade（隨 games 刪）
//   gameSessions → games 無 cascade（sessions.gameId 未設 onDelete）→ 需先手動刪 sessions
//   playerProgress / chatMessages → gameSessions cascade（隨 sessions 刪）
//
// 啟動位置：server/index.ts（IS_SCHEDULER_INSTANCE gate）
import { db } from "../db";
import { and, eq, lt, inArray } from "drizzle-orm";
import { games, gameSessions } from "@shared/schema";

const CHECK_INTERVAL_MS = 30 * 60_000; // 每 30 分鐘

let timer: NodeJS.Timeout | null = null;

async function runCleanup(): Promise<number> {
  try {
    // 找過期 demo game ids
    const expired = await db
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.isDemo, true), lt(games.demoExpiresAt, new Date())));

    if (expired.length === 0) return 0;
    const ids = expired.map((g) => g.id);

    // 先刪 gameSessions（無 cascade；連帶 playerProgress/chatMessages cascade）
    await db.delete(gameSessions).where(inArray(gameSessions.gameId, ids));
    // 再刪 games（連帶 pages cascade）
    await db.delete(games).where(inArray(games.id, ids));

    console.log(`[demo-cleanup] 清理 ${ids.length} 個過期 demo 遊戲`);
    return ids.length;
  } catch (err) {
    console.error("[demo-cleanup] failed:", err);
    return 0;
  }
}

export function startDemoCleanupCron(): void {
  if (timer) return;
  console.log("[demo-cleanup] cron started, 每 30 分鐘清過期 demo");
  // 啟動時先跑一次（清掉上次關機期間堆積的）
  void runCleanup();
  timer = setInterval(() => void runCleanup(), CHECK_INTERVAL_MS);
}

export function stopDemoCleanupCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** 手動觸發（測試用）；回傳清理筆數 */
export async function runDemoCleanupNow(): Promise<number> {
  return runCleanup();
}
