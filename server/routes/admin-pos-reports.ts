// 📊 POS 銷售報表 + 每日結帳（2026-06-13）
//
// Endpoints（requireAdminAuth + game:view，場域隔離）：
//   GET  /api/admin/pos/reports/daily?date=YYYY-MM-DD   當日銷售報表（聚合）
//   GET  /api/admin/pos/reports/status                  狀態總覽（預約 today/本月/未來 + 來源 + 退款）
//   POST /api/pos/shift/close                           每日結帳 → 寫 shift_closes + 推 Telegram 群組
//   GET  /api/admin/pos/shift/closes                    歷史結帳清單

import type { Express } from "express";
import { db } from "../db";
import { posTransactions, posTransactionItems, shiftCloses, refunds, bookings } from "@shared/schema";
import { and, eq, sql, desc, inArray, gte } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { sendToFieldGroup } from "../lib/internal-notifier";

function fail(res: import("express").Response, e: unknown) {
  console.error("[admin-pos-reports]", e);
  res.status(500).json({ error: "internal_error", message: "伺服器錯誤" });
}

/** Asia/Taipei 今天 yyyy-mm-dd */
function taipeiToday(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

const CAT_LABEL: Record<string, string> = { food: "餐飲", goods: "文創", course: "課程" };
const METHOD_LABEL: Record<string, string> = {
  cash: "現金", online_recur: "定期定額", online_stripe: "信用卡", linepay: "LINE Pay", voucher_full: "券全額",
};

/** 聚合某營業日的銷售（Asia/Taipei）*/
async function aggregateDaily(fieldId: string, date: string) {
  // 當日交易（以 Taipei 日期）
  const txns = await db
    .select({
      id: posTransactions.id,
      paidAmountCents: posTransactions.paidAmountCents,
      paymentMethod: posTransactions.paymentMethod,
      staffId: posTransactions.staffId,
    })
    .from(posTransactions)
    .where(
      and(
        eq(posTransactions.fieldId, fieldId),
        sql`(${posTransactions.createdAt} AT TIME ZONE 'Asia/Taipei')::date = ${date}::date`,
        sql`${posTransactions.deletedAt} IS NULL`,
      ),
    );

  const txIds = txns.map((t) => t.id);
  const items = txIds.length
    ? await db.select().from(posTransactionItems).where(inArray(posTransactionItems.transactionId, txIds))
    : [];

  const totalCents = txns.reduce((s, t) => s + (t.paidAmountCents ?? 0), 0);

  const byMethod: Record<string, { label: string; cents: number; count: number }> = {};
  for (const t of txns) {
    const k = t.paymentMethod;
    byMethod[k] ??= { label: METHOD_LABEL[k] ?? k, cents: 0, count: 0 };
    byMethod[k].cents += t.paidAmountCents ?? 0;
    byMethod[k].count++;
  }

  const byCategory: Record<string, { label: string; cents: number; qty: number }> = {};
  const byProduct: Record<string, { name: string; qty: number; cents: number }> = {};
  const byModifier: Record<string, number> = {};
  for (const it of items) {
    const cat = it.category ?? "other";
    byCategory[cat] ??= { label: CAT_LABEL[cat] ?? cat, cents: 0, qty: 0 };
    byCategory[cat].cents += it.lineTotalCents;
    byCategory[cat].qty += it.qty;

    const pk = it.nameSnapshot;
    byProduct[pk] ??= { name: pk, qty: 0, cents: 0 };
    byProduct[pk].qty += it.qty;
    byProduct[pk].cents += it.lineTotalCents;

    const mods = Array.isArray(it.modifiers) ? (it.modifiers as Array<{ optionName?: string }>) : [];
    for (const m of mods) {
      if (m?.optionName) byModifier[m.optionName] = (byModifier[m.optionName] ?? 0) + it.qty;
    }
  }

  return {
    date,
    totalCents,
    txnCount: txns.length,
    itemCount: items.reduce((s, i) => s + i.qty, 0),
    byMethod: Object.values(byMethod).sort((a, b) => b.cents - a.cents),
    byCategory: Object.values(byCategory).sort((a, b) => b.cents - a.cents),
    byProduct: Object.values(byProduct).sort((a, b) => b.cents - a.cents),
    byModifier: Object.entries(byModifier).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty),
  };
}

