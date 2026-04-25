// 隊伍休眠 + 召回通知排程器
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §16 §18
//
// 每天跑一次：
//   1. 找出所有 squads
//   2. 對每個 squad 計算狀態（active / warning_3/7/14 / dormant）
//   3. 如果是 warning_X → 觸發對應召回通知
//   4. 如果是 dormant → 標記 squad_status = 'dormant'
//
// 設計：
//   - 失敗單一 squad 不影響其他
//   - 用 dedupeKey 避免重複發送（每隊每天最多 1 封）
//   - 走通知 dispatcher（admin 可關閉/調整管道）
//
import { db } from "../db";
import {
  squadStats,
  fieldEngagementSettings,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { determineActivityStatus } from "./engagement-calculator";
import { dispatchNotification } from "./notification-dispatcher";

/** 排程器設定 */
interface SchedulerConfig {
  intervalMs: number;
  enabled: boolean;
  initialDelayMs: number; // server 啟動後多久跑第一次
}

const DEFAULT_CONFIG: SchedulerConfig = {
  intervalMs: 24 * 60 * 60 * 1000,    // 每 24 小時
  enabled: true,
  initialDelayMs: 60 * 60 * 1000,     // 啟動 1 小時後跑第一次（避開高峰）
};

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;

/** 啟動排程器 */
export function startDormancyScheduler(
  config: Partial<SchedulerConfig> = {},
): void {
  const { intervalMs, enabled, initialDelayMs } = { ...DEFAULT_CONFIG, ...config };
  if (!enabled) {
    console.info("[DormancyScheduler] 排程器停用");
    return;
  }

  // 啟動 1 小時後第一次（讓 server warm up）
  initialTimer = setTimeout(() => {
    runDormancyCycle().catch((err) => {
      console.error("[DormancyScheduler] 首次執行失敗:", err);
    });

    // 之後每 24h 跑一次
    schedulerTimer = setInterval(() => {
      runDormancyCycle().catch((err) => {
        console.error("[DormancyScheduler] 週期執行失敗:", err);
      });
    }, intervalMs);
  }, initialDelayMs);

  console.info(
    `[DormancyScheduler] 已啟動，${initialDelayMs / 60000} 分鐘後第一次執行，之後每 ${
      intervalMs / 3600000
    } 小時一次`,
  );
}

/** 停止排程器 */
export function stopDormancyScheduler(): void {
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

/**
 * 執行一次完整 cycle
 *
 * 流程：
 *   1. 取所有有活動紀錄的 squads
 *   2. 對每個 squad 取對應場域設定
 *   3. 用 determineActivityStatus 算狀態
 *   4. 視狀態觸發通知或標記休眠
 */
export async function runDormancyCycle(): Promise<{
  processed: number;
  warned: number;
  dormant: number;
  errors: number;
}> {
  const stats = { processed: 0, warned: 0, dormant: 0, errors: 0 };

  console.info("[DormancyScheduler] cycle 開始");

  try {
    // 取所有 squads（有 lastActiveAt 的才有意義）
    const squads = await db
      .select()
      .from(squadStats);

    // 取所有場域設定（cache）
    const allSettings = await db.select().from(fieldEngagementSettings);
    const settingsByField = new Map(allSettings.map((s) => [s.fieldId, s]));

    for (const squad of squads) {
      try {
        if (!squad.lastActiveAt) continue;
        if (squad.squadStatus === "dissolved") continue; // 解散的不處理

        // 取場域設定（squad 沒明確場域時用第一個 fieldsPlayed）
        const fieldsPlayed = (squad.fieldsPlayed as string[]) ?? [];
        const fieldId = fieldsPlayed[0];
        if (!fieldId) continue;

        const settings = settingsByField.get(fieldId);
        const config = {
          daysThreshold: settings?.dormancyDaysThreshold ?? 30,
          warningDays: ((settings?.dormancyWarningDays as number[]) ?? [3, 7, 14]),
        };

        const status = determineActivityStatus(squad.lastActiveAt, config);

        // 已是 dormant 且 status 還是 dormant → 跳過（不重複處理）
        if (status === "dormant" && squad.squadStatus === "dormant") {
          continue;
        }

        // 處理 warning_X
        if (status.startsWith("warning_")) {
          const days = parseInt(status.split("_")[1] ?? "3", 10);
          await sendDormancyWarning(squad.squadId, fieldId, days);
          stats.warned++;
        }

        // 標記 dormant
        if (status === "dormant" && squad.squadStatus !== "dormant") {
          await db
            .update(squadStats)
            .set({ squadStatus: "dormant", updatedAt: new Date() })
            .where(eq(squadStats.squadId, squad.squadId));
          stats.dormant++;
        }

        // 從 dormant 喚醒
        if (status === "active" && squad.squadStatus === "dormant") {
          await db
            .update(squadStats)
            .set({ squadStatus: "active", updatedAt: new Date() })
            .where(eq(squadStats.squadId, squad.squadId));
        }

        stats.processed++;
      } catch (err) {
        console.error(`[DormancyScheduler] squad ${squad.squadId} 處理失敗:`, err);
        stats.errors++;
      }
    }
  } catch (err) {
    console.error("[DormancyScheduler] cycle 整體失敗:", err);
  }

  console.info(
    `[DormancyScheduler] cycle 完成：processed ${stats.processed} / warned ${stats.warned} / dormant ${stats.dormant} / errors ${stats.errors}`,
  );

  return stats;
}

/**
 * 發送召回通知
 */
async function sendDormancyWarning(
  squadId: string,
  fieldId: string,
  daysSince: number,
): Promise<void> {
  // 內容依天數調整（按 SQUAD_SYSTEM_DESIGN §16）
  let title: string;
  let body: string;
  if (daysSince === 3) {
    title = "🌱 你的隊伍想念你！";
    body = "已經 3 天沒對戰了，再打一場保持新人榜排名！";
  } else if (daysSince === 7) {
    title = "⚡ 限時福利提醒";
    body = "1 週沒回來，回來打 1 場有 +50 體驗點獎勵！";
  } else {
    title = "💎 最後機會";
    body = `${daysSince} 天沒回來，再不打就要進入休眠了。回來解鎖獎勵吧！`;
  }

  await dispatchNotification({
    fieldId,
    squadId,
    eventType: "dormancy_warning",
    payload: {
      title,
      body,
      deepLink: "https://game.homi.cc/battle",
    },
    // dedupeKey 防同一天重複發
    dedupeKey: `dormancy_${squadId}_${daysSince}_${new Date().toISOString().slice(0, 10)}`,
  });
}
