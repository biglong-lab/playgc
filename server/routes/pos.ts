// 💰 POS 工作站 API（2026-05-18）
//
// 給現場工作人員使用、權限：pos_operator+ / field_executor+ / 場域 admin
// 端點：
//   GET  /api/pos/dashboard?fieldId=         今日數字 + 下個時段預約
//   POST /api/pos/checkin                    掃 QR / 預約碼 → 自動判別 + 確認資料
//   POST /api/pos/bookings/:id/check-in      手動標記到場
//   POST /api/pos/bookings/:id/no-show       標記未到
//   POST /api/pos/checkout                   現金收款（綁 booking 或散客）
//   POST /api/pos/voucher/lookup             券 token 查資料
//   POST /api/pos/voucher/redeem             券核銷
//   GET  /api/pos/summary?date=&fieldId=     今日小結
//
// 保留：班次結算 /api/pos/shift/close（後續 Round）

import type { Express, Request, Response } from "express";
import { db } from "../db";
import { bookings, activities, posTransactions, platformCoupons, couponTemplates, fields } from "@shared/schema";
import { and, eq, gte, lte, sql, or, inArray } from "drizzle-orm";
import { requireAdminAuth } from "../adminAuth";
import { z } from "zod";

/** 取得 admin 所屬 fieldId（若 query 有指定 + 是 super 則用 query；否則用 admin.fieldId）*/
function resolveFieldId(req: Request): string | null {
  const admin = req.admin;
  if (!admin) return null;
  const queryFieldId = typeof req.query.fieldId === "string" ? req.query.fieldId : undefined;
  // super admin 可指定任意場域；其他 admin 只能看自己場域
  if (queryFieldId && admin.systemRole === "super_admin") return queryFieldId;
  return admin.fieldId ?? null;
}

/**
 * 🐛 2026-05-19 業主回報 POS 全部「找不到」根因：
 *   - admin_accounts.field_id = UUID（如 72cc204d-...）
 *   - bookings.field_id       = 場域代碼（如 JIACHUN）
 *   - 直接 eq() 永遠不會 match
 *
 * 解法：取得 admin 場域的「所有可能識別碼」（UUID + code）、查詢時 OR 匹配。
 * 同時提供場域 code 給 UI 顯示用。
 */
async function resolveFieldScope(
  req: Request,
): Promise<{ id: string; code: string; identifiers: string[] } | null> {
  const raw = resolveFieldId(req);
  if (!raw) return null;
  const [row] = await db
    .select({ id: fields.id, code: fields.code })
    .from(fields)
    .where(or(eq(fields.id, raw), eq(fields.code, raw)))
    .limit(1);
  if (!row) return null;
  // 兩個值都納入比對、避免歷史資料混用
  const identifiers = Array.from(new Set([row.id, row.code].filter(Boolean) as string[]));
  return { id: row.id, code: row.code, identifiers };
}

