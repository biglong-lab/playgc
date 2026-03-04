import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock: battle-storage ──
const mockStorage = vi.hoisted(() => ({
  getSlot: vi.fn(),
  getVenue: vi.fn(),
  getRegistration: vi.fn(),
  getActiveRegistrationCount: vi.fn(),
  createRegistration: vi.fn(),
  updateSlotCount: vi.fn(),
  updateSlot: vi.fn(),
  updateRegistration: vi.fn(),
  updatePremadeGroupCount: vi.fn(),
  getUpcomingRegistrations: vi.fn(),
  createPremadeGroup: vi.fn(),
  getPremadeGroupByCode: vi.fn(),
  getPremadeGroupsBySlot: vi.fn(),
  getRegistrationsBySlot: vi.fn(),
  updateSlotConfirmedCount: vi.fn(),
}));

vi.mock("../storage/battle-storage", () => ({
  battleStorageMethods: mockStorage,
}));

// ── Mock: Firebase 認證 ──
vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, _res: any, next: () => void) => {
    if (req.headers["x-user-id"]) {
      req.user = {
        claims: { sub: req.headers["x-user-id"] },
        dbUser: { id: req.headers["x-user-id"], displayName: "測試玩家" },
      };
      return next();
    }
    return _res.status(401).json({ error: "未認證" });
  }),
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

// ── Mock: schema ──
vi.mock("@shared/schema", () => ({
  insertRegistrationSchema: { parse: vi.fn((d: any) => d) },
  insertPremadeGroupSchema: { parse: vi.fn((d: any) => d) },
}));

import express from "express";
import request from "supertest";
import { registerBattleRegistrationRoutes } from "../routes/battle-registration";

const userHeaders = { "x-user-id": "user-1" };
const adminHeaders = { "x-admin-id": "admin-1", "x-field-id": "field-1" };

function createApp() {
  const app = express();
  app.use(express.json());
  registerBattleRegistrationRoutes(app);
  return app;
}

describe("對戰報名 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /api/battle/slots/:slotId/register ──

  it("未認證報名 → 401", async () => {
    const app = createApp();
    const res = await request(app).post("/api/battle/slots/slot-1/register").send({});
    expect(res.status).toBe(401);
  });

  it("時段不存在 → 404", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/battle/slots/slot-1/register")
      .set(userHeaders)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("時段不存在");
  });

  it("時段已結束不開放報名 → 400", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue({ id: "slot-1", status: "completed", venueId: "v-1" });

    const res = await request(app)
      .post("/api/battle/slots/slot-1/register")
      .set(userHeaders)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("不開放報名");
  });

  it("已報名同一時段 → 409", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue({ id: "slot-1", status: "open", venueId: "v-1" });
    mockStorage.getRegistration.mockResolvedValue({ id: "reg-1", status: "registered" });

    const res = await request(app)
      .post("/api/battle/slots/slot-1/register")
      .set(userHeaders)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("已報名");
  });

  it("時段已額滿 → 400", async () => {
    const app = createApp();
    mockStorage.getSlot.mockResolvedValue({ id: "slot-1", status: "open", venueId: "v-1" });
    mockStorage.getRegistration.mockResolvedValue(null);
    mockStorage.getVenue.mockResolvedValue({ id: "v-1", maxPlayers: 10, minPlayers: 4 });
    mockStorage.getActiveRegistrationCount.mockResolvedValue(10);

    const res = await request(app)
      .post("/api/battle/slots/slot-1/register")
      .set(userHeaders)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("額滿");
  });

  it("成功報名 → 201", async () => {
    const app = createApp();
    const fakeReg = { id: "reg-new", slotId: "slot-1", userId: "user-1", status: "registered" };

    mockStorage.getSlot.mockResolvedValue({
      id: "slot-1", status: "open", venueId: "v-1",
      minPlayersOverride: null, maxPlayersOverride: null,
    });
    mockStorage.getRegistration.mockResolvedValue(null);
    mockStorage.getVenue.mockResolvedValue({ id: "v-1", maxPlayers: 20, minPlayers: 4 });
    mockStorage.getActiveRegistrationCount.mockResolvedValue(3);
    mockStorage.createRegistration.mockResolvedValue(fakeReg);
    mockStorage.updateSlotCount.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/battle/slots/slot-1/register")
      .set(userHeaders)
      .send({ skillLevel: "beginner" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("reg-new");
    expect(mockStorage.createRegistration).toHaveBeenCalledOnce();
    expect(mockStorage.updateSlotCount).toHaveBeenCalledWith("slot-1", 1);
  });

  // ── POST /api/battle/slots/:slotId/cancel ──

  it("找不到報名紀錄 → 404", async () => {
    const app = createApp();
    mockStorage.getRegistration.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/battle/slots/slot-1/cancel")
      .set(userHeaders)
      .send();

    expect(res.status).toBe(404);
  });

  it("已報到無法取消 → 400", async () => {
    const app = createApp();
    mockStorage.getRegistration.mockResolvedValue({ id: "reg-1", status: "checked_in" });

    const res = await request(app)
      .post("/api/battle/slots/slot-1/cancel")
      .set(userHeaders)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("已報到");
  });

  it("成功取消報名", async () => {
    const app = createApp();
    mockStorage.getRegistration.mockResolvedValue({
      id: "reg-1", status: "registered", premadeGroupId: null,
    });
    mockStorage.updateRegistration.mockResolvedValue(undefined);
    mockStorage.updateSlotCount.mockResolvedValue(undefined);
    mockStorage.getSlot.mockResolvedValue({
      id: "slot-1", status: "confirmed", venueId: "v-1",
      minPlayersOverride: null, maxPlayersOverride: null,
    });
    mockStorage.getVenue.mockResolvedValue({ id: "v-1", maxPlayers: 20, minPlayers: 4 });
    mockStorage.getActiveRegistrationCount.mockResolvedValue(5);

    const res = await request(app)
      .post("/api/battle/slots/slot-1/cancel")
      .set(userHeaders)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("已取消");
    expect(mockStorage.updateRegistration).toHaveBeenCalledWith("reg-1", expect.objectContaining({ status: "cancelled" }));
  });

  // ── GET /api/battle/my-registrations ──

  it("成功取得我的報名列表", async () => {
    const app = createApp();
    const fakeList = [
      { id: "reg-1", slotId: "slot-1", status: "registered" },
      { id: "reg-2", slotId: "slot-2", status: "confirmed" },
    ];
    mockStorage.getUpcomingRegistrations.mockResolvedValue(fakeList);

    const res = await request(app)
      .get("/api/battle/my-registrations")
      .set(userHeaders);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockStorage.getUpcomingRegistrations).toHaveBeenCalledWith("user-1");
  });
});
