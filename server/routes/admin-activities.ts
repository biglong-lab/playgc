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
import { requireAdminAuth, requirePermission } from "../adminAuth";
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
        res.json({ activities: list });
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
        res.json({ activity: updated });
      } catch (err) {
        console.error("[admin-activities PATCH]", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // DELETE 軟刪除
  app.delete(
    "/api/admin/activities/:id",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin?.fieldId) return res.status(400).json({ error: "no_field" });
        const [updated] = await db
          .update(activities)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(eq(activities.id, req.params.id), eq(activities.fieldId, req.admin.fieldId)),
          )
          .returning();
        if (!updated) return res.status(404).json({ error: "not_found" });
        res.json({ ok: true });
      } catch (err) {
        console.error("[admin-activities DELETE]", err);
        res.status(500).json({ error: "internal_error" });
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
