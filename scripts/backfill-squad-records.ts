// 重建 squad_stats 聚合表（從 squad_match_records）
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §25.1 階段 2
//
// 用途：
//   把目前已寫入的 squad_match_records 重新聚合成 squad_stats
//   修正歷史資料 / 修正計算錯誤 / 排行榜重新排序時使用
//
// 用法：
//   npx tsx scripts/backfill-squad-records.ts [--dry-run]
//
import { db } from "../server/db";
import {
  squadMatchRecords,
  squadStats,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

interface BackfillStats {
  squadStatsCreated: number;
  squadStatsUpdated: number;
  errors: string[];
}

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

console.log("=".repeat(60));
console.log("Squad Stats Rebuild");
console.log("=".repeat(60));
console.log(`模式：${isDryRun ? "Dry Run（不寫資料）" : "正式寫入"}`);
console.log("");

async function rebuildSquadStats(stats: BackfillStats) {
  console.log("📊 重建 squad_stats（從 squad_match_records 聚合）...");

  // 1. 取所有 distinct squadId
  const distinctSquads = await db
    .selectDistinctOn([squadMatchRecords.squadId], {
      squadId: squadMatchRecords.squadId,
      squadType: squadMatchRecords.squadType,
    })
    .from(squadMatchRecords);

  console.log(`   找到 ${distinctSquads.length} 個有戰績的 squad`);

  for (const s of distinctSquads) {
    try {
      // 2. 計算聚合
      const [agg] = await db
        .select({
          totalGames: sql<number>`count(*)::int`,
          totalGamesRaw: sql<number>`count(*)::int`,
          totalWins: sql<number>`sum(case when result = 'win' then 1 else 0 end)::int`,
          totalLosses: sql<number>`sum(case when result = 'loss' then 1 else 0 end)::int`,
          totalDraws: sql<number>`sum(case when result = 'draw' then 1 else 0 end)::int`,
          totalExpPoints: sql<number>`coalesce(sum(exp_points), 0)::int`,
          firstActiveAt: sql<Date>`min(played_at)`,
          lastActiveAt: sql<Date>`max(played_at)`,
        })
        .from(squadMatchRecords)
        .where(eq(squadMatchRecords.squadId, s.squadId));

      // 3. 取場域數
      const fields = await db
        .selectDistinctOn([squadMatchRecords.fieldId], {
          fieldId: squadMatchRecords.fieldId,
        })
        .from(squadMatchRecords)
        .where(eq(squadMatchRecords.squadId, s.squadId));
      const fieldsPlayed = fields.map((f) => f.fieldId);

      // 4. 30 天內的活動
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);
      const [recent] = await db
        .select({
          monthlyGames: sql<number>`count(*)::int`,
        })
        .from(squadMatchRecords)
        .where(
          sql`${squadMatchRecords.squadId} = ${s.squadId} AND ${squadMatchRecords.playedAt} >= ${thirtyDaysAgo}`,
        );

      if (!isDryRun) {
        const result = await db
          .insert(squadStats)
          .values({
            squadId: s.squadId,
            squadType: s.squadType,
            totalGames: agg.totalGames,
            totalGamesRaw: agg.totalGamesRaw,
            totalWins: agg.totalWins,
            totalLosses: agg.totalLosses,
            totalDraws: agg.totalDraws,
            totalExpPoints: agg.totalExpPoints,
            fieldsPlayed,
            monthlyGames: recent?.monthlyGames ?? 0,
            firstActiveAt: agg.firstActiveAt,
            lastActiveAt: agg.lastActiveAt,
          })
          .onConflictDoUpdate({
            target: squadStats.squadId,
            set: {
              totalGames: agg.totalGames,
              totalGamesRaw: agg.totalGamesRaw,
              totalWins: agg.totalWins,
              totalLosses: agg.totalLosses,
              totalDraws: agg.totalDraws,
              totalExpPoints: agg.totalExpPoints,
              fieldsPlayed,
              monthlyGames: recent?.monthlyGames ?? 0,
              lastActiveAt: agg.lastActiveAt,
              updatedAt: new Date(),
            },
          })
          .returning({ squadId: squadStats.squadId });

        if (result.length > 0) {
          stats.squadStatsUpdated++;
        }
      }

      stats.squadStatsCreated++;
    } catch (err) {
      const msg = `squad_stats ${s.squadId}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      stats.errors.push(msg);
    }
  }

  console.log(`   ✅ 已處理 ${stats.squadStatsCreated} 筆`);
}

async function main() {
  const stats: BackfillStats = {
    squadStatsCreated: 0,
    squadStatsUpdated: 0,
    errors: [],
  };

  try {
    await rebuildSquadStats(stats);

    console.log("");
    console.log("=".repeat(60));
    console.log("總結");
    console.log("=".repeat(60));
    console.log(`Squad Stats 處理：${stats.squadStatsCreated}`);
    console.log(`Squad Stats 寫入：${stats.squadStatsUpdated}`);
    console.log(`錯誤：${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log("");
      console.log("⚠️  錯誤明細（前 10 筆）：");
      for (const e of stats.errors.slice(0, 10)) {
        console.log(`   - ${e}`);
      }
    }

    if (isDryRun) {
      console.log("");
      console.log("⚠️  這是 dry-run 模式，沒有實際寫入資料");
      console.log("   要正式執行請移除 --dry-run flag");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Rebuild 失敗:", err);
    process.exit(1);
  }
}

main();
