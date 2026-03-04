import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock db
const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      $count: vi.fn(),
    },
  };
});

vi.mock("../db", () => ({ db: mockDb }));

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
  battleResults: { id: "battle_results.id", venueId: "battle_results.venue_id", createdAt: "battle_results.created_at" },
  battlePlayerResults: { id: "battle_player_results.id", resultId: "battle_player_results.result_id" },
  battlePlayerRankings: {
    id: "battle_player_rankings.id",
    fieldId: "battle_player_rankings.field_id",
    rating: "battle_player_rankings.rating",
    tier: "battle_player_rankings.tier",
    userId: "battle_player_rankings.user_id",
  },
  battleSlots: { id: "battle_slots.id" },
  battleVenues: { id: "battle_venues.id", fieldId: "battle_venues.field_id" },
  getTierFromRating: vi.fn((rating: number) => {
    if (rating >= 2000) return "master";
    if (rating >= 1500) return "diamond";
    if (rating >= 1000) return "platinum";
    if (rating >= 600) return "gold";
    if (rating >= 300) return "silver";
    return "bronze";
  }),
  tierLabels: {
    bronze: "🥉 新兵",
    silver: "🥈 步兵",
    gold: "🥇 突擊",
    platinum: "💎 精英",
    diamond: "💠 菁英",
    master: "👑 傳奇",
  },
}));

import { registerAdminBattleRoutes } from "../routes/admin-battle";

const adminHeaders = {
  "x-admin-id": "admin-1",
  "x-field-id": "field-1",
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminBattleRoutes(app);
  return app;
}

describe("管理端對戰統計 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/battle/stats", () => {
    it("缺少 fieldId 回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/admin/battle/stats")
        .set(adminHeaders);
      expect(res.status).toBe(400);
    });

    it("無場地回傳零值統計", async () => {
      const app = createApp();
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      mockDb.select.mockImplementation(selectMock);

      const res = await request(app)
        .get("/api/admin/battle/stats?fieldId=field-1")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body.totalBattles).toBe(0);
      expect(res.body.totalPlayers).toBe(0);
    });

    it("未認證回傳 401", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/admin/battle/stats?fieldId=field-1");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/admin/battle/tier-distribution", () => {
    it("缺少 fieldId 回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/admin/battle/tier-distribution")
        .set(adminHeaders);
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/admin/battle/rankings", () => {
    it("缺少 fieldId 回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/admin/battle/rankings")
        .set(adminHeaders);
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/admin/battle/rankings/:id", () => {
    it("無效的 rating 回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/battle/rankings/ranking-1")
        .set(adminHeaders)
        .send({ rating: -100 });
      expect(res.status).toBe(400);
    });

    it("rating 超過上限回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/battle/rankings/ranking-1")
        .set(adminHeaders)
        .send({ rating: 9999 });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/admin/battle/recent-results", () => {
    it("缺少 fieldId 回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/admin/battle/recent-results")
        .set(adminHeaders);
      expect(res.status).toBe(400);
    });
  });
});
