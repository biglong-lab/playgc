import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock battleStorageMethods
const mockStorage = vi.hoisted(() => ({
  getSlotsByVenue: vi.fn(),
  getSlot: vi.fn(),
  getVenue: vi.fn(),
  createSlot: vi.fn(),
  createSlotsBatch: vi.fn(),
  updateSlot: vi.fn(),
  getRegistrationsBySlot: vi.fn(),
  getPremadeGroupsBySlot: vi.fn(),
}));

vi.mock("../storage/battle-storage", () => ({
  battleStorageMethods: mockStorage,
}));

vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn(
    (req: Record<string, unknown>, _res: unknown, next: () => void) => {
      const headers = req.headers as Record<string, string>;
      if (headers["x-admin-id"]) {
        req.admin = {
          id: headers["x-admin-id"],
          fieldId: headers["x-field-id"] || "field-1",
          systemRole: headers["x-system-role"] || "field_admin",
          permissions: ["game:view"],
        };
        return next();
      }
      return (
        _res as { status: (n: number) => { json: (o: unknown) => void } }
      )
        .status(401)
        .json({ message: "未認證" });
    },
  ),
}));

vi.mock("@shared/schema", () => ({
  insertBattleSlotSchema: { parse: vi.fn((d: unknown) => d) },
}));

import express from "express";
import request from "supertest";
import { registerBattleSlotRoutes } from "../routes/battle-slots";

const adminHeaders = {
  "x-admin-id": "admin-1",
  "x-field-id": "field-1",
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerBattleSlotRoutes(app);
  return app;
}

