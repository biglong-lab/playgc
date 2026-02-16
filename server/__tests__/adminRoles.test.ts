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
        roles: { findMany: vi.fn(), findFirst: vi.fn() },
        permissions: { findMany: vi.fn() },
        adminAccounts: { findMany: vi.fn(), findFirst: vi.fn() },
        auditLogs: { findMany: vi.fn() },
        users: { findMany: vi.fn() },
      },
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      _chain: { values: mockValues, returning: mockReturning, set: mockSet, where: mockWhere },
    },
  };
});

vi.mock("../db", () => ({ db: mockDb }));

// Mock adminAuth
vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers["x-admin-id"]) {
      req.admin = {
        id: req.headers["x-admin-id"],
        fieldId: req.headers["x-field-id"] || "field-1",
        systemRole: req.headers["x-system-role"] || "field_admin",
        permissions: [
          "user:manage_roles", "admin:manage_accounts",
          "admin:view_audit", "user:view",
        ],
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
  createAdminAccount: vi.fn(),
  updateAdminPassword: vi.fn().mockResolvedValue(undefined),
}));

// Mock schema
vi.mock("@shared/schema", () => ({
  roles: { id: "roles.id", fieldId: "roles.fieldId", createdAt: "roles.createdAt" },
  permissions: { category: "permissions.category", key: "permissions.key" },
  rolePermissions: { roleId: "rolePermissions.roleId" },
  adminAccounts: { id: "adminAccounts.id", fieldId: "adminAccounts.fieldId", createdAt: "adminAccounts.createdAt" },
  auditLogs: { fieldId: "auditLogs.fieldId", createdAt: "auditLogs.createdAt" },
  users: { createdAt: "users.createdAt" },
}));

import { registerAdminRoleRoutes } from "../routes/admin-roles";
import { createAdminAccount } from "../adminAuth";

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminRoleRoutes(app);
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

