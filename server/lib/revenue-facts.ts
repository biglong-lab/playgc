// 💰 營收事實正規化層 — 所有營收計算的唯一基準（2026-08-01）
//
// 【為什麼存在】
// 3 個金流源的 schema 完全異質，單位也不一致：
//   posTransactions.paidAmountCents   → 分（cents）
//   purchases.amount                  → 元（TWD）
//   battleSlots.pricePerPerson        → 元（TWD）
// 舊版 revenue.ts 直接相加，POS 收 NT$100 被當成 NT$10,000（100 倍誇大）。
//
// 【統一規則】
//   1. 內部一律用「分」(cents)，只有顯示層才除以 100
//   2. POS 排除軟刪除（deleted_at IS NOT NULL）
//   3. 扣除 refunds（status='completed'），並排除「幽靈退款」
//   4. 營業日一律 Asia/Taipei（DB timezone 是 Etc/UTC，需雙重轉換）
//
// 【⚠️ 預約 bookings 不是獨立收入源】
// pos.ts:916 是全系統唯一會把 booking 標記為 paid 的位置，收款時會雙寫
// bookings.paidAt / paidAmountCents。線上金流 webhook 完全沒寫這些欄位。
// 因此把 bookings 併入營收 = 同一筆錢算兩次。
// 預約改以 posTransactions.bookingId 當作「維度」切分（預約收款 vs 散客現場）。

import { sql, eq, and, type SQL } from "drizzle-orm";
import { db } from "../db";
import {
  games,
  purchases,
  posTransactions,
  refunds,
  battleVenues,
  battleSlots,
  battleRegistrations,
} from "@shared/schema";

/** 元 → 分 */
export const TWD_TO_CENTS = 100;

export type RevenueSource = "pos" | "game" | "battle";

export interface RevenueSourceStat {
  /** 收款總額（未扣退款）*/
  grossCents: number;
  /** 退款總額 */
  refundCents: number;
  /** 淨收入 = gross - refund */
  netCents: number;
  /** 交易筆數 */
  txCount: number;
}

export interface RevenueSummary {
  /** Asia/Taipei YYYY-MM-DD，null = 不限 */
  from: string | null;
  to: string | null;
  grossCents: number;
  refundCents: number;
  netCents: number;
  txCount: number;
  bySource: Record<RevenueSource, RevenueSourceStat>;
}

export interface RevenueRange {
  from?: string;
  to?: string;
}

// ============================================================================
// SQL 片段 — 時區 / 有效性條件
// ============================================================================

/**
 * 時間欄位的兩種型別，時區轉換法「不同」，混用會差一天：
 *   naive  = timestamp without time zone（DB 存 UTC 當地值）→ 需雙層轉換
 *   tz     = timestamp with time zone（已帶時區資訊）→ 只需單層轉換
 * 實測（UTC 2026-03-10 02:00 = Taipei 10:00，正解 03-10）：
 *   naive 雙層 → 03-10 ✅ ｜ tz 雙層 → 03-09 ❌ ｜ tz 單層 → 03-10 ✅
 */
export type TimeColumnKind = "naive" | "tz";

/**
 * naive timestamp（DB 存 UTC）→ Asia/Taipei 營業日。
 *
 * ⚠️ 必須雙層轉換。只寫 `col AT TIME ZONE 'Asia/Taipei'` 是錯的：
 * 那是「把 UTC 數值當成台北當地時間解讀」，會把台北 00:00–16:00
 * 的交易錯歸到前一天（實測：台北 09:00 → 被算成前一日）。
 */
export function taipeiBusinessDate(col: SQL | unknown): SQL {
  return sql`((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Taipei')::date`;
}

/** timestamptz → Asia/Taipei 營業日（已帶時區，單層轉換即可）*/
export function taipeiBusinessDateTz(col: SQL | unknown): SQL {
  return sql`(${col} AT TIME ZONE 'Asia/Taipei')::date`;
}

/** 依欄位型別取對應的營業日運算式 */
export function businessDateOf(col: SQL | unknown, kind: TimeColumnKind = "naive"): SQL {
  return kind === "tz" ? taipeiBusinessDateTz(col) : taipeiBusinessDate(col);
}

