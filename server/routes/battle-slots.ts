// 水彈對戰 PK 擂台 — 時段管理路由
import type { Express } from "express";
import { requireAdminAuth } from "../adminAuth";
import { battleStorageMethods } from "../storage/battle-storage";
import { insertBattleSlotSchema } from "@shared/schema";
import { z } from "zod";

export function registerBattleSlotRoutes(app: Express) {
  // ============================================================================
  // GET /api/battle/slots — 取得場地的時段列表
  // ============================================================================
  app.get("/api/battle/slots", async (req, res) => {
    try {
      const venueId = req.query.venueId as string;
      const fromDate = req.query.fromDate as string | undefined;
      if (!venueId) {
        return res.status(400).json({ error: "缺少 venueId 參數" });
      }
      const slots = await battleStorageMethods.getSlotsByVenue(venueId, fromDate);
      res.json(slots);
    } catch {
      res.status(500).json({ error: "取得時段列表失敗" });
    }
  });

  // ============================================================================
  // GET /api/battle/slots/:id — 取得時段詳情
  // ============================================================================
  app.get("/api/battle/slots/:id", async (req, res) => {
    try {
      const slot = await battleStorageMethods.getSlot(req.params.id);
      if (!slot) {
        return res.status(404).json({ error: "時段不存在" });
      }

      // JOIN 玩家名稱
      const regRows = await battleStorageMethods.getRegistrationsBySlotWithNames(req.params.id);
      const registrations = regRows.map((row) => ({
        ...row.registration,
        displayName: buildDisplayName(row.firstName, row.lastName, row.registration.userId),
      }));
      const premadeGroups = await battleStorageMethods.getPremadeGroupsBySlot(req.params.id);

      res.json({ ...slot, registrations, premadeGroups });
    } catch {
      res.status(500).json({ error: "取得時段失敗" });
    }
  });

  // ============================================================================
  // POST /api/battle/slots — 建立時段（管理員）
  // ============================================================================
  app.post("/api/battle/slots", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ error: "未認證" });
      }

      const data = insertBattleSlotSchema.parse(req.body);

      // 驗證場地歸屬
      const venue = await battleStorageMethods.getVenue(data.venueId);
      if (!venue) {
        return res.status(404).json({ error: "場地不存在" });
      }
      if (venue.fieldId !== req.admin.fieldId && req.admin.systemRole !== "super_admin") {
        return res.status(403).json({ error: "無權限操作此場地的時段" });
      }

      const slot = await battleStorageMethods.createSlot(data);
      res.status(201).json(slot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "資料驗證失敗", details: error.errors });
      }
      res.status(500).json({ error: "建立時段失敗" });
    }
  });

  // ============================================================================
  // POST /api/battle/slots/batch — 批次建立時段（管理員）
  // ============================================================================
  app.post("/api/battle/slots/batch", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ error: "未認證" });
      }

      const slotsData = req.body.slots as unknown[];
      if (!Array.isArray(slotsData) || slotsData.length === 0) {
        return res.status(400).json({ error: "缺少 slots 陣列" });
      }
      if (slotsData.length > 50) {
        return res.status(400).json({ error: "單次最多建立 50 個時段" });
      }

      // 驗證場地歸屬（取第一筆的 venueId 做驗證）
      const firstSlot = slotsData[0] as Record<string, unknown>;
      const venue = await battleStorageMethods.getVenue(firstSlot.venueId as string);
      if (!venue) {
        return res.status(404).json({ error: "場地不存在" });
      }
      if (venue.fieldId !== req.admin.fieldId && req.admin.systemRole !== "super_admin") {
        return res.status(403).json({ error: "無權限操作此場地的時段" });
      }

      const parsed = slotsData.map((s) =>
        insertBattleSlotSchema.parse(s as Record<string, unknown>)
      );
      const slots = await battleStorageMethods.createSlotsBatch(parsed);
      res.status(201).json(slots);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "資料驗證失敗", details: error.errors });
      }
      res.status(500).json({ error: "批次建立時段失敗" });
    }
  });

  // ============================================================================
  // PATCH /api/battle/slots/:id — 更新時段（管理員）
  // ============================================================================
  app.patch("/api/battle/slots/:id", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ error: "未認證" });
      }

      const existing = await battleStorageMethods.getSlot(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "時段不存在" });
      }

      // 驗證場地歸屬
      const venue = await battleStorageMethods.getVenue(existing.venueId);
      if (!venue) {
        return res.status(404).json({ error: "場地不存在" });
      }
      if (venue.fieldId !== req.admin.fieldId && req.admin.systemRole !== "super_admin") {
        return res.status(403).json({ error: "無權限修改此時段" });
      }

      const allowedFields = [
        "slotDate", "startTime", "endTime", "slotType", "status",
        "minPlayersOverride", "maxPlayersOverride", "pricePerPerson",
        "registrationDeadline", "confirmationDeadline", "notes",
      ] as const;
      const updateData: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          updateData[key] = req.body[key];
        }
      }

      const slot = await battleStorageMethods.updateSlot(req.params.id, updateData);
      res.json(slot);
    } catch {
      res.status(500).json({ error: "更新時段失敗" });
    }
  });

  // ============================================================================
  // POST /api/battle/slots/:id/cancel — 取消時段（管理員）
  // ============================================================================
  app.post("/api/battle/slots/:id/cancel", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ error: "未認證" });
      }

      const existing = await battleStorageMethods.getSlot(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "時段不存在" });
      }

      const venue = await battleStorageMethods.getVenue(existing.venueId);
      if (!venue) {
        return res.status(404).json({ error: "場地不存在" });
      }
      if (venue.fieldId !== req.admin.fieldId && req.admin.systemRole !== "super_admin") {
        return res.status(403).json({ error: "無權限取消此時段" });
      }

      if (existing.status === "in_progress") {
        return res.status(400).json({ error: "進行中的時段無法取消" });
      }

      const slot = await battleStorageMethods.updateSlot(req.params.id, { status: "cancelled" });
      res.json(slot);
    } catch {
      res.status(500).json({ error: "取消時段失敗" });
    }
  });

  // ============================================================================
  // POST /api/battle/slots/:id/start — 開始對戰（管理員）
  // ============================================================================
  app.post("/api/battle/slots/:id/start", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ error: "未認證" });
      }

      const existing = await battleStorageMethods.getSlot(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "時段不存在" });
      }

      if (existing.status !== "confirmed" && existing.status !== "full") {
        return res.status(400).json({ error: "只有已確認或已滿的時段可以開始對戰" });
      }

      const slot = await battleStorageMethods.updateSlot(req.params.id, { status: "in_progress" });
      res.json(slot);
    } catch {
      res.status(500).json({ error: "開始對戰失敗" });
    }
  });

  // ============================================================================
  // POST /api/battle/slots/:id/finish — 結束對戰（管理員）
  // ============================================================================
  app.post("/api/battle/slots/:id/finish", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ error: "未認證" });
      }

      const existing = await battleStorageMethods.getSlot(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "時段不存在" });
      }

      if (existing.status !== "in_progress") {
        return res.status(400).json({ error: "只有進行中的時段可以結束" });
      }

      const slot = await battleStorageMethods.updateSlot(req.params.id, { status: "completed" });
      res.json(slot);
    } catch {
      res.status(500).json({ error: "結束對戰失敗" });
    }
  });
}
