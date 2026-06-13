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
import { bookings, activities, posTransactions, platformCoupons, couponTemplates, fields, posProducts, posModifierOptions, posTransactionItems } from "@shared/schema";
import { and, eq, gte, lte, gt, sql, or, inArray } from "drizzle-orm";
import { requireAdminAuth, logAuditAction } from "../adminAuth";
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
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const { start, end } = getTodayRange();

      // 今日預約清單（fieldId 同時支援 UUID + code）
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
            inArray(bookings.fieldId, scope.identifiers),
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

      // 今日 POS 收款總額（pos_transactions 用 UUID 存）
      const [posStats] = await db
        .select({
          totalPaidCents: sql<number>`COALESCE(SUM(${posTransactions.paidAmountCents}), 0)::int`,
          txCount: sql<number>`COUNT(*)::int`,
        })
        .from(posTransactions)
        .where(
          and(
            inArray(posTransactions.fieldId, scope.identifiers),
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

      // 場域名（給 dashboard 顯示、用 scope.id 直接查）
      const [field] = await db
        .select({ name: fields.name })
        .from(fields)
        .where(eq(fields.id, scope.id))
        .limit(1);

      res.json({
        date: start.toISOString().slice(0, 10),
        fieldId: scope.id,
        fieldCode: scope.code,
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
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const parsed = checkinSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "validation" });
      }
      const token = parsed.data.token.trim();

      // 自動判別 prefix
      if (token.startsWith("BK_") || /^[A-Z0-9]{4,12}$/i.test(token)) {
        // 🐛 2026-05-19 fix：先在「全域」找此預約、再判斷是否在本場域
        // 給業主明確訊息：找不到 vs 不是本場域 vs 已取消 vs 未到時段 vs 已過時段
        const [b] = await db
          .select()
          .from(bookings)
          .where(or(eq(bookings.qrToken, token), eq(bookings.bookingCode, token.toUpperCase())))
          .limit(1);

        if (!b) {
          return res.status(404).json({
            error: "not_found",
            type: "booking",
            message: `查無預約編號 ${token.toUpperCase()}。請確認 QR 來源或編號輸入正確`,
          });
        }

        // 跨場域檢查：booking 屬於別場
        if (!scope.identifiers.includes(b.fieldId)) {
          // 拿目標場域 code 給訊息用
          const [otherField] = await db
            .select({ code: fields.code, name: fields.name })
            .from(fields)
            .where(or(eq(fields.id, b.fieldId), eq(fields.code, b.fieldId)))
            .limit(1);
          return res.status(403).json({
            error: "wrong_field",
            type: "booking",
            booking: b,
            otherField: otherField ?? null,
            message: `此預約屬於「${otherField?.name ?? b.fieldId}」、不是本場域（${scope.code}）`,
          });
        }

        // 時段資訊（讓前端決定顯示「早到 X 分鐘」「遲到 X 分鐘」）
        const now = new Date();
        const slotStart = b.slotStart instanceof Date ? b.slotStart : new Date(b.slotStart as unknown as string);
        const slotEnd = b.slotEnd instanceof Date ? b.slotEnd : new Date(b.slotEnd as unknown as string);
        const minutesBeforeStart = Math.round((slotStart.getTime() - now.getTime()) / 60000);
        const minutesAfterEnd = Math.round((now.getTime() - slotEnd.getTime()) / 60000);

        let timing: "on_time" | "early" | "late" = "on_time";
        if (now < slotStart) timing = "early";
        else if (now > slotEnd) timing = "late";

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

        // 已取消 / 已 no-show：仍回 200 但 status 標記、前端決定 UX
        const issues: string[] = [];
        if (b.status === "cancelled") issues.push("cancelled");
        if (b.status === "no_show") issues.push("no_show");
        if (b.checkedInAt) issues.push("already_checked_in");
        if (timing === "early") issues.push("too_early");
        if (timing === "late") issues.push("too_late");

        // 🆕 2026-05-19 Phase B：掃描查詢留紀錄（不論結果）
        if (req.admin) {
          logAuditAction({
            actorAdminId: req.admin.id,
            action: "pos:scan_lookup",
            targetType: "booking",
            targetId: String(b.id),
            fieldId: scope.id,
            metadata: { bookingCode: b.bookingCode, timing, issues },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        }

        return res.json({
          type: "booking",
          booking: b,
          activity,
          timing,
          minutesBeforeStart,
          minutesAfterEnd,
          issues,
        });
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

  // POST /api/pos/bookings/:id/check-in（手動報到 / 強制核銷）
  // 🆕 2026-05-19：支援 force=true、忽略狀態與時段限制（業主可現場調整）
  app.post(
    "/api/pos/bookings/:id/check-in",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveFieldScope(req);
        if (!scope || !req.admin) return res.status(400).json({ error: "no_field" });
        const bookingId = Number(req.params.id);
        if (!Number.isFinite(bookingId)) return res.status(400).json({ error: "invalid_id" });

        const force = req.body?.force === true;
        const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : undefined;

        // 先 select 確認 booking 存在 + 同場域
        const [existing] = await db
          .select()
          .from(bookings)
          .where(and(eq(bookings.id, bookingId), inArray(bookings.fieldId, scope.identifiers)))
          .limit(1);
        if (!existing) return res.status(404).json({ error: "not_found" });

        // 非 force 模式拒絕：已取消 / 已 no-show
        if (!force && (existing.status === "cancelled" || existing.status === "no_show")) {
          return res.status(400).json({
            error: "status_blocked",
            booking: existing,
            message: `此預約狀態為「${existing.status}」、需勾選強制核銷才能報到`,
          });
        }

        const [updated] = await db
          .update(bookings)
          .set({
            checkedInAt: new Date(),
            checkedInByStaffId: req.admin.id,
            // 強制核銷時若先前是 cancelled / no_show、自動 reactivate 回 confirmed
            ...(force && (existing.status === "cancelled" || existing.status === "no_show")
              ? { status: "confirmed" as const }
              : {}),
            ...(note ? { adminNote: [existing.adminNote, `[強制核銷] ${note}`].filter(Boolean).join("\n") } : {}),
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, bookingId))
          .returning();

        // 🆕 2026-05-19 Phase B：報到 / 強制核銷必留 audit
        logAuditAction({
          actorAdminId: req.admin.id,
          action: force ? "pos:force_checkin" : "pos:checkin",
          targetType: "booking",
          targetId: String(bookingId),
          fieldId: scope.id,
          metadata: {
            bookingCode: existing.bookingCode,
            previousStatus: existing.status,
            note: note ?? null,
            reactivated: force && (existing.status === "cancelled" || existing.status === "no_show"),
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ booking: updated, forced: force });
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
        const scope = await resolveFieldScope(req);
        if (!scope || !req.admin) return res.status(400).json({ error: "no_field" });
        const bookingId = Number(req.params.id);
        if (!Number.isFinite(bookingId)) return res.status(400).json({ error: "invalid_id" });
        const [updated] = await db
          .update(bookings)
          .set({ status: "no_show", updatedAt: new Date() })
          .where(and(eq(bookings.id, bookingId), inArray(bookings.fieldId, scope.identifiers)))
          .returning();
        if (!updated) return res.status(404).json({ error: "not_found" });

        logAuditAction({
          actorAdminId: req.admin.id,
          action: "booking:no_show",
          targetType: "booking",
          targetId: String(bookingId),
          fieldId: scope.id,
          metadata: { bookingCode: updated.bookingCode },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ booking: updated });
      } catch (err) {
        console.error("[pos/no-show]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // POST /api/pos/bookings/:id/reschedule（業主改梯次、客人提前 / 遲到時用）
  // 🆕 2026-05-19：不檢查 capacity（業主已現場判斷有位置）、只改 slotStart / slotEnd
  const rescheduleSchema = z.object({
    slotStart: z.string().datetime(),
    durationMinutes: z.number().int().min(15).max(240).default(30),
    reason: z.string().max(500).optional(),
  });
  app.post(
    "/api/pos/bookings/:id/reschedule",
    requireAdminAuth,
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveFieldScope(req);
        if (!scope || !req.admin) return res.status(400).json({ error: "no_field" });
        const bookingId = Number(req.params.id);
        if (!Number.isFinite(bookingId)) return res.status(400).json({ error: "invalid_id" });

        const parsed = rescheduleSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "validation", details: parsed.error.issues });
        }

        const slotStart = new Date(parsed.data.slotStart);
        const slotEnd = new Date(slotStart.getTime() + parsed.data.durationMinutes * 60_000);

        const [existing] = await db
          .select()
          .from(bookings)
          .where(and(eq(bookings.id, bookingId), inArray(bookings.fieldId, scope.identifiers)))
          .limit(1);
        if (!existing) return res.status(404).json({ error: "not_found" });

        const reasonNote = parsed.data.reason
          ? `[改梯次 ${new Date().toISOString().slice(0, 16)}] 原 ${existing.slotStart.toISOString()} → ${slotStart.toISOString()}：${parsed.data.reason}`
          : `[改梯次 ${new Date().toISOString().slice(0, 16)}] 原 ${existing.slotStart.toISOString()} → ${slotStart.toISOString()}`;

        const [updated] = await db
          .update(bookings)
          .set({
            slotStart,
            slotEnd,
            adminNote: [existing.adminNote, reasonNote].filter(Boolean).join("\n"),
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, bookingId))
          .returning();

        logAuditAction({
          actorAdminId: req.admin.id,
          action: "booking:reschedule",
          targetType: "booking",
          targetId: String(bookingId),
          fieldId: scope.id,
          metadata: {
            bookingCode: existing.bookingCode,
            from: existing.slotStart,
            to: slotStart,
            reason: parsed.data.reason ?? null,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        res.json({ booking: updated });
      } catch (err) {
        console.error("[pos/reschedule]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // 🆕 2026-06-13 POS 未來預約（今日之後、confirmed/pending）
  app.get("/api/pos/bookings/upcoming", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const { end } = getTodayRange();
      const list = await db
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
            inArray(bookings.fieldId, scope.identifiers),
            gt(bookings.slotStart, end),
            sql`${bookings.status} IN ('confirmed', 'pending')`,
          ),
        )
        .orderBy(bookings.slotStart)
        .limit(200);
      res.json({ bookings: list });
    } catch (e) {
      console.error("[pos] upcoming 失敗:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // 🆕 2026-06-13 POS 人工預約（電話/現場）→ 產生綁定短連結
  const posManualBookingSchema = z.object({
    displayName: z.string().min(1).max(100),
    phone: z.string().max(30).optional(),
    slotStart: z.string().datetime(),
    partySize: z.number().int().min(1).max(500),
    activityId: z.string().optional(),
    customerNote: z.string().max(500).optional(),
  });
  app.post("/api/pos/bookings/manual", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope || !req.admin) return res.status(400).json({ error: "no_field" });
      const parsed = posManualBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "validation", message: parsed.error.issues[0]?.message });
      }
      const { createManualBooking } = await import("../booking/booking-service");
      const result = await createManualBooking({
        fieldId: scope.id,
        displayName: parsed.data.displayName,
        phone: parsed.data.phone,
        slotStart: new Date(parsed.data.slotStart),
        partySize: parsed.data.partySize,
        activityId: parsed.data.activityId,
        customerNote: parsed.data.customerNote,
        staffId: req.admin.id,
      });
      logAuditAction({
        actorAdminId: req.admin.id,
        action: "pos:manual_booking",
        targetType: "booking",
        targetId: result.booking.bookingCode,
        fieldId: scope.id,
        metadata: { displayName: parsed.data.displayName, partySize: parsed.data.partySize },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({ booking: result.booking });
    } catch (e) {
      console.error("[pos] manual booking 失敗:", e);
      res.status(500).json({ error: "internal_error", message: e instanceof Error ? e.message : "伺服器錯誤" });
    }
  });

  // 🆕 2026-06-13 帳務交易軟刪除（需原因、進垃圾桶可還原）
  app.post("/api/pos/transactions/:id/delete", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope || !req.admin) return res.status(400).json({ error: "no_field" });
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (reason.length < 2) return res.status(400).json({ error: "reason_required", message: "請填刪除原因" });
      const [updated] = await db
        .update(posTransactions)
        .set({ deletedAt: new Date(), deletedBy: req.admin.id, deleteReason: reason })
        .where(
          and(
            eq(posTransactions.id, req.params.id),
            inArray(posTransactions.fieldId, scope.identifiers),
            sql`${posTransactions.deletedAt} IS NULL`,
          ),
        )
        .returning();
      if (!updated) return res.status(404).json({ error: "not_found" });
      logAuditAction({
        actorAdminId: req.admin.id,
        action: "pos:transaction_delete",
        targetType: "pos_transaction",
        targetId: req.params.id,
        fieldId: scope.id,
        metadata: { reason, amountCents: updated.paidAmountCents },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({ ok: true });
    } catch (e) {
      console.error("[pos] transaction delete 失敗:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

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
    // 🆕 2026-06-13：品項明細（選品項+客製）。有帶 items → 金額伺服器端重算（防竄改）
    items: z
      .array(
        z.object({
          productId: z.string(),
          qty: z.number().int().min(1).max(99).default(1),
          modifierOptionIds: z.array(z.string()).default([]),
        }),
      )
      .optional(),
  });
  app.post("/api/pos/checkout", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope || !req.admin) return res.status(400).json({ error: "no_field" });
      const fieldId = scope.id;
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

      // 🆕 2026-06-13：有帶 items → 伺服器端用 DB 價格重算（防前端竄改金額）
      let computedLineItems: Array<{
        productId: string;
        nameSnapshot: string;
        category: string | null;
        qty: number;
        unitPriceCents: number;
        modifiers: Array<{ optionName: string; priceDeltaCents: number }>;
        lineTotalCents: number;
      }> = [];
      let itemsTotalCents = 0;
      if (parsed.data.items && parsed.data.items.length > 0) {
        const productIds = Array.from(new Set(parsed.data.items.map((i) => i.productId)));
        const prods = await db.select().from(posProducts).where(inArray(posProducts.id, productIds));
        const allOptIds = Array.from(new Set(parsed.data.items.flatMap((i) => i.modifierOptionIds)));
        const opts = allOptIds.length
          ? await db.select().from(posModifierOptions).where(inArray(posModifierOptions.id, allOptIds))
          : [];
        for (const item of parsed.data.items) {
          const prod = prods.find((p) => p.id === item.productId && p.fieldId === fieldId);
          if (!prod) return res.status(400).json({ error: "invalid_product", message: `品項不存在: ${item.productId}` });
          const chosen = item.modifierOptionIds
            .map((oid) => opts.find((o) => o.id === oid))
            .filter((o): o is NonNullable<typeof o> => Boolean(o));
          const modTotal = chosen.reduce((s, o) => s + o.priceDeltaCents, 0);
          const unit = prod.priceCents + modTotal;
          const lineTotal = unit * item.qty;
          itemsTotalCents += lineTotal;
          computedLineItems.push({
            productId: prod.id,
            nameSnapshot: prod.name,
            category: prod.category,
            qty: item.qty,
            unitPriceCents: unit,
            modifiers: chosen.map((o) => ({ optionName: o.name, priceDeltaCents: o.priceDeltaCents })),
            lineTotalCents: lineTotal,
          });
        }
      }
      // 有 items 時以重算金額為準（扣掉 voucher 折抵）
      const finalAmountCents = computedLineItems.length > 0 ? itemsTotalCents : parsed.data.amountCents;
      const finalPaidCents =
        computedLineItems.length > 0
          ? Math.max(0, itemsTotalCents - (parsed.data.voucherDiscountCents ?? 0))
          : parsed.data.paidAmountCents;

      const [tx] = await db
        .insert(posTransactions)
        .values({
          fieldId,
          staffId: req.admin.id,
          bookingId: parsed.data.bookingId ?? null,
          activityId: parsed.data.activityId ?? null,
          amountCents: finalAmountCents,
          paidAmountCents: finalPaidCents,
          paymentMethod: parsed.data.paymentMethod,
          voucherId: parsed.data.voucherId ?? null,
          voucherDiscountCents: parsed.data.voucherDiscountCents,
          customerName: parsed.data.customerName ?? null,
          customerPhone: parsed.data.customerPhone ?? null,
          note: parsed.data.note ?? null,
        })
        .returning();

      // 🆕 2026-06-13：寫入品項明細 line items
      if (tx && computedLineItems.length > 0) {
        await db.insert(posTransactionItems).values(
          computedLineItems.map((li) => ({
            transactionId: tx.id,
            productId: li.productId,
            nameSnapshot: li.nameSnapshot,
            category: li.category,
            qty: li.qty,
            unitPriceCents: li.unitPriceCents,
            modifiers: li.modifiers,
            lineTotalCents: li.lineTotalCents,
          })),
        );
      }

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

      logAuditAction({
        actorAdminId: req.admin.id,
        action: "pos:checkout",
        targetType: "pos_transaction",
        targetId: String(tx.id),
        fieldId: scope.id,
        metadata: {
          bookingId: parsed.data.bookingId ?? null,
          activityId: parsed.data.activityId ?? null,
          amountCents: parsed.data.amountCents,
          paidAmountCents: parsed.data.paidAmountCents,
          paymentMethod: parsed.data.paymentMethod,
          voucherDiscountCents: parsed.data.voucherDiscountCents,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

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
      const scope = await resolveFieldScope(req);
      if (!scope || !req.admin) return res.status(400).json({ error: "no_field" });
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

      logAuditAction({
        actorAdminId: req.admin.id,
        action: "voucher:redeem",
        targetType: "coupon",
        targetId: c.coupon.id,
        fieldId: scope.id,
        metadata: {
          code: c.coupon.code,
          templateId: c.coupon.templateId,
          bookingId: parsed.data.bookingId ?? null,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ ok: true, coupon: updated, template: c.template });
    } catch (err) {
      console.error("[pos/voucher/redeem]", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // GET /api/pos/summary
  app.get("/api/pos/summary", requireAdminAuth, async (req, res) => {
    try {
      const scope = await resolveFieldScope(req);
      if (!scope) return res.status(400).json({ error: "no_field" });
      const fieldId = scope.id;
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
            inArray(posTransactions.fieldId, scope.identifiers),
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
