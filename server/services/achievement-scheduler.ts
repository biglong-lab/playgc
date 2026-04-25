// 自動成就計算 cron — Phase 12.4
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §9.2 §9.3 §9.5
//
// 觸發成就：
//   - 跨場域：本地常客 / 雙城傳說 / 三城遠征 / 全國巡迴
//   - 場次里程碑：首戰 / 10 場 / 50 場 / 100 場（hall_of_fame）/ 500 場
//   - 招募：小招募家 / 招募達人 / 超級隊長候選
//   - 體驗：常客 (100 expPoints / 500 / 1000)
//
// 排程：每 6 小時跑一次（UTC 00:00, 06:00, 12:00, 18:00）
// 執行：批次掃描 squad_stats，逐隊判斷各成就，未達成就插入 squad_achievements
//
import { db } from "../db";
import { squadStats, squadAchievements, squadMatchRecords } from "@shared/schema";
import { eq, sql, gte } from "drizzle-orm";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  type AchievementContext,
} from "./achievement-rules";

export { ACHIEVEMENTS, type AchievementContext } from "./achievement-rules";

// ============================================================================
// 主要 cron 函式
// ============================================================================

export interface AchievementRunResult {
  squadsProcessed: number;
  achievementsAwarded: number;
  errors: string[];
}

/**
 * 跑一輪所有隊伍的成就計算
 * 1. 取所有有 totalGamesRaw >= 1 的 squad_stats
 * 2. 對每隊：算各場域場次 + 跑所有 ACHIEVEMENTS.check
 * 3. 未達成的插入 squad_achievements（onConflictDoNothing）
 */
export async function runAchievementsCycle(): Promise<AchievementRunResult> {
  const result: AchievementRunResult = {
    squadsProcessed: 0,
    achievementsAwarded: 0,
    errors: [],
  };

  try {
    // 1. 取候選 squads（有打過至少 1 場）
    const stats = await db
      .select()
      .from(squadStats)
      .where(gte(squadStats.totalGamesRaw, 1));

    for (const squad of stats) {
      try {
        // 2. 算該隊在各場域的場次（join records）
        const fieldGames = await db
          .select({
            fieldId: squadMatchRecords.fieldId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(squadMatchRecords)
          .where(eq(squadMatchRecords.squadId, squad.squadId))
          .groupBy(squadMatchRecords.fieldId);

        const fieldGamesMap: Record<string, number> = {};
        let homeFieldGames = 0;
        for (const fg of fieldGames) {
          fieldGamesMap[fg.fieldId] = fg.count;
          if (fg.count > homeFieldGames) homeFieldGames = fg.count;
        }

        // 🆕 Phase 15.4：計算 event category 統計（從 performance jsonb）
        const eventCategoryRows = await db
          .select({
            category: sql<string>`${squadMatchRecords.performance}->>'eventCategory'`,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(squadMatchRecords)
          .where(
            and(
              eq(squadMatchRecords.squadId, squad.squadId),
              sql`${squadMatchRecords.performance}->>'eventCategory' IS NOT NULL`,
            ),
          )
          .groupBy(sql`${squadMatchRecords.performance}->>'eventCategory'`);

        const eventCategoryCounts: Record<string, number> = {};
        for (const r of eventCategoryRows) {
          if (r.category) eventCategoryCounts[r.category] = r.count;
        }

        // 🆕 Phase 15.4：個人挑戰統計
        const [{ recordBreaks } = { recordBreaks: 0 }] = await db
          .select({
            recordBreaks: sql<number>`COUNT(*) FILTER (WHERE ${squadMatchRecords.performance}->>'brokeRecord' = 'true')::int`,
          })
          .from(squadMatchRecords)
          .where(eq(squadMatchRecords.squadId, squad.squadId));

        const [{ speedrunGames } = { speedrunGames: 0 }] = await db
          .select({
            speedrunGames: sql<number>`COUNT(*) FILTER (WHERE ${squadMatchRecords.gameType} = 'speedrun' OR ${squadMatchRecords.performance}->>'isSpeedrun' = 'true')::int`,
          })
          .from(squadMatchRecords)
          .where(eq(squadMatchRecords.squadId, squad.squadId));

        const ctx: AchievementContext = {
          squadId: squad.squadId,
          totalGames: squad.totalGames,
          totalGamesRaw: squad.totalGamesRaw,
          totalWins: squad.totalWins,
          totalLosses: squad.totalLosses,
          totalExpPoints: squad.totalExpPoints,
          recruitsCount: squad.recruitsCount,
          fieldsPlayed: (squad.fieldsPlayed as string[]) ?? [],
          homeFieldGames,
          fieldGamesMap,
          eventCategoryCounts,
          personalBestBreaks: recordBreaks,
          speedrunGames,
        };

        // 3. 對每個成就 check + 嘗試插入
        const earned = evaluateAchievements(ctx);
        for (const ach of earned) {
          try {
            const inserted = await db
              .insert(squadAchievements)
              .values({
                squadId: ctx.squadId,
                achievementKey: ach.key,
                category: ach.category,
                displayName: ach.displayName,
                description: ach.description,
              })
              .onConflictDoNothing()
              .returning({ id: squadAchievements.id });

            if (inserted.length > 0) {
              result.achievementsAwarded++;
            }
          } catch (e) {
            console.warn(
              `[achievement-scheduler] insert ${ach.key} for ${ctx.squadId} 失敗:`,
              e,
            );
          }
        }

        result.squadsProcessed++;
      } catch (e) {
        const msg = `squad ${squad.squadId}: ${e instanceof Error ? e.message : String(e)}`;
        console.error("[achievement-scheduler]", msg);
        result.errors.push(msg);
      }
    }
  } catch (e) {
    const msg = `cycle 失敗: ${e instanceof Error ? e.message : String(e)}`;
    console.error("[achievement-scheduler]", msg);
    result.errors.push(msg);
  }

  return result;
}

// ============================================================================
// 啟動 scheduler（每 6 小時跑一次）
// ============================================================================

let schedulerInterval: NodeJS.Timeout | null = null;
let initialDelay: NodeJS.Timeout | null = null;

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 5 * 60 * 1000; // 啟動 5 分鐘後跑第一次

export function startAchievementScheduler(): void {
  if (schedulerInterval) {
    console.warn("[achievement-scheduler] 已在運行");
    return;
  }

  console.log("[achievement-scheduler] 已啟動（每 6 小時跑一次）");

  // 5 分鐘後跑第一次（避開 server 啟動高峰）
  initialDelay = setTimeout(async () => {
    const result = await runAchievementsCycle();
    console.log(
      `[achievement-scheduler] 首輪完成: ${result.squadsProcessed} 隊處理 / ${result.achievementsAwarded} 個成就發放`,
    );

    // 之後每 6 小時跑一次
    schedulerInterval = setInterval(async () => {
      const r = await runAchievementsCycle();
      console.log(
        `[achievement-scheduler] 定期執行完成: ${r.squadsProcessed} 隊 / ${r.achievementsAwarded} 個成就`,
      );
    }, SIX_HOURS_MS);
  }, INITIAL_DELAY_MS);
}

export function stopAchievementScheduler(): void {
  if (initialDelay) {
    clearTimeout(initialDelay);
    initialDelay = null;
  }
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[achievement-scheduler] 已停止");
  }
}
