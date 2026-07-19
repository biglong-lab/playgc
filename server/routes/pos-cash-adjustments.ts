// 🛠 POS 現金「軌跡型」操作（2026-07-19 從 pos-cash.ts 拆出，維持單檔 ≤ 800 行）
//
// 共同點：都圍繞 pos_cash_adjustments（append-only 軌跡）。
//   POST /api/pos/cash/adjust           [cash]  管理員調整已鎖定紀錄（清點 / 結帳實際現金），保留前後值軌跡
//   POST /api/pos/cash/post-settlement          結帳後補記（計入實際現金 + 推播 + 留痕；可多次閉環）
//   GET  /api/pos/cash/adjustments               調整 / 補記軌跡查詢

import type { Express, Response } from "express";
import { db } from "../db";
import {
  posCashCounts,
  posDailySettlements,
  posCashAdjustments,
  posExpenses,
  posTransactions,
} from "@shared/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { sendToFieldGroup } from "../lib/internal-notifier";
import { resolveFieldScope, getTodayRange } from "./pos";
import { NT, nowHM, getSettlement } from "./pos-cash";

function fail(res: Response, e: unknown) {
  console.error("[pos-cash-adjustments]", e);
  res.status(500).json({ error: "internal_error", message: "伺服器錯誤" });
}

export function registerPosCashAdjustmentRoutes(app: Express) {
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
}
