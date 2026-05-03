import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock: battle-storage ──
const mockStorage = vi.hoisted(() => ({
  getClansByField: vi.fn(),
  getClan: vi.fn(),
  getClanMembers: vi.fn(),
  getUserClan: vi.fn(),
  createClan: vi.fn(),
  createClanWithLeader: vi.fn(),
  addClanMember: vi.fn(),
  updateClan: vi.fn(),
  removeClanMember: vi.fn(),
  updateClanMemberRole: vi.fn(),
}));

const mockGetClanMembersWithNames = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("../storage/battle-storage", () => ({
  battleStorageMethods: mockStorage,
  getClanMembersWithNames: mockGetClanMembersWithNames,
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

// ── Mock: schema ──
vi.mock("@shared/schema", () => ({
  insertBattleClanSchema: {
    parse: vi.fn((d: any) => d),
    safeParse: vi.fn((d: any) => ({ success: true, data: d })),
  },
  updateBattleClanSchema: {
    parse: vi.fn((d: any) => d),
    safeParse: vi.fn((d: any) => ({ success: true, data: d })),
  },
  clanRoleEnum: ["leader", "officer", "member"],
}));

import express from "express";
import request from "supertest";
import { registerBattleClanRoutes } from "../routes/battle-clans";

const userHeaders = { "x-user-id": "user-1" };

function createApp() {
  const app = express();
  app.use(express.json());
  registerBattleClanRoutes(app);
  return app;
}

describe("戰隊 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /api/battle/clans ──

  it("缺少 fieldId → 400", async () => {
    const app = createApp();
    const res = await request(app).get("/api/battle/clans");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("fieldId");
  });

  it("成功取得場域戰隊列表", async () => {
    const app = createApp();
    const fakeClans = [
      { id: "clan-1", name: "火焰隊", memberCount: 5 },
      { id: "clan-2", name: "冰霜隊", memberCount: 3 },
    ];
    mockStorage.getClansByField.mockResolvedValue(fakeClans);

    const res = await request(app).get("/api/battle/clans?fieldId=field-1");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockStorage.getClansByField).toHaveBeenCalledWith("field-1", 50);
  });

  // ── GET /api/battle/clans/:id ──

  it("戰隊不存在 → 404", async () => {
    const app = createApp();
    mockStorage.getClan.mockResolvedValue(null);

    const res = await request(app).get("/api/battle/clans/clan-999");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("戰隊不存在");
  });

  it("成功取得戰隊詳情含成員", async () => {
    const app = createApp();
    const fakeClan = { id: "clan-1", name: "火焰隊", fieldId: "field-1" };
    mockStorage.getClan.mockResolvedValue(fakeClan);
    mockGetClanMembersWithNames.mockResolvedValueOnce([
      { member: { userId: "user-1", role: "leader" }, firstName: "隊", lastName: "長" },
      { member: { userId: "user-2", role: "member" }, firstName: "隊", lastName: "員" },
    ]);

    const res = await request(app).get("/api/battle/clans/clan-1");

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("火焰隊");
    expect(res.body.members).toHaveLength(2);
  });

  // ── GET /api/battle/my/clan ──

  it("未認證取得我的戰隊 → 401", async () => {
    const app = createApp();
    const res = await request(app).get("/api/battle/my/clan?fieldId=field-1");
    expect(res.status).toBe(401);
  });

  it("無戰隊回傳 null", async () => {
    const app = createApp();
    mockStorage.getUserClan.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/battle/my/clan?fieldId=field-1")
      .set(userHeaders);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  // ── POST 端點全部凍結 ──
  // 紅線：CLAUDE.md / ADR-0003 — Squad 系統已取代 battle_clans
  // POST /api/battle/clans 與 /api/battle/clans/:id/join 都已凍結為 410 Gone
  // 舊資料保留唯讀、不再接受新寫入

  it("POST /api/battle/clans 已凍結 → 410（Squad 系統取代）", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/battle/clans?fieldId=field-1")
      .set(userHeaders)
      .send({ name: "新隊", tag: "NEW" });

    expect(res.status).toBe(410);
  });

  it("POST /api/battle/clans/:id/join 已凍結 → 410（Squad 系統取代）", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/battle/clans/clan-1/join")
      .set(userHeaders)
      .send();

    expect(res.status).toBe(410);
  });

  // ── DELETE /api/battle/clans/:id/leave ──

  it("隊長不能直接離開 → 400", async () => {
    const app = createApp();
    mockStorage.getClan.mockResolvedValue({ id: "clan-1", leaderId: "user-1", fieldId: "field-1" });

    const res = await request(app)
      .delete("/api/battle/clans/clan-1/leave")
      .set(userHeaders)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("隊長不能直接離開");
  });

  // ── POST /api/battle/clans/:id/transfer ──

  it("非隊長無法轉讓 → 403", async () => {
    const app = createApp();
    mockStorage.getClan.mockResolvedValue({ id: "clan-1", leaderId: "other-user", fieldId: "field-1" });

    const res = await request(app)
      .post("/api/battle/clans/clan-1/transfer")
      .set(userHeaders)
      .send({ newLeaderId: "user-2" });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("只有隊長");
  });

  it("缺少 newLeaderId → 400", async () => {
    const app = createApp();
    mockStorage.getClan.mockResolvedValue({ id: "clan-1", leaderId: "user-1", fieldId: "field-1" });

    const res = await request(app)
      .post("/api/battle/clans/clan-1/transfer")
      .set(userHeaders)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("newLeaderId");
  });

  // ── POST /api/battle/clans/:id/role ──

  it("無效角色 → 400", async () => {
    const app = createApp();
    mockStorage.getClan.mockResolvedValue({ id: "clan-1", leaderId: "user-1", fieldId: "field-1" });

    const res = await request(app)
      .post("/api/battle/clans/clan-1/role")
      .set(userHeaders)
      .send({ userId: "user-2", role: "invalid_role" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("無效角色");
  });

  it("不能透過 role 端點設定 leader → 400", async () => {
    const app = createApp();
    mockStorage.getClan.mockResolvedValue({ id: "clan-1", leaderId: "user-1", fieldId: "field-1" });

    const res = await request(app)
      .post("/api/battle/clans/clan-1/role")
      .set(userHeaders)
      .send({ userId: "user-2", role: "leader" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("轉讓功能");
  });
});