export function registerAdminPosReportRoutes(app: Express) {
  app.get("/api/admin/pos/reports/daily", requireAdminAuth, requirePermission("game:view"), async (req, res) => {
    try {
      const date = (req.query.date as string) || taipeiToday();
      const report = await aggregateDaily(req.admin!.fieldId, date);
      res.json(report);
    } catch (e) {
      fail(res, e);
    }
  });

  // 狀態總覽（預約 + 退款）
  app.get("/api/admin/pos/reports/status", requireAdminAuth, requirePermission("game:view"), async (req, res) => {
    try {
      const fieldId = req.admin!.fieldId;
      const [counts] = await db
        .select({
          today: sql<number>`COUNT(*) FILTER (WHERE (${bookings.slotStart} AT TIME ZONE 'Asia/Taipei')::date = (NOW() AT TIME ZONE 'Asia/Taipei')::date)::int`,
          month: sql<number>`COUNT(*) FILTER (WHERE date_trunc('month', ${bookings.slotStart} AT TIME ZONE 'Asia/Taipei') = date_trunc('month', NOW() AT TIME ZONE 'Asia/Taipei'))::int`,
          future: sql<number>`COUNT(*) FILTER (WHERE ${bookings.slotStart} > NOW())::int`,
          srcLineDirect: sql<number>`COUNT(*) FILTER (WHERE ${bookings.source} = 'line_direct')::int`,
          srcManual: sql<number>`COUNT(*) FILTER (WHERE ${bookings.source} = 'manual')::int`,
          srcManualLinked: sql<number>`COUNT(*) FILTER (WHERE ${bookings.source} = 'manual_linked')::int`,
        })
        .from(bookings)
        .where(and(eq(bookings.fieldId, fieldId), sql`${bookings.status} <> 'cancelled'`));

      const [refundAgg] = await db
        .select({
          count: sql<number>`COUNT(*)::int`,
          cents: sql<number>`COALESCE(SUM(${refunds.amountCents}),0)::int`,
        })
        .from(refunds)
        .where(and(eq(refunds.fieldId, fieldId), gte(refunds.createdAt, sql`date_trunc('month', NOW())`)));

      res.json({ bookings: counts, refundsThisMonth: refundAgg });
    } catch (e) {
      fail(res, e);
    }
  });

  // 每日結帳
  app.post("/api/pos/shift/close", requireAdminAuth, requirePermission("game:view"), async (req, res) => {
    try {
      const fieldId = req.admin!.fieldId;
      const date = taipeiToday();
      const report = await aggregateDaily(fieldId, date);

      // 標記當日未結交易的 shift_close_id（避免重複結算）
      const [sc] = await db
        .insert(shiftCloses)
        .values({
          fieldId,
          staffId: req.admin!.id,
          businessDate: date,
          totalCents: report.totalCents,
          txnCount: report.txnCount,
          breakdown: { byCategory: report.byCategory, byMethod: report.byMethod, byProduct: report.byProduct.slice(0, 30) },
          note: typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : null,
        })
        .returning();

      await db
        .update(posTransactions)
        .set({ shiftCloseId: sc.id })
        .where(
          and(
            eq(posTransactions.fieldId, fieldId),
            sql`${posTransactions.shiftCloseId} IS NULL`,
            sql`(${posTransactions.createdAt} AT TIME ZONE 'Asia/Taipei')::date = ${date}::date`,
          ),
        );

      logAuditAction({
        actorAdminId: req.admin!.id,
        action: "pos:shift_close",
        targetType: "shift_close",
        targetId: sc.id,
        fieldId,
        metadata: { date, totalCents: report.totalCents, txnCount: report.txnCount },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 推 Telegram 群組
      const lines = [
        `🧾 *每日結帳 · ${date}*`,
        `總收款：NT$${(report.totalCents / 100).toLocaleString()}（${report.txnCount} 筆）`,
      ];
      if (report.byCategory.length) {
        lines.push("", "*分類*");
        report.byCategory.forEach((c) => lines.push(`· ${c.label}：NT$${(c.cents / 100).toLocaleString()}（${c.qty} 件）`));
      }
      if (report.byMethod.length) {
        lines.push("", "*付款方式*");
        report.byMethod.forEach((m) => lines.push(`· ${m.label}：NT$${(m.cents / 100).toLocaleString()}`));
      }
      if (report.byProduct.length) {
        lines.push("", "*熱銷 TOP5*");
        report.byProduct.slice(0, 5).forEach((p, i) => lines.push(`${i + 1}. ${p.name} ×${p.qty}`));
      }
      sendToFieldGroup(lines.join("\n"));

      res.json({ shiftClose: sc, report });
    } catch (e) {
      fail(res, e);
    }
  });

  app.get("/api/admin/pos/shift/closes", requireAdminAuth, requirePermission("game:view"), async (req, res) => {
    try {
      const rows = await db
        .select()
        .from(shiftCloses)
        .where(eq(shiftCloses.fieldId, req.admin!.fieldId))
        .orderBy(desc(shiftCloses.closedAt))
        .limit(60);
      res.json({ closes: rows });
    } catch (e) {
      fail(res, e);
    }
  });
}
