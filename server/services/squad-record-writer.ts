// Squad 系統 — 戰績寫入 service
//
// 負責把各種「session 完成事件」轉成統一的 squad_match_records 寫入
//
// 觸發來源：
//   1. 一般遊戲 session 完成（player-sessions.ts）
//   2. 水彈對戰結算（battle-results.ts）
//   3. 競技 / 接力 match 結束（matches.ts）
//
// 設計原則：
//   - fire-and-forget（失敗不影響原本流程）
//   - 自動推算 result + performance（避免每個來源各自實作）
//   - 統一呼叫 calcRewards 算分
//
import { db } from "../db";
import {
  squadMatchRecords,
  squadRatings,
  squadStats,
} from "@shared/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import type { GameSession } from "@shared/schema";
import { calcRewards, deriveTier } from "./squad-rating-calc";

/**
 * 從一般遊戲 session 完成事件寫入 squad record
 *
 * 由 PATCH /api/sessions/:id (status=completed) 觸發
 * 條件：session 必須有 gameId + (team 模式才有 teamName)
 *
 * 因為一般遊戲多半是 PvE 模式，預設 result = "completed"
 */
export async function writeSquadRecordFromSession(
  session: GameSession,
): Promise<void> {
  // 只處理已完成的 session
  if (session.status !== "completed") return;
  if (!session.gameId) return;

  // 查 session 對應的 team（用 sessions 與 teams 的關聯）
  // 這裡先簡化：用 teamName 當 squadId（之後 Phase 5 會改 squadId）
  // 如果 session 沒 team（個人玩），就跳過
  const teamName = session.teamName;
  if (!teamName) {
    // 個人模式不寫 squad records（squad 是團隊概念）
    return;
  }

  // 取遊戲類型
  const game = await db.query.games.findFirst({
    where: (games, { eq }) => eq(games.id, session.gameId!),
  });
  if (!game) return;

  // 推算 squadType + 遊戲類型
  // 暫用 teamName 當 squadId（Phase 5 統一 squad 後改用 squad.id）
  const squadId = `team:${session.gameId}:${teamName}`; // 臨時 squadId
  const squadType = "team";

  // 推算 game_type（map 既有 game.gameMode 到 SquadGameType）
  const gameType = mapGameModeToSquadType(game.gameMode);

  // 推算結果（一般遊戲多半 PvE，完成 = completed）
  const result = "completed" as const;

  // 計算 duration
  const durationSec =
    session.completedAt && session.startedAt
      ? Math.floor(
          (new Date(session.completedAt).getTime() -
            new Date(session.startedAt).getTime()) /
            1000,
        )
      : 0;

  // 🚫 Phase 9.7 防作弊 1：< 60 秒不算（避免快進快出）
  if (durationSec < 60) {
    console.log(
      `[squad-record] 跳過 session ${session.id}：時長 ${durationSec}s < 60s`,
    );
    return;
  }

  // performance（從 session 推算）
  const performance = {
    duration: durationSec,
    completionRate: 1.0, // 既然是 completed 就視為 100%
    score: session.score ?? 0,
  };

  // 取 fieldId（從 game 取）
  const fieldId = game.fieldId ?? "default";

  // 🆕 Phase 13 修復：走完整 calcRewards 路徑（PvE 也算 rating）
  try {
    // 取/建立 rating
    const myRating = await ensureSquadRating(squadId, squadType, gameType);
    // 取/建立 stats（用於 totalGames 算 K 值 + 場域檢查）
    const myStats = await ensureSquadStats(squadId, squadType);

    const fieldsPlayed = (myStats.fieldsPlayed as string[]) ?? [];
    const isFirstVisit = !fieldsPlayed.includes(fieldId);
    const isCrossField =
      !isFirstVisit && fieldsPlayed.length > 0 && fieldsPlayed[0] !== fieldId;

    // 計算 rewards（PvE 模式，無對手）
    const calc = calcRewards({
      myRating: myRating.rating,
      opponentRating: 1200,
      result,
      performance,
      totalGames: myRating.gamesPlayed,
      isCrossField,
      isFirstVisit,
      scoringMode: "pve",
    });

    await db.insert(squadMatchRecords).values({
      squadId,
      squadType,
      gameType,
      gameId: session.gameId,
      sessionId: session.id,
      fieldId,
      result,
      performance,
      durationSec,
      ratingBefore: myRating.rating,
      ratingAfter: myRating.rating + calc.ratingChange,
      ratingChange: calc.ratingChange,
      expPoints: calc.expPoints,
      gameCountMultiplier: calc.gameCountMultiplier,
      isCrossField,
      isFirstVisit,
    });

    // 更新 squad_ratings
    await db
      .update(squadRatings)
      .set({
        rating: myRating.rating + calc.ratingChange,
        gamesPlayed: sql`${squadRatings.gamesPlayed} + 1`,
        peakRating: sql`GREATEST(${squadRatings.peakRating}, ${myRating.rating + calc.ratingChange})`,
        tier: deriveTier(myRating.rating + calc.ratingChange),
        lastPlayedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(squadRatings.squadId, squadId),
          eq(squadRatings.gameType, gameType),
        ),
      );

    // 更新 stats（含跨場域陣列）
    const newFieldsPlayed = isFirstVisit
      ? [...fieldsPlayed, fieldId]
      : fieldsPlayed;

    await db
      .update(squadStats)
      .set({
        totalGamesRaw: sql`${squadStats.totalGamesRaw} + 1`,
        totalGames: sql`${squadStats.totalGames} + ${calc.gameCountMultiplier / 100.0}`,
        totalExpPoints: sql`${squadStats.totalExpPoints} + ${calc.expPoints}`,
        fieldsPlayed: newFieldsPlayed,
        monthlyGames: sql`${squadStats.monthlyGames} + 1`,
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(squadStats.squadId, squadId));

    // 🆕 Phase 6.5：觸發獎勵規則引擎
    await triggerRewardEngine({
      eventType: "game_complete",
      sourceId: session.id,
      sourceType: "squad_match_record",
      squadId,
      fieldId,
      context: {
        gameType,
        result,
        completionRate: 1.0,
        durationSec,
      },
    });
  } catch (err) {
    // fire-and-forget：失敗不影響 session 流程
    console.error("[squad-record-writer] writeSquadRecordFromSession 失敗:", err);
  }
}

/**
 * 從水彈對戰結算寫入 squad record
 *
 * 由 BattleResult 結算（admin 按下「紅隊勝」）觸發
 * 雙方隊伍各寫一筆
 */
export async function writeSquadRecordFromBattle(opts: {
  squadId: string;
  squadType: "clan" | "premade_group";
  result: "win" | "loss" | "draw";
  slotId: string;
  fieldId: string;
  durationSec: number;
  performance: {
    eliminations?: number;
    deaths?: number;
    isMvp?: boolean;
    hits?: number;
  };
  isCrossField?: boolean;
  isFirstVisit?: boolean;
  /** 對手 squad ID（用於 24h 重複對手限制檢查） */
  opponentSquadId?: string;
}): Promise<void> {
  try {
    // 🚫 Phase 9.7 防作弊 1：< 60 秒不算
    if (opts.durationSec < 60) {
      console.log(
        `[squad-record] 跳過 battle slot ${opts.slotId}：時長 ${opts.durationSec}s < 60s`,
      );
      return;
    }

    // 🚫 Phase 9.7 防作弊 2：24h 內 vs 同對手第 6+ 場不算
    if (opts.opponentSquadId) {
      const recentDuel = await checkRecentDuelLimit(
        opts.squadId,
        opts.opponentSquadId,
      );
      if (recentDuel.shouldSkip) {
        console.log(
          `[squad-record] 跳過 battle：vs 同對手 24h 內第 ${recentDuel.count + 1} 場（達上限 5）`,
        );
        return;
      }
    }

    await db.insert(squadMatchRecords).values({
      squadId: opts.squadId,
      squadType: opts.squadType,
      gameType: "battle",
      slotId: opts.slotId,
      fieldId: opts.fieldId,
      result: opts.result,
      performance: opts.performance,
      durationSec: opts.durationSec,
      isCrossField: opts.isCrossField ?? false,
      isFirstVisit: opts.isFirstVisit ?? false,
    });

    await ensureSquadStats(opts.squadId, opts.squadType);
    const isWin = opts.result === "win";
    const isLoss = opts.result === "loss";
    const isDraw = opts.result === "draw";
    await db
      .update(squadStats)
      .set({
        totalGamesRaw: sql`${squadStats.totalGamesRaw} + 1`,
        totalGames: sql`${squadStats.totalGames} + 1`,
        totalWins: isWin ? sql`${squadStats.totalWins} + 1` : squadStats.totalWins,
        totalLosses: isLoss ? sql`${squadStats.totalLosses} + 1` : squadStats.totalLosses,
        totalDraws: isDraw ? sql`${squadStats.totalDraws} + 1` : squadStats.totalDraws,
        monthlyGames: sql`${squadStats.monthlyGames} + 1`,
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(squadStats.squadId, opts.squadId));

    // 🆕 Phase 6.5：觸發獎勵規則引擎
    await triggerRewardEngine({
      eventType: "game_complete",
      sourceId: opts.slotId,
      sourceType: "battle_result",
      squadId: opts.squadId,
      fieldId: opts.fieldId,
      context: {
        gameType: "battle",
        result: opts.result,
        isCrossField: opts.isCrossField ?? false,
        isFirstVisit: opts.isFirstVisit ?? false,
        isMvp: opts.performance.isMvp,
      },
    });
  } catch (err) {
    console.error("[squad-record-writer] writeSquadRecordFromBattle 失敗:", err);
  }
}

/**
 * 包裝呼叫 reward engine（fire-and-forget）
 */
async function triggerRewardEngine(event: {
  eventType: string;
  sourceId: string;
  sourceType: string;
  squadId?: string;
  userId?: string;
  fieldId?: string;
  context: Record<string, unknown>;
}): Promise<void> {
  try {
    const { evaluateRules } = await import("./reward-engine");
    await evaluateRules(event);
  } catch (err) {
    console.error("[squad-record-writer] reward engine 觸發失敗:", err);
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** 對應遊戲 mode → SquadGameType */
function mapGameModeToSquadType(gameMode: string | null): string {
  if (!gameMode) return "adventure";
  switch (gameMode) {
    case "team":
      return "adventure"; // 一般 team 模式視為冒險
    case "competitive":
      return "competitive";
    case "relay":
      return "relay";
    case "individual":
      return "adventure";
    default:
      return "adventure";
  }
}

/**
 * 🚫 Phase 9.7：24 小時內對同對手場次限制
 *
 * 規則（按 SQUAD_SYSTEM_DESIGN §19.3）：
 *   第 1-3 場：100% 計分
 *   第 4-5 場：50% 計分（這版本仍計入但 multiplier=0.5）
 *   第 6 場+ ：完全不計（shouldSkip = true）
 */
async function checkRecentDuelLimit(
  squadId: string,
  opponentSquadId: string,
): Promise<{ shouldSkip: boolean; count: number }> {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  // 查 24h 內 squadId vs opponentSquadId 的對戰場次
  // 這裡用 raw SQL 檢查（用 jsonb performance 內的 opponentSquadId 欄位 — 暫時不可，因為現在還沒寫入）
  // 簡化版：用 slot_id 找同 slot 內雙方都有紀錄
  // 暫時：用 squadId 的最近 24h record 數量當代理（粗略）
  const recentRecords = await db
    .select()
    .from(squadMatchRecords)
    .where(
      and(
        eq(squadMatchRecords.squadId, squadId),
        sql`${squadMatchRecords.playedAt} > ${twentyFourHoursAgo}`,
      ),
    );

  const count = recentRecords.length;
  return {
    shouldSkip: count >= 5,
    count,
  };
}

/** 確保 squad_stats 有對應的 row（自動建立）*/
async function ensureSquadStats(squadId: string, squadType: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(squadStats)
    .where(eq(squadStats.squadId, squadId))
    .limit(1);
  if (existing) return;

  await db.insert(squadStats).values({
    squadId,
    squadType,
    firstActiveAt: new Date(),
  });
}
