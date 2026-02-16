import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// vi.hoisted 確保 mock 變數在 vi.mock hoisting 後仍可存取
const { mockDb, mockQrService } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();

  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });

  return {
    mockDb: {
      insert: mockInsert,
      _chain: { values: mockValues, returning: mockReturning },
    },
    mockQrService: {
      generateGameQRCode: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
      generateSlug: vi.fn().mockReturnValue("test-slug"),
    },
  };
});

vi.mock("../db", () => ({ db: mockDb }));

vi.mock("../qrCodeService", () => ({
  generateGameQRCode: mockQrService.generateGameQRCode,
  generateSlug: mockQrService.generateSlug,
}));

// Mock adminAuth
vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers["x-admin-id"]) {
      req.admin = {
        id: req.headers["x-admin-id"],
        fieldId: req.headers["x-field-id"] || "field-1",
        systemRole: req.headers["x-system-role"] || "field_admin",
        permissions: ["game:create"],
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

// Mock schema - 只需要 games 和 pages table references, 以及模組函式
vi.mock("@shared/schema", async () => {
  const actual = await vi.importActual("@shared/schema") as Record<string, unknown>;
  return {
    ...actual,
    games: { id: "games.id" },
    pages: { id: "pages.id" },
    insertGameSchema: {
      parse: vi.fn((data: Record<string, unknown>) => data),
    },
  };
});

import { registerAdminModuleRoutes } from "../routes/admin-modules";
import { GAME_MODULES } from "@shared/schema";

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminModuleRoutes(app);
  return app;
}

const adminHeaders = {
  "x-admin-id": "admin-1",
  "x-field-id": "field-1",
  "x-system-role": "field_admin",
};

describe("admin-modules 路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/modules", () => {
    it("未認證應回傳 401", async () => {
      const app = createApp();
      const res = await request(app).get("/api/admin/modules");
      expect(res.status).toBe(401);
    });

    it("成功取得所有模組", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/admin/modules")
        .set(adminHeaders);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(GAME_MODULES.length);
    });

    it("每個模組都有必要欄位", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/admin/modules")
        .set(adminHeaders);
      for (const mod of res.body) {
        expect(mod).toHaveProperty("id");
        expect(mod).toHaveProperty("name");
        expect(mod).toHaveProperty("category");
        expect(mod).toHaveProperty("pages");
        expect(mod).toHaveProperty("highlights");
        expect(mod).toHaveProperty("flowDescription");
      }
    });
  });

  describe("GET /api/admin/modules/:id", () => {
    it("成功取得單一模組", async () => {
      const app = createApp();
      const res = await request(app)
        .get(`/api/admin/modules/${GAME_MODULES[0].id}`)
        .set(adminHeaders);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(GAME_MODULES[0].id);
      expect(res.body.name).toBe(GAME_MODULES[0].name);
    });

    it("模組不存在回傳 404", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/admin/modules/non-existent-module")
        .set(adminHeaders);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/admin/modules/:id/create-game", () => {
    it("成功從模組建立遊戲", async () => {
      const newGame = {
        id: "game-new",
        title: "我的新遊戲",
        publicSlug: "test-slug",
      };
      // 第一次 returning 是 games insert
      mockDb._chain.returning
        .mockResolvedValueOnce([newGame])
        // 後續的 pages insert 不需要 returning
        ;

      const app = createApp();
      const res = await request(app)
        .post(`/api/admin/modules/${GAME_MODULES[0].id}/create-game`)
        .set(adminHeaders)
        .send({ title: "我的新遊戲" });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe("我的新遊戲");
    });

    it("模組不存在回傳 404", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/modules/non-existent/create-game")
        .set(adminHeaders)
        .send({ title: "測試" });
      expect(res.status).toBe(404);
    });

    it("缺少遊戲名稱回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post(`/api/admin/modules/${GAME_MODULES[0].id}/create-game`)
        .set(adminHeaders)
        .send({});
      expect(res.status).toBe(400);
    });

    it("空白遊戲名稱回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post(`/api/admin/modules/${GAME_MODULES[0].id}/create-game`)
        .set(adminHeaders)
        .send({ title: "" });
      expect(res.status).toBe(400);
    });

    it("未認證回傳 401", async () => {
      const app = createApp();
      const res = await request(app)
        .post(`/api/admin/modules/${GAME_MODULES[0].id}/create-game`)
        .send({ title: "測試" });
      expect(res.status).toBe(401);
    });
  });
});
