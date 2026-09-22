// 元件遠端開關 admin 路由（P0-B 2026-09-23）
//   - 非 super_admin 只能新增 / 修改「自己場域」的覆寫，碰全域 → 403
//   - super_admin 行為不變
//   - upsert 不再用 ON CONFLICT（DB 的唯一索引是 COALESCE(field_id,'') 表達式，推論不到 → 一律 500）
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockDb, queue } = vi.hoisted(() => {
  const CHAIN_METHODS = ["from", "where", "orderBy", "limit", "set", "values", "returning", "onConflictDoUpdate"];
  // 可 await 的鏈式 mock：每個方法回傳自己，await 時吐出佇列裡的結果
  const makeChain = (result: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const m of CHAIN_METHODS) chain[m] = vi.fn(() => chain);
    chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return chain;
  };
  const queue = { select: [] as unknown[], insert: [] as unknown[], update: [] as unknown[] };
  const mockDb = {
    select: vi.fn(() => makeChain(queue.select.shift() ?? [])),
    insert: vi.fn(() => makeChain(queue.insert.shift() ?? [])),
    update: vi.fn(() => makeChain(queue.update.shift() ?? [])),
    execute: vi.fn(),
  };
  return { mockDb, queue };
});

vi.mock("../db", () => ({ db: mockDb }));

vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, res: any, next: any) => {
    if (!req.headers["x-admin-id"]) return res.status(401).json({ message: "未認證" });
    req.admin = {
      id: req.headers["x-admin-id"],
      fieldId: req.headers["x-field-id"] || "field-1",
      systemRole: req.headers["x-system-role"] || "field_director",
      permissions: ["game:view", "game:edit"],
    };
    return next();
  }),
  requirePermission: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@shared/schema", () => ({
  featureFlags: {
    id: "ff.id", scope: "ff.scope", fieldId: "ff.fieldId",
    moduleKey: "ff.moduleKey", updatedAt: "ff.updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ op: "eq", a, b })),
  and: vi.fn((...c: unknown[]) => ({ op: "and", c })),
  or: vi.fn((...c: unknown[]) => ({ op: "or", c })),
  isNull: vi.fn((a: unknown) => ({ op: "isNull", a })),
  desc: vi.fn((a: unknown) => ({ op: "desc", a })),
  sql: vi.fn(),
}));

import { registerAdminFeatureFlagsRoutes } from "../routes/admin-feature-flags";

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminFeatureFlagsRoutes(app);
  return app;
}

const fieldAdmin = { "x-admin-id": "a-1", "x-field-id": "field-1", "x-system-role": "field_director" };
const superAdmin = { "x-admin-id": "a-super", "x-field-id": "field-1", "x-system-role": "super_admin" };

type Chain = Record<string, ReturnType<typeof vi.fn>>;
const lastChain = (fn: ReturnType<typeof vi.fn>): Chain =>
  fn.mock.results[fn.mock.results.length - 1].value as Chain;

const globalFlag = { id: "flag-g", scope: "global", fieldId: null, moduleKey: "lock", enabled: true };
const ownFieldFlag = { id: "flag-f1", scope: "field", fieldId: "field-1", moduleKey: "lock", enabled: true };
const otherFieldFlag = { id: "flag-f2", scope: "field", fieldId: "field-2", moduleKey: "lock", enabled: true };

