// 🧩 模組開關中介層：關掉的模組 API 直接 403（不只是藏選單）
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn() }));
vi.mock("../lib/field-modules", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/field-modules")>();
  return { ...actual, loadFieldModules: mockLoad };
});
vi.mock("../db", () => ({ db: {} }));

import { moduleGuard } from "../middleware/require-module";

/** admin 身分由外層中介層注入；這裡直接模擬 */
function createApp(admin?: { fieldId?: string | null; systemRole?: string }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (admin) (req as express.Request & { admin?: unknown }).admin = admin;
    next();
  });
  app.use("/api", moduleGuard);
  app.get("/api/admin/pos/products", (_req, res) => res.json({ ok: true }));
  app.get("/api/admin/games", (_req, res) => res.json({ ok: true }));
  app.get("/api/matches/m1", (_req, res) => res.json({ ok: true }));
  app.get("/api/unrelated", (_req, res) => res.json({ ok: true }));
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoad.mockResolvedValue({ pos: true, match: true, games: true });
});

describe("moduleGuard", () => {
  it("模組開著 → 照常通過", async () => {
    const res = await request(createApp({ fieldId: "f1" })).get("/api/admin/pos/products");
    expect(res.status).toBe(200);
  });

  it("模組關掉 → 403 module_disabled + 可讀訊息", async () => {
    mockLoad.mockResolvedValue({ pos: false });
    const res = await request(createApp({ fieldId: "f1" })).get("/api/admin/pos/products");
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "module_disabled", module: "pos" });
    expect(res.body.message).toContain("POS");
  });

  it("競賽模組關掉 → 玩家端 /api/matches 也擋（帶 fieldId 時）", async () => {
    mockLoad.mockResolvedValue({ match: false });
    const res = await request(createApp()).get("/api/matches/m1?fieldId=f1");
    expect(res.status).toBe(403);
    expect(res.body.module).toBe("match");
  });

  it("核心模組（遊戲）永遠不擋", async () => {
    mockLoad.mockResolvedValue({ games: false });
    expect((await request(createApp({ fieldId: "f1" })).get("/api/admin/games")).status).toBe(200);
  });

  it("平台管理員不受場域模組限制；判斷不出場域也放行", async () => {
    mockLoad.mockResolvedValue({ pos: false });
    expect((await request(createApp({ fieldId: "f1", systemRole: "super_admin" })).get("/api/admin/pos/products")).status).toBe(200);
    expect((await request(createApp()).get("/api/admin/pos/products")).status).toBe(200);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("不屬於任何模組的路徑不受影響", async () => {
    mockLoad.mockResolvedValue({ pos: false });
    expect((await request(createApp({ fieldId: "f1" })).get("/api/unrelated")).status).toBe(200);
  });

  it("讀取設定失敗 → 放行（不能因為設定讀不到就把場域鎖死）", async () => {
    mockLoad.mockRejectedValue(new Error("db down"));
    expect((await request(createApp({ fieldId: "f1" })).get("/api/admin/pos/products")).status).toBe(200);
  });
});