describe("admin-roles 路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // 角色管理
  // ============================

  describe("GET /api/admin/roles", () => {
    it("未認證應回傳 401", async () => {
      const app = createApp();
      const res = await request(app).get("/api/admin/roles");
      expect(res.status).toBe(401);
    });

    it("成功取得角色列表", async () => {
      const mockRoles = [
        { id: "role-1", name: "管理員", systemRole: "field_admin" },
        { id: "role-2", name: "編輯者", systemRole: "custom" },
      ];
      mockDb.query.roles.findMany.mockResolvedValue(mockRoles);
      const app = createApp();
      const res = await request(app).get("/api/admin/roles").set(adminHeaders);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRoles);
    });
  });

  describe("GET /api/admin/permissions", () => {
    it("成功取得權限列表", async () => {
      const mockPerms = [
        { id: "p-1", key: "game:view", category: "game" },
        { id: "p-2", key: "game:edit", category: "game" },
      ];
      mockDb.query.permissions.findMany.mockResolvedValue(mockPerms);
      const app = createApp();
      const res = await request(app).get("/api/admin/permissions").set(adminHeaders);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPerms);
    });
  });

  describe("POST /api/admin/roles", () => {
    it("成功建立角色", async () => {
      const newRole = { id: "role-new", name: "新角色", description: "測試", systemRole: "custom", fieldId: "field-1", isCustom: true };
      mockDb._chain.returning.mockResolvedValue([newRole]);
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/roles")
        .set(adminHeaders)
        .send({ name: "新角色", description: "測試", permissionIds: ["p-1"] });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("新角色");
    });

    it("建立角色不附帶權限", async () => {
      const newRole = { id: "role-new2", name: "基本角色", systemRole: "custom", isCustom: true };
      mockDb._chain.returning.mockResolvedValue([newRole]);
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/roles")
        .set(adminHeaders)
        .send({ name: "基本角色" });
      expect(res.status).toBe(201);
    });
  });

  describe("PATCH /api/admin/roles/:id", () => {
    it("成功更新角色", async () => {
      const updatedRole = { id: "role-1", name: "更新名稱", fieldId: "field-1" };
      mockDb._chain.returning.mockResolvedValue([updatedRole]);
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/roles/role-1")
        .set(adminHeaders)
        .send({ name: "更新名稱", permissionIds: ["p-1", "p-2"] });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("更新名稱");
    });

    it("角色不存在回傳 404", async () => {
      mockDb._chain.returning.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/roles/not-exist")
        .set(adminHeaders)
        .send({ name: "新名稱" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/admin/roles/:id", () => {
    it("成功刪除自訂角色", async () => {
      mockDb.query.roles.findFirst.mockResolvedValue({ id: "role-1", isCustom: true, fieldId: "field-1" });
      const app = createApp();
      const res = await request(app)
        .delete("/api/admin/roles/role-1")
        .set(adminHeaders);
      expect(res.status).toBe(204);
    });

    it("角色不存在回傳 404", async () => {
      mockDb.query.roles.findFirst.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app)
        .delete("/api/admin/roles/not-exist")
        .set(adminHeaders);
      expect(res.status).toBe(404);
    });

    it("系統角色無法刪除回傳 400", async () => {
      mockDb.query.roles.findFirst.mockResolvedValue({ id: "role-sys", isCustom: false });
      const app = createApp();
      const res = await request(app)
        .delete("/api/admin/roles/role-sys")
        .set(adminHeaders);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("系統角色");
    });
  });

  // ============================
  // 管理員帳號管理
  // ============================

  describe("GET /api/admin/accounts", () => {
    it("成功取得帳號列表（不含密碼）", async () => {
      const mockAccounts = [
        { id: "acc-1", username: "admin1", passwordHash: "hashed-pw", role: {}, field: {} },
      ];
      mockDb.query.adminAccounts.findMany.mockResolvedValue(mockAccounts);
      const app = createApp();
      const res = await request(app).get("/api/admin/accounts").set(adminHeaders);
      expect(res.status).toBe(200);
      expect(res.body[0].passwordHash).toBeUndefined();
    });
  });

  describe("POST /api/admin/accounts", () => {
    it("成功建立帳號", async () => {
      (createAdminAccount as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, accountId: "acc-new" });
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/accounts")
        .set(adminHeaders)
        .send({ username: "new_admin", password: "123456", displayName: "新管理員" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("建立帳號失敗回傳 400", async () => {
      (createAdminAccount as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "此場域已存在相同帳號名稱" });
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/accounts")
        .set(adminHeaders)
        .send({ username: "dup_admin", password: "123456" });
      expect(res.status).toBe(400);
    });

    it("缺少場域 ID 回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/accounts")
        .set({ "x-admin-id": "admin-1", "x-field-id": "", "x-system-role": "field_admin" })
        .send({ username: "test", password: "123456" });
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/admin/accounts/:id", () => {
    it("成功更新帳號", async () => {
      const updated = { id: "acc-1", displayName: "新名稱", passwordHash: "hashed" };
      mockDb._chain.returning.mockResolvedValue([updated]);
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/accounts/acc-1")
        .set(adminHeaders)
        .send({ displayName: "新名稱" });
      expect(res.status).toBe(200);
      expect(res.body.passwordHash).toBeUndefined();
    });

    it("帳號不存在回傳 404", async () => {
      mockDb._chain.returning.mockResolvedValue([]);
      const app = createApp();
      const res = await request(app)
        .patch("/api/admin/accounts/not-exist")
        .set(adminHeaders)
        .send({ displayName: "test" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/admin/accounts/:id/reset-password", () => {
    it("成功重設密碼", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/accounts/acc-1/reset-password")
        .set(adminHeaders)
        .send({ newPassword: "new123456" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("密碼太短回傳 400", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/accounts/acc-1/reset-password")
        .set(adminHeaders)
        .send({ newPassword: "123" });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("6");
    });
  });

  describe("POST /api/admin/accounts/:id/approve", () => {
    it("成功授權帳號", async () => {
      mockDb.query.adminAccounts.findFirst.mockResolvedValue({
        id: "acc-pending", status: "pending", fieldId: "field-1",
      });
      mockDb.query.roles.findFirst.mockResolvedValue({ id: "role-1", fieldId: "field-1" });
      const updatedAcc = { id: "acc-pending", status: "active", passwordHash: "hash" };
      mockDb._chain.returning.mockResolvedValue([updatedAcc]);
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/accounts/acc-pending/approve")
        .set(adminHeaders)
        .send({ roleId: "role-1" });
      expect(res.status).toBe(200);
      expect(res.body.account.passwordHash).toBeUndefined();
    });

    it("帳號不存在回傳 404", async () => {
      mockDb.query.adminAccounts.findFirst.mockResolvedValue(null);
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/accounts/not-exist/approve")
        .set(adminHeaders)
        .send({});
      expect(res.status).toBe(404);
    });

    it("非 pending 帳號回傳 400", async () => {
      mockDb.query.adminAccounts.findFirst.mockResolvedValue({
        id: "acc-active", status: "active", fieldId: "field-1",
      });
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/accounts/acc-active/approve")
        .set(adminHeaders)
        .send({});
      expect(res.status).toBe(400);
    });

    it("跨場域授權回傳 403", async () => {
      mockDb.query.adminAccounts.findFirst.mockResolvedValue({
        id: "acc-other", status: "pending", fieldId: "field-2",
      });
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/accounts/acc-other/approve")
        .set(adminHeaders)
        .send({});
      expect(res.status).toBe(403);
    });
  });

  // ============================
  // 審計日誌
  // ============================

  describe("GET /api/admin/audit-logs", () => {
    it("成功取得審計日誌", async () => {
      const mockLogs = [
        { id: "log-1", action: "role:create", actorAdmin: {}, field: {} },
      ];
      mockDb.query.auditLogs.findMany.mockResolvedValue(mockLogs);
      const app = createApp();
      const res = await request(app).get("/api/admin/audit-logs").set(adminHeaders);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  // ============================
  // 玩家管理
  // ============================

  describe("GET /api/admin/users", () => {
    it("成功取得玩家列表", async () => {
      const mockUsers = [
        { id: "user-1", displayName: "玩家一" },
        { id: "user-2", displayName: "玩家二" },
      ];
      mockDb.query.users.findMany.mockResolvedValue(mockUsers);
      const app = createApp();
      const res = await request(app).get("/api/admin/users").set(adminHeaders);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });
});
