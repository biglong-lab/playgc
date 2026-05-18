// 🎯 Admin 活動管理 endpoints（2026-05-18）
//
// 端點：
//   GET    /api/admin/activities                場域活動列表
//   GET    /api/admin/activities/:id            單一活動
//   POST   /api/admin/activities                新增
//   PATCH  /api/admin/activities/:id            編輯
//   DELETE /api/admin/activities/:id            停用（soft delete: isActive=false）
//   PATCH  /api/admin/activities/:id/schedule   時段規則編輯
//
// 安全：requireAdminAuth + 場域隔離（只能改自己 fieldId 的活動）

import type { Express } from "express";
import { db } from "../db";
import { activities, activitySchedules } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { z } from "zod";

const createSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/i, "slug 只能含英數和 -"),
  name: z.string().min(1).max(100),
  shortDesc: z.string().max(200).optional().nullable(),
  description: z.string().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  locationNote: z.string().optional().nullable(),
  priceCents: z.number().int().min(0).default(0),
  currency: z.string().length(3).default("TWD"),
  durationMinutes: z.number().int().min(5).max(1440).default(60),
  capacityPerSlot: z.number().int().min(1).max(500).default(1),
  paymentMode: z.enum(["online", "onsite", "both"]).default("onsite"),
  sortOrder: z.number().int().default(0),
});

const patchSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const scheduleSchema = z.object({
  scheduleTemplate: z.record(z.unknown()),
  cancellable: z.boolean().optional(),
  cancelBeforeMinutes: z.number().int().min(0).optional(),
  reminderMinutesBefore: z.number().int().min(0).optional(),
});

