// 獎勵轉換節點 — 規則引擎核心
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26.5
//
// 流程：
//   1. 接收 GameResultEvent
//   2. 取出相關規則（場域 + 全平台）
//   3. 依 priority 排序
//   4. 一一評估觸發條件
//   5. 通過 → 發獎勵 + 更新配額
//   6. 寫入事件流（可重放）
//
import { db } from "../db";
import {
  rewardConversionRules,
  rewardConversionEvents,
  platformCoupons,
  couponTemplates,
  squadExternalRewards,
  squadAchievements,
  squadStats,
  type RewardConversionRule,
} from "@shared/schema";
import { eq, and, or, desc, isNull, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { matchTriggers, type RewardEvent, type RuleTriggers } from "./reward-rules-matcher";

// 重新匯出（保持原本 reward-engine.ts 的外部介面不變）
export { matchTriggers, type RewardEvent };

/** 獎勵描述 */
interface RewardSpec {
  type: string;          // platform_coupon / exp_points / external_coupon / badge / ...
  provider?: string;     // 'aihomi_coupon' / null
  value?: number | string;
  templateId?: string;
  target: "squad" | "leader" | "all_members";
  metadata?: Record<string, unknown>;
}

/** 配額 */
interface RuleQuota {
  perSquad?: number;
  perDay?: number;
  totalCap?: number;
  validUntil?: string;
}

/** 評估結果 */
export interface EvaluationResult {
  rulesEvaluated: Array<{ ruleId: string; matched: boolean; reason?: string }>;
  rewardsIssued: Array<{
    ruleId: string;
    rewardType: string;
    target: string;
    issuedId: string;
  }>;
  errors: string[];
}

// ============================================================================
// 主入口：evaluateRules
// ============================================================================

/**
 * 評估事件 → 觸發規則 → 發獎勵
 *
 * 設計：fire-and-forget（呼叫端不等回應），但會寫入 events 表方便追溯
 */
export async function evaluateRules(event: RewardEvent): Promise<EvaluationResult> {
  const result: EvaluationResult = {
    rulesEvaluated: [],
    rewardsIssued: [],
    errors: [],
  };

  try {
    // 1. 取出所有可能觸發的規則（場域 + 全平台）
    const rules = await db
      .select()
      .from(rewardConversionRules)
      .where(
        and(
          eq(rewardConversionRules.isActive, true),
          // 全平台規則 OR 對應場域的規則
          event.fieldId
            ? or(
                isNull(rewardConversionRules.fieldId),
                eq(rewardConversionRules.fieldId, event.fieldId),
              )
            : isNull(rewardConversionRules.fieldId),
        ),
      )
      .orderBy(desc(rewardConversionRules.priority));

    // 2. 一一評估
    for (const rule of rules) {
      const triggers = rule.triggers as RuleTriggers;
      const matched = matchTriggers(triggers, event);

      result.rulesEvaluated.push({
        ruleId: rule.id,
        matched,
        reason: matched ? "matched" : "triggers not satisfied",
      });

      if (!matched) continue;

      // 3. 配額檢查
      const quota = (rule.quota as RuleQuota) ?? {};
      const quotaOk = await checkQuota(rule, event.squadId, quota);
      if (!quotaOk) {
        result.rulesEvaluated[result.rulesEvaluated.length - 1].reason = "quota exceeded";
        continue;
      }

      // 4. 發放獎勵
      const rewards = rule.rewards as RewardSpec[];
      for (const reward of rewards) {
        try {
          const issued = await issueReward(reward, event, rule.id);
          if (issued) {
            result.rewardsIssued.push({
              ruleId: rule.id,
              rewardType: reward.type,
              target: reward.target,
              issuedId: issued,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Rule ${rule.id} reward ${reward.type}: ${msg}`);
        }
      }

      // 5. 更新規則 hits_count
      await db
        .update(rewardConversionRules)
        .set({ hitsCount: rule.hitsCount + 1 })
        .where(eq(rewardConversionRules.id, rule.id));
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  // 6. 寫入事件流（永久紀錄）
  try {
    await db.insert(rewardConversionEvents).values({
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      squadId: event.squadId,
      userId: event.userId,
      eventPayload: event as unknown as Record<string, unknown>,
      rulesEvaluated: result.rulesEvaluated,
      rewardsIssued: result.rewardsIssued,
      status: result.errors.length > 0 ? "failed" : "processed",
      errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
    });
  } catch (err) {
    console.error("[reward-engine] 寫入 events 失敗:", err);
  }

  return result;
}

// ============================================================================
// 配額檢查
// ============================================================================

async function checkQuota(
  rule: RewardConversionRule,
  squadId: string | undefined,
  quota: RuleQuota,
): Promise<boolean> {
  // totalCap 檢查
  if (quota.totalCap !== undefined && rule.hitsCount >= quota.totalCap) {
    return false;
  }

  // validUntil 檢查
  if (quota.validUntil) {
    const validUntilDate = new Date(quota.validUntil);
    if (new Date() > validUntilDate) return false;
  }

  // perSquad 檢查（從 events 表算這個 squad 觸發過幾次）
  if (quota.perSquad !== undefined && squadId) {
    const previousHits = await db
      .select()
      .from(rewardConversionEvents)
      .where(
        and(
          eq(rewardConversionEvents.squadId, squadId),
          eq(rewardConversionEvents.status, "processed"),
        ),
      );
    const hits = previousHits.filter((e) => {
      const rewards = e.rewardsIssued as Array<{ ruleId: string }>;
      return rewards.some((r) => r.ruleId === rule.id);
    });
    if (hits.length >= quota.perSquad) return false;
  }

  // 🆕 Phase 15.9：perDay 檢查（每日總共觸發上限）
  if (quota.perDay !== undefined) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayHits = await db
      .select()
      .from(rewardConversionEvents)
      .where(
        and(
          eq(rewardConversionEvents.status, "processed"),
          sql`${rewardConversionEvents.createdAt} >= ${todayStart}`,
        ),
      );
    const ruleHitsToday = todayHits.filter((e) => {
      const rewards = e.rewardsIssued as Array<{ ruleId: string }>;
      return rewards.some((r) => r.ruleId === rule.id);
    });
    if (ruleHitsToday.length >= quota.perDay) return false;
  }

  return true;
}

// ============================================================================
// 發獎勵（依 type 分流）
// ============================================================================

async function issueReward(
  reward: RewardSpec,
  event: RewardEvent,
  ruleId: string,
): Promise<string | null> {
  switch (reward.type) {
    case "platform_coupon":
      return await issuePlatformCoupon(reward, event);

    case "external_coupon":
      // Phase 8 才接 aihomi，先寫入 squadExternalRewards 待處理
      return await stageExternalReward(reward, event);

    case "exp_points":
      // 🆕 Phase 13 修復：規則引擎觸發的 exp_points 直接加進 squad_stats
      // (與 calcRewards 在 record 寫入時加的點數獨立 — 規則是「額外」獎勵)
      return await issueExpPoints(reward, event);

    case "badge":
      return await issueBadge(reward, event, ruleId);

    default:
      return null;
  }
}

/** 產生平台券 */
async function issuePlatformCoupon(reward: RewardSpec, event: RewardEvent): Promise<string | null> {
  if (!reward.templateId) return null;

  // 取 template 算 expiresAt
  const [tpl] = await db
    .select()
    .from(couponTemplates)
    .where(eq(couponTemplates.id, reward.templateId));
  if (!tpl) return null;

  const validityDays = tpl.validityDays ?? 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + validityDays);

  // 產生 coupon code
  const code = generateCouponCode();

  // 決定發給誰
  const userId = reward.target === "leader" ? event.userId : null;
  const squadId = reward.target === "squad" ? event.squadId : null;

  const [created] = await db
    .insert(platformCoupons)
    .values({
      code,
      templateId: reward.templateId,
      issuedToSquadId: squadId,
      issuedToUserId: userId,
      sourceEventId: event.sourceId,
      expiresAt,
    })
    .returning();

  return created.id;
}

/** 寫入徽章（Phase 11.1） */
async function issueBadge(
  reward: RewardSpec,
  event: RewardEvent,
  ruleId: string,
): Promise<string | null> {
  if (!event.squadId) return null;
  if (!reward.value || typeof reward.value !== "string") return null;

  // unique constraint 處理：用 onConflictDoNothing 避免重複
  try {
    const [created] = await db
      .insert(squadAchievements)
      .values({
        squadId: event.squadId,
        achievementKey: reward.value,
        category: (reward.metadata?.category as string) ?? null,
        displayName: (reward.metadata?.displayName as string) ?? null,
        description: (reward.metadata?.description as string) ?? null,
        iconUrl: (reward.metadata?.iconUrl as string) ?? null,
        sourceRuleId: ruleId,
        sourceEventId: event.sourceId,
      })
      .onConflictDoNothing()
      .returning();
    return created?.id ?? null;
  } catch (err) {
    console.error("[reward-engine] issueBadge 失敗:", err);
    return null;
  }
}

/**
 * 規則觸發的體驗點數獎勵 — 直接加進 squad_stats
 * （Phase 13 修復：之前只寫 log，沒實際加進 DB）
 */
async function issueExpPoints(
  reward: RewardSpec,
  event: RewardEvent,
): Promise<string | null> {
  if (!event.squadId) {
    console.warn("[reward-engine] exp_points reward 需要 squadId，跳過");
    return null;
  }
  const points = typeof reward.value === "number" ? reward.value : Number(reward.value);
  if (!Number.isFinite(points) || points <= 0) {
    console.warn("[reward-engine] exp_points value 無效:", reward.value);
    return null;
  }

  try {
    await db
      .update(squadStats)
      .set({
        totalExpPoints: sql`${squadStats.totalExpPoints} + ${points}`,
        updatedAt: new Date(),
      })
      .where(eq(squadStats.squadId, event.squadId));
    return `exp_points_${points}`;
  } catch (err) {
    console.error("[reward-engine] issueExpPoints 失敗:", err);
    return null;
  }
}

/**
 * 預備外部券 + 即送 aihomi webhook（Phase 13 修復）
 *
 * 步驟：
 *   1. 寫 squad_external_rewards 為 pending（含 requestId 做 idempotency）
 *   2. 呼叫 sendAihomiReward 對外發 webhook
 *   3. 失敗不阻擋規則引擎（reward 留 pending，admin 可重送）
 */
async function stageExternalReward(reward: RewardSpec, event: RewardEvent): Promise<string | null> {
  if (!reward.provider) return null;
  if (!event.userId) {
    console.warn("[reward-engine] external reward 需要 userId，跳過");
    return null;
  }

  // 1. 寫 pending 記錄
  const [created] = await db
    .insert(squadExternalRewards)
    .values({
      squadId: event.squadId,
      userId: event.userId,
      provider: reward.provider,
      sourceEventId: event.sourceId,
      requestId: `req_${Date.now()}_${randomBytes(4).toString("hex")}`,
      status: "pending",
      displayName: typeof reward.value === "string" ? reward.value : null,
      valueDescription: (reward.metadata?.description as string) ?? null,
    })
    .returning();

  if (!created) return null;

  // 2. 對 aihomi 發 webhook（fire-and-forget，失敗留 pending）
  if (reward.provider === "aihomi_coupon") {
    // 動態 import 避免循環依賴
    import("./aihomi-adapter")
      .then(({ sendAihomiReward }) =>
        sendAihomiReward({
          externalRewardId: created.id,
          userId: event.userId!,
          eventContext: {
            eventType: event.eventType,
            squadId: event.squadId,
            fieldId: event.fieldId,
            ...event.context,
          },
          voucherTemplate: String(reward.value ?? reward.templateId ?? ""),
        }),
      )
      .then((result) => {
        if (!result.success && !result.pending) {
          console.warn(
            `[reward-engine] aihomi 發送失敗 ${created.id}:`,
            result.errorMessage,
          );
        }
      })
      .catch((err) => {
        console.error("[reward-engine] aihomi 發送異常:", err);
      });
  }

  return created.id;
}

/** 產生 8 碼大寫英數兌換碼 */
function generateCouponCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 排除易混淆字
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
