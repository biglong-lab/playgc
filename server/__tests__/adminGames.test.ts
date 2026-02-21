import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock db（vi.hoisted 確保 hoisted vi.mock 可存取）
const { mockDb } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockWhere = vi.fn();
  const mockDelete = vi.fn();

  // select 鏈式操作（用於配額檢查等）
  const mockSelectLimit = vi.fn().mockResolvedValue([{ settings: {} }]);
  const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockSelectLimit });
  const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

  // 鏈式操作
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ returning: mockReturning });
  mockDelete.mockReturnValue({ where: vi.fn() });

  return {
    mockDb: {
      query: {
        games: { findMany: vi.fn(), findFirst: vi.fn() },
      },
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      select: mockSelect,
      _chain: { values: mockValues, returning: mockReturning, set: mockSet, where: mockWhere },
      _selectChain: { from: mockSelectFrom, where: mockSelectWhere, limit: mockSelectLimit },
    },
  };
});

vi.mock("../db", () => ({ db: mockDb }));

// Mock adminAuth - 透過 middleware 注入 req.admin
vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers["x-admin-id"]) {
      req.admin = {
        id: req.headers["x-admin-id"],
        fieldId: req.headers["x-field-id"] || "field-1",
        systemRole: req.headers["x-system-role"] || "field_admin",
        permissions: ["game:view", "game:create", "game:edit", "game:delete", "game:publish", "qr:generate", "qr:view"],
      };
      return next();
    }
    return _res.status(401).json({ message: "未認證" });
  }),
  requirePermission: vi.fn((..._perms: string[]) => (req: any, _res: any, next: any) => {
    if (!req.admin) return _res.status(401).json({ message: "未認證" });
    return next();
  }),
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

// Mock 相依模組
vi.mock("../qrCodeService", () => ({
  generateGameQRCode: vi.fn().mockResolvedValue("data:image/png;base64,mock-qr"),
  generateGameUrl: vi.fn((slug: string) => `https://example.com/g/${slug}`),
  generateSlug: vi.fn().mockReturnValue("ABC123"),
}));

vi.mock("../objectStorage", () => ({
  ObjectStorageService: vi.fn(() => ({
    getObjectEntityUploadURL: vi.fn().mockResolvedValue("https://storage.example.com/upload?token=xyz"),
    normalizeObjectEntityPath: vi.fn().mockReturnValue("/objects/uploads/mock-uuid"),
    trySetObjectEntityAclPolicy: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("@shared/schema", () => ({
  insertGameSchema: {
    parse: vi.fn((data: Record<string, unknown>) => data),
  },
  getTemplateById: vi.fn().mockReturnValue(null),
  pages: { id: "pages.id", gameId: "pages.gameId", pageOrder: "pages.pageOrder" },
  games: { id: "games.id", fieldId: "games.fieldId", createdAt: "games.createdAt" },
  fields: { id: "fields.id", settings: "fields.settings" },
  parseFieldSettings: vi.fn().mockReturnValue({}),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: string, b: string) => ({ op: "eq", a, b })),
  desc: vi.fn((col: string) => ({ op: "desc", col })),
  count: vi.fn().mockReturnValue("count(*)"),
}));

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    default: actual,
    randomUUID: vi.fn().mockReturnValue("mock-uuid-1234"),
  };
});

import { registerAdminGameRoutes } from "../routes/admin-games";

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminGameRoutes(app);
  return app;
}

// 共用 header 設定
const adminHeaders = {
  "x-admin-id": "admin-1",
  "x-field-id": "field-1",
  "x-system-role": "field_admin",
};

const superAdminHeaders = {
  "x-admin-id": "admin-super",
  "x-field-id": "field-1",
  "x-system-role": "super_admin",
};

