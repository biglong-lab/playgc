// 預約 API（玩家端）
//
// Endpoints:
//   GET  /api/bookings/availability/:fieldId?from=&to=  — 看可預約時段
//   GET  /api/bookings/config/:fieldId                 — 看預約規則（給預約頁顯示）
//   POST /api/bookings                                  — 建立預約
//   GET  /api/bookings/:bookingCode                     — 用 code 查單筆
//   GET  /api/bookings/mine                             — 玩家查自己的預約
//   POST /api/bookings/:bookingCode/cancel              — 玩家自助取消
//
// LINE 身份驗證策略（第一期）：
//   - 信任 LIFF 前端傳的 lineUserId（client/src/lib/liff.ts initLiff 後拿）
//   - 後續 hardening：改要求 LIFF idToken、後端 verify
//   - 風險：預約系統不收費（第一期）→ 假預約只能浪費 slot、業主能取消、可控

import type { Express, Request } from "express";
import { z } from "zod";
import {
  getBookingConfig,
  getAvailability,
  createBooking,
  cancelBooking,
  getMyBookings,
  getBookingByCode,
  BookingError,
} from "../booking/booking-service";
import { resolveLineConfig } from "../lib/line-config-resolver";

const lineUserIdSchema = z.string().min(8).max(64);

const createBookingBodySchema = z.object({
  fieldId: z.string().min(1).max(50),
  lineUserId: lineUserIdSchema,
  displayName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  slotStart: z.string().datetime(),
  partySize: z.number().int().min(1).max(20),
  customerNote: z.string().max(500).optional(),
});

const cancelBodySchema = z.object({
  lineUserId: lineUserIdSchema,
  reason: z.string().max(500).optional(),
});

