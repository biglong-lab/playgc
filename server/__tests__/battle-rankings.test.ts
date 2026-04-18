import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock battleStorageMethods
const mockStorage = vi.hoisted(() => ({
  getRankingsByField: vi.fn(),
  getPlayerRanking: vi.fn(),
  getPlayerHistory: vi.fn(),
}));

const mockGetRankingsByFieldWithNames = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockGetPlayerHistoryWithDetails = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("../storage/battle-storage", () => ({
  battleStorageMethods: mockStorage,
  getRankingsByFieldWithNames: mockGetRankingsByFieldWithNames,
  getPlayerHistoryWithDetails: mockGetPlayerHistoryWithDetails,
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn(
    (req: Record<string, unknown>, _res: unknown, next: () => void) => {
      const headers = req.headers as Record<string, string>;
      if (headers["x-user-id"]) {
        req.user = {
          claims: { sub: headers["x-user-id"] },
          dbUser: {
            id: headers["x-user-id"],
            displayName: "測試玩家",
          },
        };
        return next();
      }
      return (
        _res as { status: (n: number) => { json: (o: unknown) => void } }
      )
        .status(401)
        .json({ error: "未認證" });
    },
  ),
}));

vi.mock("@shared/schema", () => ({
  tierLabels: {
    bronze: "新兵",
    silver: "步兵",
    gold: "突擊",
    platinum: "精英",
    diamond: "菁英",
    master: "傳奇",
  },
  getTierFromRating: vi.fn((rating: number) => {
    if (rating >= 2000) return "master";
    if (rating >= 1500) return "diamond";
    if (rating >= 1000) return "platinum";
    if (rating >= 600) return "gold";
    if (rating >= 300) return "silver";
    return "bronze";
  }),
}));

import express from "express";
import request from "supertest";
import { registerBattleRankingRoutes } from "../routes/battle-rankings";

const userHeaders = {
  "x-user-id": "user-1",
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerBattleRankingRoutes(app);
  return app;
}

describe("對戰排名 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/battle/rankings
  // =========================================================================
  describe("GET /api/battle/rankings", () => {
    it("缺少 fieldId 回傳 400", async () => {
      const app = createApp();
      const res = await request(app).get("/api/battle/rankings");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/fieldId/);
    });

    it("成功回傳排行榜含 rank/tierLabel/winRate", async () => {
      const rankings = [
        {
          userId: "u1",
          displayName: "玩家A",
          rating: 1200,
          tier: "platinum",
          totalBattles: 10,
          wins: 7,
          losses: 2,
          draws: 1,
        },
        {
          userId: "u2",
          displayName: "玩家B",
          rating: 800,
          tier: "gold",
          totalBattles: 5,
          wins: 2,
          losses: 3,
          draws: 0,
        },
      ];
      mockGetRankingsByFieldWithNames.mockResolvedValue(
        rankings.map((r) => ({
          ranking: r,
          firstName: r.displayName,
          lastName: "",
        })),
      );

      const app = createApp();
      const res = await request(app)
        .get("/api/battle/rankings")
        .query({ fieldId: "field-1" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      // 第一名
      expect(res.body[0].rank).toBe(1);
      expect(res.body[0].tierLabel).toBe("精英");
      expect(res.body[0].winRate).toBe(70);
      // 第二名
      expect(res.body[1].rank).toBe(2);
      expect(res.body[1].winRate).toBe(40);
    });
  });

  // =========================================================================
  // GET /api/battle/rankings/me
  // =========================================================================
  describe("GET /api/battle/rankings/me", () => {
    it("未認證回傳 401", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/battle/rankings/me")
        .query({ fieldId: "field-1" });

      expect(res.status).toBe(401);
    });

    it("無排名紀錄回傳預設值", async () => {
      mockStorage.getPlayerRanking.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app)
        .get("/api/battle/rankings/me")
        .set(userHeaders)
        .query({ fieldId: "field-1" });

      expect(res.status).toBe(200);
      expect(res.body.rating).toBe(1000);
      expect(res.body.tier).toBe("platinum");
      expect(res.body.totalBattles).toBe(0);
      expect(res.body.winRate).toBe(0);
    });

    it("有排名紀錄回傳實際資料", async () => {
      const ranking = {
        userId: "user-1",
        rating: 1500,
        tier: "diamond",
        totalBattles: 20,
        wins: 15,
        losses: 4,
        draws: 1,
        winStreak: 3,
        bestStreak: 7,
        mvpCount: 5,
      };
      mockStorage.getPlayerRanking.mockResolvedValue(ranking);

      const app = createApp();
      const res = await request(app)
        .get("/api/battle/rankings/me")
        .set(userHeaders)
        .query({ fieldId: "field-1" });

      expect(res.status).toBe(200);
      expect(res.body.rating).toBe(1500);
      expect(res.body.tierLabel).toBe("菁英");
      expect(res.body.winRate).toBe(75);
    });
  });

  // =========================================================================
  // GET /api/battle/my/history
  // =========================================================================
  describe("GET /api/battle/my/history", () => {
    it("未認證回傳 401", async () => {
      const app = createApp();
      const res = await request(app).get("/api/battle/my/history");

      expect(res.status).toBe(401);
    });

    it("成功回傳對戰歷史", async () => {
      const history = [
        { id: "r1", result: "win", ratingChange: 25 },
        { id: "r2", result: "loss", ratingChange: -20 },
      ];
      mockStorage.getPlayerHistory.mockResolvedValue(history);

      const app = createApp();
      const res = await request(app)
        .get("/api/battle/my/history")
        .set(userHeaders);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockStorage.getPlayerHistory).toHaveBeenCalledWith("user-1", 20);
    });
  });
});
