/**
 * 接力路由 API 整合測試 — relay.ts
 *
 * Mock 策略：同 matches.test.ts，使用 selectResults 佇列
 * 依序消費每次 select() 呼叫的回傳值。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── 可控的回傳佇列 ─────────────────────────────────
let selectResults: unknown[][] = [];
let selectIndex = 0;

const mockInsertReturning = vi.fn();
const mockUpdateReturning = vi.fn();

function nextSelectResult() {
  const result = selectResults[selectIndex] ?? [];
  selectIndex++;
  return result;
}

function createSelectChain() {
  const chain: Record<string, unknown> = {};

  const makeThenable = () => ({
    orderBy: vi.fn(() => Promise.resolve(nextSelectResult())),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(nextSelectResult()).then(resolve, reject),
  });

  chain.from = vi.fn(() => ({
    where: vi.fn(() => makeThenable()),
    orderBy: vi.fn(() => Promise.resolve(nextSelectResult())),
  }));

  return chain;
}

vi.mock("../db", () => ({
  db: {
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockInsertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: mockUpdateReturning,
        })),
      })),
    })),
  },
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "user-1" },
        dbUser: { id: "user-1" },
      };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
}));

import { registerRelayRoutes } from "../routes/relay";

function createApp() {
  const app = express();
  app.use(express.json());
  const ctx = {
    broadcastToSession: vi.fn(),
    broadcastToTeam: vi.fn(),
    broadcastToMatch: vi.fn(),
  };
  registerRelayRoutes(app, ctx);
  return { app, ctx };
}

describe("接力路由 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    selectIndex = 0;
  });

  // ────────────────────────────────────────────────────
  // POST /api/matches/:matchId/relay/assign — 分配段落
  // ────────────────────────────────────────────────────
  describe("POST /api/matches/:matchId/relay/assign — 分配段落", () => {
    it("建立者可以分配段落", async () => {
      const { app, ctx } = createApp();
      // select #0: match 存在且為建立者（where）
      // select #1: 參與者列表（where().orderBy()）
      selectResults = [
        [{ id: "match-1", creatorId: "user-1" }],
        [
          { id: "p1", userId: "u1", joinedAt: new Date() },
          { id: "p2", userId: "u2", joinedAt: new Date() },
        ],
      ];

      // 每個參與者 update returning（L48 的 update 沒有 .returning()，不消費佇列）
      mockUpdateReturning
        .mockResolvedValueOnce([{ id: "p1", relaySegment: 1, relayStatus: "active", userId: "u1" }])
        .mockResolvedValueOnce([{ id: "p2", relaySegment: 2, relayStatus: "pending", userId: "u2" }]);

      const res = await request(app)
        .post("/api/matches/match-1/relay/assign")
        .set("Authorization", "Bearer valid-token")
        .send({
          relayConfig: {
            segmentCount: 2,
            handoffMethod: "auto_on_complete",
          },
        });

      expect(res.status).toBe(200);
      expect(ctx.broadcastToMatch).toHaveBeenCalledWith(
        "match-1",
        expect.objectContaining({ type: "relay_segments_assigned" }),
      );
    });

    it("非建立者不能分配段落", async () => {
      const { app } = createApp();
      selectResults = [[{ id: "match-1", creatorId: "other-user" }]];

      const res = await request(app)
        .post("/api/matches/match-1/relay/assign")
        .set("Authorization", "Bearer valid-token")
        .send({
          relayConfig: { segmentCount: 2, handoffMethod: "auto_on_complete" },
        });

      expect(res.status).toBe(403);
    });

    it("無效的 relayConfig 回傳 400", async () => {
      const { app } = createApp();
      // 需要先讓 match 查詢通過（路由先查 match 再驗證 body）
      selectResults = [[{ id: "match-1", creatorId: "user-1" }]];

      const res = await request(app)
        .post("/api/matches/match-1/relay/assign")
        .set("Authorization", "Bearer valid-token")
        .send({
          relayConfig: { segmentCount: 0 }, // 無效：必須為正整數
        });

      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────
  // GET /api/matches/:matchId/relay/status — 接力進度
  // ────────────────────────────────────────────────────
  describe("GET /api/matches/:matchId/relay/status — 接力進度", () => {
    it("回傳接力進度", async () => {
      const { app } = createApp();
      // select #0: match（where）
      // select #1: participants（where().orderBy()）
      selectResults = [
        [{ id: "match-1", relayConfig: { segmentCount: 3 } }],
        [
          { userId: "u1", relaySegment: 1, relayStatus: "completed", currentScore: 50 },
          { userId: "u2", relaySegment: 2, relayStatus: "active", currentScore: 30 },
        ],
      ];

      const res = await request(app)
        .get("/api/matches/match-1/relay/status");

      expect(res.status).toBe(200);
      expect(res.body.matchId).toBe("match-1");
      expect(res.body.completedSegments).toBe(1);
    });

    it("對戰不存在回傳 404", async () => {
      const { app } = createApp();
      selectResults = [[]];

      const res = await request(app)
        .get("/api/matches/nonexistent/relay/status");

      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/matches/:matchId/relay/handoff — 傳棒
  // ────────────────────────────────────────────────────
  describe("POST /api/matches/:matchId/relay/handoff — 傳棒", () => {
    it("active 狀態的參與者可以傳棒", async () => {
      const { app, ctx } = createApp();
      // select #0: 當前參與者（where with and）
      // select #1: 下一位參與者（where with and）
      selectResults = [
        [{
          id: "p1",
          userId: "user-1",
          relayStatus: "active",
          relaySegment: 1,
        }],
        [{
          id: "p2",
          userId: "u2",
          relayStatus: "pending",
          relaySegment: 2,
        }],
      ];

      // 完成當前段落 + 啟動下一位
      mockUpdateReturning.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/matches/match-1/relay/handoff")
        .set("Authorization", "Bearer valid-token")
        .send({ toUserId: "u2" });

      expect(res.status).toBe(200);
      expect(ctx.broadcastToMatch).toHaveBeenCalledWith(
        "match-1",
        expect.objectContaining({ type: "relay_handoff" }),
      );
    });

    it("非 active 狀態不能傳棒", async () => {
      const { app } = createApp();
      selectResults = [[{
        id: "p1",
        userId: "user-1",
        relayStatus: "pending",
      }]];

      const res = await request(app)
        .post("/api/matches/match-1/relay/handoff")
        .set("Authorization", "Bearer valid-token")
        .send({ toUserId: "u2" });

      expect(res.status).toBe(400);
    });

    it("缺少 toUserId 回傳 400", async () => {
      const { app } = createApp();

      const res = await request(app)
        .post("/api/matches/match-1/relay/handoff")
        .set("Authorization", "Bearer valid-token")
        .send({});

      expect(res.status).toBe(400);
    });

    it("未加入對戰回傳 404", async () => {
      const { app } = createApp();
      selectResults = [[]];

      const res = await request(app)
        .post("/api/matches/match-1/relay/handoff")
        .set("Authorization", "Bearer valid-token")
        .send({ toUserId: "u2" });

      expect(res.status).toBe(404);
    });
  });
});
