import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../db", () => ({
  db: { query: {} },
}));

vi.mock("../storage", () => ({
  storage: {
    getGame: vi.fn(),
    getLocations: vi.fn(),
    getPages: vi.fn(),
    getLocation: vi.fn(),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
    deleteLocation: vi.fn(),
    getSession: vi.fn(),
    createPlayerLocation: vi.fn(),
    getTeamLocations: vi.fn(),
    getPlayerLocationHistory: vi.fn(),
    hasVisitedLocation: vi.fn(),
    createLocationVisit: vi.fn(),
    getPlayerProgress: vi.fn(),
    updatePlayerProgress: vi.fn(),
    getLocationVisits: vi.fn(),
    getNavigationPaths: vi.fn(),
    createNavigationPath: vi.fn(),
    deleteNavigationPath: vi.fn(),
  },
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "user-1" },
        dbUser: { id: "user-1", role: "creator" },
      };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
}));

vi.mock("./utils", () => ({
  checkGameOwnership: vi.fn(),
}));

// 因為 checkGameOwnership 從 ./utils 引入，但 locations.ts 引入的是 ../routes/utils
// 需要用完整路徑 mock
vi.mock("../routes/utils", () => ({
  checkGameOwnership: vi.fn(),
}));

import { storage } from "../storage";
import { registerLocationRoutes } from "../routes/locations";

// 引入被 mock 的 checkGameOwnership
import { checkGameOwnership } from "../routes/utils";

const mockStorage = storage as {
  [K in keyof typeof storage]: ReturnType<typeof vi.fn>;
};

const mockCheckOwnership = checkGameOwnership as ReturnType<typeof vi.fn>;

function createApp() {
  const app = express();
  app.use(express.json());
  const ctx = { broadcastToSession: vi.fn() };
  registerLocationRoutes(app, ctx as any);
  return { app, ctx };
}

const AUTH = { Authorization: "Bearer valid-token" };

