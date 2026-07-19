// 💰 POS 櫃檯現金管理（2026-06-22）
//
// 上班清點(opening) / 下班結算(closing) / 隔日對帳 / 差異確認 / 清帳(取現金)。
// 面額分張數統計（1000/500/100/50/10/1）。金額一律以「分」為單位。
//
// Endpoints：
//   GET  /api/pos/cash/today                        今日開班/收班狀態 + 預期金額預填
//   POST /api/pos/cash/count                         送出清點(opening|closing) → 算 counted/expected/variance
//   POST /api/pos/cash/count/:id/confirm   [cash]    確認差異（record 依紀錄 / adjust 輸入調整金額）
//   POST /api/pos/cash/drawdown            [cash]    清帳取現金
//   GET  /api/pos/cash/history                       清點 + 清帳歷史
//   GET  /api/pos/cash/summary                       某日現金摘要（給報表用）

import type { Express, Response } from "express";
import { db } from "../db";
import { posCashCounts, posCashDrawdowns, posDailySettlements, posCashAdjustments, posExpenses, posTransactions, refunds, CASH_DENOMINATIONS } from "@shared/schema";
import { and, eq, sql, desc, inArray, gte, lte, lt } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { sendToFieldGroup } from "../lib/internal-notifier";
import { resolveFieldScope, getTodayRange } from "./pos";

function fail(res: Response, e: unknown) {
  console.error("[pos-cash]", e);
  res.status(500).json({ error: "internal_error", message: "伺服器錯誤" });
}

const NT = (cents: number) => `NT$${Math.round(cents / 100).toLocaleString()}`;

/** 現在台北時間 HH:MM */
function nowHM(): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** Taipei 日期字串 yyyy-mm-dd → UTC [start,end] */
function taipeiDateRange(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - 8 * 3600 * 1000);
  const end = new Date(start.getTime() + 86400000 - 1);
  return { start, end };
}

/** 依面額張數算總額（分）；denominations: { "1000": n, ... } 元為單位 → ×100 */
function sumDenominations(denoms: Record<string, number>): number {
  let cents = 0;
  for (const face of CASH_DENOMINATIONS) {
    const qty = Math.max(0, Math.floor(Number(denoms?.[String(face)] ?? 0)));
    cents += face * qty * 100;
  }
  return cents;
}

/**
 * 排除「幽靈退款」：退款後來源 POS 交易又被軟刪除（deleted_at 有值）。
 * 交易刪了不算收入，對應退款也不該再從現金扣除，否則櫃台現金會被重複扣減。
 */
const REFUND_SOURCE_NOT_DELETED = sql`NOT (
  ${refunds.sourceType} = 'pos_transaction' AND EXISTS (
    SELECT 1 FROM ${posTransactions} pt
    WHERE pt.id = ${refunds.sourceId} AND pt.deleted_at IS NOT NULL
  )
)`;

/** 某日現金收款 / 現金退款（分）；after 指定時間後（對齊開帳時間點，避免重複計）*/
async function cashFlows(identifiers: string[], dateStr: string, after?: Date) {
  const { start, end } = taipeiDateRange(dateStr);
  const from = after && after > start ? after : start;
  const [salesAgg] = await db
    .select({ cents: sql<number>`COALESCE(SUM(${posTransactions.paidAmountCents}),0)::int` })
    .from(posTransactions)
    .where(
      and(
        inArray(posTransactions.fieldId, identifiers),
        eq(posTransactions.paymentMethod, "cash"),
        gte(posTransactions.createdAt, from),
        lte(posTransactions.createdAt, end),
        sql`${posTransactions.deletedAt} IS NULL`,
      ),
    );
  const [refundAgg] = await db
    .select({ cents: sql<number>`COALESCE(SUM(${refunds.amountCents}),0)::int` })
    .from(refunds)
    .where(
      and(
        inArray(refunds.fieldId, identifiers),
        eq(refunds.refundMethod, "cash"),
        eq(refunds.status, "completed"),
        gte(refunds.createdAt, from),
        lte(refunds.createdAt, end),
        REFUND_SOURCE_NOT_DELETED,
      ),
    );
  return { cashSalesCents: salesAgg?.cents ?? 0, cashRefundsCents: refundAgg?.cents ?? 0 };
}

