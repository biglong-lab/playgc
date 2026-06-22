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
import { posCashCounts, posCashDrawdowns, posDailySettlements, posCashAdjustments, posTransactions, refunds, CASH_DENOMINATIONS } from "@shared/schema";
import { and, eq, sql, desc, inArray, gte, lte, lt } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { sendToFieldGroup } from "../lib/internal-notifier";
import { resolveFieldScope, getTodayRange } from "./pos";

function fail(res: Response, e: unknown) {
  console.error("[pos-cash]", e);
  res.status(500).json({ error: "internal_error", message: "伺服器錯誤" });
}

const NT = (cents: number) => `NT$${Math.round(cents / 100).toLocaleString()}`;

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

/** 某日現金收款 / 現金退款（分）*/
async function cashFlows(identifiers: string[], dateStr: string) {
  const { start, end } = taipeiDateRange(dateStr);
  const [salesAgg] = await db
    .select({ cents: sql<number>`COALESCE(SUM(${posTransactions.paidAmountCents}),0)::int` })
    .from(posTransactions)
    .where(
      and(
        inArray(posTransactions.fieldId, identifiers),
        eq(posTransactions.paymentMethod, "cash"),
        gte(posTransactions.createdAt, start),
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
        gte(refunds.createdAt, start),
        lte(refunds.createdAt, end),
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

/** 取某 fieldId 最近一次 closing 清點（用於 opening 對帳基準）*/
async function lastClosing(identifiers: string[], beforeDate: string) {
  const [row] = await db
    .select()
    .from(posCashCounts)
    .where(
      and(
        inArray(posCashCounts.fieldId, identifiers),
        eq(posCashCounts.countType, "closing"),
        lt(posCashCounts.businessDate, beforeDate),
      ),
    )
    .orderBy(desc(posCashCounts.businessDate), desc(posCashCounts.countedAt))
    .limit(1);
  return row ?? null;
}

/** 取某日某型別的清點 */
async function getCount(identifiers: string[], date: string, type: "opening" | "closing") {
  const [row] = await db
    .select()
    .from(posCashCounts)
    .where(
      and(
        inArray(posCashCounts.fieldId, identifiers),
        eq(posCashCounts.businessDate, date),
        eq(posCashCounts.countType, type),
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
  // closing：今日 opening + 現金收 − 現金退 − 今日(開班後)清帳
  const opening = await getCount(identifiers, date, "opening");
  const openingCents = opening ? opening.adjustmentCents ?? opening.countedCents : 0;
  const { cashSalesCents, cashRefundsCents } = await cashFlows(identifiers, date);
  const drawnAfterOpen = await drawdownsSince(identifiers, opening?.countedAt ?? taipeiDateRange(date).start);
  return Math.max(0, openingCents + cashSalesCents - cashRefundsCents - drawnAfterOpen);
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
      // 🔒 已結帳鎖定 → 不可再清點（管理員須走「調整」）
      const settled = await getSettlement(scope.identifiers, date);
      if (settled) return res.status(409).json({ error: "locked", message: "當日已結帳鎖定，如需更正請由管理員調整" });
      const expectedCents = await computeExpected(scope.identifiers, date, countType);
      const varianceCents = countedCents - expectedCents;
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
            `⚠️ *POS 現金差異*（${date} ${label}）`,
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
            `💵 *POS 清帳*（${date}）`,
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
        .where(inArray(posCashCounts.fieldId, scope.identifiers))
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
      const closingCounted = closing ? closing.adjustmentCents ?? closing.countedCents : null;
      res.json({
        date,
        openingCents: opening ? opening.adjustmentCents ?? opening.countedCents : null,
        closingCents: closingCounted,
        cashSalesCents,
        cashRefundsCents,
        drawdownCents,
        // 櫃檯實際現金 = 下班點鈔 − 清帳
        actualCashCents: closingCounted !== null ? Math.max(0, closingCounted - drawdownCents) : null,
        openingVarianceCents: opening?.varianceCents ?? 0,
        closingVarianceCents: closing?.varianceCents ?? 0,
      });
    } catch (e) {
      fail(res, e);
    }
  });
}
