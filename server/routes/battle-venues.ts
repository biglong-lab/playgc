// 水彈對戰 PK 擂台 — 場地管理路由
import type { Express } from "express";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { battleStorageMethods } from "../storage/battle-storage";
import {
  insertBattleVenueSchema,
  updateBattleVenueSchema,
} from "@shared/schema";
import { z } from "zod";

export function registerBattleVenueRoutes(app: Express) {
  // ============================================================================
  // GET /api/battle/venues — 取得場域下的所有對戰場地
  // ============================================================================
  app.get("/api/battle/venues", async (req, res) => {
    try {
      const fieldId = req.query.fieldId as string;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId 參數" });
      }
      const venues = await battleStorageMethods.getVenuesByField(fieldId);
      res.json(venues);
    } catch {
      res.status(500).json({ error: "取得場地列表失敗" });
    }
  });

  // ============================================================================
  // GET /api/battle/venues/:id — 取得場地詳情
  // ============================================================================
  app.get("/api/battle/venues/:id", async (req, res) => {
    try {
      const venue = await battleStorageMethods.getVenue(req.params.id);
      if (!venue) {
        return res.status(404).json({ error: "場地不存在" });
      }
      res.json(venue);
    } catch {
      res.status(500).json({ error: "取得場地失敗" });
    }
  });

  // ============================================================================
  // POST /api/battle/venues — 建立對戰場地（管理員）
  // ============================================================================
  app.post("/api/battle/venues", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ error: "未認證" });
      }

      const data = insertBattleVenueSchema.parse({
        ...req.body,
        fieldId: req.admin.fieldId,
      });

      const venue = await battleStorageMethods.createVenue(data);
      res.status(201).json(venue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "資料驗證失敗", details: error.errors });
      }
      res.status(500).json({ error: "建立場地失敗" });
    }
  });

  // ============================================================================
  // PATCH /api/battle/venues/:id — 更新場地設定（管理員）
  // ============================================================================
  app.patch("/api/battle/venues/:id", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ error: "未認證" });
      }

      const existing = await battleStorageMethods.getVenue(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "場地不存在" });
      }
      if (existing.fieldId !== req.admin.fieldId && req.admin.systemRole !== "super_admin") {
        return res.status(403).json({ error: "無權限修改此場地" });
      }

      const data = updateBattleVenueSchema.parse(req.body);
      const venue = await battleStorageMethods.updateVenue(req.params.id, data);
      res.json(venue);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "資料驗證失敗", details: error.errors });
      }
      res.status(500).json({ error: "更新場地失敗" });
    }
  });

  // ============================================================================
  // DELETE /api/battle/venues/:id — 停用場地（軟刪除）
  // ============================================================================
  app.delete("/api/battle/venues/:id", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ error: "未認證" });
      }

      const existing = await battleStorageMethods.getVenue(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "場地不存在" });
      }
      if (existing.fieldId !== req.admin.fieldId && req.admin.systemRole !== "super_admin") {
        return res.status(403).json({ error: "無權限停用此場地" });
      }

      await battleStorageMethods.updateVenue(req.params.id, { isActive: false });
      res.json({ message: "場地已停用" });
    } catch {
      res.status(500).json({ error: "停用場地失敗" });
    }
  });
}
