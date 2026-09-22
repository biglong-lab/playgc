// 📊 推送日報（POST /api/pos/shift/close）群組訊息命名
//   - 過去與「交班鎖帳」都叫「每日結帳」→ 群組分不出哪則是鎖帳
//   - 推送日報只彙整銷售、不鎖帳 → 訊息標題改「日報」
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockDb, mockSend } = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "groupBy", "orderBy", "innerJoin", "insert", "values", "update", "set"]) {
    chain[m] = vi.fn(() => chain);
  }
  // insert(...).values(...).returning() → 寫入的 shift_close 列
  chain.returning = vi.fn(async () => [{ id: "sc-1" }]);
  chain.then = (resolve: (v: unknown[]) => unknown) => resolve([]);
  return { mockDb: chain, mockSend: vi.fn() };
});

vi.mock("../db", () => ({ db: mockDb }));
vi.mock("../lib/internal-notifier", () => ({ sendToFieldGroup: mockSend }));

vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, _res: any, next: any) => {
    req.admin = { id: "admin-1", fieldId: "field-1", systemRole: "field_director", permissions: ["game:view"] };
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

describe("POST /api/pos/shift/close — 推送日報", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("推群組的標題是「日報」、不再叫「結帳」", async () => {
    const res = await request(createApp()).post("/api/pos/shift/close").send({});
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const message = String(mockSend.mock.calls[0][0]);
    expect(message.split("\n")[0]).toContain("日報");
    expect(message).not.toContain("結帳");
  });
});
