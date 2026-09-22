/**
 * 接力路由 API — relay.ts（2026-09-23 P1 改寫：分段來自遊戲設定快照、交棒自動）
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockGetMatch, mockRanking, mockMyLeg } = vi.hoisted(() => ({
  mockGetMatch: vi.fn(),
  mockRanking: vi.fn(),
  mockMyLeg: vi.fn(),
}));

vi.mock("../services/match-lobby", () => ({ getMatch: mockGetMatch }));
vi.mock("../services/match-lifecycle", () => ({ loadMatchRanking: mockRanking }));
vi.mock("../services/relay-lifecycle", async () => {
  const actual = await vi.importActual<typeof import("../services/relay-lifecycle")>("../services/relay-lifecycle");
  return { relayLegsOf: actual.relayLegsOf, getMyRelayLeg: mockMyLeg };
});
vi.mock("../db", () => ({ db: {} }));
vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = { claims: { sub: "user-1" } };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
}));

import { registerRelayRoutes } from "../routes/relay";

const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const AUTH = { Authorization: "Bearer valid-token" };

function createApp() {
  const app = express();
  app.use(express.json());
  registerRelayRoutes(app, { broadcastToMatch: vi.fn() } as never);
  return app;
}

const relayMatch = {
  id: MATCH_ID,
  matchMode: "relay",
  status: "playing",
  settings: { relaySegments: [{ fromPage: 1, toPage: 3 }, { fromPage: 4, toPage: 6 }] },
};

beforeEach(() => vi.clearAllMocks());

describe("GET /api/matches/:id/relay/status", () => {
  it("不是接力賽 → 400", async () => {
    mockGetMatch.mockResolvedValue({ ...relayMatch, matchMode: "competitive" });
    expect((await request(createApp()).get(`/api/matches/${MATCH_ID}/relay/status`)).status).toBe(400);
  });

  it("回傳每一棒的頁碼、負責人、狀態與整隊總分", async () => {
    mockGetMatch.mockResolvedValue(relayMatch);
    mockRanking.mockResolvedValue([
      { userId: "a", displayName: "小明", relaySegment: 1, relayStatus: "completed", score: 30 },
      { userId: "b", displayName: "小華", relaySegment: 2, relayStatus: "active", score: 10 },
    ]);
    const res = await request(createApp()).get(`/api/matches/${MATCH_ID}/relay/status`);
    expect(res.body).toMatchObject({
      totalSegments: 2,
      completedSegments: 1,
      activeSegment: 2,
      teamTotal: 40,
      legs: [
        { segment: 1, fromPage: 1, toPage: 3, displayName: "小明", status: "completed" },
        { segment: 2, fromPage: 4, toPage: 6, displayName: "小華", status: "active" },
      ],
    });
  });
});

describe("GET /api/matches/:id/relay/me", () => {
  it("要登入；回傳我的棒次", async () => {
    const app = createApp();
    expect((await request(app).get(`/api/matches/${MATCH_ID}/relay/me`)).status).toBe(401);
    mockGetMatch.mockResolvedValue(relayMatch);
    mockMyLeg.mockResolvedValue({ status: "pending", segment: 2 });
    const res = await request(app).get(`/api/matches/${MATCH_ID}/relay/me`).set(AUTH);
    expect(res.body).toEqual({ status: "pending", segment: 2 });
    expect(mockMyLeg).toHaveBeenCalledWith(relayMatch, "user-1");
  });
});

describe("舊入口停用", () => {
  it("手動分段 / 手動傳棒 → 410", async () => {
    const app = createApp();
    expect((await request(app).post(`/api/matches/${MATCH_ID}/relay/assign`).set(AUTH)).status).toBe(410);
    expect((await request(app).post(`/api/matches/${MATCH_ID}/relay/handoff`).set(AUTH).send({ toUserId: "x" })).status).toBe(410);
  });
});