function handleBookingError(res: import("express").Response, err: unknown) {
  if (err instanceof BookingError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  console.error("[bookings]", err);
  return res.status(500).json({ error: "internal_error", message: "伺服器錯誤" });
}

function parseDateParam(raw: unknown, fallback: Date): Date {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return fallback;
  return d;
}

function getLineUserIdFromQuery(req: Request): string | null {
  const v = req.query.lineUserId;
  if (typeof v !== "string" || v.length === 0) return null;
  return v;
}

export function registerBookingRoutes(app: Express) {
  // ──────────────────────────────────────────
  // GET /api/bookings/availability/:fieldId
  // ──────────────────────────────────────────
  app.get("/api/bookings/availability/:fieldId", async (req, res) => {
    try {
      const fieldId = req.params.fieldId;
      const today = new Date();
      const defaultFrom = new Date(today);
      defaultFrom.setHours(0, 0, 0, 0);
      const defaultTo = new Date(today);
      defaultTo.setDate(defaultTo.getDate() + 14); // 預設往後 14 天
      defaultTo.setHours(23, 59, 59, 999);

      const fromDate = parseDateParam(req.query.from, defaultFrom);
      const toDate = parseDateParam(req.query.to, defaultTo);

      // 限制最多 30 天
      const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 86400);
      if (diffDays > 30) {
        return res.status(400).json({
          error: "range_too_wide",
          message: "查詢區間最多 30 天",
        });
      }

      const slots = await getAvailability(fieldId, fromDate, toDate);
      res.json({ fieldId, from: fromDate.toISOString(), to: toDate.toISOString(), slots });
    } catch (err) {
      return handleBookingError(res, err);
    }
  });

  // ──────────────────────────────────────────
  // 🆕 2026-05-17 per-field LIFF + 場域資訊（公開、不需 auth、case-insensitive）
  app.get("/api/bookings/liff/:fieldCode", async (req, res) => {
    try {
      const fieldCode = req.params.fieldCode;
      const config = await resolveLineConfig(fieldCode);

      // 同時回場域 logoUrl / name（給 BookDonePage 卡片式畫面用）
      const { db } = await import("../db");
      const { fields: fieldsTable } = await import("@shared/schema");
      const { sql: rawSql } = await import("drizzle-orm");
      const rows = await db
        .select({
          name: fieldsTable.name,
          code: fieldsTable.code,
          logoUrl: fieldsTable.logoUrl,
        })
        .from(fieldsTable)
        .where(rawSql`lower(${fieldsTable.code}) = lower(${fieldCode})`)
        .limit(1);
      const field = rows[0] ?? null;

      res.json({
        liffId: config.liffId,
        source: config.source,
        fieldName: field?.name ?? null,
        fieldCode: field?.code ?? fieldCode,
        logoUrl: field?.logoUrl ?? null,
      });
    } catch (err) {
      console.error("[bookings/liff]", err);
      res.status(500).json({ error: "查詢失敗" });
    }
  });

  // GET /api/bookings/config/:fieldId
  //   給預約頁顯示：是否需付費、取消政策、提醒分鐘等
  // ──────────────────────────────────────────
  app.get("/api/bookings/config/:fieldId", async (req, res) => {
    try {
      const config = await getBookingConfig(req.params.fieldId);
      if (!config) {
        return res.status(404).json({ error: "not_found", message: "場域尚未開通預約" });
      }
      // 不回 admin_notes（私人）
      const { adminNotes: _omit, ...publicConfig } = config;
      res.json(publicConfig);
    } catch (err) {
      return handleBookingError(res, err);
    }
  });

  // ──────────────────────────────────────────
  // POST /api/bookings
  // ──────────────────────────────────────────
  app.post("/api/bookings", async (req, res) => {
    try {
      const parsed = createBookingBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "validation", message: parsed.error.errors[0]?.message });
      }
      const slotStart = new Date(parsed.data.slotStart);
      if (isNaN(slotStart.getTime())) {
        return res.status(400).json({ error: "invalid_date", message: "slotStart 格式錯誤" });
      }

      const result = await createBooking({
        ...parsed.data,
        slotStart,
      });
      res.status(201).json({ booking: result.booking });
    } catch (err) {
      return handleBookingError(res, err);
    }
  });

  // ──────────────────────────────────────────
  // GET /api/bookings/mine?lineUserId=xxx&includeCompleted=true
  // ──────────────────────────────────────────
  app.get("/api/bookings/mine", async (req, res) => {
    try {
      const lineUserId = getLineUserIdFromQuery(req);
      if (!lineUserId) {
        return res.status(400).json({ error: "missing_line_user_id" });
      }
      const includeCompleted = req.query.includeCompleted === "true";
      const list = await getMyBookings(lineUserId, { includeCompleted });
      res.json({ bookings: list });
    } catch (err) {
      return handleBookingError(res, err);
    }
  });

  // ──────────────────────────────────────────
  // GET /api/bookings/:bookingCode
  // ──────────────────────────────────────────
  app.get("/api/bookings/:bookingCode", async (req, res) => {
    try {
      const booking = await getBookingByCode(req.params.bookingCode);
      if (!booking) return res.status(404).json({ error: "not_found" });
      // 限制：要傳 lineUserId 證明擁有
      const lineUserId = getLineUserIdFromQuery(req);
      if (!lineUserId || booking.lineUserId !== lineUserId) {
        return res.status(403).json({ error: "forbidden" });
      }
      res.json({ booking });
    } catch (err) {
      return handleBookingError(res, err);
    }
  });

  // ──────────────────────────────────────────
  // POST /api/bookings/:bookingCode/cancel
  // ──────────────────────────────────────────
  app.post("/api/bookings/:bookingCode/cancel", async (req, res) => {
    try {
      const parsed = cancelBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "validation", message: parsed.error.errors[0]?.message });
      }
      const result = await cancelBooking({
        bookingCode: req.params.bookingCode,
        cancelBy: { type: "self", lineUserId: parsed.data.lineUserId },
        reason: parsed.data.reason,
      });
      res.json({ booking: result });
    } catch (err) {
      return handleBookingError(res, err);
    }
  });
}