export function registerAdminActivitiesRoutes(app: Express) {
  // GET 場域活動列表
  app.get(
    "/api/admin/activities",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin?.fieldId) {
          return res.status(400).json({ error: "no_field" });
        }
        const list = await db
          .select()
          .from(activities)
          .where(eq(activities.fieldId, req.admin.fieldId))
          .orderBy(asc(activities.sortOrder), asc(activities.createdAt));

        // 🆕 2026-05-18 加 booking count（給 admin 卡片顯示）
        const { bookings } = await import("@shared/schema");
        const { sql: drizzleSql, ne } = await import("drizzle-orm");
        const counts = await db
          .select({
            activityId: bookings.activityId,
            count: drizzleSql<number>`COUNT(*)::int`,
          })
          .from(bookings)
          .where(
            and(
              eq(bookings.fieldId, req.admin.fieldId),
              ne(bookings.status, "cancelled"),
            ),
          )
          .groupBy(bookings.activityId);
        const countMap = new Map<string, number>();
        for (const c of counts) {
          if (c.activityId) countMap.set(c.activityId, c.count);
        }
        const withCounts = list.map((a) => ({ ...a, bookingCount: countMap.get(a.id) ?? 0 }));
        res.json({ activities: withCounts });
      } catch (err) {
        console.error("[admin-activities GET]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // GET 單一
  app.get(
    "/api/admin/activities/:id",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin?.fieldId) return res.status(400).json({ error: "no_field" });
        const [row] = await db
          .select()
          .from(activities)
          .where(and(eq(activities.id, req.params.id), eq(activities.fieldId, req.admin.fieldId)))
          .limit(1);
        if (!row) return res.status(404).json({ error: "not_found" });
        const [schedule] = await db
          .select()
          .from(activitySchedules)
          .where(eq(activitySchedules.activityId, row.id))
          .limit(1);
        res.json({ activity: row, schedule: schedule ?? null });
      } catch (err) {
        console.error("[admin-activities GET :id]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // POST 新增
  app.post(
    "/api/admin/activities",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin?.fieldId) return res.status(400).json({ error: "no_field" });
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "validation", details: parsed.error.issues });
        }
        // slug 唯一性 check（per field）
        const [existing] = await db
          .select({ id: activities.id })
          .from(activities)
          .where(and(eq(activities.fieldId, req.admin.fieldId), eq(activities.slug, parsed.data.slug)))
          .limit(1);
        if (existing) {
          return res.status(409).json({ error: "slug_taken", message: "此 slug 已被使用" });
        }
        const [created] = await db
          .insert(activities)
          .values({
            ...parsed.data,
            fieldId: req.admin.fieldId,
          })
          .returning();
        logAuditAction({
          actorAdminId: req.admin.id,
          action: "activity:create",
          targetType: "activity",
          targetId: created.id,
          fieldId: req.admin.fieldId,
          metadata: { slug: parsed.data.slug, name: parsed.data.name, priceCents: parsed.data.priceCents },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
        res.status(201).json({ activity: created });
      } catch (err) {
        console.error("[admin-activities POST]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // PATCH 編輯
  app.patch(
    "/api/admin/activities/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin?.fieldId) return res.status(400).json({ error: "no_field" });
        const parsed = patchSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "validation", details: parsed.error.issues });
        }
        const [updated] = await db
          .update(activities)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(
            and(eq(activities.id, req.params.id), eq(activities.fieldId, req.admin.fieldId)),
          )
          .returning();
        if (!updated) return res.status(404).json({ error: "not_found" });
        logAuditAction({
          actorAdminId: req.admin.id,
          action: "activity:update",
          targetType: "activity",
          targetId: updated.id,
          fieldId: req.admin.fieldId,
          metadata: { keys: Object.keys(parsed.data) },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
        res.json({ activity: updated });
      } catch (err) {
        console.error("[admin-activities PATCH]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // DELETE — 業主回報想要真刪除（不只是停用）
  // 2026-05-18：先檢查有沒有預約綁定、有 → 拒絕並建議用停用、沒 → 真刪
  app.delete(
    "/api/admin/activities/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin?.fieldId) return res.status(400).json({ error: "no_field" });

        // 確認活動屬於此 admin 的場域
        const [target] = await db
          .select({ id: activities.id })
          .from(activities)
          .where(
            and(eq(activities.id, req.params.id), eq(activities.fieldId, req.admin.fieldId)),
          )
          .limit(1);
        if (!target) return res.status(404).json({ error: "not_found" });

        // 檢查是否有 booking 綁定（保護 referential integrity）
        const { bookings } = await import("@shared/schema");
        const { count, sql: drizzleSql } = await import("drizzle-orm");
        const [stats] = await db
          .select({ total: drizzleSql<number>`COUNT(*)::int` })
          .from(bookings)
          .where(eq(bookings.activityId, req.params.id));

        if ((stats?.total ?? 0) > 0) {
          // 有預約綁定 → 不可真刪、改成停用（軟刪除）
          await db
            .update(activities)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(activities.id, req.params.id));
          return res.json({
            ok: true,
            mode: "deactivated",
            message: `此活動有 ${stats?.total} 筆預約紀錄、已停用（保留歷史資料）`,
          });
        }

        // 沒任何預約 → 真刪
        // 連帶刪 activity_schedules（沒 FK cascade）
        const { activitySchedules } = await import("@shared/schema");
        await db.delete(activitySchedules).where(eq(activitySchedules.activityId, req.params.id));
        await db.delete(activities).where(eq(activities.id, req.params.id));

        res.json({ ok: true, mode: "deleted", message: "活動已永久刪除" });
      } catch (err) {
        console.error("[admin-activities DELETE]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // 🆕 2026-05-18：封面上傳（業主可直接傳檔、不用自己拿 URL）
  const coverSchema = z.object({
    imageData: z.string()
      .min(1, "缺少圖片資料")
      .refine(
        (d) => d.startsWith("data:image/"),
        "無效的圖片格式",
      )
      .refine((d) => d.length < 10 * 1024 * 1024, "圖片大小不能超過 10MB"),
  });
  app.post(
    "/api/admin/activities/:id/cover",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin?.fieldId) return res.status(400).json({ error: "no_field" });
        const parsed = coverSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "validation", message: parsed.error.issues[0]?.message });
        }
        // 確認活動屬此場域
        const [target] = await db
          .select({ id: activities.id })
          .from(activities)
          .where(
            and(eq(activities.id, req.params.id), eq(activities.fieldId, req.admin.fieldId)),
          )
          .limit(1);
        if (!target) return res.status(404).json({ error: "not_found" });

        // 上傳 cloudinary
        const { cloudinaryService } = await import("../cloudinary");
        const result = await cloudinaryService.uploadActivityCover(parsed.data.imageData, req.params.id);

        // 更新 activity.coverUrl
        const [updated] = await db
          .update(activities)
          .set({ coverUrl: result.secure_url, updatedAt: new Date() })
          .where(eq(activities.id, req.params.id))
          .returning();

        res.json({ coverUrl: result.secure_url, activity: updated });
      } catch (err) {
        console.error("[admin-activities cover]", err);
        res.status(500).json({ error: "upload_failed", message: err instanceof Error ? err.message : "未知錯誤" });
      }
    },
  );

  // PATCH schedule
  app.patch(
    "/api/admin/activities/:id/schedule",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin?.fieldId) return res.status(400).json({ error: "no_field" });
        const parsed = scheduleSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "validation", details: parsed.error.issues });
        }
        // 確認 activity 屬於此 field
        const [activity] = await db
          .select({ id: activities.id })
          .from(activities)
          .where(
            and(eq(activities.id, req.params.id), eq(activities.fieldId, req.admin.fieldId)),
          )
          .limit(1);
        if (!activity) return res.status(404).json({ error: "not_found" });

        // upsert schedule
        const [existing] = await db
          .select()
          .from(activitySchedules)
          .where(eq(activitySchedules.activityId, req.params.id))
          .limit(1);

        if (existing) {
          await db
            .update(activitySchedules)
            .set({ ...parsed.data, updatedAt: new Date() })
            .where(eq(activitySchedules.activityId, req.params.id));
        } else {
          await db.insert(activitySchedules).values({
            activityId: req.params.id,
            ...parsed.data,
          });
        }
        res.json({ ok: true });
      } catch (err) {
        console.error("[admin-activities PATCH schedule]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );
}
