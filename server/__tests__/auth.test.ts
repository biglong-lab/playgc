import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock DB
const mockDbFindFirst = vi.fn();
const mockDbFindMany = vi.fn();
const mockDbInsertValues = vi.fn();
const mockDbUpdateSet = vi.fn();

// 通用 select chain mock：可被覆寫 limit 結果（select().from().innerJoin().where().limit()）
const { mockSelectLimit, mockSelectChain } = vi.hoisted(() => {
  const mockSelectLimit = vi.fn().mockResolvedValue([]);
  return {
    mockSelectLimit,
    mockSelectChain: {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: mockSelectLimit,
    },
  };
});

vi.mock("../db", () => ({
  db: {
    query: {
      fields: { findFirst: vi.fn() },
      adminAccounts: { findFirst: vi.fn() },
      adminSessions: { findFirst: vi.fn() },
      roles: { findFirst: vi.fn() },
      rolePermissions: { findMany: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: mockDbInsertValues,
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mockDbUpdateSet,
      })),
    })),
    select: vi.fn(() => mockSelectChain),
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
  },
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "user-1" },
        dbUser: { id: "user-1", displayName: "Test User", email: "test@example.com" },
      };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
  verifyFirebaseToken: vi.fn(),
}));

vi.mock("../adminAuth", () => ({
  adminLogin: vi.fn(),
  adminLogout: vi.fn(),
  requireAdminAuth: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer admin-token" || req.cookies?.adminToken === "admin-token") {
      req.admin = {
        id: "admin-1",
        fieldId: "field-1",
        displayName: "Admin",
        systemRole: "field_admin",
      };
      return next();
    }
    return res.status(401).json({ message: "未認證" });
  }),
  logAuditAction: vi.fn(),
  verifyToken: vi.fn(),
  getAdminPermissions: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn().mockReturnValue("mock-jwt-token"),
  },
}));

import { db } from "../db";
import { adminLogin, adminLogout, verifyToken, getAdminPermissions } from "../adminAuth";
import { verifyFirebaseToken } from "../firebaseAuth";
import { registerAuthRoutes } from "../routes/auth";

const mockAdminLogin = adminLogin as ReturnType<typeof vi.fn>;
const mockAdminLogout = adminLogout as ReturnType<typeof vi.fn>;
const mockVerifyToken = verifyToken as ReturnType<typeof vi.fn>;
const mockVerifyFirebaseToken = verifyFirebaseToken as ReturnType<typeof vi.fn>;
const mockGetAdminPermissions = getAdminPermissions as ReturnType<typeof vi.fn>;
const mockDb = db as any;

function createApp() {
  const app = express();
  app.use(express.json());
  // 模擬 cookie-parser
  app.use((req: any, _res: any, next: any) => {
    req.cookies = {};
    next();
  });
  registerAuthRoutes(app);
  return app;
}

const AUTH_HEADER = { Authorization: "Bearer valid-token" };
const ADMIN_HEADER = { Authorization: "Bearer admin-token" };