/** 取得當日（Asia/Taipei）的起訖時間（UTC）*/
function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  // 用 Asia/Taipei 時區算今日 00:00 ~ 23:59:59
  const taipeiOffset = 8 * 60; // 分鐘
  const utcMs = now.getTime();
  const taipeiMs = utcMs + taipeiOffset * 60 * 1000;
  const taipeiDate = new Date(taipeiMs);
  const dayStart = new Date(
    Date.UTC(taipeiDate.getUTCFullYear(), taipeiDate.getUTCMonth(), taipeiDate.getUTCDate()),
  );
  const start = new Date(dayStart.getTime() - taipeiOffset * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

export function registerPosRoutes(app: Express) {
  // GET /api/pos/dashboard
  app.get("/api/pos/dashboard", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = resolveFieldId(req);
      if (!fieldId) return res.status(400).json({ error: "no_field" });
      const { start, end } = getTodayRange();

      // 今日預約清單
      const todayList = await db
        .select({
          id: bookings.id,
          bookingCode: bookings.bookingCode,
          displayName: bookings.displayName,
          phone: bookings.phone,
          slotStart: bookings.slotStart,
          slotEnd: bookings.slotEnd,
          partySize: bookings.partySize,
          status: bookings.status,
          paymentStatus: bookings.paymentStatus,
          amountCents: bookings.amountCents,
          checkedInAt: bookings.checkedInAt,
          paidAt: bookings.paidAt,
          activityId: bookings.activityId,
          customerNote: bookings.customerNote,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.fieldId, fieldId),
            gte(bookings.slotStart, start),
            lte(bookings.slotStart, end),
          ),
        )
        .orderBy(bookings.slotStart);

      // 統計
      const total = todayList.length;
      const arrived = todayList.filter((b) => !!b.checkedInAt).length;
      const paid = todayList.filter(
        (b) => !!b.paidAt || b.paymentStatus === "paid",
      ).length;
      // 🆕 2026-05-18：待現場付款金額（沒取消 + 沒付）
      const pendingOnsiteCents = todayList
        .filter(
          (b) =>
            b.status !== "cancelled" &&
            b.status !== "no_show" &&
            !b.paidAt &&
            b.paymentStatus !== "paid",
        )
        .reduce((s, b) => s + (b.amountCents ?? 0), 0);

      // 今日 POS 收款總額
      const [posStats] = await db
        .select({
          totalPaidCents: sql<number>`COALESCE(SUM(${posTransactions.paidAmountCents}), 0)::int`,
          txCount: sql<number>`COUNT(*)::int`,
        })
        .from(posTransactions)
        .where(
          and(
            eq(posTransactions.fieldId, fieldId),
            gte(posTransactions.createdAt, start),
            lte(posTransactions.createdAt, end),
          ),
        );

      // 下個 30 分鐘要到的預約
      const now = new Date();
      const next30 = new Date(now.getTime() + 30 * 60 * 1000);
      const upcoming = todayList.filter(
        (b) => b.slotStart >= now && b.slotStart <= next30 && b.status !== "cancelled",
      );

      // 補充 activity 名（如有）
      const activityIds = Array.from(
        new Set(todayList.map((b) => b.activityId).filter((id): id is string => !!id)),
      );
      const activityMap = new Map<string, { name: string; coverUrl: string | null }>();
      if (activityIds.length) {
        const acts = await db
          .select({ id: activities.id, name: activities.name, coverUrl: activities.coverUrl })
          .from(activities)
          .where(or(...activityIds.map((id) => eq(activities.id, id))));
        for (const a of acts) activityMap.set(a.id, { name: a.name, coverUrl: a.coverUrl });
      }

      // 場域名（給 dashboard 顯示）
      const { fields } = await import("@shared/schema");
      const [field] = await db
        .select({ name: fields.name })
        .from(fields)
        .where(eq(fields.id, fieldId))
        .limit(1);

      res.json({
        date: start.toISOString().slice(0, 10),
        fieldId,
        fieldName: field?.name,
        stats: {
          totalBookings: total,
          arrivedBookings: arrived,
          paidBookings: paid,
          posTotalPaidCents: posStats?.totalPaidCents ?? 0,
          posTxCount: posStats?.txCount ?? 0,
          pendingOnsiteCents,
        },
        upcoming: upcoming.map((b) => ({
          ...b,
          activity: b.activityId ? activityMap.get(b.activityId) ?? null : null,
        })),
        todayBookings: todayList.map((b) => ({
          ...b,
          activity: b.activityId ? activityMap.get(b.activityId) ?? null : null,
        })),
      });
    } catch (err) {
      console.error("[pos/dashboard]", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/pos/checkin（掃 QR / 預約碼自動判別）
  const checkinSchema = z.object({
    token: z.string().min(1).max(120),
  });
  app.post("/api/pos/checkin", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = resolveFieldId(req);
      if (!fieldId) return res.status(400).json({ error: "no_field" });
      const parsed = checkinSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "validation" });
      }
      const token = parsed.data.token.trim();

      // 自動判別 prefix
      if (token.startsWith("BK_") || /^[A-Z0-9]{4,12}$/i.test(token)) {
        // 嘗試用 qr_token 或 bookingCode 找
        const [b] = await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.fieldId, fieldId),
              or(eq(bookings.qrToken, token), eq(bookings.bookingCode, token.toUpperCase())),
            ),
          )
          .limit(1);
        if (!b) {
          // 🐛 2026-05-19 業主回報「找不到 Request failed」原因不清楚
          // 改回友善 message、前端可顯示具體問題
          return res.status(404).json({
            error: "not_found",
            type: "booking",
            message: `找不到預約：${token}（可能不是本場域的預約、或編號錯誤）`,
          });
        }

        // 補活動資訊
        let activity = null;
        if (b.activityId) {
          const [a] = await db
            .select({ name: activities.name, coverUrl: activities.coverUrl })
            .from(activities)
            .where(eq(activities.id, b.activityId))
            .limit(1);
          activity = a ?? null;
        }
        return res.json({ type: "booking", booking: b, activity });
      }

      // 🆕 2026-05-18 Phase 5：CP_xxx 平台券 / 純 code
      if (token.startsWith("CP_") || /^[A-Z0-9]{6,32}$/i.test(token)) {
        const [c] = await db
          .select({
            coupon: platformCoupons,
            template: couponTemplates,
          })
          .from(platformCoupons)
          .leftJoin(couponTemplates, eq(platformCoupons.templateId, couponTemplates.id))
          .where(or(eq(platformCoupons.qrToken, token), eq(platformCoupons.code, token.toUpperCase())))
          .limit(1);
        if (c) {
          return res.json({
            type: "voucher",
            coupon: c.coupon,
            template: c.template,
          });
        }
      }
      res.status(400).json({
        error: "unknown_token_type",
        message: `此 QR 不是預約碼或券（${token.slice(0, 20)}...）`,
      });
    } catch (err) {
      console.error("[pos/checkin]", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /api/pos/bookings/:id/check-in（手動報到）
  app.post(
    "/api/pos/bookings/:id/check-in",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const fieldId = resolveFieldId(req);
        if (!fieldId || !req.admin) return res.status(400).json({ error: "no_field" });
        const bookingId = Number(req.params.id);
        if (!Number.isFinite(bookingId)) return res.status(400).json({ error: "invalid_id" });

        const [updated] = await db
          .update(bookings)
          .set({
            checkedInAt: new Date(),
            checkedInByStaffId: req.admin.id,
            updatedAt: new Date(),
          })
          .where(and(eq(bookings.id, bookingId), eq(bookings.fieldId, fieldId)))
          .returning();
        if (!updated) return res.status(404).json({ error: "not_found" });
        res.json({ booking: updated });
      } catch (err) {
        console.error("[pos/check-in]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // POST /api/pos/bookings/:id/no-show
  app.post(
    "/api/pos/bookings/:id/no-show",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const fieldId = resolveFieldId(req);
        if (!fieldId) return res.status(400).json({ error: "no_field" });
        const bookingId = Number(req.params.id);
        if (!Number.isFinite(bookingId)) return res.status(400).json({ error: "invalid_id" });
        const [updated] = await db
          .update(bookings)
          .set({ status: "no_show", updatedAt: new Date() })
          .where(and(eq(bookings.id, bookingId), eq(bookings.fieldId, fieldId)))
          .returning();
        if (!updated) return res.status(404).json({ error: "not_found" });
        res.json({ booking: updated });
      } catch (err) {
        console.error("[pos/no-show]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // POST /api/pos/checkout（現金收款）
  const checkoutSchema = z.object({
    bookingId: z.number().int().optional(),
    activityId: z.string().uuid().optional(),
    amountCents: z.number().int().min(0),
    paidAmountCents: z.number().int().min(0),
    paymentMethod: z.enum(["cash", "online_recur", "online_stripe", "linepay", "voucher_full"]),
    voucherId: z.string().optional(),
    voucherDiscountCents: z.number().int().min(0).default(0),
    customerName: z.string().max(100).optional(),
    customerPhone: z.string().max(20).optional(),
    note: z.string().max(500).optional(),
  });
  app.post("/api/pos/checkout", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = resolveFieldId(req);
      if (!fieldId || !req.admin) return res.status(400).json({ error: "no_field" });
      const parsed = checkoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "validation", details: parsed.error.issues });
      }

      // 🆕 2026-05-18 Phase 5：如有 voucherId、標券已用 + 校驗
      if (parsed.data.voucherId) {
        const [c] = await db
          .select()
          .from(platformCoupons)
          .where(eq(platformCoupons.id, parsed.data.voucherId))
          .limit(1);
        if (!c) return res.status(404).json({ error: "voucher_not_found" });
        if (c.status !== "unused") {
          return res.status(400).json({ error: "voucher_already_used" });
        }
        await db
          .update(platformCoupons)
          .set({
            status: "used",
            usedAt: new Date(),
            redeemedByStaffId: req.admin.id,
          })
          .where(eq(platformCoupons.id, c.id));
      }

      const [tx] = await db
        .insert(posTransactions)
        .values({
          fieldId,
          staffId: req.admin.id,
          bookingId: parsed.data.bookingId ?? null,
          activityId: parsed.data.activityId ?? null,
          amountCents: parsed.data.amountCents,
          paidAmountCents: parsed.data.paidAmountCents,
          paymentMethod: parsed.data.paymentMethod,
          voucherId: parsed.data.voucherId ?? null,
          voucherDiscountCents: parsed.data.voucherDiscountCents,
          customerName: parsed.data.customerName ?? null,
          customerPhone: parsed.data.customerPhone ?? null,
          note: parsed.data.note ?? null,
        })
        .returning();

      // 若綁定 booking → 標記 paid_at / paymentStatus
      if (parsed.data.bookingId) {
        await db
          .update(bookings)
          .set({
            paymentStatus: "paid",
            paidAt: new Date(),
            paidByStaffId: req.admin.id,
            paidAmountCents: parsed.data.paidAmountCents,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, parsed.data.bookingId));
      }

      res.status(201).json({ transaction: tx });
    } catch (err) {
      console.error("[pos/checkout]", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // 🆕 2026-05-18 Phase 5：POST /api/pos/voucher/redeem（純核銷、不收款）
  const voucherRedeemSchema = z.object({
    token: z.string().min(1).max(120),
    bookingId: z.number().int().optional(),
  });
  app.post("/api/pos/voucher/redeem", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = resolveFieldId(req);
      if (!fieldId || !req.admin) return res.status(400).json({ error: "no_field" });
      const parsed = voucherRedeemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "validation" });
      }
      const token = parsed.data.token.trim();

      const [c] = await db
        .select({ coupon: platformCoupons, template: couponTemplates })
        .from(platformCoupons)
        .leftJoin(couponTemplates, eq(platformCoupons.templateId, couponTemplates.id))
        .where(or(eq(platformCoupons.qrToken, token), eq(platformCoupons.code, token.toUpperCase())))
        .limit(1);
      if (!c) return res.status(404).json({ error: "voucher_not_found" });
      if (c.coupon.status !== "unused") {
        return res.status(400).json({ error: "voucher_already_used", coupon: c.coupon });
      }
      if (c.coupon.expiresAt < new Date()) {
        return res.status(400).json({ error: "voucher_expired" });
      }

      const [updated] = await db
        .update(platformCoupons)
        .set({
          status: "used",
          usedAt: new Date(),
          redeemedByStaffId: req.admin.id,
        })
        .where(eq(platformCoupons.id, c.coupon.id))
        .returning();

      res.json({ ok: true, coupon: updated, template: c.template });
    } catch (err) {
      console.error("[pos/voucher/redeem]", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/pos/summary
  app.get("/api/pos/summary", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = resolveFieldId(req);
      if (!fieldId) return res.status(400).json({ error: "no_field" });
      const { start, end } = getTodayRange();

      // 🆕 2026-05-18 join admin_accounts 拿收款員姓名
      const { adminAccounts } = await import("@shared/schema");
      const txRows = await db
        .select({
          tx: posTransactions,
          staffName: adminAccounts.displayName,
          staffUsername: adminAccounts.username,
        })
        .from(posTransactions)
        .leftJoin(adminAccounts, eq(posTransactions.staffId, adminAccounts.id))
        .where(
          and(
            eq(posTransactions.fieldId, fieldId),
            gte(posTransactions.createdAt, start),
            lte(posTransactions.createdAt, end),
          ),
        )
        .orderBy(posTransactions.createdAt);

      const txs = txRows.map((r) => ({
        ...r.tx,
        staffName: r.staffName ?? r.staffUsername ?? null,
      }));

      const totalPaid = txs.reduce((s, t) => s + (t.paidAmountCents ?? 0), 0);
      const totalDiscount = txs.reduce((s, t) => s + (t.voucherDiscountCents ?? 0), 0);

      // 按收款員分組（給班次結算）
      const byStaff = new Map<string, { count: number; totalCents: number; name: string }>();
      for (const t of txs) {
        const key = t.staffId;
        const cur = byStaff.get(key) ?? { count: 0, totalCents: 0, name: t.staffName ?? "未知" };
        cur.count += 1;
        cur.totalCents += t.paidAmountCents ?? 0;
        byStaff.set(key, cur);
      }
      const byStaffArr = Array.from(byStaff.entries()).map(([staffId, v]) => ({
        staffId,
        ...v,
      }));

      // 按活動分組
      const byActivity = new Map<string, { count: number; totalCents: number }>();
      for (const t of txs) {
        const key = t.activityId ?? "uncategorized";
        const cur = byActivity.get(key) ?? { count: 0, totalCents: 0 };
        cur.count += 1;
        cur.totalCents += t.paidAmountCents ?? 0;
        byActivity.set(key, cur);
      }
      const byActivityArr = Array.from(byActivity.entries()).map(([k, v]) => ({
        activityId: k === "uncategorized" ? null : k,
        ...v,
      }));

      res.json({
        date: start.toISOString().slice(0, 10),
        fieldId,
        totalTransactions: txs.length,
        totalPaidCents: totalPaid,
        totalDiscountCents: totalDiscount,
        byActivity: byActivityArr,
        byStaff: byStaffArr,
        transactions: txs,
      });
    } catch (err) {
      console.error("[pos/summary]", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