describe("地點路由 (locations)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOwnership.mockResolvedValue({ authorized: true });
  });

  // ===========================================
  // GET /api/games/:gameId/locations
  // ===========================================
  describe("GET /api/games/:gameId/locations", () => {
    it("未認證時回傳 401", async () => {
      const { app } = createApp();
      const res = await request(app).get("/api/games/game-1/locations");
      expect(res.status).toBe(401);
    });

    it("遊戲不存在時回傳 404", async () => {
      const { app } = createApp();
      mockStorage.getGame.mockResolvedValue(null);
      const res = await request(app).get("/api/games/game-1/locations").set(AUTH);
      expect(res.status).toBe(404);
    });

    it("成功取得地點列表", async () => {
      const { app } = createApp();
      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getLocations.mockResolvedValue([
        { id: 1, name: "地點A", latitude: "25.0", longitude: "121.5" },
        { id: 2, name: "地點B", latitude: "25.1", longitude: "121.6" },
      ]);

      const res = await request(app).get("/api/games/game-1/locations").set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("includeGpsMissions 會合併 GPS 任務頁面", async () => {
      const { app } = createApp();
      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getLocations.mockResolvedValue([]);
      mockStorage.getPages.mockResolvedValue([
        {
          pageType: "gps_mission",
          config: {
            title: "GPS 任務",
            targetLocation: { lat: 25.0, lng: 121.5 },
            radius: 30,
          },
          pageOrder: 1,
        },
      ]);

      const res = await request(app)
        .get("/api/games/game-1/locations?includeGpsMissions=true")
        .set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================
  // GET /api/locations/:id
  // ===========================================
  describe("GET /api/locations/:id", () => {
    it("無效 ID 時回傳 400", async () => {
      const { app } = createApp();
      const res = await request(app).get("/api/locations/abc").set(AUTH);
      expect(res.status).toBe(400);
    });

    it("地點不存在時回傳 404", async () => {
      const { app } = createApp();
      mockStorage.getLocation.mockResolvedValue(null);
      const res = await request(app).get("/api/locations/999").set(AUTH);
      expect(res.status).toBe(404);
    });

    it("成功取得地點", async () => {
      const { app } = createApp();
      mockStorage.getLocation.mockResolvedValue({ id: 1, name: "地點A" });
      const res = await request(app).get("/api/locations/1").set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("地點A");
    });
  });

  // ===========================================
  // POST /api/games/:gameId/locations
  // ===========================================
  describe("POST /api/games/:gameId/locations", () => {
    it("權限不足時回傳 403", async () => {
      const { app } = createApp();
      mockCheckOwnership.mockResolvedValue({
        authorized: false,
        status: 403,
        message: "Permission denied",
      });
      const res = await request(app)
        .post("/api/games/game-1/locations")
        .set(AUTH)
        .send({ name: "新地點" });
      expect(res.status).toBe(403);
    });

    it("成功建立地點回傳 201", async () => {
      const { app } = createApp();
      mockStorage.createLocation.mockResolvedValue({
        id: 3,
        name: "新地點",
        gameId: "game-1",
      });

      const res = await request(app)
        .post("/api/games/game-1/locations")
        .set(AUTH)
        .send({ name: "新地點", latitude: "25.0", longitude: "121.5" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(3);
    });
  });

  // ===========================================
  // PATCH /api/locations/:id
  // ===========================================
  describe("PATCH /api/locations/:id", () => {
    it("地點不存在時回傳 404", async () => {
      const { app } = createApp();
      mockStorage.getLocation.mockResolvedValue(null);
      const res = await request(app)
        .patch("/api/locations/999")
        .set(AUTH)
        .send({ name: "更新" });
      expect(res.status).toBe(404);
    });

    it("成功更新地點", async () => {
      const { app } = createApp();
      mockStorage.getLocation.mockResolvedValue({
        id: 1,
        gameId: "game-1",
        name: "舊名",
      });
      mockStorage.updateLocation.mockResolvedValue({
        id: 1,
        name: "新名",
      });

      const res = await request(app)
        .patch("/api/locations/1")
        .set(AUTH)
        .send({ name: "新名" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("新名");
    });
  });

  // ===========================================
  // DELETE /api/locations/:id
  // ===========================================
  describe("DELETE /api/locations/:id", () => {
    it("地點不存在時回傳 404", async () => {
      const { app } = createApp();
      mockStorage.getLocation.mockResolvedValue(null);
      const res = await request(app).delete("/api/locations/999").set(AUTH);
      expect(res.status).toBe(404);
    });

    it("成功刪除地點回傳 204", async () => {
      const { app } = createApp();
      mockStorage.getLocation.mockResolvedValue({
        id: 1,
        gameId: "game-1",
      });
      mockStorage.deleteLocation.mockResolvedValue(undefined);

      const res = await request(app).delete("/api/locations/1").set(AUTH);
      expect(res.status).toBe(204);
    });
  });

  // ===========================================
  // POST /api/navigation/calculate
  // ===========================================
  describe("POST /api/navigation/calculate", () => {
    it("缺少座標參數時回傳 400", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/navigation/calculate")
        .set(AUTH)
        .send({ currentLat: 25.0 }); // 缺少其他座標
      expect(res.status).toBe(400);
    });

    it("成功計算導航資訊", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/navigation/calculate")
        .set(AUTH)
        .send({
          currentLat: 25.033,
          currentLng: 121.565,
          targetLat: 25.040,
          targetLng: 121.570,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("distance");
      expect(res.body).toHaveProperty("bearing");
      expect(res.body).toHaveProperty("direction");
      expect(res.body).toHaveProperty("estimatedTime");
      expect(typeof res.body.distance).toBe("number");
    });
  });

  // ===========================================
  // POST /api/navigation/check-proximity
  // ===========================================
  describe("POST /api/navigation/check-proximity", () => {
    it("缺少參數時回傳 400", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/navigation/check-proximity")
        .set(AUTH)
        .send({ locationId: "abc" }); // 非數字
      expect(res.status).toBe(400);
    });

    it("地點不存在時回傳 404", async () => {
      const { app } = createApp();
      mockStorage.getLocation.mockResolvedValue(null);
      const res = await request(app)
        .post("/api/navigation/check-proximity")
        .set(AUTH)
        .send({ locationId: "999", playerLat: 25.0, playerLng: 121.5 });
      expect(res.status).toBe(404);
    });

    it("在範圍內時 isWithinRange 為 true", async () => {
      const { app } = createApp();
      mockStorage.getLocation.mockResolvedValue({
        id: 1,
        name: "目標地點",
        latitude: "25.033",
        longitude: "121.565",
        radius: 100,
      });

      const res = await request(app)
        .post("/api/navigation/check-proximity")
        .set(AUTH)
        .send({
          locationId: "1",
          playerLat: 25.033,
          playerLng: 121.565,
        });

      expect(res.status).toBe(200);
      expect(res.body.isWithinRange).toBe(true);
      expect(res.body.locationName).toBe("目標地點");
    });

    it("在範圍外時 isWithinRange 為 false", async () => {
      const { app } = createApp();
      mockStorage.getLocation.mockResolvedValue({
        id: 1,
        name: "遠方地點",
        latitude: "26.0",
        longitude: "122.0",
        radius: 50,
      });

      const res = await request(app)
        .post("/api/navigation/check-proximity")
        .set(AUTH)
        .send({
          locationId: "1",
          playerLat: 25.0,
          playerLng: 121.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.isWithinRange).toBe(false);
    });
  });

  // ===========================================
  // POST /api/sessions/:sessionId/locations/:locationId/visit
  // ===========================================
  describe("POST /api/sessions/:sessionId/locations/:locationId/visit", () => {
    it("session 不存在時回傳 404", async () => {
      const { app } = createApp();
      mockStorage.getSession.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/sessions/s1/locations/1/visit")
        .set(AUTH)
        .send({});
      expect(res.status).toBe(404);
    });

    it("地點不存在時回傳 404", async () => {
      const { app } = createApp();
      mockStorage.getSession.mockResolvedValue({ id: "s1" });
      mockStorage.getLocation.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/sessions/s1/locations/1/visit")
        .set(AUTH)
        .send({});
      expect(res.status).toBe(404);
    });

    it("已訪問時回傳 400", async () => {
      const { app } = createApp();
      mockStorage.getSession.mockResolvedValue({ id: "s1" });
      mockStorage.getLocation.mockResolvedValue({ id: 1, points: 10 });
      mockStorage.hasVisitedLocation.mockResolvedValue(true);

      const res = await request(app)
        .post("/api/sessions/s1/locations/1/visit")
        .set(AUTH)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Location already visited");
    });

    it("成功記錄訪問並廣播", async () => {
      const { app, ctx } = createApp();
      mockStorage.getSession.mockResolvedValue({ id: "s1" });
      mockStorage.getLocation.mockResolvedValue({
        id: 1,
        name: "地點A",
        points: 15,
      });
      mockStorage.hasVisitedLocation.mockResolvedValue(false);
      mockStorage.createLocationVisit.mockResolvedValue({
        id: 1,
        locationId: 1,
        completed: true,
      });
      mockStorage.getPlayerProgress.mockResolvedValue([
        { id: "p1", userId: "user-1", score: 100 },
      ]);
      mockStorage.updatePlayerProgress.mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/sessions/s1/locations/1/visit")
        .set(AUTH)
        .send({});

      expect(res.status).toBe(201);
      expect(ctx.broadcastToSession).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({
          type: "location_visited",
          pointsEarned: 15,
        }),
      );
      // 確認分數有更新
      expect(mockStorage.updatePlayerProgress).toHaveBeenCalledWith("p1", {
        score: 115,
      });
    });
  });
});