describe("認證路由 (auth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================
  // GET /api/auth/user - 取得玩家資訊
  // ===========================================
  describe("GET /api/auth/user", () => {
    it("未認證時回傳 401", async () => {
      const app = createApp();
      const res = await request(app).get("/api/auth/user");
      expect(res.status).toBe(401);
    });

    it("認證成功時回傳使用者資料", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/auth/user")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("user-1");
      expect(res.body.displayName).toBe("Test User");
    });
  });

  // ===========================================
  // POST /api/admin/login - 密碼登入已停用 (410 Gone)
  // ===========================================
  describe("POST /api/admin/login", () => {
    it("任何請求都回傳 410 Gone（密碼登入已停用）", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/login")
        .send({ fieldCode: "F001", username: "admin", password: "correct" });

      expect(res.status).toBe(410);
      expect(res.body.message).toBe("密碼登入已停用，請使用 Google 帳號登入");
      expect(res.body.migration).toBeDefined();
    });

    it("空 body 也回傳 410 Gone", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/login")
        .send({});

      expect(res.status).toBe(410);
    });
  });

  // ===========================================
  // POST /api/admin/firebase-login - Firebase 管理員登入
  // ===========================================
  describe("POST /api/admin/firebase-login", () => {
    it("缺少 Authorization header 時回傳 401", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/admin/firebase-login")
        .send({ fieldCode: "F001" });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("請先登入");
    });

    it("無效 token 時回傳 401", async () => {
      const app = createApp();
      mockVerifyFirebaseToken.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/admin/firebase-login")
        .set({ Authorization: "Bearer invalid-firebase-token" })
        .send({ fieldCode: "F001" });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("無效的登入令牌");
    });

    it("缺少 fieldCode 且無 super_admin 帳號時回傳 404", async () => {
      const app = createApp();
      mockVerifyFirebaseToken.mockResolvedValue({
        uid: "firebase-user-1",
        email: "admin@test.com",
      });
      // select().from().innerJoin().where().limit() 都返回空陣列（找不到 super_admin）
      mockSelectLimit.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/admin/firebase-login")
        .set({ Authorization: "Bearer firebase-token" })
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("找不到超級管理員帳號，請輸入場域編號或聯絡平台");
    });

    it("缺少 fieldCode 但有 super_admin 帳號 → 不再回 404/400 (status 不會卡關)", async () => {
      const app = createApp();
      mockVerifyFirebaseToken.mockResolvedValue({
        uid: "firebase-user-1",
        email: "admin@test.com",
      });
      // select 篩 super_admin 找到一筆（已透過 innerJoin role 確保是 super_admin）
      mockSelectLimit.mockResolvedValue([
        {
          admin: {
            id: "admin-1",
            roleId: "role-1",
            fieldId: "field-1",
            status: "active",
            email: "admin@test.com",
          },
        },
      ]);
      mockDb.query.fields.findFirst.mockResolvedValue({
        id: "field-1",
        code: "TEST",
        name: "測試場域",
      });

      const res = await request(app)
        .post("/api/admin/firebase-login")
        .set({ Authorization: "Bearer firebase-token" })
        .send({});

      // 關鍵驗證：不再走 systemRole 檢查（之前是 400「非超級管理員請輸入場域編號」）
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(404);
      expect(mockSelectLimit).toHaveBeenCalled();
    });

    it("缺少 fieldCode 且 firebaseUser 有多個 admin_accounts → join 篩出 super_admin", async () => {
      const app = createApp();
      mockVerifyFirebaseToken.mockResolvedValue({
        uid: "firebase-user-1",
        email: "twfam4@test.com",
      });
      // 模擬：DB 有 4 個 admin_accounts、3 個 field_director + 1 個 super_admin
      // join 篩 super_admin → 直接拿到 super_admin 那筆（不會被其他 field_director 干擾）
      mockSelectLimit.mockResolvedValue([
        {
          admin: {
            id: "admin-super",
            roleId: "role-super",
            fieldId: "field-1",
            status: "active",
            email: "twfam4@test.com",
          },
        },
      ]);
      mockDb.query.fields.findFirst.mockResolvedValue({
        id: "field-1",
        code: "JIACHUN",
        name: "賈村",
      });

      const res = await request(app)
        .post("/api/admin/firebase-login")
        .set({ Authorization: "Bearer firebase-token" })
        .send({});

      // 關鍵驗證：不會回 400 「非超級管理員請輸入場域編號」（之前 findFirst 隨機抓 field_director 會回這個）
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(404);
      // 驗證 select join chain 確實被呼叫
      expect(mockSelectLimit).toHaveBeenCalled();
    });

    it("場域不存在時回傳 404", async () => {
      const app = createApp();
      mockVerifyFirebaseToken.mockResolvedValue({
        uid: "firebase-user-1",
        email: "admin@test.com",
      });
      mockDb.query.fields.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/admin/firebase-login")
        .set({ Authorization: "Bearer firebase-token" })
        .send({ fieldCode: "NOEXIST" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("找不到此場域");
    });

    it("新帳號建立待授權申請回傳 202", async () => {
      const app = createApp();
      mockVerifyFirebaseToken.mockResolvedValue({
        uid: "firebase-new-user",
        email: "new@test.com",
        name: "New User",
      });
      mockDb.query.fields.findFirst.mockResolvedValue({
        id: "field-1",
        code: "F001",
        name: "測試場域",
      });
      mockDb.query.adminAccounts.findFirst.mockResolvedValue(null);
      mockDbInsertValues.mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/admin/firebase-login")
        .set({ Authorization: "Bearer firebase-token" })
        .send({ fieldCode: "F001" });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe("pending");
    });

    it("帳號停用時回傳 403", async () => {
      const app = createApp();
      mockVerifyFirebaseToken.mockResolvedValue({
        uid: "firebase-user-1",
        email: "admin@test.com",
      });
      mockDb.query.fields.findFirst.mockResolvedValue({
        id: "field-1",
        code: "F001",
      });
      mockDb.query.adminAccounts.findFirst.mockResolvedValue({
        id: "admin-1",
        status: "inactive",
      });

      const res = await request(app)
        .post("/api/admin/firebase-login")
        .set({ Authorization: "Bearer firebase-token" })
        .send({ fieldCode: "F001" });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("您的帳號已被停用或鎖定");
    });

    it("帳號啟用但待審核回傳 202", async () => {
      const app = createApp();
      mockVerifyFirebaseToken.mockResolvedValue({
        uid: "firebase-user-1",
        email: "admin@test.com",
      });
      mockDb.query.fields.findFirst.mockResolvedValue({
        id: "field-1",
        code: "F001",
      });
      mockDb.query.adminAccounts.findFirst.mockResolvedValue({
        id: "admin-1",
        status: "pending",
      });

      const res = await request(app)
        .post("/api/admin/firebase-login")
        .set({ Authorization: "Bearer firebase-token" })
        .send({ fieldCode: "F001" });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe("pending");
    });
  });

  // ===========================================
  // POST /api/admin/logout - 管理員登出
  // ===========================================
  describe("POST /api/admin/logout", () => {
    it("未認證時回傳 401", async () => {
      const app = createApp();
      const res = await request(app).post("/api/admin/logout");
      expect(res.status).toBe(401);
    });

    it("登出成功", async () => {
      const app = createApp();
      mockAdminLogout.mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/admin/logout")
        .set(ADMIN_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ===========================================
  // GET /api/admin/me - 取得管理員自己的資料
  // ===========================================
  describe("GET /api/admin/me", () => {
    it("未認證時回傳 401", async () => {
      const app = createApp();
      const res = await request(app).get("/api/admin/me");
      expect(res.status).toBe(401);
    });

    it("認證成功時回傳管理員資料", async () => {
      const app = createApp();
      const res = await request(app)
        .get("/api/admin/me")
        .set(ADMIN_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("admin-1");
      expect(res.body.systemRole).toBe("field_admin");
    });
  });

  // ===========================================
  // GET /api/admin/session - 驗證管理員 session
  // ===========================================
  describe("GET /api/admin/session", () => {
    it("沒有 token 時回傳 authenticated: false", async () => {
      const app = createApp();
      const res = await request(app).get("/api/admin/session");

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it("token 無效時回傳 authenticated: false", async () => {
      const app = createApp();
      mockVerifyToken.mockReturnValue(null);

      const res = await request(app)
        .get("/api/admin/session")
        .set({ Authorization: "Bearer expired-token" });

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it("session 已過期時回傳 authenticated: false", async () => {
      const app = createApp();
      mockVerifyToken.mockReturnValue({ sub: "admin-1" });
      mockDb.query.adminSessions.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/admin/session")
        .set({ Authorization: "Bearer some-token" });

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it("帳號停用時回傳 authenticated: false", async () => {
      const app = createApp();
      mockVerifyToken.mockReturnValue({ sub: "admin-1" });
      mockDb.query.adminSessions.findFirst.mockResolvedValue({
        token: "some-token",
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockDb.query.adminAccounts.findFirst.mockResolvedValue({
        id: "admin-1",
        status: "inactive",
      });

      const res = await request(app)
        .get("/api/admin/session")
        .set({ Authorization: "Bearer some-token" });

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it("valid session 回傳 authenticated: true 和管理員資料", async () => {
      const app = createApp();
      mockVerifyToken.mockReturnValue({ sub: "admin-1" });
      mockDb.query.adminSessions.findFirst.mockResolvedValue({
        token: "some-token",
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockDb.query.adminAccounts.findFirst.mockResolvedValue({
        id: "admin-1",
        status: "active",
        fieldId: "field-1",
        displayName: "Admin User",
        roleId: "role-1",
        role: { systemRole: "field_admin" },
      });
      mockDb.query.fields.findFirst.mockResolvedValue({
        id: "field-1",
        code: "F001",
        name: "測試場域",
      });
      mockGetAdminPermissions.mockResolvedValue(["games:read", "games:write"]);

      const res = await request(app)
        .get("/api/admin/session")
        .set({ Authorization: "Bearer some-token" });

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.admin.fieldCode).toBe("F001");
      expect(res.body.admin.permissions).toEqual(["games:read", "games:write"]);
    });
  });
});
