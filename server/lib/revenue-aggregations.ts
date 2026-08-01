// 📊 營收聚合查詢 — 趨勢 / 維度排行 / 明細下鑽（2026-08-01）
//
// 所有計算基準沿用 revenue-facts.ts（幣別統一分、Taipei 營業日、
// 排除軟刪除、扣退款）。本檔只負責「怎麼切」，不重新定義「怎麼算」。

import { sql, eq, and, desc, inArray, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  games,
  purchases,
  posTransactions,
  posTransactionItems,
  activities,
  refunds,
  battleVenues,
  battleSlots,
  battleRegistrations,
} from "@shared/schema";
import {
  TWD_TO_CENTS,
  POS_NOT_DELETED,
  REFUND_NOT_GHOST,
  BATTLE_PRICE_TWD,
  businessDateOf,
  withinBusinessRange,
  type RevenueRange,
  type RevenueSource,
} from "./revenue-facts";

export type Granularity = "day" | "week" | "month";

export type BreakdownDimension =
  | "source"       // 收入來源（POS / 遊戲 / 對戰）
  | "pos_product"  // POS 品項
  | "pos_category" // POS 分類（餐飲 / 文創 / 課程）
  | "pos_modifier" // POS 客製選項熱度
  | "activity"     // 活動場次
  | "method"       // 付款方式
  | "catalog";     // 遊戲 / 對戰場地商品

export interface TimeBucket {
  /** 桶起始日 YYYY-MM-DD（Taipei）*/
  bucket: string;
  posCents: number;
  gameCents: number;
  battleCents: number;
  refundCents: number;
  /** 淨收入 = 三源合計 − 退款 */
  netCents: number;
  txCount: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  cents: number;
  /** 交易/報名筆數 */
  count: number;
  /** 件數（僅品項類維度有值）*/
  qty?: number;
  /** 佔比 0–100 */
  share: number;
}

export interface UnifiedTransaction {
  id: string;
  source: RevenueSource;
  occurredAt: Date | null;
  businessDate: string;
  amountCents: number;
  label: string;
  detail: string | null;
  status: string;
}

const SOURCE_LABEL: Record<RevenueSource, string> = {
  pos: "現場收款",
  game: "遊戲購買",
  battle: "對戰報名",
};
const CAT_LABEL: Record<string, string> = { food: "餐飲", goods: "文創", course: "課程" };
const METHOD_LABEL: Record<string, string> = {
  cash: "現金",
  online_recur: "定期定額",
  online_stripe: "信用卡",
  linepay: "LINE Pay",
  voucher_full: "券全額",
};

/** 依粒度把營業日截到桶起始日 */
function bucketExpr(col: SQL | unknown, g: Granularity, kind: "naive" | "tz" = "naive"): SQL {
  const day = businessDateOf(col, kind);
  if (g === "day") return sql`${day}`;
  const unit = g === "week" ? sql`'week'` : sql`'month'`;
  return sql`date_trunc(${unit}, ${day})::date`;
}

// ============================================================================
// 趨勢
// ============================================================================

/**
 * 營收趨勢 — 各源分別 GROUP BY 後於 Node 合併並補零，
 * 確保沒有交易的日子也出現在圖表上（缺點會讓折線斷裂）。
 */
