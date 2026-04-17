// 💰 SaaS 計費引擎 (Phase 6)
// 功能：用量計量、配額檢查、交易抽成、月度訂閱扣款
import { db } from "../db";
import {
  fieldSubscriptions,
  fieldUsageMeters,
  platformPlans,
  platformTransactions,
  fields,
  parsePlanLimits,
  type PlanLimits,
  type UsageMeterKey,
} from "@shared/schema";
import { eq, and, sql, gte, lt } from "drizzle-orm";

// ============================================================================
// 工具：取得當月期間
// ============================================================================
function getCurrentMonthPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

// ============================================================================
// 📊 用量計量
// ============================================================================

/**
 * 增加場域的用量計量
 * @returns 更新後的 current value
 */
export async function incrementUsage(
  fieldId: string,
  meterKey: UsageMeterKey,
  amount: number = 1
): Promise<number> {
  const { start, end } = getCurrentMonthPeriod();

  // 找到該場域的當前限制（從 plan 的 limits JSON）
  const subRow = await db
    .select({
      sub: fieldSubscriptions,
      plan: platformPlans,
    })
    .from(fieldSubscriptions)
    .leftJoin(platformPlans, eq(platformPlans.id, fieldSubscriptions.planId))
    .where(eq(fieldSubscriptions.fieldId, fieldId))
    .limit(1);

  const sub = subRow[0]?.sub;
  const plan = subRow[0]?.plan;
  const planLimits = plan ? parsePlanLimits(plan.limits) : {};
  const customLimits = sub?.customLimits ? (sub.customLimits as PlanLimits) : {};
  const effectiveLimits = { ...planLimits, ...customLimits };
  const limitKey = mapMeterToLimitKey(meterKey);
  const limit = limitKey ? effectiveLimits[limitKey] : undefined;

  // UPSERT 計量
  const existing = await db.query.fieldUsageMeters.findFirst({
    where: and(
      eq(fieldUsageMeters.fieldId, fieldId),
      eq(fieldUsageMeters.meterKey, meterKey),
      gte(fieldUsageMeters.periodStart, start),
      lt(fieldUsageMeters.periodStart, end)
    ),
  });

  if (existing) {
    const newValue = (existing.currentValue ?? 0) + amount;
    const isOverage =
      limit !== undefined && limit !== -1 && newValue > limit;
    const [updated] = await db
      .update(fieldUsageMeters)
      .set({
        currentValue: newValue,
        limitValue: limit === -1 ? null : limit ?? null,
        overageCount: isOverage
          ? (existing.overageCount ?? 0) + 1
          : existing.overageCount,
        lastOverageAt: isOverage ? new Date() : existing.lastOverageAt,
        updatedAt: new Date(),
      })
      .where(eq(fieldUsageMeters.id, existing.id))
      .returning();
    return updated?.currentValue ?? newValue;
  }

  const [created] = await db
    .insert(fieldUsageMeters)
    .values({
      fieldId,
      meterKey,
      periodStart: start,
      periodEnd: end,
      currentValue: amount,
      limitValue: limit === -1 ? null : limit ?? null,
    })
    .returning();
  return created?.currentValue ?? amount;
}

/**
 * 將 meter key 對應到 plan limits 欄位
 */
function mapMeterToLimitKey(meterKey: UsageMeterKey): keyof PlanLimits | null {
  const map: Partial<Record<UsageMeterKey, keyof PlanLimits>> = {
    games: "maxGames",
    checkouts: "maxCheckoutsPerMonth",
    admins: "maxAdmins",
    storage_bytes: "maxStorageGb",
    battle_slots: "maxBattleSlotsPerMonth",
  };
  return map[meterKey] ?? null;
}

/**
 * 檢查場域是否超過配額
 */
export interface QuotaCheck {
  current: number;
  limit: number | null; // null = 無限
  isOver: boolean;
  percent: number;
}

export async function checkQuota(
  fieldId: string,
  meterKey: UsageMeterKey
): Promise<QuotaCheck> {
  const { start, end } = getCurrentMonthPeriod();

  const meter = await db.query.fieldUsageMeters.findFirst({
    where: and(
      eq(fieldUsageMeters.fieldId, fieldId),
      eq(fieldUsageMeters.meterKey, meterKey),
      gte(fieldUsageMeters.periodStart, start),
      lt(fieldUsageMeters.periodStart, end)
    ),
  });

  const current = meter?.currentValue ?? 0;
  const limit = meter?.limitValue ?? null;
  const isOver = limit !== null && current > limit;
  const percent = limit === null ? 0 : Math.min(100, (current / limit) * 100);

  return { current, limit, isOver, percent };
}

/**
 * 取得場域所有用量（本月）
 */
export async function getFieldUsage(fieldId: string) {
  const { start, end } = getCurrentMonthPeriod();
  const meters = await db
    .select()
    .from(fieldUsageMeters)
    .where(
      and(
        eq(fieldUsageMeters.fieldId, fieldId),
        gte(fieldUsageMeters.periodStart, start),
        lt(fieldUsageMeters.periodStart, end)
      )
    );
  return meters;
}

// ============================================================================
// 💸 交易抽成
// ============================================================================

/**
 * 為一筆購買自動建立平台抽成交易
 * @param params purchase 相關資訊
 */
