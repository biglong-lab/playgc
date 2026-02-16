import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// vi.hoisted 確保 mock 變數在 vi.mock hoisting 後仍可存取
const { mockDb, mockStorage, mockCloudinary } = vi.hoisted(() => {
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockWhere = vi.fn();
  const mockReturning = vi.fn();

  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ returning: mockReturning });

  return {
    mockDb: {
      query: {
        games: { findFirst: vi.fn() },
      },
      update: mockUpdate,
      _chain: { set: mockSet, where: mockWhere, returning: mockReturning },
    },
    mockStorage: {
      getGame: vi.fn(),
    },
    mockCloudinary: {
      getStatus: vi.fn(),
      uploadGamePhoto: vi.fn(),
      uploadGameCover: vi.fn(),
      uploadPlayerPhoto: vi.fn(),
      uploadGameMedia: vi.fn(),
    },
  };
});

vi.mock("../db", () => ({ db: mockDb }));
vi.mock("../storage", () => ({ storage: mockStorage }));
vi.mock("../cloudinary", () => ({ cloudinaryService: mockCloudinary }));

// Mock firebaseAuth
vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      (req as any).user = { id: "user-1" };
      return next();
    }
    return _res.status(401).json({ message: "未認證" });
  }),
}));

// Mock adminAuth
vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers["x-admin-id"]) {
      req.admin = {
        id: req.headers["x-admin-id"],
        fieldId: req.headers["x-field-id"] || "field-1",
        systemRole: req.headers["x-system-role"] || "field_admin",
        permissions: ["game:edit"],
      };
      return next();
    }
    return _res.status(401).json({ message: "未認證" });
  }),
  requirePermission: vi.fn((..._perms: string[]) => (req: any, _res: any, next: any) => {
    if (!req.admin) return _res.status(401).json({ message: "未認證" });
    return next();
  }),
}));

vi.mock("@shared/schema", () => ({
  games: { id: "games.id" },
}));

import { registerMediaRoutes } from "../routes/media";

function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  registerMediaRoutes(app);
  return app;
}

const playerHeaders = { authorization: "Bearer valid-token" };
const adminHeaders = {
  "x-admin-id": "admin-1",
  "x-field-id": "field-1",
  "x-system-role": "field_admin",
};