export async function getRevenueTimeseries(
  fieldId: string,
  range: Required<RevenueRange>,
  granularity: Granularity = "day",
): Promise<TimeBucket[]> {
  const bucketOf = (col: SQL | unknown, kind: "naive" | "tz" = "naive") =>
    bucketExpr(col, granularity, kind);

  const [posRows, gameRows, battleRows, refundRows] = await Promise.all([
    db
      .select({
        bucket: sql<string>`${bucketOf(posTransactions.createdAt)}::text`,
        cents: sql<number>`COALESCE(SUM(${posTransactions.paidAmountCents}),0)::int`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(posTransactions)
      .where(and(
        eq(posTransactions.fieldId, fieldId),
        POS_NOT_DELETED,
        withinBusinessRange(posTransactions.createdAt, range),
      ))
      .groupBy(bucketOf(posTransactions.createdAt)),

    db
      .select({
        bucket: sql<string>`${bucketOf(purchases.createdAt)}::text`,
        cents: sql<number>`COALESCE(SUM(${purchases.amount}),0)::int * ${TWD_TO_CENTS}`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(purchases)
      .innerJoin(games, eq(purchases.gameId, games.id))
      .where(and(
        eq(games.fieldId, fieldId),
        eq(purchases.status, "completed"),
        withinBusinessRange(purchases.createdAt, range),
      ))
      .groupBy(bucketOf(purchases.createdAt)),

    db
      .select({
        bucket: sql<string>`${bucketOf(battleRegistrations.registeredAt)}::text`,
        cents: sql<number>`COALESCE(SUM(${BATTLE_PRICE_TWD}),0)::int * ${TWD_TO_CENTS}`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(battleRegistrations)
      .innerJoin(battleSlots, eq(battleRegistrations.slotId, battleSlots.id))
      .innerJoin(battleVenues, eq(battleSlots.venueId, battleVenues.id))
      .where(and(
        eq(battleVenues.fieldId, fieldId),
        eq(battleRegistrations.depositPaid, true),
        withinBusinessRange(battleRegistrations.registeredAt, range),
      ))
      .groupBy(bucketOf(battleRegistrations.registeredAt)),

    db
      .select({
        bucket: sql<string>`${bucketOf(refunds.createdAt, "tz")}::text`,
        cents: sql<number>`COALESCE(SUM(${refunds.amountCents}),0)::int`,
      })
      .from(refunds)
      .where(and(
        eq(refunds.fieldId, fieldId),
        eq(refunds.status, "completed"),
        REFUND_NOT_GHOST,
        withinBusinessRange(refunds.createdAt, range, "tz"),
      ))
      .groupBy(bucketOf(refunds.createdAt, "tz")),
  ]);

  const buckets = new Map<string, TimeBucket>();
  const touch = (b: string): TimeBucket => {
    let row = buckets.get(b);
    if (!row) {
      row = { bucket: b, posCents: 0, gameCents: 0, battleCents: 0, refundCents: 0, netCents: 0, txCount: 0 };
      buckets.set(b, row);
    }
    return row;
  };

  for (const r of posRows) { const b = touch(r.bucket); b.posCents = Number(r.cents); b.txCount += Number(r.count); }
  for (const r of gameRows) { const b = touch(r.bucket); b.gameCents = Number(r.cents); b.txCount += Number(r.count); }
  for (const r of battleRows) { const b = touch(r.bucket); b.battleCents = Number(r.cents); b.txCount += Number(r.count); }
  for (const r of refundRows) { touch(r.bucket).refundCents = Number(r.cents); }

  for (const b of Array.from(buckets.values())) {
    b.netCents = b.posCents + b.gameCents + b.battleCents - b.refundCents;
  }

  return fillGaps(Array.from(buckets.values()), range, granularity);
}

/** 補上沒有交易的空桶，避免圖表折線斷裂 */
function fillGaps(rows: TimeBucket[], range: Required<RevenueRange>, g: Granularity): TimeBucket[] {
  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  const out: TimeBucket[] = [];
  const cursor = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  // 週/月粒度先對齊桶起點
  if (g === "week") cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  if (g === "month") cursor.setUTCDate(1);

  let guard = 0;
  while (cursor <= end && guard++ < 1000) {
    const key = cursor.toISOString().slice(0, 10);
    out.push(
      byBucket.get(key) ?? {
        bucket: key, posCents: 0, gameCents: 0, battleCents: 0, refundCents: 0, netCents: 0, txCount: 0,
      },
    );
    if (g === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (g === "week") cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

// ============================================================================
// 維度排行
// ============================================================================

/** POS 明細行的共用過濾（join 回主檔確保場域 + 未刪除 + 區間）*/
function posItemScope(fieldId: string, range: RevenueRange) {
  return and(
    eq(posTransactions.fieldId, fieldId),
    POS_NOT_DELETED,
    withinBusinessRange(posTransactions.createdAt, range),
  );
}

async function breakdownPosItems(
  fieldId: string,
  range: RevenueRange,
  by: "name" | "category",
): Promise<BreakdownRow[]> {
  const keyCol = by === "name" ? posTransactionItems.nameSnapshot : posTransactionItems.category;
  const rows = await db
    .select({
      key: sql<string>`COALESCE(${keyCol}, 'other')`,
      cents: sql<number>`COALESCE(SUM(${posTransactionItems.lineTotalCents}),0)::int`,
      qty: sql<number>`COALESCE(SUM(${posTransactionItems.qty}),0)::int`,
      count: sql<number>`COUNT(DISTINCT ${posTransactionItems.transactionId})::int`,
    })
    .from(posTransactionItems)
    .innerJoin(posTransactions, eq(posTransactionItems.transactionId, posTransactions.id))
    .where(posItemScope(fieldId, range))
    .groupBy(sql`COALESCE(${keyCol}, 'other')`);

  return rows.map((r) => ({
    key: r.key,
    label: by === "category" ? (CAT_LABEL[r.key] ?? r.key) : r.key,
    cents: Number(r.cents),
    count: Number(r.count),
    qty: Number(r.qty),
    share: 0,
  }));
}

async function breakdownModifiers(fieldId: string, range: RevenueRange): Promise<BreakdownRow[]> {
  const rows = await db
    .select({
      key: sql<string>`m->>'optionName'`,
      qty: sql<number>`COALESCE(SUM(${posTransactionItems.qty}),0)::int`,
      cents: sql<number>`COALESCE(SUM(COALESCE((m->>'priceDeltaCents')::int,0) * ${posTransactionItems.qty}),0)::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(posTransactionItems)
    .innerJoin(posTransactions, eq(posTransactionItems.transactionId, posTransactions.id))
    .innerJoin(
      sql`LATERAL jsonb_array_elements(COALESCE(${posTransactionItems.modifiers}, '[]'::jsonb)) AS m`,
      sql`true`,
    )
    .where(and(posItemScope(fieldId, range), sql`m->>'optionName' IS NOT NULL`))
    .groupBy(sql`m->>'optionName'`);

  return rows.map((r) => ({
    key: r.key, label: r.key, cents: Number(r.cents),
    count: Number(r.count), qty: Number(r.qty), share: 0,
  }));
}

async function breakdownPosTx(
  fieldId: string,
  range: RevenueRange,
  by: "activity" | "method",
): Promise<BreakdownRow[]> {
  if (by === "method") {
    const rows = await db
      .select({
        key: posTransactions.paymentMethod,
        cents: sql<number>`COALESCE(SUM(${posTransactions.paidAmountCents}),0)::int`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(posTransactions)
      .where(and(
        eq(posTransactions.fieldId, fieldId),
        POS_NOT_DELETED,
        withinBusinessRange(posTransactions.createdAt, range),
      ))
      .groupBy(posTransactions.paymentMethod);
    return rows.map((r) => ({
      key: r.key, label: METHOD_LABEL[r.key] ?? r.key,
      cents: Number(r.cents), count: Number(r.count), share: 0,
    }));
  }

  const rows = await db
    .select({
      key: sql<string>`COALESCE(${posTransactions.activityId}, '__none__')`,
      name: activities.name,
      cents: sql<number>`COALESCE(SUM(${posTransactions.paidAmountCents}),0)::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(posTransactions)
    .leftJoin(activities, eq(posTransactions.activityId, activities.id))
    .where(and(
      eq(posTransactions.fieldId, fieldId),
      POS_NOT_DELETED,
      withinBusinessRange(posTransactions.createdAt, range),
    ))
    .groupBy(sql`COALESCE(${posTransactions.activityId}, '__none__')`, activities.name);

  return rows.map((r) => ({
    key: r.key,
    label: r.name ?? (r.key === "__none__" ? "未指定活動（散客）" : r.key),
    cents: Number(r.cents), count: Number(r.count), share: 0,
  }));
}

/** 遊戲 / 對戰場地商品排行 */
async function breakdownCatalog(fieldId: string, range: RevenueRange): Promise<BreakdownRow[]> {
  const [gameRows, venueRows] = await Promise.all([
    db
      .select({
        key: games.id,
        label: games.title,
        cents: sql<number>`COALESCE(SUM(${purchases.amount}),0)::int * ${TWD_TO_CENTS}`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(purchases)
      .innerJoin(games, eq(purchases.gameId, games.id))
      .where(and(
        eq(games.fieldId, fieldId),
        eq(purchases.status, "completed"),
        withinBusinessRange(purchases.createdAt, range),
      ))
      .groupBy(games.id, games.title),
    db
      .select({
        key: battleVenues.id,
        label: battleVenues.name,
        cents: sql<number>`COALESCE(SUM(${BATTLE_PRICE_TWD}),0)::int * ${TWD_TO_CENTS}`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(battleRegistrations)
      .innerJoin(battleSlots, eq(battleRegistrations.slotId, battleSlots.id))
      .innerJoin(battleVenues, eq(battleSlots.venueId, battleVenues.id))
      .where(and(
        eq(battleVenues.fieldId, fieldId),
        eq(battleRegistrations.depositPaid, true),
        withinBusinessRange(battleRegistrations.registeredAt, range),
      ))
      .groupBy(battleVenues.id, battleVenues.name),
  ]);

  return [
    ...gameRows.map((r) => ({
      key: `game:${r.key}`, label: `🎮 ${r.label}`,
      cents: Number(r.cents), count: Number(r.count), share: 0,
    })),
    ...venueRows.map((r) => ({
      key: `venue:${r.key}`, label: `⚔️ ${r.label}`,
      cents: Number(r.cents), count: Number(r.count), share: 0,
    })),
  ];
}

/**
 * 維度排行 — Top N 之外的自動歸入「其他」，避免長尾把圖表撐爆。
 * share 於此統一計算，呼叫端不需自己算百分比。
 */
export async function getRevenueBreakdown(
  fieldId: string,
  range: RevenueRange,
  dimension: BreakdownDimension,
  limit = 20,
): Promise<{ dimension: BreakdownDimension; rows: BreakdownRow[]; totalCents: number }> {
  let rows: BreakdownRow[];
  switch (dimension) {
    case "pos_product":  rows = await breakdownPosItems(fieldId, range, "name"); break;
    case "pos_category": rows = await breakdownPosItems(fieldId, range, "category"); break;
    case "pos_modifier": rows = await breakdownModifiers(fieldId, range); break;
    case "activity":     rows = await breakdownPosTx(fieldId, range, "activity"); break;
    case "method":       rows = await breakdownPosTx(fieldId, range, "method"); break;
    case "catalog":      rows = await breakdownCatalog(fieldId, range); break;
    case "source": {
      const { getRevenueSummary } = await import("./revenue-facts");
      const s = await getRevenueSummary(fieldId, range);
      rows = (Object.keys(s.bySource) as RevenueSource[]).map((k) => ({
        key: k, label: SOURCE_LABEL[k],
        cents: s.bySource[k].netCents, count: s.bySource[k].txCount, share: 0,
      }));
      break;
    }
  }

  rows.sort((a, b) => b.cents - a.cents);
  const totalCents = rows.reduce((sum, r) => sum + r.cents, 0);

  let out = rows;
  if (rows.length > limit) {
    const head = rows.slice(0, limit);
    const tail = rows.slice(limit);
    head.push({
      key: "__other__",
      label: `其他（${tail.length} 項）`,
      cents: tail.reduce((s, r) => s + r.cents, 0),
      count: tail.reduce((s, r) => s + r.count, 0),
      qty: tail.reduce((s, r) => s + (r.qty ?? 0), 0) || undefined,
      share: 0,
    });
    out = head;
  }

  for (const r of out) {
    r.share = totalCents > 0 ? Math.round((r.cents / totalCents) * 1000) / 10 : 0;
  }
  return { dimension, rows: out, totalCents };
}

// ============================================================================
// 明細下鑽
// ============================================================================

/** 跨源統一交易明細（供表格與 CSV 匯出）*/
export async function getRevenueTransactions(
  fieldId: string,
  range: RevenueRange,
  opts: { sources?: RevenueSource[]; limit?: number } = {},
): Promise<UnifiedTransaction[]> {
  const want = new Set<RevenueSource>(opts.sources?.length ? opts.sources : ["pos", "game", "battle"]);
  const limit = Math.min(opts.limit ?? 200, 1000);
  const out: UnifiedTransaction[] = [];

  if (want.has("pos")) {
    const rows = await db
      .select({
        id: posTransactions.id,
        at: posTransactions.createdAt,
        day: sql<string>`${businessDateOf(posTransactions.createdAt)}::text`,
        cents: posTransactions.paidAmountCents,
        method: posTransactions.paymentMethod,
        customer: posTransactions.customerName,
        activityName: activities.name,
        bookingId: posTransactions.bookingId,
      })
      .from(posTransactions)
      .leftJoin(activities, eq(posTransactions.activityId, activities.id))
      .where(and(
        eq(posTransactions.fieldId, fieldId),
        POS_NOT_DELETED,
        withinBusinessRange(posTransactions.createdAt, range),
      ))
      .orderBy(desc(posTransactions.createdAt))
      .limit(limit);

    const txIds = rows.map((r) => r.id);
    const items = txIds.length
      ? await db
          .select({
            txId: posTransactionItems.transactionId,
            name: posTransactionItems.nameSnapshot,
            qty: posTransactionItems.qty,
          })
          .from(posTransactionItems)
          .where(inArray(posTransactionItems.transactionId, txIds))
      : [];
    const itemsByTx = new Map<string, string[]>();
    for (const it of items) {
      const list = itemsByTx.get(it.txId) ?? [];
      list.push(`${it.name}×${it.qty}`);
      itemsByTx.set(it.txId, list);
    }

    for (const r of rows) {
      out.push({
        id: `pos:${r.id}`,
        source: "pos",
        occurredAt: r.at,
        businessDate: r.day,
        amountCents: r.cents ?? 0,
        label: r.activityName ?? (r.bookingId ? "預約收款" : "現場散客"),
        detail: itemsByTx.get(r.id)?.join("、") ?? r.customer ?? null,
        status: METHOD_LABEL[r.method] ?? r.method,
      });
    }
  }

  if (want.has("game")) {
    const rows = await db
      .select({
        id: purchases.id,
        at: purchases.createdAt,
        day: sql<string>`${businessDateOf(purchases.createdAt)}::text`,
        amount: purchases.amount,
        title: games.title,
        userId: purchases.userId,
      })
      .from(purchases)
      .innerJoin(games, eq(purchases.gameId, games.id))
      .where(and(
        eq(games.fieldId, fieldId),
        eq(purchases.status, "completed"),
        withinBusinessRange(purchases.createdAt, range),
      ))
      .orderBy(desc(purchases.createdAt))
      .limit(limit);

    for (const r of rows) {
      out.push({
        id: `game:${r.id}`, source: "game", occurredAt: r.at, businessDate: r.day,
        amountCents: (r.amount ?? 0) * TWD_TO_CENTS,
        label: r.title, detail: `玩家 ${r.userId.slice(0, 8)}`, status: "已完成",
      });
    }
  }

  if (want.has("battle")) {
    const rows = await db
      .select({
        id: battleRegistrations.id,
        at: battleRegistrations.registeredAt,
        day: sql<string>`${businessDateOf(battleRegistrations.registeredAt)}::text`,
        twd: sql<number>`${BATTLE_PRICE_TWD}::int`,
        venue: battleVenues.name,
        userId: battleRegistrations.userId,
      })
      .from(battleRegistrations)
      .innerJoin(battleSlots, eq(battleRegistrations.slotId, battleSlots.id))
      .innerJoin(battleVenues, eq(battleSlots.venueId, battleVenues.id))
      .where(and(
        eq(battleVenues.fieldId, fieldId),
        eq(battleRegistrations.depositPaid, true),
        withinBusinessRange(battleRegistrations.registeredAt, range),
      ))
      .orderBy(desc(battleRegistrations.registeredAt))
      .limit(limit);

    for (const r of rows) {
      out.push({
        id: `battle:${r.id}`, source: "battle", occurredAt: r.at, businessDate: r.day,
        amountCents: Number(r.twd) * TWD_TO_CENTS,
        label: r.venue, detail: `玩家 ${r.userId.slice(0, 8)}`, status: "已付訂金",
      });
    }
  }

  out.sort((a, b) => (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0));
  return out.slice(0, limit);
}
