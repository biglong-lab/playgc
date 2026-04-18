import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock: battle-storage ──
const mockStorage = vi.hoisted(() => ({
  getSlot: vi.fn(),
  getVenue: vi.fn(),
  getResultBySlot: vi.fn(),
  createResult: vi.fn(),
  getOrCreateRanking: vi.fn(),
  updateRanking: vi.fn(),
  createPlayerResults: vi.fn(),
  getPlayerResultsByResult: vi.fn(),
  updateSlot: vi.fn(),
}));

const mockGetPlayerResultsByResultWithNames = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("../storage/battle-storage", () => ({
  battleStorageMethods: mockStorage,
  getPlayerResultsByResultWithNames: mockGetPlayerResultsByResultWithNames,
}));

// ── Mock: 管理員認證 ──
vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, _res: any, next: () => void) => {
    if (req.headers["x-admin-id"]) {
      req.admin = {
        id: req.headers["x-admin-id"],
        fieldId: req.headers["x-field-id"] || "field-1",
        systemRole: req.headers["x-system-role"] || "field_admin",
        permissions: ["game:view"],
      };
      return next();
    }
    return _res.status(401).json({ message: "未認證" });
  }),
}));

// ── Mock: ELO 計算 ──
vi.mock("../services/battle-elo", () => ({
  calculateElo: vi.fn(() => ({ newRating: 1050, ratingChange: 50, newTier: "platinum" })),
  teamAvgRating: vi.fn(() => 1000),
}));

// ── Mock: 成就系統 ──
vi.mock("../services/battle-achievement-checker", () => ({
  checkAndUnlockAchievements: vi.fn(() => []),
}));

// ── Mock: schema ──
vi.mock("@shared/schema", () => ({
  insertBattleResultSchema: { parse: vi.fn((d: any) => d) },
  insertPlayerResultSchema: { parse: vi.fn((d: any) => d) },
  getTierFromRating: vi.fn((rating: number) => {
    if (rating >= 2000) return "master";
    if (rating >= 1500) return "diamond";
    if (rating >= 1000) return "platinum";
    if (rating >= 600) return "gold";
    if (rating >= 300) return "silver";
    return "bronze";
  }),
}));

import express from "express";
import request from "supertest";
import { registerBattleResultRoutes } from "../routes/battle-results";

const adminHeaders = {
  "x-admin-id": "admin-1",
  "x-field-id": "field-1",
};

const mockCtx = {
  broadcastToSession: vi.fn(),
  broadcastToTeam: vi.fn(),
  broadcastToMatch: vi.fn(),
  broadcastToBattleSlot: vi.fn(),
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerBattleResultRoutes(app, mockCtx as any);
  return app;
}