describe("media 路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/cloudinary/status", () => {
    it("成功取得 Cloudinary 狀態", async () => {
      mockCloudinary.getStatus.mockReturnValue({ configured: true, cloudName: "test-cloud" });
      const app = createApp();
      const res = await request(app).get("/api/cloudinary/status").set(adminHeaders);
      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
    });

    it("未認證回傳 401", async () => {
      const app = createApp();
      const res = await request(app).get("/api/cloudinary/status");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/cloudinary/upload", () => {
    it("成功上傳遊戲照片", async () => {
      mockStorage.getGame.mockResolvedValue({ id: "game-1", title: "測試遊戲" });
      mockCloudinary.uploadGamePhoto.mockResolvedValue({
        secure_url: "https://cloudinary.com/photo.jpg",
        public_id: "game-photos/test",
        width: 800,
        height: 600,
      });
      const app = createApp();
      const res = await request(app)
        .post("/api/cloudinary/upload")
        .set(playerHeaders)
        .send({ imageData: "data:image/jpeg;base64,abc123", gameId: "game-1" });
      expect(res.status).toBe(201);
      expect(res.body.url).toContain("cloudinary.com");
    });

    it("缺少圖片資料回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/cloudinary/upload")
        .set(playerHeaders)
        .send({ gameId: "game-1" });
      expect(res.status).toBe(400);
    });

    it("無效圖片格式回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/cloudinary/upload")
        .set(playerHeaders)
        .send({ imageData: "not-an-image", gameId: "game-1" });
      expect(res.status).toBe(400);
    });

    it("遊戲不存在回傳 404", async () => {
      mockStorage.getGame.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app)
        .post("/api/cloudinary/upload")
        .set(playerHeaders)
        .send({ imageData: "data:image/jpeg;base64,abc123", gameId: "no-game" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/admin/games/:id/cloudinary-cover", () => {
    it("成功上傳封面圖片", async () => {
      mockDb.query.games.findFirst.mockResolvedValue({ id: "game-1", fieldId: "field-1" });
      mockCloudinary.uploadGameCover.mockResolvedValue({ secure_url: "https://cloudinary.com/cover.jpg" });
      mockDb._chain.returning.mockResolvedValue([{ id: "game-1", coverImageUrl: "https://cloudinary.com/cover.jpg" }]);
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/games/game-1/cloudinary-cover")
        .set(adminHeaders)
        .send({ imageData: "data:image/png;base64,abc" });
      expect(res.status).toBe(200);
      expect(res.body.coverImageUrl).toContain("cloudinary.com");
    });

    it("遊戲不存在回傳 404", async () => {
      mockDb.query.games.findFirst.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/games/no-game/cloudinary-cover")
        .set(adminHeaders)
        .send({ imageData: "data:image/png;base64,abc" });
      expect(res.status).toBe(404);
    });

    it("跨場域回傳 403", async () => {
      mockDb.query.games.findFirst.mockResolvedValue({ id: "game-1", fieldId: "field-2" });
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/games/game-1/cloudinary-cover")
        .set(adminHeaders)
        .send({ imageData: "data:image/png;base64,abc" });
      expect(res.status).toBe(403);
    });

    it("Zod 驗證失敗回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/games/game-1/cloudinary-cover")
        .set(adminHeaders)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/cloudinary/player-photo", () => {
    it("成功上傳玩家照片", async () => {
      mockCloudinary.uploadPlayerPhoto.mockResolvedValue({
        secure_url: "https://cloudinary.com/player.jpg",
        public_id: "player-photos/test",
      });
      const app = createApp();
      const res = await request(app)
        .post("/api/cloudinary/player-photo")
        .set(playerHeaders)
        .send({ imageData: "data:image/jpeg;base64,abc", gameId: "game-1", sessionId: "session-1" });
      expect(res.status).toBe(201);
      expect(res.body.url).toContain("cloudinary.com");
    });

    it("缺少必要欄位回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/cloudinary/player-photo")
        .set(playerHeaders)
        .send({ imageData: "data:image/jpeg;base64,abc" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/admin/games/:id/cloudinary-media", () => {
    it("成功上傳媒體檔案", async () => {
      mockDb.query.games.findFirst.mockResolvedValue({ id: "game-1", fieldId: "field-1" });
      mockCloudinary.uploadGameMedia.mockResolvedValue({
        secure_url: "https://cloudinary.com/video.mp4",
        public_id: "game-media/test",
        resource_type: "video",
        duration: 120,
      });
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/games/game-1/cloudinary-media")
        .set(adminHeaders)
        .send({ mediaData: "data:video/mp4;base64,abc", mediaType: "video", gameId: "game-1" });
      expect(res.status).toBe(200);
      expect(res.body.url).toContain("cloudinary.com");
    });

    it("遊戲不存在回傳 404", async () => {
      mockDb.query.games.findFirst.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/games/no-game/cloudinary-media")
        .set(adminHeaders)
        .send({ mediaData: "data:image/png;base64,abc", mediaType: "image", gameId: "no-game" });
      expect(res.status).toBe(404);
    });

    it("跨場域回傳 403", async () => {
      mockDb.query.games.findFirst.mockResolvedValue({ id: "game-1", fieldId: "field-2" });
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/games/game-1/cloudinary-media")
        .set(adminHeaders)
        .send({ mediaData: "data:image/png;base64,abc", mediaType: "image", gameId: "game-1" });
      expect(res.status).toBe(403);
    });

    it("無效 mediaType 回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/games/game-1/cloudinary-media")
        .set(adminHeaders)
        .send({ mediaData: "data:image/png;base64,abc", mediaType: "pdf", gameId: "game-1" });
      expect(res.status).toBe(400);
    });
  });
});