describe("對戰時段 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/battle/slots
  // =========================================================================
  describe("GET /api/battle/slots", () => {
    it("缺少 venueId 回傳 400", async () => {
      const app = createApp();
      const res = await request(app).get("/api/battle/slots");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/venueId/);
    });

    it("成功回傳時段列表", async () => {
      const slots = [
        { id: "s1", venueId: "v1", status: "open" },
        { id: "s2", venueId: "v1", status: "confirmed" },
      ];
      mockStorage.getSlotsByVenue.mockResolvedValue(slots);

      const app = createApp();
      const res = await request(app)
        .get("/api/battle/slots")
        .query({ venueId: "v1" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockStorage.getSlotsByVenue).toHaveBeenCalledWith(
        "v1",
        undefined,
      );
    });
  });

  // =========================================================================
  // GET /api/battle/slots/:id
  // =========================================================================
  describe("GET /api/battle/slots/:id", () => {
    it("時段不存在回傳 404", async () => {
      mockStorage.getSlot.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get("/api/battle/slots/not-exist");

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/不存在/);
    });

    it("成功回傳時段詳情含 registrations", async () => {
      mockStorage.getSlot.mockResolvedValue({
        id: "s1",
        venueId: "v1",
        status: "open",
      });
      mockStorage.getRegistrationsBySlot.mockResolvedValue([
        { id: "r1", userId: "u1" },
      ]);
      mockStorage.getPremadeGroupsBySlot.mockResolvedValue([]);

      const app = createApp();
      const res = await request(app).get("/api/battle/slots/s1");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("s1");
      expect(res.body.registrations).toHaveLength(1);
      expect(res.body.premadeGroups).toHaveLength(0);
    });
  });

  // =========================================================================
  // POST /api/battle/slots
  // =========================================================================
  describe("POST /api/battle/slots", () => {
    it("場地不存在回傳 404", async () => {
      mockStorage.getVenue.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots")
        .set(adminHeaders)
        .send({ venueId: "not-exist", slotDate: "2026-03-10" });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/場地不存在/);
    });

    it("成功建立時段回傳 201", async () => {
      mockStorage.getVenue.mockResolvedValue({
        id: "v1",
        fieldId: "field-1",
      });
      mockStorage.createSlot.mockResolvedValue({
        id: "s-new",
        venueId: "v1",
        status: "open",
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots")
        .set(adminHeaders)
        .send({ venueId: "v1", slotDate: "2026-03-10" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("s-new");
    });
  });

  // =========================================================================
  // POST /api/battle/slots/batch
  // =========================================================================
  describe("POST /api/battle/slots/batch", () => {
    it("空陣列回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots/batch")
        .set(adminHeaders)
        .send({ slots: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/slots/);
    });

    it("超過 50 個回傳 400", async () => {
      const tooMany = Array.from({ length: 51 }, (_, i) => ({
        venueId: "v1",
        slotDate: `2026-03-${String(i + 1).padStart(2, "0")}`,
      }));

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots/batch")
        .set(adminHeaders)
        .send({ slots: tooMany });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/50/);
    });

    it("成功批次建立回傳 201", async () => {
      const slotsInput = [
        { venueId: "v1", slotDate: "2026-03-10" },
        { venueId: "v1", slotDate: "2026-03-11" },
      ];
      mockStorage.getVenue.mockResolvedValue({
        id: "v1",
        fieldId: "field-1",
      });
      mockStorage.createSlotsBatch.mockResolvedValue([
        { id: "s1" },
        { id: "s2" },
      ]);

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots/batch")
        .set(adminHeaders)
        .send({ slots: slotsInput });

      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(2);
    });
  });

  // =========================================================================
  // PATCH /api/battle/slots/:id
  // =========================================================================
  describe("PATCH /api/battle/slots/:id", () => {
    it("時段不存在回傳 404", async () => {
      mockStorage.getSlot.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app)
        .patch("/api/battle/slots/not-exist")
        .set(adminHeaders)
        .send({ notes: "更新備註" });

      expect(res.status).toBe(404);
    });

    it("成功更新時段", async () => {
      mockStorage.getSlot.mockResolvedValue({
        id: "s1",
        venueId: "v1",
        status: "open",
      });
      mockStorage.getVenue.mockResolvedValue({
        id: "v1",
        fieldId: "field-1",
      });
      mockStorage.updateSlot.mockResolvedValue({
        id: "s1",
        notes: "已更新",
      });

      const app = createApp();
      const res = await request(app)
        .patch("/api/battle/slots/s1")
        .set(adminHeaders)
        .send({ notes: "已更新" });

      expect(res.status).toBe(200);
      expect(mockStorage.updateSlot).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // POST /api/battle/slots/:id/cancel
  // =========================================================================
  describe("POST /api/battle/slots/:id/cancel", () => {
    it("進行中的時段無法取消回傳 400", async () => {
      mockStorage.getSlot.mockResolvedValue({
        id: "s1",
        venueId: "v1",
        status: "in_progress",
      });
      mockStorage.getVenue.mockResolvedValue({
        id: "v1",
        fieldId: "field-1",
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots/s1/cancel")
        .set(adminHeaders);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/進行中/);
    });

    it("成功取消時段", async () => {
      mockStorage.getSlot.mockResolvedValue({
        id: "s1",
        venueId: "v1",
        status: "confirmed",
      });
      mockStorage.getVenue.mockResolvedValue({
        id: "v1",
        fieldId: "field-1",
      });
      mockStorage.updateSlot.mockResolvedValue({
        id: "s1",
        status: "cancelled",
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots/s1/cancel")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(mockStorage.updateSlot).toHaveBeenCalledWith("s1", {
        status: "cancelled",
      });
    });
  });

  // =========================================================================
  // POST /api/battle/slots/:id/start
  // =========================================================================
  describe("POST /api/battle/slots/:id/start", () => {
    it("非 confirmed/full 狀態回傳 400", async () => {
      mockStorage.getSlot.mockResolvedValue({
        id: "s1",
        venueId: "v1",
        status: "open",
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots/s1/start")
        .set(adminHeaders);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/已確認或已滿/);
    });

    it("成功開始對戰", async () => {
      mockStorage.getSlot.mockResolvedValue({
        id: "s1",
        venueId: "v1",
        status: "confirmed",
      });
      mockStorage.updateSlot.mockResolvedValue({
        id: "s1",
        status: "in_progress",
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots/s1/start")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(mockStorage.updateSlot).toHaveBeenCalledWith("s1", {
        status: "in_progress",
      });
    });
  });

  // =========================================================================
  // POST /api/battle/slots/:id/finish
  // =========================================================================
  describe("POST /api/battle/slots/:id/finish", () => {
    it("非 in_progress 狀態回傳 400", async () => {
      mockStorage.getSlot.mockResolvedValue({
        id: "s1",
        venueId: "v1",
        status: "confirmed",
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots/s1/finish")
        .set(adminHeaders);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/進行中/);
    });

    it("成功結束對戰", async () => {
      mockStorage.getSlot.mockResolvedValue({
        id: "s1",
        venueId: "v1",
        status: "in_progress",
      });
      mockStorage.updateSlot.mockResolvedValue({
        id: "s1",
        status: "completed",
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/slots/s1/finish")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(mockStorage.updateSlot).toHaveBeenCalledWith("s1", {
        status: "completed",
      });
    });
  });
});