/** Asia/Taipei 今天 YYYY-MM-DD */
export function taipeiToday(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** 依營業日區間過濾（from/to 皆可選，含頭含尾）*/
export function withinBusinessRange(
  col: SQL | unknown,
  range: RevenueRange,
  kind: TimeColumnKind = "naive",
): SQL | undefined {
  const day = businessDateOf(col, kind);
  if (range.from && range.to) return sql`${day} BETWEEN ${range.from}::date AND ${range.to}::date`;
  if (range.from) return sql`${day} >= ${range.from}::date`;
  if (range.to) return sql`${day} <= ${range.to}::date`;
  return undefined;
}

/** POS 交易有效（未軟刪除）*/
export const POS_NOT_DELETED = sql`${posTransactions.deletedAt} IS NULL`;

/**
 * 排除「幽靈退款」：退款後來源 POS 交易又被軟刪除。
 * 交易刪了就不算收入，對應退款也不該再扣帳，否則帳被重複扣減。
 * 僅針對 source_type='pos_transaction'。
 */
export const REFUND_NOT_GHOST = sql`NOT (
  ${refunds.sourceType} = 'pos_transaction' AND EXISTS (
    SELECT 1 FROM ${posTransactions} pt
    WHERE pt.id = ${refunds.sourceId} AND pt.deleted_at IS NOT NULL
  )
)`;

/** 對戰單價（元）→ slot 覆寫優先，fallback 到場地設定 */
export const BATTLE_PRICE_TWD = sql`COALESCE(
  ${battleSlots.pricePerPerson},
  CAST(${battleVenues.settings}->>'pricePerPerson' AS INTEGER),
  0
)`;

// ============================================================================
// 各源聚合
// ============================================================================

/** 🛒 POS 收款（已排除軟刪除）*/
async function posGross(fieldId: string, range: RevenueRange): Promise<{ cents: number; count: number }> {
  const [row] = await db
    .select({
      cents: sql<number>`COALESCE(SUM(${posTransactions.paidAmountCents}), 0)::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.fieldId, fieldId),
        POS_NOT_DELETED,
        withinBusinessRange(posTransactions.createdAt, range),
      ),
    );
  return { cents: Number(row?.cents ?? 0), count: Number(row?.count ?? 0) };
}

/** 💸 退款（completed，排除幽靈）— 目前全部歸屬 POS，遊戲/對戰尚無退款關聯 */
async function refundTotal(fieldId: string, range: RevenueRange): Promise<number> {
  const [row] = await db
    .select({ cents: sql<number>`COALESCE(SUM(${refunds.amountCents}), 0)::int` })
    .from(refunds)
    .where(
      and(
        eq(refunds.fieldId, fieldId),
        eq(refunds.status, "completed"),
        REFUND_NOT_GHOST,
        withinBusinessRange(refunds.createdAt, range, "tz"),
      ),
    );
  return Number(row?.cents ?? 0);
}

/** 🎮 遊戲購買（purchases.amount 是「元」，需 ×100）*/
async function gameGross(fieldId: string, range: RevenueRange): Promise<{ cents: number; count: number }> {
  const [row] = await db
    .select({
      cents: sql<number>`COALESCE(SUM(${purchases.amount}), 0)::int * ${TWD_TO_CENTS}`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(purchases)
    .innerJoin(games, eq(purchases.gameId, games.id))
    .where(
      and(
        eq(games.fieldId, fieldId),
        eq(purchases.status, "completed"),
        withinBusinessRange(purchases.createdAt, range),
      ),
    );
  return { cents: Number(row?.cents ?? 0), count: Number(row?.count ?? 0) };
}

/** ⚔️ 對戰報名（單價是「元」，需 ×100；只算已付訂金）*/
async function battleGross(fieldId: string, range: RevenueRange): Promise<{ cents: number; count: number }> {
  const [row] = await db
    .select({
      cents: sql<number>`COALESCE(SUM(${BATTLE_PRICE_TWD}), 0)::int * ${TWD_TO_CENTS}`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(battleRegistrations)
    .innerJoin(battleSlots, eq(battleRegistrations.slotId, battleSlots.id))
    .innerJoin(battleVenues, eq(battleSlots.venueId, battleVenues.id))
    .where(
      and(
        eq(battleVenues.fieldId, fieldId),
        eq(battleRegistrations.depositPaid, true),
        withinBusinessRange(battleRegistrations.registeredAt, range),
      ),
    );
  return { cents: Number(row?.cents ?? 0), count: Number(row?.count ?? 0) };
}

// ============================================================================
// 對外主函式
// ============================================================================

/**
 * 營收總覽 — 3 源統一計算（cents）
 * @param range 省略 from/to = 全期累計
 */
export async function getRevenueSummary(
  fieldId: string,
  range: RevenueRange = {},
): Promise<RevenueSummary> {
  const [pos, refundCents, game, battle] = await Promise.all([
    posGross(fieldId, range),
    refundTotal(fieldId, range),
    gameGross(fieldId, range),
    battleGross(fieldId, range),
  ]);

  const bySource: Record<RevenueSource, RevenueSourceStat> = {
    pos: {
      grossCents: pos.cents,
      refundCents,
      netCents: pos.cents - refundCents,
      txCount: pos.count,
    },
    game: { grossCents: game.cents, refundCents: 0, netCents: game.cents, txCount: game.count },
    battle: {
      grossCents: battle.cents,
      refundCents: 0,
      netCents: battle.cents,
      txCount: battle.count,
    },
  };

  const grossCents = pos.cents + game.cents + battle.cents;

  return {
    from: range.from ?? null,
    to: range.to ?? null,
    grossCents,
    refundCents,
    netCents: grossCents - refundCents,
    txCount: pos.count + game.count + battle.count,
    bySource,
  };
}

/** 顯示用：分 → NT$ 字串 */
export function centsToTwdLabel(cents: number): string {
  return `NT$ ${Math.round(cents / TWD_TO_CENTS).toLocaleString("zh-TW")}`;
}
