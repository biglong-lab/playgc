// 🔑 P2 驗收（2026-09-24）：業主要能建「只做 POS」「只看報表」這種角色
//
// 驗的是「權限鍵拆開後真的分得開」：
//   只做 POS 的角色 → 進得去 POS 設定，打遊戲 / 預約 / 營收 API 會被擋
//   只看報表的角色 → 看得到報表，改不了任何東西
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

// adminAuth 會連資料庫與讀 session 金鑰，這支只驗權限判斷 → db 用假的、金鑰給測試值
//（用 vi.hoisted 確保在 import adminAuth 之前就設好）
vi.hoisted(() => {
  process.env.SESSION_SECRET ||= "test-session-secret";
});
vi.mock("../db", () => ({ db: {} }));

import { requirePermission } from "../adminAuth";
import { PERMISSION_KEYS, PERMISSION_BACKFILL } from "@shared/lib/permission-catalog";

/** 用真的 requirePermission，只把「登入後的角色」換成測試角色 */
function appWithRole(permissions: string[], systemRole = "custom") {
  const app = express();
  app.use((req, _res, next) => {
    (req as express.Request & { admin?: unknown }).admin = {
      id: "admin-1", fieldId: "field-1", systemRole, permissions,
    };
    next();
  });
  const ok = (_req: express.Request, res: express.Response) => res.json({ ok: true });
  app.get("/pos-products", requirePermission("pos:manage"), ok);
  // 讀取品項 / 菜單（與 admin-pos-products.ts 的 POS_READ 同一組）
  app.get("/pos-menu", requirePermission("pos:view", "pos:operate", "pos:manage"), ok);
  app.get("/pos-reports", requirePermission("pos_cash_admin"), ok);
  app.get("/games-edit", requirePermission("game:edit"), ok);
  app.get("/games-view", requirePermission("game:view"), ok);
  app.get("/bookings", requirePermission("booking:manage"), ok);
  app.get("/reports", requirePermission("report:view"), ok);
  app.get("/revenue", requirePermission("revenue:view"), ok);
  return app;
}

const status = async (app: express.Express, path: string) => (await request(app).get(path)).status;

describe("角色分離（權限鍵拆分後）", () => {
  it("只做 POS：進得去 POS 設定，遊戲 / 預約 / 營收都 403", async () => {
    const app = appWithRole(["pos:view", "pos:operate", "pos:manage"]);
    expect(await status(app, "/pos-products")).toBe(200);
    expect(await status(app, "/games-edit")).toBe(403);
    expect(await status(app, "/games-view")).toBe(403);
    expect(await status(app, "/bookings")).toBe(403);
    expect(await status(app, "/revenue")).toBe(403);
  });

  it("只做 POS + 現金管理：多了現金報表，仍碰不到遊戲", async () => {
    const app = appWithRole(["pos:view", "pos:operate", "pos:manage", "pos_cash_admin"]);
    expect(await status(app, "/pos-reports")).toBe(200);
    expect(await status(app, "/games-edit")).toBe(403);
  });

  it("只看報表：看得到報表與營收，改不了 POS 設定與遊戲", async () => {
    const app = appWithRole(["report:view", "revenue:view"]);
    expect(await status(app, "/reports")).toBe(200);
    expect(await status(app, "/revenue")).toBe(200);
    expect(await status(app, "/pos-products")).toBe(403);
    expect(await status(app, "/games-edit")).toBe(403);
  });

  it("只做預約：管得到預約，碰不到 POS 設定與遊戲編輯", async () => {
    const app = appWithRole(["booking:manage", "booking:view_today"]);
    expect(await status(app, "/bookings")).toBe(200);
    expect(await status(app, "/pos-products")).toBe(403);
    expect(await status(app, "/games-edit")).toBe(403);
  });

  it("遊戲編輯者：能編遊戲，但沒有 POS / 預約 / 營收（拆分後不再夾帶）", async () => {
    const app = appWithRole(["game:view", "game:edit"]);
    expect(await status(app, "/games-edit")).toBe(200);
    expect(await status(app, "/pos-products")).toBe(403);
    expect(await status(app, "/bookings")).toBe(403);
    expect(await status(app, "/revenue")).toBe(403);
  });

  it("🐛 2026-09-26 回歸：只有 pos:manage 或只有 pos:operate 的角色也讀得到品項（現場停擺事故）", async () => {
    expect(await status(appWithRole(["pos:manage"]), "/pos-menu")).toBe(200);
    expect(await status(appWithRole(["pos:operate"]), "/pos-menu")).toBe(200);
    expect(await status(appWithRole(["report:view"]), "/pos-menu")).toBe(403);
  });

  it("補發規則：有 pos:manage / pos:operate 的角色一定會拿到 pos:view", () => {
    const grants = (key: string) => PERMISSION_BACKFILL.filter((r) => r.when === key).flatMap((r) => r.grant);
    expect(grants("pos:manage")).toContain("pos:view");
    expect(grants("pos:operate")).toContain("pos:view");
  });

  it("平台管理員（super_admin）不受限", async () => {
    const app = appWithRole([], "super_admin");
    expect(await status(app, "/pos-products")).toBe(200);
    expect(await status(app, "/games-edit")).toBe(200);
  });

  it("這些鍵都在權限目錄裡（後台角色編輯頁才選得到）", () => {
    const used = ["pos:view", "pos:operate", "pos:manage", "pos_cash_admin", "booking:manage", "report:view", "revenue:view"];
    expect(used.filter((k) => !PERMISSION_KEYS.includes(k))).toEqual([]);
  });
});