/** 清帳總額（分），可選只算某時間點之後 */
async function drawdownsSince(identifiers: string[], after?: Date): Promise<number> {
  const conds = [inArray(posCashDrawdowns.fieldId, identifiers)];
  if (after) conds.push(gte(posCashDrawdowns.drawdownAt, after));
  const [agg] = await db
    .select({ cents: sql<number>`COALESCE(SUM(${posCashDrawdowns.amountCents}),0)::int` })
    .from(posCashDrawdowns)
    .where(and(...conds));
  return agg?.cents ?? 0;
}

/** 某日現金支出總額（分，排除已軟刪除）；after 指定時間後（對齊開帳時間點）*/
async function expensesForDate(identifiers: string[], dateStr: string, after?: Date): Promise<number> {
  const conds = [
    inArray(posExpenses.fieldId, identifiers),
    eq(posExpenses.businessDate, dateStr),
    sql`${posExpenses.deletedAt} IS NULL`,
  ];
  if (after) conds.push(gte(posExpenses.spentAt, after));
  const [agg] = await db
    .select({ cents: sql<number>`COALESCE(SUM(${posExpenses.amountCents}),0)::int` })
    .from(posExpenses)
    .where(and(...conds));
  return agg?.cents ?? 0;
}

/** 取某 fieldId 最近一次 closing 清點（用於 opening 對帳基準）；排除軟刪除 */
async function lastClosing(identifiers: string[], beforeDate: string) {
  const [row] = await db
    .select()
    .from(posCashCounts)
    .where(
      and(
        inArray(posCashCounts.fieldId, identifiers),
        eq(posCashCounts.countType, "closing"),
        lt(posCashCounts.businessDate, beforeDate),
        sql`${posCashCounts.deletedAt} IS NULL`,
      ),
    )
    .orderBy(desc(posCashCounts.businessDate), desc(posCashCounts.countedAt))
    .limit(1);
  return row ?? null;
}

/** 取某日某型別的清點；排除軟刪除（誤按被刪的不算）*/
async function getCount(identifiers: string[], date: string, type: "opening" | "closing") {
  const [row] = await db
    .select()
    .from(posCashCounts)
    .where(
      and(
        inArray(posCashCounts.fieldId, identifiers),
        eq(posCashCounts.businessDate, date),
        eq(posCashCounts.countType, type),
        sql`${posCashCounts.deletedAt} IS NULL`,
      ),
    )
    .orderBy(desc(posCashCounts.countedAt))
    .limit(1);
  return row ?? null;
}

/** 取某日結帳紀錄 */
async function getSettlement(identifiers: string[], date: string) {
  const [row] = await db
    .select()
    .from(posDailySettlements)
    .where(and(inArray(posDailySettlements.fieldId, identifiers), eq(posDailySettlements.businessDate, date)))
    .orderBy(desc(posDailySettlements.settledAt))
    .limit(1);
  return row ?? null;
}

/** 取最近一次（早於 date）已結帳紀錄 */
async function lastSettlement(identifiers: string[], beforeDate: string) {
  const [row] = await db
    .select()
    .from(posDailySettlements)
    .where(and(inArray(posDailySettlements.fieldId, identifiers), lt(posDailySettlements.businessDate, beforeDate)))
    .orderBy(desc(posDailySettlements.businessDate), desc(posDailySettlements.settledAt))
    .limit(1);
  return row ?? null;
}

/** 計算某型別清點的「系統預期金額」(分) */
async function computeExpected(
  identifiers: string[],
  date: string,
  type: "opening" | "closing",
): Promise<number> {
  if (type === "opening") {
    // 對帳基礎優先用「上次已結帳的實際現金」（確認數字成隔日基礎）；否則退回上次 closing 點鈔
    const ls = await lastSettlement(identifiers, date);
    if (ls) {
      const drawn = await drawdownsSince(identifiers, ls.settledAt ?? undefined);
      return Math.max(0, ls.actualCashCents - drawn);
    }
    const lc = await lastClosing(identifiers, date);
    if (!lc) return 0; // 無前一日基礎 → 預期 0（首次開班）
    const base = lc.adjustmentCents ?? lc.countedCents;
    const drawn = await drawdownsSince(identifiers, lc.countedAt ?? undefined);
    return Math.max(0, base - drawn);
  }
  // closing：opening + (開帳後的現金收 − 退 − 清帳 − 支出)
  // ⚠️ 全部以「開帳時間點之後」為窗，因 opening 點鈔已反映當下抽屜（含先前異動），避免重複計
  const opening = await getCount(identifiers, date, "opening");
  const openingCents = opening ? opening.adjustmentCents ?? opening.countedCents : 0;
  const since = opening?.countedAt ?? taipeiDateRange(date).start;
  const { cashSalesCents, cashRefundsCents } = await cashFlows(identifiers, date, since);
  const drawnAfterOpen = await drawdownsSince(identifiers, since);
  const expenses = await expensesForDate(identifiers, date, since);
  return Math.max(0, openingCents + cashSalesCents - cashRefundsCents - drawnAfterOpen - expenses);
}

