import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock db
const { mockDb } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockWhere = vi.fn();

  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ returning: mockReturning });

  return {
    mockDb: {
      query: {
        fields: { findMany: vi.fn(), findFirst: vi.fn() },
      },
      insert: mockInsert,
      update: mockUpdate,
      _chain: { values: mockValues, returning: mockReturning, set: mockSet, where: mockWhere },
    },
  };
});

vi.mock("../db", () => ({ db: mockDb }));

vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers["x-admin-id"]) {
      req.admin = {
        id: req.headers["x-admin-id"],
        fieldId: req.headers["x-field-id"] || "field-1",
        systemRole: req.headers["x-system-role"] || "field_admin",
        permissions: ["field:manage"],
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

vi.mock("@shared/schema", () => ({
  fields: { id: "fields.id", code: "fields.code", createdAt: "fields.createdAt" },
  insertFieldSchema: {
    parse: vi.fn((data: Record<string, unknown>) => data),
    partial: vi.fn(() => ({
      parse: vi.fn((data: Record<string, unknown>) => data),
    })),
  },
}));

import { registerAdminFieldRoutes } from "../routes/admin-fields";
import { insertFieldSchema } from "@shared/schema";

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminFieldRoutes(app);
  return app;
}

const adminHeaders = {
  "x-admin-id": "admin-1",
  "x-field-id": "field-1",
  "x-system-role": "field_admin",
};

const superAdminHeaders = {
  "x-admin-id": "super-1",
  "x-field-id": "field-1",
  "x-system-role": "super_admin",
};

describe("admin-fields 路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重設 insertFieldSchema mock
    (insertFieldSchema.parse as ReturnType<typeof vi.fn>).mockImplementation((data: Record<string, unknown>) => data);
    (insertFieldSchema.partial as ReturnType<typeof vi.fn>).mockReturnValue({
      parse: vi.fn((data: Record<string, unknown>) => data),
    });
  });

  describe("GET /api/admin/fields", () => {
    it("未認證應回傳 401", async () => {
      const app = createApp();
      const res = await request(app).get("/api/admin/fields");
      expect(res.status).toBe(401);
    });

    it("super_admin 取得所有場域", async () => {
      const allFields = [
        { id: "field-1", name: "場域一", code: "F001" },
        { id: "field-2", name: "場域二", code: "F002" },
      ];
      mockDb.query.fields.findMany.mockResolvedValue(allFields);
      const app = createApp();
      const res = await request(app).get("/api/admin/fields").set(superAdminHeaders);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("一般管理員只取得自己的場域", async () => {
      const myField = { id: "field-1", name: "我的場域", code: "F001" };
      mockDb.query.fields.findFirst.mockResolvedValue(myField);
      const app = createApp();
      const res = await request(app).get("/api/admin/fields").set(adminHeaders);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("我的場域");
    });

    it("場域不存在時回傳空陣列", async () => {
      mockDb.query.fields.findFirst.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app).get("/api/admin/fields").set(adminHeaders);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("POST /api/admin/fields", () => {
    it("成功建立場域", async () => {
      const newField = { id: "field-new", name: "新場域", code: "NEWF" };
      mockDb._chain.returning.mockResolvedValue([newField]);
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/fields")
        .set(superAdminHeaders)
        .send({ name: "新場域", code: "newf" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("新場域");
    });

    it("Zod 驗證失敗回傳 400", async () => {
      const { z } = await import("zod");
      (insertFieldSchema.parse as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new z.ZodError([{ code: "invalid_type", expected: "string", received: "undefined", path: ["name"], message: "必填" }]);
      });
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/fields")
        .set(superAdminHeaders)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid");
    });
  });

  describe("PATCH /api/admin/fields/:id", () => {
    it("成功更新場域", async () => {
      const existingField = { id: "field-1", name: "舊名稱", code: "F001", codeLastChangedAt: null };
      mockDb.query.fields.findFirst.mockResolvedValue(existingField);
      const updatedField = { id: "field-1", name: "新名稱", code: "F001" };
      mockDb._chain.returning.mockResolvedValue([updatedField]);
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/fields/field-1")
        .set(adminHeaders)
        .send({ name: "新名稱" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("新名稱");
    });

    it("場域不存在回傳 404（super_admin）", async () => {
      mockDb.query.fields.findFirst.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/fields/not-exist")
        .set(superAdminHeaders)
        .send({ name: "test" });
      expect(res.status).toBe(404);
    });

    it("非 super_admin 修改其他場域回傳 403", async () => {
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/fields/field-2")
        .set(adminHeaders)
        .send({ name: "改別人的" });
      expect(res.status).toBe(403);
    });

    it("super_admin 可修改任何場域", async () => {
      const existingField = { id: "field-2", name: "其他場域", code: "F002", codeLastChangedAt: null };
      mockDb.query.fields.findFirst.mockResolvedValue(existingField);
      const updatedField = { id: "field-2", name: "已更新", code: "F002" };
      mockDb._chain.returning.mockResolvedValue([updatedField]);
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/fields/field-2")
        .set(superAdminHeaders)
        .send({ name: "已更新" });
      expect(res.status).toBe(200);
    });

    it("場域編號重複回傳 400", async () => {
      const existingField = { id: "field-1", name: "場域一", code: "F001", codeLastChangedAt: null };
      mockDb.query.fields.findFirst
        .mockResolvedValueOnce(existingField)
        .mockResolvedValueOnce({ id: "field-2", code: "F002" });
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/fields/field-1")
        .set(superAdminHeaders)
        .send({ code: "f002" });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("已被使用");
    });

    it("6 個月內變更過編號的場域，非 super_admin 不可再變更", async () => {
      const recentChange = new Date();
      recentChange.setMonth(recentChange.getMonth() - 1);
      const existingField = { id: "field-1", name: "場域一", code: "F001", codeLastChangedAt: recentChange };
      mockDb.query.fields.findFirst.mockResolvedValue(existingField);
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/fields/field-1")
        .set(adminHeaders)
        .send({ code: "NEW1" });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("六個月");
    });
  });
});
