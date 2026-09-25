// 📺 2026-09-25 B-0 止血：host 模組關閉時，後台建大螢幕場次的 API 要被擋（403 module_disabled）
//   公開的 /api/host-sessions/:id（既有活動的大螢幕連結）判斷不出場域 → 放行，維持相容
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockLoadFieldModules } = vi.hoisted(() => ({ mockLoadFieldModules: vi.fn() }));
vi.mock("../lib/field-modules", () => ({
  loadFieldModules: mockLoadFieldModules,
  moduleOffMessage: (def: { label: string }) => `此場域未啟用「${def.label}」`,
}));
vi.mock("../lib/field-plan", () => ({ fieldHasFeature: vi.fn(async () => true) }));

import { moduleGuard } from "../middleware/require-module";

function appAs(admin: { fieldId?: string; systemRole?: string } | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (admin) (req as express.Request & { admin?: unknown }).admin = { id: "a1", ...admin };
    next();
  });
  app.use("/api", moduleGuard);
  const ok = (_req: express.Request, res: express.Response) => res.json({ ok: true });
  app.post("/api/admin/host-sessions", ok);
  app.get("/api/admin/host-sessions", ok);
  app.get("/api/host-sessions/:id", ok);
  app.post("/api/trivia/:id/answer", ok);
  app.get("/api/admin/games", ok);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  // 既有場域：沒設過 host → 關（用登錄表預設）
  mockLoadFieldModules.mockResolvedValue({ games: true, pos: true, booking: true, host: false });
});

describe("host 模組關閉時", () => {
  it("後台建 / 列 host 場次 → 403 module_disabled", async () => {
    const app = appAs({ fieldId: "field-1", systemRole: "field_manager" });
    const created = await request(app).post("/api/admin/host-sessions").send({ gameId: "g1" });
    expect(created.status).toBe(403);
    expect(created.body).toMatchObject({ error: "module_disabled", module: "host" });
    expect((await request(app).get("/api/admin/host-sessions")).status).toBe(403);
  });

  it("其他模組（遊戲）不受影響", async () => {
    const app = appAs({ fieldId: "field-1", systemRole: "field_manager" });
    expect((await request(app).get("/api/admin/games")).status).toBe(200);
  });

  it("既有活動的公開連結（大螢幕 / 手機）判斷不出場域 → 放行，不讓正在用的人斷掉", async () => {
    const app = appAs(null);
    expect((await request(app).get("/api/host-sessions/s1")).status).toBe(200);
    expect((await request(app).post("/api/trivia/s1/answer").send({})).status).toBe(200);
  });

  it("super_admin 不受場域模組限制（要幫某場域開時用）", async () => {
    const app = appAs({ fieldId: "field-1", systemRole: "super_admin" });
    expect((await request(app).post("/api/admin/host-sessions").send({})).status).toBe(200);
  });

  it("場域明確開啟 host → 放行", async () => {
    mockLoadFieldModules.mockResolvedValue({ games: true, host: true });
    const app = appAs({ fieldId: "field-1", systemRole: "field_manager" });
    expect((await request(app).post("/api/admin/host-sessions").send({})).status).toBe(200);
  });
});