export function registerPosCashRoutes(app: Express) {
  // ── GET 今日狀態 ───────────────────────────────
  app.get("/api/pos/cash/today", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const { date } = getTodayRange();
      const opening = await getCount(scope.identifiers, date, "opening");
      const closing = await getCount(scope.identifiers, date, "closing");
      const openingExpected = await computeExpected(scope.identifiers, date, "opening");
      const closingExpected = await computeExpected(scope.identifiers, date, "closing");
      const { cashSalesCents, cashRefundsCents } = await cashFlows(scope.identifiers, date);
      const todayDrawdowns = await drawdownsSince(scope.identifiers, taipeiDateRange(date).start);
      const todayExpenses = await expensesForDate(scope.identifiers, date);
      const settlement = await getSettlement(scope.identifiers, date);
      const canCashAdmin =
        req.admin!.systemRole === "super_admin" || req.admin!.permissions.includes("pos_cash_admin");
      // 結帳閉環階段：opening done? → 記帳中 → closing done? → settled?
      const stage = settlement ? "settled" : closing ? "closing_done" : opening ? "open" : "not_started";
      res.json({
        date,
        opening,
        closing,
        openingExpected,
        closingExpected,
        cashSalesCents,
        cashRefundsCents,
        todayDrawdownsCents: todayDrawdowns,
        todayExpensesCents: todayExpenses,
        settlement,
        locked: !!settlement?.locked,
        stage,
        canCashAdmin,
        denominations: CASH_DENOMINATIONS,
      });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── POST 送出清點（開班/收班）──────────────────
  app.post("/api/pos/cash/count", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const { countType, denominations, note } = req.body ?? {};
      if (countType !== "opening" && countType !== "closing") {
        return res.status(400).json({ error: "bad_count_type" });
      }
      const denoms = (denominations ?? {}) as Record<string, number>;
      const countedCents = sumDenominations(denoms);
      const { date } = getTodayRange();
      // 🔒 已結帳 → opening 一律擋（需隔日上班打卡再開帳）；closing 亦擋（當日已鎖帳）
      const settled = await getSettlement(scope.identifiers, date);
      if (settled) {
        return res.status(409).json({
          error: "already_settled",
          message:
            countType === "opening"
              ? "本日已結帳，請明日上班打卡再開帳"
              : "本日已結帳鎖定，如需更正請由管理員調整",
        });
      }
      // 🔒 今日同型別已有紀錄（未軟刪）→ 擋，防「收班後又誤按上班」等重複清點
      const existingSame = await getCount(scope.identifiers, date, countType);
      if (existingSame) {
        return res.status(409).json({
          error: "duplicate_count",
          message:
            countType === "opening"
              ? "今日已開帳（上班打卡），如需更正請由管理員調整"
              : "今日已完成收班結算，如需更正請由管理員調整",
        });
      }
      const expectedCents = await computeExpected(scope.identifiers, date, countType);
      // 🆕 2026-06-22 開帳首日無對帳基礎（無前日結帳/收班）→ 不算差異、不推
      let hasBase = true;
      if (countType === "opening") {
        const ls = await lastSettlement(scope.identifiers, date);
        const lc = await lastClosing(scope.identifiers, date);
        hasBase = !!(ls || lc);
      }
      const varianceCents = countType === "opening" && !hasBase ? 0 : countedCents - expectedCents;
      const varianceStatus = varianceCents === 0 ? "none" : "pending";

      const [row] = await db
        .insert(posCashCounts)
        .values({
          fieldId: scope.id,
          businessDate: date,
          countType,
          denominations: denoms,
          countedCents,
          expectedCents,
          varianceCents,
          varianceReason: varianceCents !== 0 ? (note ?? null) : null,
          varianceStatus,
          countedBy: req.admin!.id,
          countedByName: req.admin!.displayName ?? req.admin!.username,
          note: note ?? null,
        })
        .returning();

      await logAuditAction({
        actorAdminId: req.admin!.id,
        action: `pos:cash_count_${countType}`,
        targetType: "pos_cash_count",
        targetId: row.id,
        fieldId: scope.id,
        metadata: { date, countedCents, expectedCents, varianceCents },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 差異 → 通知管理員（群組）
      if (varianceCents !== 0) {
        const label = countType === "opening" ? "上班清點" : "下班結算";
        const sign = varianceCents > 0 ? "溢" : "短";
        sendToFieldGroup(
          [
            `⚠️ *POS 現金差異*（${date} ${nowHM()} ${label}）`,
            `點鈔：${NT(countedCents)}　預期：${NT(expectedCents)}`,
            `差異：${sign}${NT(Math.abs(varianceCents))}`,
            `清點人：${row.countedByName ?? "—"}`,
            note ? `原因：${note}` : `（待補原因/確認）`,
          ].join("\n"),
        );
      }

      res.json({ ok: true, count: row });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── POST 確認差異（依紀錄 / 輸入調整金額）[cash] ─
  app.post(
    "/api/pos/cash/count/:id/confirm",
    requireAdminAuth,
    requirePermission("pos_cash_admin"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { mode, adjustmentCents, reason } = req.body ?? {};
        if (mode !== "record" && mode !== "adjust") {
          return res.status(400).json({ error: "bad_mode" });
        }
        const [existing] = await db.select().from(posCashCounts).where(eq(posCashCounts.id, id)).limit(1);
        if (!existing) return res.status(404).json({ error: "not_found" });

        const adj =
          mode === "adjust" && Number.isFinite(Number(adjustmentCents))
            ? Math.max(0, Math.round(Number(adjustmentCents)))
            : null;

        const [row] = await db
          .update(posCashCounts)
          .set({
            varianceStatus: "confirmed",
            adjustmentCents: adj,
            varianceReason: reason ?? existing.varianceReason,
            confirmedBy: req.admin!.id,
            confirmedByName: req.admin!.displayName ?? req.admin!.username,
            confirmedAt: new Date(),
          })
          .where(eq(posCashCounts.id, id))
          .returning();

        await logAuditAction({
          actorAdminId: req.admin!.id,
          action: "pos:cash_variance_confirm",
          targetType: "pos_cash_count",
          targetId: id,
          fieldId: existing.fieldId,
          metadata: { mode, adjustmentCents: adj, varianceCents: existing.varianceCents },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ ok: true, count: row });
      } catch (e) {
        fail(res, e);
      }
    },
  );

  // ── POST 清帳（取走現金）[cash] ────────────────
  app.post(
    "/api/pos/cash/drawdown",
    requireAdminAuth,
    requirePermission("pos_cash_admin"),
    async (req, res) => {
      try {
        const scope = await resolveFieldScope(req);
        if (!scope) return res.status(400).json({ error: "no_field" });
        const { amountCents, reason } = req.body ?? {};
        const amount = Math.round(Number(amountCents));
        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({ error: "bad_amount" });
        }
        const { date } = getTodayRange();
        const settledDd = await getSettlement(scope.identifiers, date);
        if (settledDd) return res.status(409).json({ error: "locked", message: "當日已結帳鎖定" });
        const [row] = await db
          .insert(posCashDrawdowns)
          .values({
            fieldId: scope.id,
            businessDate: date,
            amountCents: amount,
            reason: reason ?? null,
            drawdownBy: req.admin!.id,
            drawdownByName: req.admin!.displayName ?? req.admin!.username,
          })
          .returning();

        await logAuditAction({
          actorAdminId: req.admin!.id,
          action: "pos:cash_drawdown",
          targetType: "pos_cash_drawdown",
          targetId: row.id,
          fieldId: scope.id,
          metadata: { date, amountCents: amount, reason },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        sendToFieldGroup(
          [
            `💵 *POS 清帳*（${date} ${nowHM()}）`,
            `取走現金：${NT(amount)}`,
            `操作人：${row.drawdownByName ?? "—"}`,
            reason ? `事由：${reason}` : "",
          ].filter(Boolean).join("\n"),
        );

        res.json({ ok: true, drawdown: row });
      } catch (e) {
        fail(res, e);
      }
    },
  );

  // ── GET 歷史（清點 + 清帳）─────────────────────
  app.get("/api/pos/cash/history", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 60));
      const counts = await db
        .select()
        .from(posCashCounts)
        .where(and(inArray(posCashCounts.fieldId, scope.identifiers), sql`${posCashCounts.deletedAt} IS NULL`))
        .orderBy(desc(posCashCounts.countedAt))
        .limit(limit);
      const drawdowns = await db
        .select()
        .from(posCashDrawdowns)
        .where(inArray(posCashDrawdowns.fieldId, scope.identifiers))
        .orderBy(desc(posCashDrawdowns.drawdownAt))
        .limit(limit);
      res.json({ counts, drawdowns });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── GET 某日現金摘要（給銷售報表納入）───────────
  app.get("/api/pos/cash/summary", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const date = (req.query.date as string) || getTodayRange().date;
      const opening = await getCount(scope.identifiers, date, "opening");
      const closing = await getCount(scope.identifiers, date, "closing");
      const { cashSalesCents, cashRefundsCents } = await cashFlows(scope.identifiers, date);
      const { start, end } = taipeiDateRange(date);
      const [ddAgg] = await db
        .select({ cents: sql<number>`COALESCE(SUM(${posCashDrawdowns.amountCents}),0)::int` })
        .from(posCashDrawdowns)
        .where(
          and(
            inArray(posCashDrawdowns.fieldId, scope.identifiers),
            gte(posCashDrawdowns.drawdownAt, start),
            lte(posCashDrawdowns.drawdownAt, end),
          ),
        );
      const drawdownCents = ddAgg?.cents ?? 0;
      const expensesCents = await expensesForDate(scope.identifiers, date);
      const closingCounted = closing ? closing.adjustmentCents ?? closing.countedCents : null;
      res.json({
        date,
        openingCents: opening ? opening.adjustmentCents ?? opening.countedCents : null,
        closingCents: closingCounted,
        cashSalesCents,
        cashRefundsCents,
        drawdownCents,
        expensesCents,
        // 櫃檯實際現金 = 下班點鈔 − 清帳
        actualCashCents: closingCounted !== null ? Math.max(0, closingCounted - drawdownCents) : null,
        openingVarianceCents: opening?.varianceCents ?? 0,
        closingVarianceCents: closing?.varianceCents ?? 0,
      });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── POST 每日結帳（閉環：開帳+記帳+收班 → 鎖定當日）─
  // 現場可直接結帳完成（requireAdminAuth）。結帳後即鎖；數字成隔日對帳基礎。
  app.post("/api/pos/cash/settle", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const { date } = getTodayRange();
      const existed = await getSettlement(scope.identifiers, date);
      if (existed) return res.status(409).json({ error: "already_settled", message: "當日已結帳" });

      const opening = await getCount(scope.identifiers, date, "opening");
      const closing = await getCount(scope.identifiers, date, "closing");
      if (!closing) return res.status(400).json({ error: "no_closing", message: "請先完成下班結算清點再結帳" });

      const openingCents = opening ? opening.adjustmentCents ?? opening.countedCents : 0;
      const countedCashCents = closing.adjustmentCents ?? closing.countedCents;
      const { start, end } = taipeiDateRange(date);
      // ⚠️ 與 computeExpected 一致：全部以「開帳時間點之後」為窗，避免與 today 顯示的預期不符
      const since = opening?.countedAt ?? start;
      const { cashSalesCents, cashRefundsCents } = await cashFlows(scope.identifiers, date, since);
      const [ddAgg] = await db
        .select({ cents: sql<number>`COALESCE(SUM(${posCashDrawdowns.amountCents}),0)::int` })
        .from(posCashDrawdowns)
        .where(and(inArray(posCashDrawdowns.fieldId, scope.identifiers), gte(posCashDrawdowns.drawdownAt, since), lte(posCashDrawdowns.drawdownAt, end)));
      const drawdownCents = ddAgg?.cents ?? 0;
      const expensesCents = await expensesForDate(scope.identifiers, date, since);
      const expectedCashCents = Math.max(0, openingCents + cashSalesCents - cashRefundsCents - drawdownCents - expensesCents);
      const varianceCents = countedCashCents - expectedCashCents;
      const actualCashCents = Math.max(0, countedCashCents - drawdownCents);
      const reason = typeof req.body?.varianceReason === "string" ? req.body.varianceReason : null;
      if (varianceCents !== 0 && !reason) {
        return res.status(400).json({ error: "need_reason", message: "現金有差異，請填寫差異原因再結帳" });
      }
      // 銷售總額（所有付款方式）
      const [salesAgg] = await db
        .select({
          cents: sql<number>`COALESCE(SUM(${posTransactions.paidAmountCents}),0)::int`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(posTransactions)
        .where(and(inArray(posTransactions.fieldId, scope.identifiers), gte(posTransactions.createdAt, start), lte(posTransactions.createdAt, end), sql`${posTransactions.deletedAt} IS NULL`));

      const [row] = await db
        .insert(posDailySettlements)
        .values({
          fieldId: scope.id,
          businessDate: date,
          openingCents,
          cashSalesCents,
          cashRefundsCents,
          drawdownCents,
          expensesCents,
          expectedCashCents,
          countedCashCents,
          varianceCents,
          varianceReason: reason,
          actualCashCents,
          salesTotalCents: salesAgg?.cents ?? 0,
          txnCount: salesAgg?.count ?? 0,
          locked: true,
          settledBy: req.admin!.id,
          settledByName: req.admin!.displayName ?? req.admin!.username,
          note: typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : null,
        })
        .returning();

      await logAuditAction({
        actorAdminId: req.admin!.id,
        action: "pos:daily_settle",
        targetType: "pos_daily_settlement",
        targetId: row.id,
        fieldId: scope.id,
        metadata: { date, expectedCashCents, countedCashCents, varianceCents, actualCashCents, salesTotalCents: row.salesTotalCents },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      sendToFieldGroup(
        [
          `✅ *每日結帳 · ${date} ${nowHM()}*`,
          `銷售總額：${NT(row.salesTotalCents)}（${row.txnCount} 筆）`,
          ``,
          `*櫃檯現金*`,
          `· 開帳：${NT(openingCents)}　現金收：${NT(cashSalesCents)}`,
          `· 現金退：${NT(cashRefundsCents)}　清帳：${NT(drawdownCents)}`,
          `· 現金支出：${NT(expensesCents)}`,
          `· 預期：${NT(expectedCashCents)}　實點：${NT(countedCashCents)}`,
          varianceCents !== 0 ? `· ⚠️ 差異：${varianceCents > 0 ? "溢" : "短"}${NT(Math.abs(varianceCents))}（${reason}）` : `· 差異：無`,
          `· 櫃檯實際現金：${NT(actualCashCents)}（隔日開帳基礎）`,
          `結帳人：${row.settledByName ?? "—"}`,
        ].join("\n"),
      );

      res.json({ ok: true, settlement: row });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── POST 結帳後補記（閉環：計入實際現金 + 推播 + 軌跡；可多次）──
  // 當日已結帳鎖定後仍發生現金收/支 → 用此補記：計入真實現金（隔日開帳基礎即時反映）、
  // 每次獨立留痕+推播（多次補記＝多次閉環）。原結帳快照不動，補記以軌跡呈現。
  app.post("/api/pos/cash/post-settlement", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const { direction, amountCents, category, note } = req.body ?? {};
      if (direction !== "income" && direction !== "expense") {
        return res.status(400).json({ error: "bad_direction", message: "補記方向須為收入或支出" });
      }
      const amount = Math.round(Number(amountCents));
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "bad_amount", message: "金額需大於 0" });
      }
      const { date } = getTodayRange();
      const settlement = await getSettlement(scope.identifiers, date);
      if (!settlement) {
        return res.status(409).json({ error: "not_settled", message: "本日尚未結帳，請走一般收款/支出流程" });
      }
      const noteText = typeof note === "string" ? note.slice(0, 200).trim() : "";

      // 1. 寫入對應紀錄（標 post_settlement，可日後追溯）
      if (direction === "income") {
        await db.insert(posTransactions).values({
          fieldId: scope.id,
          staffId: req.admin!.id,
          amountCents: amount,
          paidAmountCents: amount,
          paymentMethod: "cash",
          postSettlement: true,
          note: `結帳後補記${noteText ? `：${noteText}` : ""}`,
        });
      } else {
        const cat = typeof category === "string" && category.trim() ? category.trim().slice(0, 40) : "補記支出";
        await db.insert(posExpenses).values({
          fieldId: scope.id,
          businessDate: date,
          category: cat,
          amountCents: amount,
          postSettlement: true,
          note: noteText || null,
          spentBy: req.admin!.id,
          spentByName: req.admin!.displayName ?? req.admin!.username,
        });
      }

      // 2. 計入實際現金（收入 +、支出 −）→ 隔日開帳對帳基礎即時反映真實
      const oldActual = settlement.actualCashCents;
      const delta = direction === "income" ? amount : -amount;
      const newActual = Math.max(0, oldActual + delta);
      await db
        .update(posDailySettlements)
        .set({ actualCashCents: newActual })
        .where(eq(posDailySettlements.id, settlement.id));

      // 3. append 軌跡（append-only，保留前後值）
      const reasonText = `結帳後補記・${direction === "income" ? "收入" : "支出"}${noteText ? `（${noteText}）` : ""}`;
      const [adj] = await db
        .insert(posCashAdjustments)
        .values({
          fieldId: scope.id,
          businessDate: date,
          targetType: "settlement",
          targetId: settlement.id,
          fieldChanged: "actualCashCents",
          oldCents: oldActual,
          newCents: newActual,
          reason: reasonText,
          adjustedBy: req.admin!.id,
          adjustedByName: req.admin!.displayName ?? req.admin!.username,
        })
        .returning();

      await logAuditAction({
        actorAdminId: req.admin!.id,
        action: "pos:post_settlement_entry",
        targetType: "pos_daily_settlement",
        targetId: settlement.id,
        fieldId: scope.id,
        metadata: { date, direction, amountCents: amount, oldActual, newActual, note: noteText },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 4. 推播（每次補記一個閉環）
      sendToFieldGroup(
        [
          `🕐 *POS 結帳後補記*（${date} ${nowHM()}）`,
          `${direction === "income" ? "補收入" : "補支出"}：${NT(amount)}`,
          noteText ? `說明：${noteText}` : "",
          `櫃檯實際現金：${NT(oldActual)} → ${NT(newActual)}（隔日基礎已更新）`,
          `操作人：${adj.adjustedByName ?? "—"}`,
        ]
          .filter(Boolean)
          .join("\n"),
      );

      res.json({ ok: true, adjustment: adj, actualCashCents: newActual });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── GET 某日結帳 ───────────────────────────────
  app.get("/api/pos/cash/settlement", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const date = (req.query.date as string) || getTodayRange().date;
      const settlement = await getSettlement(scope.identifiers, date);
      res.json({ settlement });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── POST 調整已鎖定紀錄（append-only，[cash]）────
  // 原紀錄不動；追加完整軌跡（人/時間/前後值/原因）；同步更新有效值。
  app.post("/api/pos/cash/adjust", requireAdminAuth, requirePermission("pos_cash_admin"), async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const { targetType, targetId, newCents, reason } = req.body ?? {};
      if (!["count", "settlement"].includes(targetType) || !targetId) return res.status(400).json({ error: "bad_target" });
      if (!reason || typeof reason !== "string") return res.status(400).json({ error: "need_reason", message: "調整必須填原因" });
      const nv = Math.max(0, Math.round(Number(newCents)));
      if (!Number.isFinite(nv)) return res.status(400).json({ error: "bad_value" });

      let oldCents = 0;
      let fieldChanged = "";
      let businessDate = "";
      if (targetType === "count") {
        const [c] = await db.select().from(posCashCounts).where(eq(posCashCounts.id, targetId)).limit(1);
        if (!c) return res.status(404).json({ error: "not_found" });
        oldCents = c.adjustmentCents ?? c.countedCents;
        fieldChanged = "countedCents";
        businessDate = c.businessDate;
        await db.update(posCashCounts).set({
          adjustmentCents: nv,
          varianceCents: nv - c.expectedCents,
          varianceStatus: "confirmed",
          confirmedBy: req.admin!.id,
          confirmedByName: req.admin!.displayName ?? req.admin!.username,
          confirmedAt: new Date(),
        }).where(eq(posCashCounts.id, targetId));
      } else {
        const [s] = await db.select().from(posDailySettlements).where(eq(posDailySettlements.id, targetId)).limit(1);
        if (!s) return res.status(404).json({ error: "not_found" });
        oldCents = s.actualCashCents;
        fieldChanged = "actualCashCents";
        businessDate = s.businessDate;
        await db.update(posDailySettlements).set({ actualCashCents: nv }).where(eq(posDailySettlements.id, targetId));
      }

      const [adj] = await db
        .insert(posCashAdjustments)
        .values({
          fieldId: scope.id,
          businessDate,
          targetType,
          targetId,
          fieldChanged,
          oldCents,
          newCents: nv,
          reason,
          adjustedBy: req.admin!.id,
          adjustedByName: req.admin!.displayName ?? req.admin!.username,
        })
        .returning();

      await logAuditAction({
        actorAdminId: req.admin!.id,
        action: "pos:cash_adjust",
        targetType: `pos_${targetType}`,
        targetId,
        fieldId: scope.id,
        metadata: { businessDate, fieldChanged, oldCents, newCents: nv, reason },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      sendToFieldGroup(
        [
          `🛠 *POS 現金調整*（${businessDate} ${nowHM()}）`,
          `項目：${targetType === "count" ? "清點" : "結帳實際現金"}`,
          `${NT(oldCents)} → ${NT(nv)}`,
          `原因：${reason}`,
          `調整人：${adj.adjustedByName ?? "—"}`,
        ].join("\n"),
      );

      res.json({ ok: true, adjustment: adj });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── GET 調整紀錄（append-only 軌跡）─────────────
  app.get("/api/pos/cash/adjustments", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 60));
      const rows = await db
        .select()
        .from(posCashAdjustments)
        .where(inArray(posCashAdjustments.fieldId, scope.identifiers))
        .orderBy(desc(posCashAdjustments.adjustedAt))
        .limit(limit);
      res.json({ adjustments: rows });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── POST 記現金支出（現場執行者可記）──────────────
  app.post("/api/pos/expenses", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const { category, amountCents, note } = req.body ?? {};
      const cat = typeof category === "string" ? category.trim().slice(0, 40) : "";
      const amount = Math.round(Number(amountCents));
      if (!cat) return res.status(400).json({ error: "category_required", message: "請選擇或填寫支出分類" });
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "bad_amount", message: "金額需大於 0" });
      const { date } = getTodayRange();
      // 已結帳鎖定 → 不可再記當日支出（避免影響已鎖帳）
      const settled = await getSettlement(scope.identifiers, date);
      if (settled) return res.status(409).json({ error: "locked", message: "當日已結帳鎖定，無法再記支出" });
      const [row] = await db
        .insert(posExpenses)
        .values({
          fieldId: scope.id,
          businessDate: date,
          category: cat,
          amountCents: amount,
          note: typeof note === "string" ? note.slice(0, 200) : null,
          spentBy: req.admin!.id,
          spentByName: req.admin!.displayName ?? req.admin!.username,
        })
        .returning();
      await logAuditAction({
        actorAdminId: req.admin!.id,
        action: "pos:expense_add",
        targetType: "pos_expense",
        targetId: row.id,
        fieldId: scope.id,
        metadata: { date, category: cat, amountCents: amount, note },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({ ok: true, expense: row });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── GET 支出清單（某日，排除已刪除）────────────────
  app.get("/api/pos/expenses", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const date = (req.query.date as string) || getTodayRange().date;
      const rows = await db
        .select()
        .from(posExpenses)
        .where(
          and(
            inArray(posExpenses.fieldId, scope.identifiers),
            eq(posExpenses.businessDate, date),
            sql`${posExpenses.deletedAt} IS NULL`,
          ),
        )
        .orderBy(desc(posExpenses.spentAt));
      const totalCents = rows.reduce((s, r) => s + r.amountCents, 0);
      res.json({ expenses: rows, totalCents });
    } catch (e) {
      fail(res, e);
    }
  });

  // ── POST 支出軟刪除（需原因，進垃圾桶）─────────────
  app.post("/api/pos/expenses/:id/delete", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (reason.length < 2) return res.status(400).json({ error: "reason_required", message: "請填刪除原因" });
      // 已結帳鎖定 → 不可刪（避免影響已鎖帳）
      const { date } = getTodayRange();
      const settled = await getSettlement(scope.identifiers, date);
      const [target] = await db.select().from(posExpenses).where(eq(posExpenses.id, req.params.id)).limit(1);
      if (settled && target && target.businessDate === date) {
        return res.status(409).json({ error: "locked", message: "當日已結帳鎖定，無法刪除支出" });
      }
      const [updated] = await db
        .update(posExpenses)
        .set({ deletedAt: new Date(), deletedBy: req.admin!.id, deleteReason: reason })
        .where(and(eq(posExpenses.id, req.params.id), inArray(posExpenses.fieldId, scope.identifiers), sql`${posExpenses.deletedAt} IS NULL`))
        .returning();
      if (!updated) return res.status(404).json({ error: "not_found" });
      await logAuditAction({
        actorAdminId: req.admin!.id,
        action: "pos:expense_delete",
        targetType: "pos_expense",
        targetId: updated.id,
        fieldId: scope.id,
        metadata: { reason, amountCents: updated.amountCents, category: updated.category },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({ ok: true });
    } catch (e) {
      fail(res, e);
    }
  });
}
