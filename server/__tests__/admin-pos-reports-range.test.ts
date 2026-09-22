// 📊 POS 區間報表 from/to 驗證（2026-09-22）
//   - 格式必須 YYYY-MM-DD 且為真實日期（2026-02-30 這種 DB 轉型會 500）
//   - from <= to、區間最長 366 天（防大範圍掃表）
//   - 錯誤一律 400 { error, message }（繁中）
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// 鏈式 DB mock：select/from/where/groupBy/orderBy/innerJoin 全回自己，await 時得到空陣列
const { mockDb } = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "groupBy", "orderBy", "innerJoin"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown[]) => unknown) => resolve([]);
  return { mockDb: chain };
});

vi.mock("../db", () => ({ db: mockDb }));
vi.mock("../lib/internal-notifier", () => ({ sendToFieldGroup: vi.fn() }));

vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, res: any, next: any) => {
    if (!req.headers["x-admin-id"]) return res.status(401).json({ message: "未認證" });
    req.admin = { id: req.headers["x-admin-id"], fieldId: "field-1", systemRole: "field_admin", permissions: [] };
    return next();
  }),
  requirePermission: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  logAuditAction: vi.fn(),
}));

import { registerAdminPosReportRoutes } from "../routes/admin-pos-reports";

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminPosReportRoutes(app);
  return app;
}

const headers = { "x-admin-id": "admin-1" };
const get = (qs: string) => request(createApp()).get(`/api/admin/pos/reports/range${qs}`).set(headers);

describe("GET /api/admin/pos/reports/range — from/to 驗證", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("合法區間（上個月）→ 200 並回傳起訖", async () => {
    const res = await get("?from=2026-08-01&to=2026-08-31");
    expect(res.status).toBe(200);
    expect(res.body.fromDate).toBe("2026-08-01");
    expect(res.body.toDate).toBe("2026-08-31");
    expect(res.body.netCents).toBe(0);
  });

  it("from = to（單日）→ 200", async () => {
    const res = await get("?from=2026-09-22&to=2026-09-22");
    expect(res.status).toBe(200);
  });

  it("未帶參數 → 沿用預設（今天 ~ 今天）200", async () => {
    const res = await get("");
    expect(res.status).toBe(200);
    expect(res.body.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.fromDate).toBe(res.body.toDate);
  });

  it("剛好 366 天（閏年整年）→ 200", async () => {
    const res = await get("?from=2024-01-01&to=2024-12-31");
    expect(res.status).toBe(200);
  });

  it("格式錯誤 → 400 且不查 DB", async () => {
    const res = await get("?from=2026/08/01&to=2026-08-31");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_range");
    expect(res.body.message).toContain("YYYY-MM-DD");
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("不存在的日期（2026-02-30）→ 400", async () => {
    const res = await get("?from=2026-02-01&to=2026-02-30");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_range");
  });

  it("平年 2/29 不存在 → 400；閏年 2/29 合法 → 200", async () => {
    expect((await get("?from=2026-02-01&to=2026-02-29")).status).toBe(400);
    expect((await get("?from=2024-02-01&to=2024-02-29")).status).toBe(200);
  });

  it("from > to → 400「起始日不可晚於結束日」", async () => {
    const res = await get("?from=2026-09-10&to=2026-09-01");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("起始日不可晚於結束日");
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("超過 366 天 → 400 並說明上限", async () => {
    const res = await get("?from=2025-01-01&to=2026-01-02");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_range");
    expect(res.body.message).toContain("366");
  });

  it("重複參數（陣列）→ 400 不當字串處理", async () => {
    const res = await get("?from=2026-08-01&from=2026-08-02&to=2026-08-31");
    expect(res.status).toBe(400);
  });
});
