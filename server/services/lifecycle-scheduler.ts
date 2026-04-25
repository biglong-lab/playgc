// 隊伍 lifecycle 自動轉換 + 超級隊長段位寫入 cron — Phase 14.2 / 14.3
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §1.2 §13.3 §18
//
// 兩個任務合一個 cron（每 12 小時跑一次）：
//
// 任務 1：隊伍狀態自動轉換
//   - 0 場 → 新隊（squadStatus = 'active'）
//   - 1-9 場 → 新人（active）
//   - 10-49 場 → 活躍（active）
//   - 50-99 場 → 資深（active）
//   - 100+ 場 → 傳奇（active）
//   - 30+ 天無活動 → dormant（已由 dormancy-scheduler 處理，這裡跳過）
//   - 升級時觸發 tier_upgrade 通知
//
// 任務 2：超級隊長段位（squadStats.superLeaderTier）
//   - Bronze: 10+ 場
//   - Silver: 50+ 場 + 勝率 40%+
//   - Gold: 100+ 場 + 勝率 50%+ + 跨 2 場域
//   - Platinum: 200+ 場 + 跨 3 場域
//   - Super: 平台 top 10 + 招募 30+
//
import { db } from "../db";
import { squadStats, fieldEngagementSettings } from "@shared/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import {
  deriveSquadTier,
  deriveSuperLeaderTier,
  compareTier,
  tierLabel,
  type SuperLeaderTier,
  type SuperLeaderInput,
} from "./lifecycle-rules";

export {
  deriveSquadTier,
  deriveSuperLeaderTier,
  type SuperLeaderTier,
  type SuperLeaderInput,
} from "./lifecycle-rules";

// ============================================================================
// 主要 cron 函式
// ============================================================================

export interface LifecycleResult {
  squadsProcessed: number;
  tierUpgrades: Array<{ squadId: string; oldTier: string | null; newTier: SuperLeaderTier }>;
  errors: string[];
}

export async function runLifecycleCycle(): Promise<LifecycleResult> {
  const result: LifecycleResult = {
    squadsProcessed: 0,
    tierUpgrades: [],
    errors: [],
  };

  try {
    // 取所有 active squad（含舊資料）
    const stats = await db
      .select()
      .from(squadStats)
      .where(gte(squadStats.totalGamesRaw, 1));

    // 平台 top 10 用排序計算
    const top10Ids = new Set(
      stats
        .slice()
        .sort((a, b) => b.totalGames - a.totalGames)
        .slice(0, 10)
        .map((s) => s.squadId),
    );

    for (const squad of stats) {
      try {
        const platformRank = top10Ids.has(squad.squadId)
          ? Array.from(top10Ids).indexOf(squad.squadId) + 1
          : undefined;

        const newSuperTier = deriveSuperLeaderTier({
          totalGames: squad.totalGames,
          totalGamesRaw: squad.totalGamesRaw,
          totalWins: squad.totalWins,
          totalLosses: squad.totalLosses,
          recruitsCount: squad.recruitsCount,
          fieldsPlayed: (squad.fieldsPlayed as string[]) ?? [],
          platformRank,
        });

        // 變化才寫入
        if (newSuperTier !== squad.superLeaderTier) {
          await db
            .update(squadStats)
            .set({
              superLeaderTier: newSuperTier,
              updatedAt: new Date(),
            })
            .where(eq(squadStats.squadId, squad.squadId));

          // 升級才記錄（降級不記）
          const direction = compareTier(
            squad.superLeaderTier as SuperLeaderTier | null,
            newSuperTier,
          );
          if (newSuperTier && direction === 1) {
            result.tierUpgrades.push({
              squadId: squad.squadId,
              oldTier: squad.superLeaderTier,
              newTier: newSuperTier,
            });

            // 觸發 tier_upgrade 通知（fire-and-forget）
            // 取主場 fieldId（fieldsPlayed[0]）
            const fields = (squad.fieldsPlayed as string[]) ?? [];
            if (fields.length > 0) {
              try {
                const { dispatchNotification } = await import(
                  "./notification-dispatcher"
                );
                await dispatchNotification({
                  fieldId: fields[0],
                  squadId: squad.squadId,
                  eventType: "tier_upgrade",
                  payload: {
                    title: `隊伍升級！`,
                    body: `🌟 隊伍升級為「${tierLabel(newSuperTier)}」！`,
                  },
                  dedupeKey: `tier_${squad.squadId}_${newSuperTier}`,
                });
              } catch (e) {
                console.warn("[lifecycle] 通知失敗:", e);
              }
            }
          }
        }

        result.squadsProcessed++;
      } catch (e) {
        const msg = `squad ${squad.squadId}: ${e instanceof Error ? e.message : String(e)}`;
        console.error("[lifecycle]", msg);
        result.errors.push(msg);
      }
    }
  } catch (e) {
    const msg = `cycle 失敗: ${e instanceof Error ? e.message : String(e)}`;
    console.error("[lifecycle]", msg);
    result.errors.push(msg);
  }

  return result;
}

// ============================================================================
// 啟動 scheduler（每 12 小時跑一次）
// ============================================================================

let schedulerInterval: NodeJS.Timeout | null = null;
let initialDelay: NodeJS.Timeout | null = null;

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 10 * 60 * 1000; // 啟動 10 分鐘後跑首輪

export function startLifecycleScheduler(): void {
  if (schedulerInterval) {
    console.warn("[lifecycle-scheduler] 已在運行");
    return;
  }

  console.log("[lifecycle-scheduler] 已啟動（每 12 小時跑一次）");

  initialDelay = setTimeout(async () => {
    const result = await runLifecycleCycle();
    console.log(
      `[lifecycle-scheduler] 首輪完成: ${result.squadsProcessed} 隊處理 / ${result.tierUpgrades.length} 個升級`,
    );

    schedulerInterval = setInterval(async () => {
      const r = await runLifecycleCycle();
      console.log(
        `[lifecycle-scheduler] 定期執行: ${r.squadsProcessed} 隊 / ${r.tierUpgrades.length} 升級`,
      );
    }, TWELVE_HOURS_MS);
  }, INITIAL_DELAY_MS);
}

export function stopLifecycleScheduler(): void {
  if (initialDelay) {
    clearTimeout(initialDelay);
    initialDelay = null;
  }
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[lifecycle-scheduler] 已停止");
  }
}
