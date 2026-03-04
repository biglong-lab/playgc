import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock: battle-storage ──
const mockStorage = vi.hoisted(() => ({
  getSlot: vi.fn(),
  getVenue: vi.fn(),
  getRegistrationsBySlot: vi.fn(),
  getPremadeGroupsBySlot: vi.fn(),
  updateRegistration: vi.fn(),
}));

vi.mock("../storage/battle-storage", () => ({
  battleStorageMethods: mockStorage,
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

// ── Mock: 配對服務 ──
const mockAssignTeams = vi.hoisted(() => vi.fn());
vi.mock("../services/battle-matchmaking", () => ({
  assignTeams: mockAssignTeams,
}));

import express from "express";
import request from "supertest";
import { registerBattleMatchmakingRoutes } from "../routes/battle-matchmaking";

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
  registerBattleMatchmakingRoutes(app, mockCtx as any);
  return app;
}

describe("對戰配對 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /api/battle/slots/:slotId/matchmake ──

  it("未認證 → 401", async () => {
    const app = createApp();
    const res = await request(app).post("/api/battle/slots/slot-1/matchmake").send();
    expect(res.status).toBe(401);
  });

  it("時段不存在 → 404", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/battle/slots/slot-1/matchmake")
      .set(adminHeaders)
      .send();

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("時段不存在");
  });

  it("時段狀態非 confirmed/full → 400", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue({ id: "slot-1", status: "open", venueId: "v-1" });

    const res = await request(app)
      .post("/api/battle/slots/slot-1/matchmake")
      .set(adminHeaders)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("可配對狀態");
  });

  it("無權限操作他場場地 → 403", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue({ id: "slot-1", status: "confirmed", venueId: "v-1" });
    mockStorage.getVenue.mockResolvedValue({ id: "v-1", fieldId: "field-other" });

    const res = await request(app)
      .post("/api/battle/slots/slot-1/matchmake")
      .set(adminHeaders)
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("無權限");
  });

  it("成功執行配對", async () => {
    const app = createApp();
    const fakeRegistrations = [
      { id: "reg-1", userId: "u1", status: "registered" },
      { id: "reg-2", userId: "u2", status: "registered" },
    ];
    const fakeTeamResult = {
      teams: [
        { teamName: "A", members: [{ registrationId: "reg-1", userId: "u1" }] },
        { teamName: "B", members: [{ registrationId: "reg-2", userId: "u2" }] },
      ],
    };

    mockStorage.getSlot.mockResolvedValue({ id: "slot-1", status: "confirmed", venueId: "v-1" });
    mockStorage.getVenue.mockResolvedValue({ id: "v-1", fieldId: "field-1" });
    mockStorage.getRegistrationsBySlot.mockResolvedValue(fakeRegistrations);
    mockStorage.getPremadeGroupsBySlot.mockResolvedValue([]);
    mockAssignTeams.mockReturnValue(fakeTeamResult);
    mockStorage.updateRegistration.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/battle/slots/slot-1/matchmake")
      .set(adminHeaders)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(2);
    expect(mockAssignTeams).toHaveBeenCalledOnce();
    expect(mockStorage.updateRegistration).toHaveBeenCalledTimes(2);
    expect(mockCtx.broadcastToBattleSlot).toHaveBeenCalledWith(
      "slot-1",
      expect.objectContaining({ type: "battle_teams_assigned" }),
    );
  });

  // ── GET /api/battle/slots/:slotId/teams ──

  it("成功取得配對結果", async () => {
    const app = createApp();
    mockStorage.getRegistrationsBySlot.mockResolvedValue([
      { id: "reg-1", userId: "u1", assignedTeam: "A", status: "registered", skillLevel: "beginner" },
      { id: "reg-2", userId: "u2", assignedTeam: "B", status: "registered", skillLevel: "advanced" },
      { id: "reg-3", userId: "u3", assignedTeam: null, status: "cancelled" },
    ]);

    const res = await request(app).get("/api/battle/slots/slot-1/teams");

    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(2);
    expect(res.body.unassigned).toEqual([]);
  });
});
