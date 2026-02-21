import type { Express } from "express";
import {
  requireAdminAuth,
  requirePermission,
  logAuditAction,
} from "../adminAuth";
import { db } from "../db";
import { fields, parseFieldSettings } from "@shared/schema";
import type { FieldSettings } from "@shared/schema";
import { insertFieldSchema } from "@shared/schema";
import { encryptApiKey, decryptApiKey } from "../lib/crypto";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

export function registerAdminFieldRoutes(app: Express) {
  // ============================================================================
  // Field Management Routes - 場域管理
  // ============================================================================

  app.get("/api/admin/fields", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      if (req.admin.systemRole === "super_admin") {
        const allFields = await db.query.fields.findMany({
          orderBy: [desc(fields.createdAt)],
        });
        return res.json(allFields);
      }

      const field = await db.query.fields.findFirst({
        where: eq(fields.id, req.admin.fieldId),
      });
      res.json(field ? [field] : []);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch fields" });
    }
  });

  app.post("/api/admin/fields", requireAdminAuth, requirePermission("field:manage"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      const data = insertFieldSchema.parse(req.body);
      const [field] = await db.insert(fields).values({
        ...data,
        code: data.code.toUpperCase(),
      }).returning();

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "field:create",
        targetType: "field",
        targetId: field.id,
        fieldId: field.id,
        metadata: { name: field.name },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create field" });
    }
  });

  app.patch("/api/admin/fields/:id", requireAdminAuth, requirePermission("field:manage"), async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ message: "未認證" });
      }

      if (req.admin.systemRole !== "super_admin" && req.params.id !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權修改此場域" });
      }

      const existingField = await db.query.fields.findFirst({
        where: eq(fields.id, req.params.id),
      });

      if (!existingField) {
        return res.status(404).json({ message: "場域不存在" });
      }

      const data = insertFieldSchema.partial().parse(req.body);

      // 檢查是否要變更場域編號
      if (data.code && data.code !== existingField.code) {
        // 非超級管理員需檢查 6 個月鎖定
        if (req.admin.systemRole !== "super_admin") {
          if (existingField.codeLastChangedAt) {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            if (existingField.codeLastChangedAt > sixMonthsAgo) {
              const nextChangeDate = new Date(existingField.codeLastChangedAt);
              nextChangeDate.setMonth(nextChangeDate.getMonth() + 6);
              return res.status(403).json({
                message: `場域編號在六個月內已變更過，下次可變更時間：${nextChangeDate.toLocaleDateString("zh-TW")}`,
                nextChangeDate: nextChangeDate.toISOString(),
              });
            }
          }
        }

        // 檢查新編號是否唯一
        const existingCode = await db.query.fields.findFirst({
          where: eq(fields.code, data.code.toUpperCase()),
        });

        if (existingCode && existingCode.id !== req.params.id) {
          return res.status(400).json({ message: "此場域編號已被使用" });
        }

        data.code = data.code.toUpperCase();
        data.codeLastChangedAt = new Date();
      }

      const [field] = await db.update(fields)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(fields.id, req.params.id))
        .returning();

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "field:update",
        targetType: "field",
        targetId: field.id,
        fieldId: field.id,
        metadata: { ...data, codeChanged: data.code !== existingField.code },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(field);
    } catch (error) {
      res.status(500).json({ message: "Failed to update field" });
    }
  });

  // ============================================================================
  // Field Settings — 場域進階設定（AI Key、配額、功能開關）
  // ============================================================================

  // GET /api/admin/fields/:id/settings — 取得場域設定（Key 遮罩）
  app.get("/api/admin/fields/:id/settings", requireAdminAuth, requirePermission("field:manage"), async (req, res) => {
    try {
      if (!req.admin) return res.status(401).json({ message: "未認證" });

      // 非 super_admin 只能存取自己的場域
      if (req.admin.systemRole !== "super_admin" && req.params.id !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權存取此場域設定" });
      }

      const field = await db.query.fields.findFirst({
        where: eq(fields.id, req.params.id),
        columns: { settings: true },
      });

      if (!field) return res.status(404).json({ message: "場域不存在" });

      const settings = parseFieldSettings(field.settings);

      // 遮罩 API Key：只回傳是否已設定，不回傳明文
      return res.json({
        ...settings,
        geminiApiKey: undefined,
        hasGeminiApiKey: Boolean(settings.geminiApiKey),
      });
    } catch (error) {
      return res.status(500).json({ message: "取得設定失敗" });
    }
  });

  // PATCH /api/admin/fields/:id/settings — 更新場域設定
  app.patch("/api/admin/fields/:id/settings", requireAdminAuth, requirePermission("field:manage"), async (req, res) => {
    try {
      if (!req.admin) return res.status(401).json({ message: "未認證" });

      if (req.admin.systemRole !== "super_admin" && req.params.id !== req.admin.fieldId) {
        return res.status(403).json({ message: "無權修改此場域設定" });
      }

      const field = await db.query.fields.findFirst({
        where: eq(fields.id, req.params.id),
        columns: { settings: true },
      });

      if (!field) return res.status(404).json({ message: "場域不存在" });

      const currentSettings = parseFieldSettings(field.settings);
      const body = req.body as Record<string, unknown>;

      // 合併設定（不可變模式）
      const updatedSettings: FieldSettings = { ...currentSettings };

      // AI Key 處理：新值 → 加密存儲；空字串 → 清除
      if (typeof body.geminiApiKey === "string") {
        if (body.geminiApiKey.trim()) {
          updatedSettings.geminiApiKey = encryptApiKey(body.geminiApiKey.trim());
        } else {
          updatedSettings.geminiApiKey = undefined;
        }
      }

      // 布林開關
      if (typeof body.enableAI === "boolean") updatedSettings.enableAI = body.enableAI;
      if (typeof body.enablePayment === "boolean") updatedSettings.enablePayment = body.enablePayment;
      if (typeof body.enableTeamMode === "boolean") updatedSettings.enableTeamMode = body.enableTeamMode;
      if (typeof body.enableCompetitiveMode === "boolean") updatedSettings.enableCompetitiveMode = body.enableCompetitiveMode;

      // 數值
      if (typeof body.maxGames === "number") updatedSettings.maxGames = Math.max(0, Math.round(body.maxGames));
      if (typeof body.maxConcurrentSessions === "number") {
        updatedSettings.maxConcurrentSessions = Math.max(0, Math.round(body.maxConcurrentSessions));
      }

      // 品牌
      if (typeof body.primaryColor === "string") updatedSettings.primaryColor = body.primaryColor;
      if (typeof body.welcomeMessage === "string") updatedSettings.welcomeMessage = body.welcomeMessage;

      await db.update(fields)
        .set({ settings: updatedSettings, updatedAt: new Date() })
        .where(eq(fields.id, req.params.id));

      await logAuditAction({
        actorAdminId: req.admin.id,
        action: "field:update_settings",
        targetType: "field",
        targetId: req.params.id,
        fieldId: req.params.id,
        metadata: {
          updatedKeys: Object.keys(body),
          apiKeyChanged: typeof body.geminiApiKey === "string",
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // 回傳遮罩版本
      return res.json({
        ...updatedSettings,
        geminiApiKey: undefined,
        hasGeminiApiKey: Boolean(updatedSettings.geminiApiKey),
      });
    } catch (error) {
      return res.status(500).json({ message: "更新設定失敗" });
    }
  });
}