export async function recordTransactionFee(params: {
  fieldId: string;
  sourceTransactionId: string;
  sourceAmount: number;
  description?: string;
}): Promise<{ feeAmount: number; feePercent: number } | null> {
  const row = await db
    .select({
      sub: fieldSubscriptions,
      plan: platformPlans,
    })
    .from(fieldSubscriptions)
    .leftJoin(platformPlans, eq(platformPlans.id, fieldSubscriptions.planId))
    .where(eq(fieldSubscriptions.fieldId, params.fieldId))
    .limit(1);

  const sub = row[0]?.sub;
  const plan = row[0]?.plan;
  if (!sub || !plan) return null;

  // 優先使用場域自訂費率，其次方案費率
  const feePercentStr = sub.customFeePercent ?? plan.transactionFeePercent ?? "0";
  const feePercent = parseFloat(feePercentStr);
  if (feePercent <= 0) return null;

  const feeAmount = Math.round((params.sourceAmount * feePercent) / 100);
  if (feeAmount <= 0) return null;

  await db.insert(platformTransactions).values({
    fieldId: params.fieldId,
    type: "transaction_fee",
    amount: feeAmount,
    status: "pending", // 待月底結算
    sourceTransactionId: params.sourceTransactionId,
    subscriptionId: sub.id,
    description:
      params.description ??
      `交易抽成 ${feePercent}%（原金額 NT$${params.sourceAmount}）`,
  });

  return { feeAmount, feePercent };
}

// ============================================================================
// 📅 月度訂閱扣款
// ============================================================================

/**
 * 為單一場域產生當月訂閱帳單
 */
export async function generateMonthlyInvoice(
  fieldId: string,
  targetMonth?: Date
): Promise<{ invoiceId: string; amount: number } | null> {
  const row = await db
    .select({
      sub: fieldSubscriptions,
      plan: platformPlans,
    })
    .from(fieldSubscriptions)
    .leftJoin(platformPlans, eq(platformPlans.id, fieldSubscriptions.planId))
    .where(eq(fieldSubscriptions.fieldId, fieldId))
    .limit(1);

  const sub = row[0]?.sub;
  const plan = row[0]?.plan;
  if (!sub || !plan) return null;
  if (sub.status !== "active" && sub.status !== "trial") return null;

  const month = targetMonth ?? new Date();
  const periodStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const periodEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  // 查看這個月是否已有訂閱費
  const existing = await db.query.platformTransactions.findFirst({
    where: and(
      eq(platformTransactions.fieldId, fieldId),
      eq(platformTransactions.type, "subscription"),
      gte(platformTransactions.billingPeriodStart, periodStart),
      lt(platformTransactions.billingPeriodStart, periodEnd)
    ),
  });

  if (existing) {
    return { invoiceId: existing.id, amount: existing.amount };
  }

  // 計算金額（年付 = 月費 × 12，但本函式只處理月費帳單）
  const amount = plan.monthlyPrice ?? 0;
  if (amount <= 0) return null;

  const [invoice] = await db
    .insert(platformTransactions)
    .values({
      fieldId,
      type: "subscription",
      amount,
      status: "pending",
      subscriptionId: sub.id,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      dueAt: new Date(periodStart.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 天後到期
      description: `${plan.name} 月費 (${periodStart.toISOString().slice(0, 7)})`,
    })
    .returning();

  return { invoiceId: invoice.id, amount };
}

/**
 * 對所有 active + trial 場域跑月度帳單
 * 可由 cron 或手動觸發
 */
export async function runMonthlyBilling(targetMonth?: Date): Promise<{
  processed: number;
  invoiced: number;
  skipped: number;
  errors: string[];
}> {
  const subs = await db
    .select()
    .from(fieldSubscriptions)
    .where(sql`${fieldSubscriptions.status} IN ('active', 'trial')`);

  let invoiced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const sub of subs) {
    try {
      const result = await generateMonthlyInvoice(sub.fieldId, targetMonth);
      if (result) {
        invoiced++;
      } else {
        skipped++;
      }
    } catch (err) {
      errors.push(
        `${sub.fieldId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { processed: subs.length, invoiced, skipped, errors };
}

// ============================================================================
// 📊 場域帳務摘要
// ============================================================================

/**
 * 取得場域的「本月應付平台費用」總和
 */
export async function getFieldPlatformFees(fieldId: string): Promise<{
  subscriptionFee: number;
  transactionFees: number;
  addons: number;
  total: number;
  pendingCount: number;
}> {
  const { start, end } = getCurrentMonthPeriod();

  const rows = await db
    .select({
      type: platformTransactions.type,
      total: sql<number>`COALESCE(SUM(${platformTransactions.amount}), 0)::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(platformTransactions)
    .where(
      and(
        eq(platformTransactions.fieldId, fieldId),
        gte(platformTransactions.createdAt, start),
        lt(platformTransactions.createdAt, end)
      )
    )
    .groupBy(platformTransactions.type);

  let subscriptionFee = 0;
  let transactionFees = 0;
  let addons = 0;
  let pendingCount = 0;

  for (const row of rows) {
    if (row.type === "subscription") subscriptionFee += row.total;
    else if (row.type === "transaction_fee") transactionFees += row.total;
    else if (row.type === "addon") addons += row.total;
    pendingCount += row.count;
  }

  return {
    subscriptionFee,
    transactionFees,
    addons,
    total: subscriptionFee + transactionFees + addons,
    pendingCount,
  };
}
