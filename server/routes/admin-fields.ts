import type { Express } from "express";
import {
  requireAdminAuth,
  requirePermission,
  logAuditAction,
} from "../adminAuth";
import { db } from "../db";
import { fields } from "@shared/schema";
import { insertFieldSchema } from "@shared/schema";
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
        (data as any).codeLastChangedAt = new Date();
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
}
