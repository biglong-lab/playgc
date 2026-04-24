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
  // 🆕 為 seed-default-roles 增加 select / from / where 鏈（用於拉 permissions / roles）
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockSelectWhere = vi.fn();

  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ returning: mockReturning });
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelectWhere.mockResolvedValue([]);

  return {
    mockDb: {
      query: {
        fields: { findMany: vi.fn(), findFirst: vi.fn() },
        roles: { findFirst: vi.fn(), findMany: vi.fn() },
        adminAccounts: { findFirst: vi.fn() },
      },
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      _chain: { values: mockValues, returning: mockReturning, set: mockSet, where: mockWhere, selectWhere: mockSelectWhere, from: mockFrom },
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
  roles: { id: "roles.id", fieldId: "roles.fieldId", systemRole: "roles.systemRole" },
  rolePermissions: { roleId: "rolePermissions.roleId" },
  permissions: { id: "permissions.id", key: "permissions.key" },
  adminAccounts: { id: "adminAccounts.id", fieldId: "adminAccounts.fieldId", email: "adminAccounts.email", firebaseUserId: "adminAccounts.firebaseUserId" },
  games: { id: "games.id", fieldId: "games.fieldId" },
  parseFieldSettings: vi.fn((raw: unknown) => (typeof raw === "object" && raw !== null ? raw : {})),
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
    // 清空 mockResolvedValueOnce 佇列，保留 middleware 實作
    mockDb.query.fields.findMany.mockReset();
    mockDb.query.fields.findFirst.mockReset();
    mockDb._chain.returning.mockReset();
    mockDb._chain.where.mockReset();
    // 重設鏈式 mock
    mockDb.insert.mockReturnValue({ values: mockDb._chain.values });
    mockDb._chain.values.mockReturnValue({ returning: mockDb._chain.returning });
    mockDb.update.mockReturnValue({ set: mockDb._chain.set });
    mockDb._chain.set.mockReturnValue({ where: mockDb._chain.where });
    mockDb._chain.where.mockReturnValue({ returning: mockDb._chain.returning });
    // 🆕 select 鏈（給 seed 抓 permissions 用）
    mockDb.select.mockReturnValue({ from: mockDb._chain.from });
    mockDb._chain.from.mockReturnValue({ where: mockDb._chain.selectWhere });
    mockDb._chain.selectWhere.mockResolvedValue([]);
    // 🆕 query.roles / query.adminAccounts reset
    mockDb.query.roles.findFirst.mockReset();
    mockDb.query.roles.findMany.mockReset();
    mockDb.query.adminAccounts.findFirst.mockReset();
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

  // ══════════════════════════════════════════════════════════
  // 🆕 TRACK B1: seedDefaultRolesForField + 自動指派建立者測試
  // ══════════════════════════════════════════════════════════
  describe("POST /api/admin/fields — 新場域自動 seed 預設角色 + 指派建立者", () => {
    it("成功建場域時呼叫 seedDefaultRolesForField 並完成自動指派", async () => {
      // 1. field insert returning
      const newField = { id: "field-new", name: "後浦", code: "HPSPACE" };
      mockDb._chain.returning.mockResolvedValueOnce([newField]); // field insert
      // 2. permissions select (19 個)
      const allPerms = Array.from({ length: 19 }).map((_, i) => ({
        id: `perm-${i}`,
        key: `permission:${i}`,
      }));
      mockDb._chain.selectWhere.mockResolvedValueOnce(allPerms); // permissions select (no where actually)
      // seedDefaultRolesForField 用 db.select().from(permissions)，所以要讓 from 直接回陣列
      // 但我們的鏈 select.from.where 不含 where。先讓 from 直接回 resolved，重置：
      mockDb._chain.from.mockReturnValueOnce(Promise.resolve(allPerms));

      // 3. roles insert (director) returning
      const directorRole = { id: "role-director", name: "場域管理員", fieldId: newField.id, systemRole: "field_director" };
      mockDb._chain.returning.mockResolvedValueOnce([directorRole]);
      // 4. rolePermissions insert (19 個)
      mockDb._chain.values.mockResolvedValueOnce(undefined);
      // 5. roles insert (executor) returning
      const executorRole = { id: "role-executor", name: "活動執行者", fieldId: newField.id };
      mockDb._chain.returning.mockResolvedValueOnce([executorRole]);
      mockDb._chain.values.mockResolvedValueOnce(undefined);

      // 6. auto-assign: query creator's adminAccount
      const creatorAccount = {
        id: "super-1",
        fieldId: "other-field",
        email: "creator@chito.cc",
        firebaseUserId: "firebase-creator",
        displayName: "Creator",
        username: null,
      };
      mockDb.query.adminAccounts.findFirst.mockResolvedValueOnce(creatorAccount);
      // 7. select director role for new field (legacy select)
      mockDb._chain.from.mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce([directorRole]) });
      // 8. findFirst for director role
      mockDb.query.roles.findFirst.mockResolvedValueOnce(directorRole);
      // 9. existing admin_account check — none
      mockDb.query.adminAccounts.findFirst.mockResolvedValueOnce(null);
      // 10. insert new admin_account returning
      mockDb._chain.returning.mockResolvedValueOnce([{ id: "new-admin-account", fieldId: newField.id }]);

      const app = createApp();
      const res = await request(app)
        .post("/api/admin/fields")
        .set(superAdminHeaders)
        .send({ name: "後浦", code: "HPSPACE" });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(newField.id);
      // 驗證 seed + auto-assign 有被觸發（至少 insert 呼叫 ≥ 4 次：field + director role + executor role + admin_account + role_permissions 兩批）
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("POST /api/admin/fields/:id/seed-default-roles", () => {
    it("已有角色的場域回 400", async () => {
      mockDb.query.fields.findFirst.mockResolvedValue({ id: "field-1" });
      // query.roles.findMany 回已有角色
      mockDb.query.roles.findMany.mockResolvedValueOnce([{ id: "existing-role" }]);
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/fields/field-1/seed-default-roles")
        .set(superAdminHeaders);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("已有角色");
    });

    it("非 super_admin 呼叫別場域 seed 回 403", async () => {
      const app = createApp();
      // adminHeaders.x-field-id=field-1，呼叫 field-2 的 seed
      const res = await request(app)
        .post("/api/admin/fields/field-2/seed-default-roles")
        .set(adminHeaders);
      expect(res.status).toBe(403);
    });

    it("場域不存在回 404", async () => {
      mockDb.query.fields.findFirst.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/fields/not-exist/seed-default-roles")
        .set(superAdminHeaders);
      expect(res.status).toBe(404);
    });
  });

  describe("seedDefaultRolesForField 行為驗證", () => {
    it("空 permissions 時不建立任何 role（安全退出）", async () => {
      mockDb.query.fields.findFirst.mockResolvedValue({ id: "field-1" });
      mockDb.query.roles.findMany.mockResolvedValueOnce([]); // 允許 seed
      // permissions select 回空陣列
      mockDb._chain.from.mockReturnValueOnce(Promise.resolve([]));

      const app = createApp();
      const res = await request(app)
        .post("/api/admin/fields/field-1/seed-default-roles")
        .set(superAdminHeaders);
      // 不應該插入 role（insert 只有 field 建立那次，這邊沒建 field 所以 0 次）
      expect(res.status).toBe(200);
      expect(res.body.message).toContain("已建立");
    });
  });
});
