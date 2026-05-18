// 預約 API（admin 端）
//
// Endpoints:
//   GET    /api/admin/bookings/:fieldId/config         — 取場域預約設定
//   PUT    /api/admin/bookings/:fieldId/config         — 更新場域預約設定（schedule_template、付費、取消政策）
//   POST   /api/admin/bookings/:fieldId/init           — 初始化場域預約（首次啟用、可帶 JIACUN_DEFAULT 等預設）
//   GET    /api/admin/bookings/:fieldId/list           — 列預約（含 filter）
//   POST   /api/admin/bookings/:bookingCode/cancel     — admin 強制取消
//   GET    /api/admin/bookings/:fieldId/blackouts      — 列黑名單時段
//   POST   /api/admin/bookings/:fieldId/blackouts      — 新增黑名單時段
//   DELETE /api/admin/bookings/:fieldId/blackouts/:id  — 刪黑名單時段
//
// 通知模板：
//   GET    /api/admin/bookings/:fieldId/templates      — 列模板
//   PUT    /api/admin/bookings/:fieldId/templates/:key — 編輯模板

import type { Express } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  bookings,
  bookingConfigs,
  bookingBlackouts,
  bookingNotificationTemplates,
  JIACUN_DEFAULT_SCHEDULE,
  bookingNotificationTemplateKeyEnum,
  type BookingScheduleTemplate,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import {
  cancelBooking,
  listBookings,
  markBookingCompleted,
  markBookingNoShow,
  BookingError,
} from "../booking/booking-service";
import {
  getTelegramStatus,
  sendMessage as tgSendMessage,
  getBotInfo,
} from "../lib/telegram-bot";
import {
  setupBookingRichMenu,
  generateRichMenuImage,
  listRichMenus,
  deleteRichMenu,
} from "../lib/line-rich-menu";

// ── Validators ──────────────────────────────────────────

const slotWindowSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  intervalMinutes: z.number().int().min(5).max(480),
  capacity: z.number().int().min(1).max(500),
  gameDurationMinutes: z.number().int().min(5).max(480),
});

const applyRangeSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  dateRanges: z
    .array(z.object({ from: z.string(), to: z.string() }))
    .optional(),
  specificDates: z.array(z.string()).optional(),
  treatHolidaysAsWeekend: z.boolean().optional(),
});

const ruleSchema = z.object({
  id: z.string(),
  name: z.string().max(80),
  priority: z.number().int().min(0).max(1000),
  enabled: z.boolean(),
  applyTo: applyRangeSchema,
  slots: z.array(slotWindowSchema),
  pricePerSlotCentsOverride: z.number().int().min(0).optional(),
  capacityOverride: z.number().int().min(1).optional(),
  adminNotes: z.string().max(500).optional(),
});

const scheduleTemplateSchema = z.object({
  rules: z.array(ruleSchema),
  blackoutDates: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional(),
  version: z.number().int().optional(),
});

const updateConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  pricePerSlotCents: z.number().int().min(0).optional(),
  currency: z.string().max(8).optional(),
  cancellable: z.boolean().optional(),
  cancelBeforeMinutes: z.number().int().min(0).optional(),
  reminderMinutesBefore: z.number().int().min(0).optional(),
  scheduleTemplate: scheduleTemplateSchema.optional(),
  adminNotes: z.string().max(2000).optional(),
});

const blackoutSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(500).optional(),
});