describe("Admin Games 路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重設鏈式 mock
    mockDb.insert.mockReturnValue({ values: mockDb._chain.values });
    mockDb._chain.values.mockReturnValue({ returning: mockDb._chain.returning });
    mockDb.update.mockReturnValue({ set: mockDb._chain.set });
    mockDb._chain.set.mockReturnValue({ where: mockDb._chain.where });
    mockDb._chain.where.mockReturnValue({ returning: mockDb._chain.returning });
    mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  });

  describe("GET /api/admin/games", () => {
    it("未認證應回 401", async () => {
      const app = createApp();
      const res = await request(app).get("/api/admin/games");
      expect(res.status).toBe(401);
    });

    it("成功回傳遊戲列表", async () => {
      const app = createApp();
      const mockGames = [
        { id: "g1", title: "遊戲一", fieldId: "field-1" },
        { id: "g2", title: "遊戲二", fieldId: "field-1" },
      ];
      mockDb.query.games.findMany.mockResolvedValueOnce(mockGames);

      const res = await request(app)
        .get("/api/admin/games")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe("GET /api/admin/games/:id", () => {
    it("遊戲不存在應回 404", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/admin/games/non-exist")
        .set(adminHeaders);

      expect(res.status).toBe(404);
    });

    it("非同場域應回 403", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce({
        id: "g1", title: "遊戲", fieldId: "other-field",
      });

      const res = await request(app)
        .get("/api/admin/games/g1")
        .set(adminHeaders);

      expect(res.status).toBe(403);
    });

    it("super_admin 可跨場域存取", async () => {
      const app = createApp();
      const game = { id: "g1", title: "遊戲", fieldId: "other-field" };
      mockDb.query.games.findFirst.mockResolvedValueOnce(game);

      const res = await request(app)
        .get("/api/admin/games/g1")
        .set(superAdminHeaders);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("遊戲");
    });

    it("同場域應成功回傳", async () => {
      const app = createApp();
      const game = { id: "g1", title: "遊戲", fieldId: "field-1" };
      mockDb.query.games.findFirst.mockResolvedValueOnce(game);

      const res = await request(app)
        .get("/api/admin/games/g1")
        .set(adminHeaders);

      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/admin/games", () => {
    it("成功建立遊戲應回 201", async () => {
      const app = createApp();
      const createdGame = { id: "g-new", title: "新遊戲", fieldId: "field-1", publicSlug: "ABC123" };
      mockDb._chain.returning.mockResolvedValueOnce([createdGame]);

      const res = await request(app)
        .post("/api/admin/games")
        .set(adminHeaders)
        .send({ title: "新遊戲", difficulty: "medium" });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("新遊戲");
      expect(res.body.qrCodeUrl).toBe("data:image/png;base64,mock-qr");
    });

    it("缺少必要欄位應回 400", async () => {
      const app = createApp();
      // 讓 insertGameSchema.parse 拋出 ZodError
      const { insertGameSchema } = await import("@shared/schema");
      const { z } = await import("zod");
      (insertGameSchema.parse as any).mockImplementationOnce(() => {
        throw new z.ZodError([{ code: "custom", message: "title required", path: ["title"] }]);
      });

      const res = await request(app)
        .post("/api/admin/games")
        .set(adminHeaders)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("格式錯誤");
    });
  });

  describe("PATCH /api/admin/games/:id", () => {
    it("遊戲不存在應回 404", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch("/api/admin/games/non-exist")
        .set(adminHeaders)
        .send({ title: "更新" });

      expect(res.status).toBe(404);
    });

    it("非同場域應回 403", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce({
        id: "g1", title: "遊戲", fieldId: "other-field",
      });

      const res = await request(app)
        .patch("/api/admin/games/g1")
        .set(adminHeaders)
        .send({ title: "更新" });

      expect(res.status).toBe(403);
    });

    it("成功更新遊戲", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce({
        id: "g1", title: "舊標題", fieldId: "field-1",
      });
      const updated = { id: "g1", title: "新標題", fieldId: "field-1" };
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      const res = await request(app)
        .patch("/api/admin/games/g1")
        .set(adminHeaders)
        .send({ title: "新標題" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("新標題");
    });
  });

  describe("DELETE /api/admin/games/:id", () => {
    it("遊戲不存在應回 404", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete("/api/admin/games/non-exist")
        .set(adminHeaders);

      expect(res.status).toBe(404);
    });

    it("非同場域應回 403", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce({
        id: "g1", fieldId: "other-field", title: "遊戲",
      });

      const res = await request(app)
        .delete("/api/admin/games/g1")
        .set(adminHeaders);

      expect(res.status).toBe(403);
    });

    it("成功刪除遊戲", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce({
        id: "g1", fieldId: "field-1", title: "遊戲",
      });

      const res = await request(app)
        .delete("/api/admin/games/g1")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /api/admin/games/:id/publish", () => {
    it("遊戲不存在應回 404", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/admin/games/non-exist/publish")
        .set(adminHeaders)
        .send({ status: "published" });

      expect(res.status).toBe(404);
    });

    it("成功發布遊戲", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce({
        id: "g1", fieldId: "field-1", title: "遊戲",
      });
      mockDb._chain.returning.mockResolvedValueOnce([{
        id: "g1", status: "published", title: "遊戲",
      }]);

      const res = await request(app)
        .post("/api/admin/games/g1/publish")
        .set(adminHeaders)
        .send({ status: "published" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("published");
    });
  });

  describe("POST /api/admin/games/:id/qrcode", () => {
    it("遊戲不存在應回 404", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/admin/games/non-exist/qrcode")
        .set(adminHeaders)
        .send({});

      expect(res.status).toBe(404);
    });

    it("成功產生 QR Code", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce({
        id: "g1", fieldId: "field-1", publicSlug: null, title: "遊戲",
      });

      const res = await request(app)
        .post("/api/admin/games/g1/qrcode")
        .set(adminHeaders)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe("ABC123");
      expect(res.body.qrCodeUrl).toContain("data:image/png");
    });

    it("regenerateSlug 應重新產生 slug", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce({
        id: "g1", fieldId: "field-1", publicSlug: "OLD-SLUG", title: "遊戲",
      });

      const res = await request(app)
        .post("/api/admin/games/g1/qrcode")
        .set(adminHeaders)
        .send({ regenerateSlug: true });

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe("ABC123");
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/games/:id/qrcode", () => {
    it("遊戲不存在應回 404", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .get("/api/admin/games/non-exist/qrcode")
        .set(adminHeaders);

      expect(res.status).toBe(404);
    });

    it("尚未產生 QR Code 應回 404", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce({
        id: "g1", fieldId: "field-1", publicSlug: null, qrCodeUrl: null,
      });

      const res = await request(app)
        .get("/api/admin/games/g1/qrcode")
        .set(adminHeaders);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("尚未產生");
    });

    it("成功回傳 QR Code 資訊", async () => {
      const app = createApp();
      mockDb.query.games.findFirst.mockResolvedValueOnce({
        id: "g1", fieldId: "field-1", publicSlug: "ABC123", qrCodeUrl: "data:image/png;base64,qr",
      });

      const res = await request(app)
        .get("/api/admin/games/g1/qrcode")
        .set(adminHeaders);

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe("ABC123");
      expect(res.body.gameUrl).toContain("ABC123");
    });
  });
});
