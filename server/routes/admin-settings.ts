// 系統設定路由 — 讀寫管理員所屬場域的遊戲/場次預設設定
import type { Express } from "express";
import { requireAdminAuth } from "../adminAuth";
import { db } from "../db";
import { fields, parseFieldSettings } from "@shared/schema";
import type { FieldSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// 驗證 schema
const updateSettingsSchema = z.object({
  defaultGameTime: z.number().int().min(1).max(999).optional(),
  defaultMaxPlayers: z.number().int().min(1).max(999).optional(),
  autoEndIdleSession: z.boolean().optional(),
  sessionIdleTimeout: z.number().int().min(1).max(9999).optional(),
});

export function registerAdminSettingsRoutes(app: Express) {
  // GET /api/admin/settings — 取得場域的遊戲/場次預設設定
  app.get("/api/admin/settings", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) return res.status(401).json({ message: "未認證" });

      const field = await db.query.fields.findFirst({
        where: eq(fields.id, req.admin.fieldId),
        columns: { settings: true },
      });

      if (!field) return res.status(404).json({ message: "場域不存在" });

      const settings = parseFieldSettings(field.settings);

      return res.json({
        defaultGameTime: settings.defaultGameTime ?? 30,
        defaultMaxPlayers: settings.defaultMaxPlayers ?? 6,
        autoEndIdleSession: settings.autoEndIdleSession ?? true,
        sessionIdleTimeout: settings.sessionIdleTimeout ?? 120,
      });
    } catch (error) {
      return res.status(500).json({ message: "取得設定失敗" });
    }
  });

  // PATCH /api/admin/settings — 更新場域的遊戲/場次預設設定
  app.patch("/api/admin/settings", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) return res.status(401).json({ message: "未認證" });

      const parsed = updateSettingsSchema.parse(req.body);

      const field = await db.query.fields.findFirst({
        where: eq(fields.id, req.admin.fieldId),
        columns: { settings: true },
      });

      if (!field) return res.status(404).json({ message: "場域不存在" });

      const currentSettings = parseFieldSettings(field.settings);

      const updatedSettings: FieldSettings = {
        ...currentSettings,
        ...parsed,
      };

      await db
        .update(fields)
        .set({ settings: updatedSettings, updatedAt: new Date() })
        .where(eq(fields.id, req.admin.fieldId));

      return res.json({
        defaultGameTime: updatedSettings.defaultGameTime ?? 30,
        defaultMaxPlayers: updatedSettings.defaultMaxPlayers ?? 6,
        autoEndIdleSession: updatedSettings.autoEndIdleSession ?? true,
        sessionIdleTimeout: updatedSettings.sessionIdleTimeout ?? 120,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "資料格式錯誤", errors: error.errors });
      }
      return res.status(500).json({ message: "更新設定失敗" });
    }
  });
}