const templateUpdateSchema = z.object({
  messageText: z.string().max(2000),
  flexMessageJson: z.record(z.unknown()).optional(),
  actionUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

function handleErr(res: import("express").Response, err: unknown) {
  if (err instanceof BookingError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  console.error("[admin-bookings]", err);
  return res.status(500).json({ error: "internal_error" });
}

// ── Routes ──────────────────────────────────────────────

export function registerAdminBookingRoutes(app: Express) {
  // ─ Telegram bot 狀態 + 測試訊息 ───────────────────────
  app.get(
    "/api/admin/telegram/status",
    requireAdminAuth,
    async (_req, res) => {
      try {
        const status = getTelegramStatus();
        const info = await getBotInfo();
        res.json({ ...status, botInfo: info });
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  app.post(
    "/api/admin/telegram/test",
    requireAdminAuth,
    async (req, res) => {
      try {
        const text = String(req.body?.text || "🧪 測試訊息");
        const result = await tgSendMessage({ text });
        res.json({ result });
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // ─ LINE Rich Menu 一鍵設定 ───────────────────────────
  app.get(
    "/api/admin/line/rich-menu/preview",
    requireAdminAuth,
    async (_req, res) => {
      try {
        const buf = await generateRichMenuImage();
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "no-store");
        res.send(buf);
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  app.post(
    "/api/admin/line/rich-menu/setup",
    requireAdminAuth,
    async (_req, res) => {
      try {
        const result = await setupBookingRichMenu();
        res.json({ ok: true, ...result });
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  app.get(
    "/api/admin/line/rich-menu/list",
    requireAdminAuth,
    async (_req, res) => {
      try {
        const list = await listRichMenus();
        res.json({ richMenus: list });
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  app.delete(
    "/api/admin/line/rich-menu/:richMenuId",
    requireAdminAuth,
    async (req, res) => {
      try {
        await deleteRichMenu(req.params.richMenuId);
        res.status(204).end();
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // GET config
  app.get(
    "/api/admin/bookings/:fieldId/config",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const rows = await db
          .select()
          .from(bookingConfigs)
          .where(eq(bookingConfigs.fieldId, req.params.fieldId))
          .limit(1);
        if (rows.length === 0) {
          return res.status(404).json({ error: "not_initialized" });
        }
        res.json(rows[0]);
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // PUT config
  app.put(
    "/api/admin/bookings/:fieldId/config",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const parsed = updateConfigSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "validation", message: parsed.error.errors[0]?.message });
        }
        const updated = await db
          .update(bookingConfigs)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(bookingConfigs.fieldId, req.params.fieldId))
          .returning();
        if (updated.length === 0) {
          return res.status(404).json({ error: "not_initialized" });
        }
        if (req.admin) {
          logAuditAction({
            actorAdminId: req.admin.id,
            action: "booking_config:update",
            targetType: "booking_config",
            targetId: req.params.fieldId,
            fieldId: req.params.fieldId,
            metadata: { keys: Object.keys(parsed.data) },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        }
        res.json(updated[0]);
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // POST init — 首次啟用、寫入預設 schedule
  app.post(
    "/api/admin/bookings/:fieldId/init",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const fieldId = req.params.fieldId;
        const existing = await db
          .select()
          .from(bookingConfigs)
          .where(eq(bookingConfigs.fieldId, fieldId))
          .limit(1);
        if (existing.length > 0) {
          return res.status(409).json({ error: "already_initialized", config: existing[0] });
        }
        const usePreset = req.body?.preset === "jiacun";
        const defaultTemplate: BookingScheduleTemplate = usePreset
          ? JIACUN_DEFAULT_SCHEDULE
          : { version: 1, rules: [] };
        const inserted = await db
          .insert(bookingConfigs)
          .values({
            fieldId,
            isEnabled: true,
            isPaid: false,
            pricePerSlotCents: 0,
            cancellable: true,
            cancelBeforeMinutes: 0,
            reminderMinutesBefore: 30,
            scheduleTemplate: defaultTemplate,
          })
          .returning();
        res.status(201).json(inserted[0]);
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // GET list
  app.get(
    "/api/admin/bookings/:fieldId/list",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const fieldId = req.params.fieldId;
        const fromStr = req.query.from as string | undefined;
        const toStr = req.query.to as string | undefined;
        const statusStr = req.query.status as string | undefined;

        const opts = {
          fieldId,
          fromDate: fromStr ? new Date(fromStr) : undefined,
          toDate: toStr ? new Date(toStr) : undefined,
          status: statusStr ? statusStr.split(",") : undefined,
          limit: Math.min(parseInt(String(req.query.limit ?? "100"), 10), 500),
          offset: parseInt(String(req.query.offset ?? "0"), 10),
        };
        const list = await listBookings(opts);
        res.json({ bookings: list });
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // POST cancel（admin 強制）
  app.post(
    "/api/admin/bookings/:bookingCode/cancel",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const result = await cancelBooking({
          bookingCode: req.params.bookingCode,
          cancelBy: { type: "admin" },
          reason: req.body?.reason,
        });
        if (req.admin) {
          logAuditAction({
            actorAdminId: req.admin.id,
            action: "booking:cancel_admin",
            targetType: "booking",
            targetId: req.params.bookingCode,
            fieldId: result?.fieldId,
            metadata: { reason: req.body?.reason ?? null },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        }
        res.json({ booking: result });
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // POST mark-completed（活動結束、業主標記完成 + 推送 game_completed 訊息）
  app.post(
    "/api/admin/bookings/:bookingCode/mark-completed",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const result = await markBookingCompleted({
          bookingCode: req.params.bookingCode,
          sendNotification: req.body?.sendNotification !== false,
          customActionUrl: req.body?.customActionUrl,
        });
        if (req.admin) {
          logAuditAction({
            actorAdminId: req.admin.id,
            action: "booking:mark_completed",
            targetType: "booking",
            targetId: req.params.bookingCode,
            fieldId: result?.fieldId,
            metadata: { sentNotification: req.body?.sendNotification !== false },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        }
        res.json({ booking: result });
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // POST mark-no-show（玩家未到場）
  app.post(
    "/api/admin/bookings/:bookingCode/mark-no-show",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const result = await markBookingNoShow(req.params.bookingCode);
        if (req.admin) {
          logAuditAction({
            actorAdminId: req.admin.id,
            action: "booking:mark_no_show_admin",
            targetType: "booking",
            targetId: req.params.bookingCode,
            fieldId: result?.fieldId,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        }
        res.json({ booking: result });
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // GET blackouts
  app.get(
    "/api/admin/bookings/:fieldId/blackouts",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const list = await db
          .select()
          .from(bookingBlackouts)
          .where(eq(bookingBlackouts.fieldId, req.params.fieldId));
        res.json({ blackouts: list });
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // POST blackout
  app.post(
    "/api/admin/bookings/:fieldId/blackouts",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const parsed = blackoutSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "validation", message: parsed.error.errors[0]?.message });
        }
        const inserted = await db
          .insert(bookingBlackouts)
          .values({
            fieldId: req.params.fieldId,
            startAt: new Date(parsed.data.startAt),
            endAt: new Date(parsed.data.endAt),
            reason: parsed.data.reason,
          })
          .returning();
        if (req.admin) {
          logAuditAction({
            actorAdminId: req.admin.id,
            action: "booking_blackout:create",
            targetType: "booking_blackout",
            targetId: String(inserted[0].id),
            fieldId: req.params.fieldId,
            metadata: { startAt: parsed.data.startAt, endAt: parsed.data.endAt, reason: parsed.data.reason },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        }
        res.status(201).json(inserted[0]);
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // DELETE blackout
  app.delete(
    "/api/admin/bookings/:fieldId/blackouts/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: "invalid_id" });
        await db
          .delete(bookingBlackouts)
          .where(
            and(
              eq(bookingBlackouts.fieldId, req.params.fieldId),
              eq(bookingBlackouts.id, id),
            ),
          );
        if (req.admin) {
          logAuditAction({
            actorAdminId: req.admin.id,
            action: "booking_blackout:delete",
            targetType: "booking_blackout",
            targetId: String(id),
            fieldId: req.params.fieldId,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        }
        res.status(204).end();
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // GET templates
  app.get(
    "/api/admin/bookings/:fieldId/templates",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const list = await db
          .select()
          .from(bookingNotificationTemplates)
          .where(eq(bookingNotificationTemplates.fieldId, req.params.fieldId));
        res.json({ templates: list, availableKeys: bookingNotificationTemplateKeyEnum });
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );

  // PUT template
  app.put(
    "/api/admin/bookings/:fieldId/templates/:key",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const key = req.params.key;
        if (!bookingNotificationTemplateKeyEnum.includes(key as never)) {
          return res.status(400).json({ error: "invalid_template_key" });
        }
        const parsed = templateUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: "validation", message: parsed.error.errors[0]?.message });
        }
        // upsert
        const existing = await db
          .select()
          .from(bookingNotificationTemplates)
          .where(
            and(
              eq(bookingNotificationTemplates.fieldId, req.params.fieldId),
              eq(bookingNotificationTemplates.templateKey, key),
            ),
          )
          .limit(1);
        if (existing.length > 0) {
          const updated = await db
            .update(bookingNotificationTemplates)
            .set({ ...parsed.data, updatedAt: new Date() })
            .where(eq(bookingNotificationTemplates.id, existing[0].id))
            .returning();
          return res.json(updated[0]);
        }
        const inserted = await db
          .insert(bookingNotificationTemplates)
          .values({
            fieldId: req.params.fieldId,
            templateKey: key,
            messageText: parsed.data.messageText,
            flexMessageJson: parsed.data.flexMessageJson,
            actionUrl: parsed.data.actionUrl,
            imageUrl: parsed.data.imageUrl,
            isActive: parsed.data.isActive ?? true,
          })
          .returning();
        res.status(201).json(inserted[0]);
      } catch (err) {
        return handleErr(res, err);
      }
    },
  );
}