describe("對戰結果 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /api/battle/slots/:slotId/result ──

  it("未認證記錄結果 → 401", async () => {
    const app = createApp();
    const res = await request(app).post("/api/battle/slots/slot-1/result").send({});
    expect(res.status).toBe(401);
  });

  it("時段不存在 → 404", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/battle/slots/slot-1/result")
      .set(adminHeaders)
      .send({ winningTeam: "A" });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("時段不存在");
  });

  it("時段狀態不正確（open）→ 400", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue({ id: "slot-1", status: "open", venueId: "v-1" });

    const res = await request(app)
      .post("/api/battle/slots/slot-1/result")
      .set(adminHeaders)
      .send({ winningTeam: "A" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("進行中或已完成");
  });

  it("已有結果記錄 → 409", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue({ id: "slot-1", status: "in_progress", venueId: "v-1" });
    mockStorage.getResultBySlot.mockResolvedValue({ id: "result-old" });

    const res = await request(app)
      .post("/api/battle/slots/slot-1/result")
      .set(adminHeaders)
      .send({ winningTeam: "A" });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("已有結果");
  });

  it("成功記錄對戰結果 → 201", async () => {
    const app = createApp();
    const fakeResult = { id: "result-1", slotId: "slot-1", winningTeam: "A" };

    mockStorage.getSlot.mockResolvedValue({ id: "slot-1", status: "in_progress", venueId: "v-1" });
    mockStorage.getResultBySlot.mockResolvedValue(null);
    mockStorage.getVenue.mockResolvedValue({ id: "v-1", fieldId: "field-1" });
    mockStorage.createResult.mockResolvedValue(fakeResult);
    mockStorage.getOrCreateRanking.mockResolvedValue({
      id: "rank-1", rating: 1000, totalBattles: 5,
      wins: 3, losses: 2, draws: 0,
      winStreak: 1, bestStreak: 2, mvpCount: 0,
    });
    mockStorage.updateRanking.mockResolvedValue(undefined);
    mockStorage.createPlayerResults.mockResolvedValue([
      { id: "pr-1", userId: "u1", team: "A", ratingChange: 50 },
    ]);
    mockStorage.updateSlot.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/battle/slots/slot-1/result")
      .set(adminHeaders)
      .send({
        winningTeam: "A",
        isDraw: false,
        teamScores: [{ team: "A", score: 10 }, { team: "B", score: 5 }],
        durationMinutes: 30,
        playerResults: [
          { userId: "u1", team: "A", score: 5, hits: 10, eliminations: 3, deaths: 1, isMvp: true },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.result.id).toBe("result-1");
    expect(mockStorage.createResult).toHaveBeenCalledOnce();
    expect(mockStorage.createPlayerResults).toHaveBeenCalledOnce();
    expect(mockStorage.updateSlot).toHaveBeenCalledWith("slot-1", { status: "completed" });
    expect(mockCtx.broadcastToBattleSlot).toHaveBeenCalledWith(
      "slot-1",
      expect.objectContaining({ type: "battle_result_published" }),
    );
  });

  // ── GET /api/battle/slots/:slotId/result ──

  it("尚無結果記錄 → 404", async () => {
    const app = createApp();
    mockStorage.getResultBySlot.mockResolvedValue(null);

    const res = await request(app).get("/api/battle/slots/slot-1/result");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("尚無結果");
  });

  it("成功取得對戰結果", async () => {
    const app = createApp();
    const fakeResult = { id: "result-1", slotId: "slot-1", winningTeam: "A" };

    mockStorage.getResultBySlot.mockResolvedValue(fakeResult);
    mockGetPlayerResultsByResultWithNames.mockResolvedValue([
      {
        playerResult: { id: "pr-1", userId: "u1", team: "A", ratingChange: 50 },
        firstName: "玩",
        lastName: "家",
      },
    ]);

    const res = await request(app).get("/api/battle/slots/slot-1/result");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("result-1");
    expect(res.body.playerResults).toHaveLength(1);
  });

  it("成功記錄結果後呼叫 ELO 更新排名", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue({ id: "slot-1", status: "in_progress", venueId: "v-1" });
    mockStorage.getResultBySlot.mockResolvedValue(null);
    mockStorage.getVenue.mockResolvedValue({ id: "v-1", fieldId: "field-1" });
    mockStorage.createResult.mockResolvedValue({ id: "result-1" });
    mockStorage.getOrCreateRanking.mockResolvedValue({
      id: "rank-1", rating: 1000, totalBattles: 5,
      wins: 3, losses: 2, draws: 0,
      winStreak: 1, bestStreak: 2, mvpCount: 0,
    });
    mockStorage.updateRanking.mockResolvedValue(undefined);
    mockStorage.createPlayerResults.mockResolvedValue([]);
    mockStorage.updateSlot.mockResolvedValue(undefined);

    await request(app)
      .post("/api/battle/slots/slot-1/result")
      .set(adminHeaders)
      .send({
        winningTeam: "A",
        isDraw: false,
        playerResults: [
          { userId: "u1", team: "A", score: 5, hits: 10, eliminations: 3, deaths: 1, isMvp: false },
        ],
      });

    expect(mockStorage.getOrCreateRanking).toHaveBeenCalled();
    expect(mockStorage.updateRanking).toHaveBeenCalledWith(
      "rank-1",
      expect.objectContaining({ rating: 1050, tier: "platinum" }),
    );
  });
});
