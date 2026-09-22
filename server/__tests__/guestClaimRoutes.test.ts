// 🎟️ 訪客紀錄認領 API — 權限規則
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockStorage, mockClaim } = vi.hoisted(() => ({
  mockStorage: { getUser: vi.fn() },
  mockClaim: vi.fn(),
}));

vi.mock("../storage", () => ({ storage: mockStorage }));
vi.mock("../db", () => ({ db: {} })); // 搬移已 mock，路由測試不連 DB
vi.mock("../utils/rate-limiters", () => ({
  guestClaimLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
// token → 身分：anon-token = 訪客、google-token = Google 帳號、line-token = LINE（custom token、無 email）
vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    const map: Record<string, { sub: string; signInProvider: string }> = {
      "Bearer anon-token": { sub: "anon-1", signInProvider: "anonymous" },
      "Bearer google-token": { sub: "real-1", signInProvider: "google.com" },
      "Bearer line-token": { sub: "line-1", signInProvider: "custom" },
    };
    const claims = map[req.headers.authorization as string];
    if (!claims) return res.status(401).json({ message: "Unauthorized" });
    req.user = { claims, dbUser: { id: claims.sub } };
    return next();
  }),
}));
vi.mock("../services/guest-claim", async () => {
  const actual = await vi.importActual<typeof import("../services/guest-claim")>("../services/guest-claim");
  return { ...actual, claimGuestRecords: mockClaim };
});

import { registerGuestClaimRoutes } from "../routes/guest-claim";
import { createClaimTicket } from "../services/guest-claim";

function createApp() {
  const app = express();
  app.use(express.json());
  registerGuestClaimRoutes(app);
  return app;
}

describe("訪客紀錄認領 API", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET ||= "test-session-secret";
    mockStorage.getUser.mockReset();
    mockClaim.mockReset();
    mockClaim.mockResolvedValue({ player_progress: 2 });
  });

  it("訪客可取得認領憑證", async () => {
    const res = await request(createApp()).post("/api/me/guest-claim-ticket").set("Authorization", "Bearer anon-token");
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatch(/\./);
  });

  it("正式帳號不能取得憑證（避免替正式帳號開搬移口子）", async () => {
    const res = await request(createApp()).post("/api/me/guest-claim-ticket").set("Authorization", "Bearer google-token");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("not_guest");
  });

  it("未登入 → 401", async () => {
    const res = await request(createApp()).post("/api/me/guest-claim-ticket");
    expect(res.status).toBe(401);
  });

  it("正式帳號帶有效憑證 → 搬移訪客紀錄", async () => {
    mockStorage.getUser.mockResolvedValue({ id: "anon-1", email: "user-anon-1@firebase.local" });
    const res = await request(createApp())
      .post("/api/me/claim-guest")
      .set("Authorization", "Bearer google-token")
      .send({ ticket: createClaimTicket("anon-1") });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, moved: { player_progress: 2 } });
    expect(mockClaim).toHaveBeenCalledWith("anon-1", "real-1");
  });

  it("LINE 帳號（custom token、可能無 email）也能認領", async () => {
    mockStorage.getUser.mockResolvedValue({ id: "anon-1", email: "user-anon-1@firebase.local" });
    const res = await request(createApp())
      .post("/api/me/claim-guest")
      .set("Authorization", "Bearer line-token")
      .send({ ticket: createClaimTicket("anon-1") });
    expect(res.status).toBe(200);
    expect(mockClaim).toHaveBeenCalledWith("anon-1", "line-1");
  });

  it("還是訪客身分不能認領", async () => {
    const res = await request(createApp())
      .post("/api/me/claim-guest")
      .set("Authorization", "Bearer anon-token")
      .send({ ticket: createClaimTicket("anon-2") });
    expect(res.status).toBe(400);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it("憑證指向正式帳號（非假信箱）→ 拒絕，不搬走正式帳號的資料", async () => {
    mockStorage.getUser.mockResolvedValue({ id: "victim", email: "victim@gmail.com" });
    const res = await request(createApp())
      .post("/api/me/claim-guest")
      .set("Authorization", "Bearer google-token")
      .send({ ticket: createClaimTicket("victim") });
    expect(res.status).toBe(400);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it("無效憑證 → 400", async () => {
    const res = await request(createApp())
      .post("/api/me/claim-guest")
      .set("Authorization", "Bearer google-token")
      .send({ ticket: "forged.ticket-value" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_ticket");
  });
});
