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
  type RewardConversionRule,
} from "@shared/schema";
import { eq, and, or, desc, isNull } from "drizzle-orm";
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
    // 計算這條規則發給這隊伍幾次（搜 rewardsIssued 包含 ruleId）
    const hits = previousHits.filter((e) => {
      const rewards = e.rewardsIssued as Array<{ ruleId: string }>;
      return rewards.some((r) => r.ruleId === rule.id);
    });
    if (hits.length >= quota.perSquad) return false;
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
      // 內部點數直接加到 squad_stats（已在 squad-records 寫入時處理）
      // 這裡不重複加，只記事件
      return `exp_points_${reward.value}`;

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

/** 預備外部券（待 Phase 8 真正發送 webhook 給 aihomi）*/
async function stageExternalReward(reward: RewardSpec, event: RewardEvent): Promise<string | null> {
  if (!reward.provider) return null;

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

  // 注意：這只是「待發送」狀態，Phase 8 會 hook webhook 真送
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
