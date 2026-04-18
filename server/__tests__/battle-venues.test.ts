import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock battleStorageMethods
const mockStorage = vi.hoisted(() => ({
  getVenuesByField: vi.fn(),
  getVenue: vi.fn(),
  createVenue: vi.fn(),
  updateVenue: vi.fn(),
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
  requirePermission: vi.fn(
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  ),
}));

vi.mock("@shared/schema", () => ({
  insertBattleVenueSchema: { parse: vi.fn((d: unknown) => d) },
  updateBattleVenueSchema: { parse: vi.fn((d: unknown) => d) },
}));

import express from "express";
import request from "supertest";
import { registerBattleVenueRoutes } from "../routes/battle-venues";

const adminHeaders = {
  "x-admin-id": "admin-1",
  "x-field-id": "field-1",
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerBattleVenueRoutes(app);
  return app;
}

describe("對戰場地 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/battle/venues
  // =========================================================================
  describe("GET /api/battle/venues", () => {
    it("無 fieldId 時回傳所有活躍場地", async () => {
      const allVenues = [{ id: "v0", name: "公開場地", fieldId: null }];
      mockStorage.getAllActiveVenues.mockResolvedValue(allVenues);

      const app = createApp();
      const res = await request(app).get("/api/battle/venues");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockStorage.getAllActiveVenues).toHaveBeenCalled();
    });

    it("成功回傳場地列表", async () => {
      const venues = [
        { id: "v1", name: "場地A", fieldId: "field-1" },
        { id: "v2", name: "場地B", fieldId: "field-1" },
      ];
      mockStorage.getVenuesByField.mockResolvedValue(venues);

      const app = createApp();
      const res = await request(app)
        .get("/api/battle/venues")
        .query({ fieldId: "field-1" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockStorage.getVenuesByField).toHaveBeenCalledWith("field-1");
    });
  });

  // =========================================================================
  // GET /api/battle/venues/:id
  // =========================================================================
  describe("GET /api/battle/venues/:id", () => {
    it("場地不存在回傳 404", async () => {
      mockStorage.getVenue.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get("/api/battle/venues/not-exist");

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/不存在/);
    });

    it("成功回傳場地詳情", async () => {
      const venue = { id: "v1", name: "場地A", fieldId: "field-1" };
      mockStorage.getVenue.mockResolvedValue(venue);

      const app = createApp();
      const res = await request(app).get("/api/battle/venues/v1");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("v1");
    });
  });

  // =========================================================================
  // POST /api/battle/venues
  // =========================================================================
  describe("POST /api/battle/venues", () => {
    it("未認證回傳 401", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/battle/venues")
        .send({ name: "新場地" });

      expect(res.status).toBe(401);
    });

    it("成功建立場地回傳 201", async () => {
      const created = { id: "v-new", name: "新場地", fieldId: "field-1" };
      mockStorage.createVenue.mockResolvedValue(created);

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/venues")
        .set(adminHeaders)
        .send({ name: "新場地" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("v-new");
      expect(mockStorage.createVenue).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // PATCH /api/battle/venues/:id
  // =========================================================================
  describe("PATCH /api/battle/venues/:id", () => {
    it("場地不存在回傳 404", async () => {
      mockStorage.getVenue.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app)
        .patch("/api/battle/venues/not-exist")
        .set(adminHeaders)
        .send({ name: "更新名稱" });

      expect(res.status).toBe(404);
    });

    it("fieldId 不符且非 super_admin 回傳 403", async () => {
      mockStorage.getVenue.mockResolvedValue({
        id: "v1",
        fieldId: "other-field",
      });

      const app = createApp();
      const res = await request(app)
        .patch("/api/battle/venues/v1")
        .set(adminHeaders)
        .send({ name: "更新" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/無權限/);
    });
  });

  // =========================================================================
  // DELETE /api/battle/venues/:id
  // =========================================================================
  describe("DELETE /api/battle/venues/:id", () => {
    it("成功停用場地", async () => {
      mockStorage.getVenue.mockResolvedValue({
        id: "v1",
        fieldId: "field-1",
      });
      mockStorage.updateVenue.mockResolvedValue({
        id: "v1",
        isActive: false,
      });

      const app = createApp();
      const res = await request(app)
        .delete("/api/battle/venues/v1")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/停用/);
      expect(mockStorage.updateVenue).toHaveBeenCalledWith("v1", {
        isActive: false,
      });
    });
  });
});
