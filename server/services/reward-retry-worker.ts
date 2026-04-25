// 失敗獎勵 retry worker — Phase 15.9
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26 商業閉環
//
// 用途：
//   - aihomi webhook 失敗的 squad_external_rewards（status='pending' 但長時間沒回 callback）→ 重送
//   - reward_conversion_events status='failed' 的事件 → 重新評估
//
// 排程：每 30 分鐘跑一次
//
import { db } from "../db";
import {
  squadExternalRewards,
  rewardConversionEvents,
} from "@shared/schema";
import { eq, and, sql, lte, isNull } from "drizzle-orm";

let workerInterval: NodeJS.Timeout | null = null;
let initialDelay: NodeJS.Timeout | null = null;

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const INITIAL_DELAY_MS = 8 * 60 * 1000; // 啟動 8 分鐘後跑首次

const MAX_RETRY_ATTEMPTS = 3;
/** 最後嘗試時間距今 5 分鐘以上才重試（避免同一輪跑兩次）*/
const MIN_RETRY_GAP_MINUTES = 5;
/** 超過 24 小時還沒成功 → 標記永久失敗 */
const PERMANENT_FAIL_AFTER_HOURS = 24;

export interface RetryResult {
  externalRewardsRetried: number;
  externalRewardsPermanentlyFailed: number;
  errors: string[];
}

/**
 * 重試 squad_external_rewards status='pending' + 長時間沒 callback 的紀錄
 */
export async function runRewardRetryCycle(): Promise<RetryResult> {
  const result: RetryResult = {
    externalRewardsRetried: 0,
    externalRewardsPermanentlyFailed: 0,
    errors: [],
  };

  try {
    const minRetryAgo = new Date(Date.now() - MIN_RETRY_GAP_MINUTES * 60 * 1000);
    const permanentFailAgo = new Date(
      Date.now() - PERMANENT_FAIL_AFTER_HOURS * 60 * 60 * 1000,
    );

    // 取所有 pending + 5 分鐘前以上的記錄
    const pendingRewards = await db
      .select()
      .from(squadExternalRewards)
      .where(
        and(
          eq(squadExternalRewards.status, "pending"),
          lte(squadExternalRewards.createdAt, minRetryAgo),
        ),
      )
      .limit(100);

    for (const reward of pendingRewards) {
      try {
        // 超過 24 小時 → 標記永久失敗
        if (reward.createdAt < permanentFailAgo) {
          await db
            .update(squadExternalRewards)
            .set({ status: "failed" })
            .where(eq(squadExternalRewards.id, reward.id));
          result.externalRewardsPermanentlyFailed++;
          console.log(
            `[reward-retry] permanent fail: ${reward.id} (${reward.provider}) — 超過 ${PERMANENT_FAIL_AFTER_HOURS} 小時`,
          );
          continue;
        }

        // 重送 webhook
        if (reward.provider === "aihomi_coupon" && reward.userId) {
          try {
            const { sendAihomiReward } = await import("./aihomi-adapter");
            const sendResult = await sendAihomiReward({
              externalRewardId: reward.id,
              userId: reward.userId,
              eventContext: {
                eventType: "retry",
                squadId: reward.squadId ?? undefined,
              },
              voucherTemplate: reward.displayName ?? "",
            });

            if (!sendResult.success && !sendResult.pending) {
              console.warn(
                `[reward-retry] aihomi 重送失敗 ${reward.id}:`,
                sendResult.errorMessage,
              );
            } else {
              result.externalRewardsRetried++;
              console.log(`[reward-retry] aihomi 重送成功 ${reward.id}`);
            }
          } catch (e) {
            const msg = `${reward.id}: ${e instanceof Error ? e.message : String(e)}`;
            result.errors.push(msg);
          }
        }
      } catch (e) {
        const msg = `${reward.id}: ${e instanceof Error ? e.message : String(e)}`;
        console.error("[reward-retry]", msg);
        result.errors.push(msg);
      }
    }
  } catch (e) {
    const msg = `cycle 失敗: ${e instanceof Error ? e.message : String(e)}`;
    console.error("[reward-retry]", msg);
    result.errors.push(msg);
  }

  return result;
}

export function startRewardRetryWorker(): void {
  if (workerInterval) {
    console.warn("[reward-retry-worker] 已在運行");
    return;
  }

  console.log("[reward-retry-worker] 已啟動（每 30 分鐘跑一次）");

  initialDelay = setTimeout(async () => {
    const result = await runRewardRetryCycle();
    console.log(
      `[reward-retry-worker] 首輪: ${result.externalRewardsRetried} 重送 / ${result.externalRewardsPermanentlyFailed} 永久失敗`,
    );

    workerInterval = setInterval(async () => {
      const r = await runRewardRetryCycle();
      console.log(
        `[reward-retry-worker] 週期: ${r.externalRewardsRetried} 重送 / ${r.externalRewardsPermanentlyFailed} 永久失敗`,
      );
    }, THIRTY_MINUTES_MS);
  }, INITIAL_DELAY_MS);
}

export function stopRewardRetryWorker(): void {
  if (initialDelay) {
    clearTimeout(initialDelay);
    initialDelay = null;
  }
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[reward-retry-worker] 已停止");
  }
}

export const RETRY_CONFIG = {
  MAX_RETRY_ATTEMPTS,
  MIN_RETRY_GAP_MINUTES,
  PERMANENT_FAIL_AFTER_HOURS,
};
