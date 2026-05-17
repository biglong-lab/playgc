// 🎯 玩家端活動公開 endpoints（2026-05-18）
//
// GET /api/fields/:fieldCode/activities         場域啟用中的活動列表
// GET /api/fields/:fieldCode/activities/:slug   單一活動詳細

import type { Express } from "express";
import { db } from "../db";
import { activities, fields } from "@shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";

export function registerPublicActivitiesRoutes(app: Express) {
  // 場域內啟用中活動列表
  app.get("/api/fields/:fieldCode/activities", async (req, res) => {
    try {
      const fieldCode = req.params.fieldCode;
      // 找場域（code 或 id、case-insensitive）
      const [field] = await db
        .select({ id: fields.id, name: fields.name, code: fields.code })
        .from(fields)
        .where(sql`lower(${fields.code}) = lower(${fieldCode}) OR ${fields.id} = ${fieldCode}`)
        .limit(1);
      if (!field) return res.status(404).json({ error: "field_not_found" });

      const list = await db
        .select()
        .from(activities)
        .where(and(eq(activities.fieldId, field.id), eq(activities.isActive, true)))
        .orderBy(asc(activities.sortOrder), asc(activities.createdAt));

      res.json({
        field: { id: field.id, code: field.code, name: field.name },
        activities: list,
      });
    } catch (err) {
      console.error("[public-activities GET list]", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // 單一活動
  app.get("/api/fields/:fieldCode/activities/:slug", async (req, res) => {
    try {
      const { fieldCode, slug } = req.params;
      const [field] = await db
        .select({ id: fields.id, name: fields.name, code: fields.code })
        .from(fields)
        .where(sql`lower(${fields.code}) = lower(${fieldCode}) OR ${fields.id} = ${fieldCode}`)
        .limit(1);
      if (!field) return res.status(404).json({ error: "field_not_found" });

      const [activity] = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.fieldId, field.id),
            eq(activities.slug, slug),
            eq(activities.isActive, true),
          ),
        )
        .limit(1);
      if (!activity) return res.status(404).json({ error: "activity_not_found" });

      res.json({
        field: { id: field.id, code: field.code, name: field.name },
        activity,
      });
    } catch (err) {
      console.error("[public-activities GET single]", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
