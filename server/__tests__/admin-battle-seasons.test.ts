import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock storage
const mockStorage = vi.hoisted(() => ({
  getActiveSeason: vi.fn(),
  getSeasonsByField: vi.fn(),
  createSeason: vi.fn(),
  endSeason: vi.fn(),
  snapshotSeasonRankings: vi.fn(),
  resetFieldRankings: vi.fn(),
  getSeasonRankings: vi.fn(),
  getSeason: vi.fn(),
}));

vi.mock("../storage/battle-storage-seasons", () => mockStorage);

vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: Record<string, unknown>, _res: unknown, next: () => void) => {
    const headers = req.headers as Record<string, string>;
    if (headers["x-admin-id"]) {
      req.admin = {
        id: headers["x-admin-id"],
        fieldId: headers["x-field-id"] || "field-1",
        systemRole: "field_admin",
        permissions: ["game:view"],
      };
      return next();
    }
    return (_res as { status: (n: number) => { json: (o: unknown) => void } }).status(401).json({ message: "未認證" });
  }),
}));

vi.mock("@shared/schema", () => ({
  createSeasonSchema: {
    parse: vi.fn((data: Record<string, unknown>) => data),
  },
}));

import { registerAdminBattleSeasonRoutes } from "../routes/admin-battle-seasons";

const adminHeaders = {
  "x-admin-id": "admin-1",
  "x-field-id": "field-1",
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminBattleSeasonRoutes(app);
  return app;
}

describe("管理端賽季 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/admin/battle/seasons", () => {
    it("已有活躍賽季回傳 409", async () => {
      mockStorage.getActiveSeason.mockResolvedValueOnce({ id: "s1", status: "active" });

      const app = createApp();
      const res = await request(app)
        .post("/api/admin/battle/seasons")
        .set(adminHeaders)
        .send({ fieldId: "field-1", name: "S1", startDate: "2026-01-01" });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("活躍賽季");
    });

    it("成功建立賽季回傳 201", async () => {
      mockStorage.getActiveSeason.mockResolvedValueOnce(null);
      mockStorage.getSeasonsByField.mockResolvedValueOnce([]);
      mockStorage.createSeason.mockResolvedValueOnce({
        id: "s1",
        seasonNumber: 1,
        name: "S1",
        status: "active",
      });

      const app = createApp();
      const res = await request(app)
        .post("/api/admin/battle/seasons")
        .set(adminHeaders)
        .send({ fieldId: "field-1", name: "S1", startDate: "2026-01-01" });

      expect(res.status).toBe(201);
      expect(res.body.seasonNumber).toBe(1);
    });

    it("未認證回傳 401", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/battle/seasons")
        .send({ name: "S1", startDate: "2026-01-01" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/admin/battle/seasons", () => {
    it("缺少 fieldId 回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/admin/battle/seasons")
        .set(adminHeaders);

      expect(res.status).toBe(400);
    });

    it("成功取得賽季列表", async () => {
      mockStorage.getSeasonsByField.mockResolvedValueOnce([
        { id: "s1", seasonNumber: 1, name: "S1", status: "ended" },
        { id: "s2", seasonNumber: 2, name: "S2", status: "active" },
      ]);

      const app = createApp();
      const res = await request(app)
        .get("/api/admin/battle/seasons?fieldId=field-1")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe("POST /api/admin/battle/seasons/:id/end", () => {
    it("賽季不存在回傳 404", async () => {
      mockStorage.getSeason.mockResolvedValueOnce(null);

      const app = createApp();
      const res = await request(app)
        .post("/api/admin/battle/seasons/s999/end")
        .set(adminHeaders);

      expect(res.status).toBe(404);
    });

    it("非活躍賽季回傳 400", async () => {
      mockStorage.getSeason.mockResolvedValueOnce({ id: "s1", status: "ended" });

      const app = createApp();
      const res = await request(app)
        .post("/api/admin/battle/seasons/s1/end")
        .set(adminHeaders);

      expect(res.status).toBe(400);
    });

    it("成功結束賽季", async () => {
      mockStorage.getSeason.mockResolvedValueOnce({
        id: "s1",
        status: "active",
        fieldId: "field-1",
        resetRatingTo: 1000,
      });
      mockStorage.snapshotSeasonRankings.mockResolvedValueOnce([{ id: "r1" }, { id: "r2" }]);
      mockStorage.endSeason.mockResolvedValueOnce({ id: "s1", status: "ended" });
      mockStorage.resetFieldRankings.mockResolvedValueOnce(undefined);

      const app = createApp();
      const res = await request(app)
        .post("/api/admin/battle/seasons/s1/end")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body.snapshotCount).toBe(2);
      expect(mockStorage.resetFieldRankings).toHaveBeenCalledWith("field-1", 1000);
    });
  });

  describe("GET /api/admin/battle/seasons/:id/rankings", () => {
    it("成功取得賽季排名", async () => {
      mockStorage.getSeasonRankings.mockResolvedValueOnce([
        { id: "r1", rank: 1, userId: "u1", finalRating: 1500 },
      ]);

      const app = createApp();
      const res = await request(app)
        .get("/api/admin/battle/seasons/s1/rankings")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