describe("admin feature flags 路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue.select.length = 0;
    queue.insert.length = 0;
    queue.update.length = 0;
  });

  describe("POST /api/admin/feature-flags（新增 / 覆寫）", () => {
    it("場域管理員新增全域開關 → 403、不寫 DB", async () => {
      const res = await request(createApp())
        .post("/api/admin/feature-flags")
        .set(fieldAdmin)
        .send({ scope: "global", moduleKey: "lock", enabled: false });

      expect(res.status).toBe(403);
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("場域管理員沒帶 scope → 預設本場域覆寫（fieldId 強制為自己場域）", async () => {
      queue.select.push([]); // 尚無既有覆寫
      queue.insert.push([{ ...ownFieldFlag, enabled: false }]);

      const res = await request(createApp())
        .post("/api/admin/feature-flags")
        .set(fieldAdmin)
        .send({ moduleKey: "lock", enabled: false });

      expect(res.status).toBe(200);
      const values = lastChain(mockDb.insert).values.mock.calls[0][0];
      expect(values).toMatchObject({ scope: "field", fieldId: "field-1", moduleKey: "lock", enabled: false });
    });

    it("場域管理員指定別的場域 → 403", async () => {
      const res = await request(createApp())
        .post("/api/admin/feature-flags")
        .set(fieldAdmin)
        .send({ scope: "field", fieldId: "field-2", moduleKey: "lock", enabled: false });

      expect(res.status).toBe(403);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("已有同場域覆寫 → 更新那一筆（不重複新增）", async () => {
      queue.select.push([ownFieldFlag]);
      queue.update.push([{ ...ownFieldFlag, enabled: false }]);

      const res = await request(createApp())
        .post("/api/admin/feature-flags")
        .set(fieldAdmin)
        .send({ scope: "field", moduleKey: "lock", enabled: false });

      expect(res.status).toBe(200);
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(lastChain(mockDb.update).set.mock.calls[0][0]).toMatchObject({ enabled: false });
    });

    it("super_admin 新增全域開關 → 寫入 global、fieldId=null（行為不變），不用 ON CONFLICT", async () => {
      queue.select.push([]);
      queue.insert.push([{ ...globalFlag, enabled: false }]);

      const res = await request(createApp())
        .post("/api/admin/feature-flags")
        .set(superAdmin)
        .send({ moduleKey: "lock", enabled: false });

      expect(res.status).toBe(200);
      const chain = lastChain(mockDb.insert);
      expect(chain.values.mock.calls[0][0]).toMatchObject({ scope: "global", fieldId: null });
      expect(chain.onConflictDoUpdate).not.toHaveBeenCalled();
    });

    it("格式錯誤 → 400", async () => {
      const res = await request(createApp())
        .post("/api/admin/feature-flags")
        .set(superAdmin)
        .send({ moduleKey: "", enabled: "yes" });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/admin/feature-flags/:id（切換）", () => {
    it("場域管理員切換全域開關 → 403、不寫 DB", async () => {
      queue.select.push([globalFlag]);

      const res = await request(createApp())
        .patch("/api/admin/feature-flags/flag-g")
        .set(fieldAdmin)
        .send({ enabled: false });

      expect(res.status).toBe(403);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("場域管理員切換別場域的覆寫 → 403", async () => {
      queue.select.push([otherFieldFlag]);

      const res = await request(createApp())
        .patch("/api/admin/feature-flags/flag-f2")
        .set(fieldAdmin)
        .send({ enabled: false });

      expect(res.status).toBe(403);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("場域管理員切換本場域覆寫 → 200", async () => {
      queue.select.push([ownFieldFlag]);
      queue.update.push([{ ...ownFieldFlag, enabled: false }]);

      const res = await request(createApp())
        .patch("/api/admin/feature-flags/flag-f1")
        .set(fieldAdmin)
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.flag.enabled).toBe(false);
    });

    it("super_admin 切換全域開關 → 200（行為不變）", async () => {
      queue.select.push([globalFlag]);
      queue.update.push([{ ...globalFlag, enabled: false }]);

      const res = await request(createApp())
        .patch("/api/admin/feature-flags/flag-g")
        .set(superAdmin)
        .send({ enabled: false });

      expect(res.status).toBe(200);
    });

    it("flag 不存在 → 404", async () => {
      queue.select.push([]);

      const res = await request(createApp())
        .patch("/api/admin/feature-flags/nope")
        .set(superAdmin)
        .send({ enabled: true });

      expect(res.status).toBe(404);
    });

    it("enabled 不是布林 → 400", async () => {
      const res = await request(createApp())
        .patch("/api/admin/feature-flags/flag-f1")
        .set(fieldAdmin)
        .send({ enabled: "false" });

      expect(res.status).toBe(400);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/feature-flags（列表）", () => {
    it("場域管理員只看得到全域 + 自己場域（看不到別場域的覆寫）", async () => {
      queue.select.push([globalFlag, ownFieldFlag]);
      const { or, eq } = await import("drizzle-orm");

      const res = await request(createApp()).get("/api/admin/feature-flags").set(fieldAdmin);

      expect(res.status).toBe(200);
      expect(lastChain(mockDb.select).where).toHaveBeenCalled();
      expect(or).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith("ff.scope", "global");
      expect(eq).toHaveBeenCalledWith("ff.fieldId", "field-1");
    });

    it("super_admin 看全部（不加篩選）", async () => {
      queue.select.push([globalFlag, ownFieldFlag, otherFieldFlag]);
      const { or } = await import("drizzle-orm");

      const res = await request(createApp()).get("/api/admin/feature-flags").set(superAdmin);

      expect(res.status).toBe(200);
      expect(res.body.flags).toHaveLength(3);
      // where(undefined) = drizzle 不加條件
      expect(lastChain(mockDb.select).where).toHaveBeenCalledWith(undefined);
      expect(or).not.toHaveBeenCalled();
    });
  });
});
