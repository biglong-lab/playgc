/**
 * 對戰路由 API — matches.ts（2026-09-23 P1 改寫：路由只做驗證 / 轉呼叫，資料操作在 services）
 * Mock 策略：mock services（match-lobby / match-view / match-lifecycle）與 storage，驗證路由規則
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { lobby, view, life, mockStorage, mockGuestName } = vi.hoisted(() => ({
  lobby: {
    checkCanStart: vi.fn(),
    countParticipants: vi.fn(),
    createMatch: vi.fn(),
    findMyActiveMatch: vi.fn(),
    findWaitingMatchByCode: vi.fn(),
    getMatch: vi.fn(),
    isMatchParticipant: vi.fn(),
    joinMatch: vi.fn(),
    kickParticipant: vi.fn(),
    leaveMatch: vi.fn(),
    listWaitingMatches: vi.fn(),
    matchModeOf: vi.fn(),
  },
  view: { getMatchDetail: vi.fn(), getMyMatchState: vi.fn() },
  life: { beginCountdown: vi.fn(), finishMatch: vi.fn(), loadMatchRanking: vi.fn(), promoteToPlaying: vi.fn() },
  mockStorage: { getGame: vi.fn() },
  mockGuestName: vi.fn(),
}));

vi.mock("../services/match-lobby", () => lobby);
vi.mock("../services/match-view", () => view);
vi.mock("../services/match-lifecycle", () => life);
vi.mock("../storage", () => ({ storage: mockStorage }));
vi.mock("../services/guest-display-name", () => ({ persistGuestDisplayName: mockGuestName }));
vi.mock("../routes/relay", () => ({ registerRelayRoutes: vi.fn() }));
vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = { claims: { sub: "user-1", signInProvider: "anonymous" } };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
  // 可選認證：有帶 token 就附上身分（賽事詳情用來決定要不要回邀請碼）
  optionalAuth: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = { claims: { sub: "user-1", signInProvider: "anonymous" } };
    }
    return next();
  }),
}));

import { registerMatchRoutes } from "../routes/matches";

const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const GAME_ID = "22222222-2222-4222-8222-222222222222";
const AUTH = { Authorization: "Bearer valid-token" };

function createApp() {
  const app = express();
  app.use(express.json());
  const ctx = { broadcastToSession: vi.fn(), broadcastToTeam: vi.fn(), broadcastToMatch: vi.fn() };
  registerMatchRoutes(app, ctx as never);
  return { app, ctx };
}

function match(overrides: Record<string, unknown> = {}) {
  return { id: MATCH_ID, gameId: GAME_ID, creatorId: "user-1", status: "waiting", matchMode: "competitive", settings: {}, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  life.loadMatchRanking.mockResolvedValue([]);
});

describe("建立賽事 POST /api/games/:gameId/matches", () => {
  it("未登入 → 401", async () => {
    const res = await request(createApp().app).post(`/api/games/${GAME_ID}/matches`);
    expect(res.status).toBe(401);
  });

  it("遊戲不存在 → 404；不是競賽 / 接力遊戲 → 400", async () => {
    const { app } = createApp();
    mockStorage.getGame.mockResolvedValueOnce(undefined);
    expect((await request(app).post(`/api/games/${GAME_ID}/matches`).set(AUTH)).status).toBe(404);
    mockStorage.getGame.mockResolvedValueOnce({ id: GAME_ID, gameMode: "individual", status: "published" });
    lobby.matchModeOf.mockReturnValueOnce(null);
    expect((await request(app).post(`/api/games/${GAME_ID}/matches`).set(AUTH)).status).toBe(400);
  });

  it("成功 → 以遊戲模式建賽、房主自動參賽、訪客暱稱寫入", async () => {
    const game = { id: GAME_ID, gameMode: "competitive", status: "published" };
    mockStorage.getGame.mockResolvedValue(game);
    lobby.matchModeOf.mockReturnValue("competitive");
    lobby.createMatch.mockResolvedValue(match());
    const res = await request(createApp().app).post(`/api/games/${GAME_ID}/matches`).set(AUTH).send({ playerName: "探險家1234" });
    expect(res.status).toBe(201);
    expect(lobby.createMatch).toHaveBeenCalledWith(game, "competitive", "user-1", false);
    expect(mockGuestName).toHaveBeenCalledWith("user-1", "探險家1234", "anonymous");
  });
});

describe("🔒 安全審查修正（2026-09-23）", () => {
  it("草稿 / 下架的遊戲不能開賽事", async () => {
    mockStorage.getGame.mockResolvedValue({ id: GAME_ID, gameMode: "competitive", status: "draft" });
    lobby.matchModeOf.mockReturnValue("competitive");
    const res = await request(createApp().app).post(`/api/games/${GAME_ID}/matches`).set(AUTH).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("還沒發布");
    expect(lobby.createMatch).not.toHaveBeenCalled();
  });

  it("私人房：建賽帶 isPrivate 會傳給服務層", async () => {
    const game = { id: GAME_ID, gameMode: "competitive", status: "published" };
    mockStorage.getGame.mockResolvedValue(game);
    lobby.matchModeOf.mockReturnValue("competitive");
    lobby.createMatch.mockResolvedValue(match());
    await request(createApp().app).post(`/api/games/${GAME_ID}/matches`).set(AUTH).send({ isPrivate: true });
    expect(lobby.createMatch).toHaveBeenCalledWith(game, "competitive", "user-1", true);
  });

  it("踢人：非房主 403；已開賽 409；成功移除並廣播", async () => {
    const { app, ctx } = createApp();
    lobby.getMatch.mockResolvedValueOnce(match({ creatorId: "other" }));
    expect((await request(app).post(`/api/matches/${MATCH_ID}/kick`).set(AUTH).send({ userId: "u2" })).status).toBe(403);
    lobby.getMatch.mockResolvedValueOnce(match({ status: "playing" }));
    expect((await request(app).post(`/api/matches/${MATCH_ID}/kick`).set(AUTH).send({ userId: "u2" })).status).toBe(409);
    lobby.getMatch.mockResolvedValue(match());
    lobby.kickParticipant.mockResolvedValueOnce(false);
    expect((await request(app).post(`/api/matches/${MATCH_ID}/kick`).set(AUTH).send({ userId: "u2" })).status).toBe(400);
    lobby.kickParticipant.mockResolvedValueOnce(true);
    const ok = await request(app).post(`/api/matches/${MATCH_ID}/kick`).set(AUTH).send({ userId: "u2" });
    expect(ok.status).toBe(200);
    expect(ctx.broadcastToMatch).toHaveBeenCalledWith(MATCH_ID, expect.objectContaining({ type: "match_participant_left" }));
  });

  it("詳情：有登入 → 把 viewerId 交給服務層（決定要不要回邀請碼）", async () => {
    lobby.getMatch.mockResolvedValue(match());
    view.getMatchDetail.mockResolvedValue({ id: MATCH_ID, ranking: [] });
    await request(createApp().app).get(`/api/matches/${MATCH_ID}`).set(AUTH);
    expect(view.getMatchDetail).toHaveBeenLastCalledWith(expect.anything(), "user-1");
  });
});

describe("大廳讀取", () => {
  it("列表：無效 ID → 400；有效 → 等待中賽事", async () => {
    const { app } = createApp();
    expect((await request(app).get("/api/games/not-a-uuid/matches")).status).toBe(400);
    lobby.listWaitingMatches.mockResolvedValue([{ id: MATCH_ID, participantCount: 2 }]);
    const res = await request(app).get(`/api/games/${GAME_ID}/matches`);
    expect(res.body).toEqual([{ id: MATCH_ID, participantCount: 2 }]);
  });

  it("我的賽事：回傳進行中賽事或 null", async () => {
    lobby.findMyActiveMatch.mockResolvedValue(null);
    const res = await request(createApp().app).get(`/api/games/${GAME_ID}/matches/mine`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expect(lobby.findMyActiveMatch).toHaveBeenCalledWith(GAME_ID, "user-1");
  });

  it("詳情：不存在 → 404；存在 → 檢視資料", async () => {
    const { app } = createApp();
    lobby.getMatch.mockResolvedValueOnce(undefined);
    expect((await request(app).get(`/api/matches/${MATCH_ID}`)).status).toBe(404);
    lobby.getMatch.mockResolvedValueOnce(match());
    view.getMatchDetail.mockResolvedValue({ id: MATCH_ID, ranking: [] });
    expect((await request(app).get(`/api/matches/${MATCH_ID}`)).body).toEqual({ id: MATCH_ID, ranking: [] });
    // 未登入 → 不帶 viewerId（服務層據此不回邀請碼）
    expect(view.getMatchDetail).toHaveBeenLastCalledWith(expect.anything(), undefined);
  });

  it("我的狀態：要登入；回傳 getMyMatchState 結果", async () => {
    const { app } = createApp();
    expect((await request(app).get(`/api/matches/${MATCH_ID}/me`)).status).toBe(401);
    lobby.getMatch.mockResolvedValue(match({ status: "playing" }));
    view.getMyMatchState.mockResolvedValue({ matchId: MATCH_ID, isParticipant: true });
    const res = await request(app).get(`/api/matches/${MATCH_ID}/me`).set(AUTH);
    expect(res.body).toEqual({ matchId: MATCH_ID, isParticipant: true });
  });
});

describe("加入 / 邀請碼 / 退出", () => {
  it("加入失敗 → 用服務回的狀態碼與訊息", async () => {
    lobby.joinMatch.mockResolvedValue({ ok: false, status: 409, message: "這場賽事人數已滿" });
    const res = await request(createApp().app).post(`/api/matches/${MATCH_ID}/join`).set(AUTH);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("這場賽事人數已滿");
  });

  it("新加入 → 201 + 廣播；已加入 → 200 不重複廣播", async () => {
    const { app, ctx } = createApp();
    lobby.joinMatch.mockResolvedValueOnce({ ok: true, participant: { id: "p1" }, alreadyJoined: false, participantCount: 2 });
    expect((await request(app).post(`/api/matches/${MATCH_ID}/join`).set(AUTH)).status).toBe(201);
    expect(ctx.broadcastToMatch).toHaveBeenCalledWith(MATCH_ID, expect.objectContaining({ type: "match_participant_joined" }));
    ctx.broadcastToMatch.mockClear();
    lobby.joinMatch.mockResolvedValueOnce({ ok: true, participant: { id: "p1" }, alreadyJoined: true, participantCount: 2 });
    const again = await request(app).post(`/api/matches/${MATCH_ID}/join`).set(AUTH);
    expect(again.status).toBe(200);
    expect(again.body.matchId).toBe(MATCH_ID);
    expect(ctx.broadcastToMatch).not.toHaveBeenCalled();
  });

  it("邀請碼：沒填 → 400；找不到 → 404；找到 → 加入那場", async () => {
    const { app } = createApp();
    expect((await request(app).post(`/api/games/${GAME_ID}/matches/join-by-code`).set(AUTH).send({})).status).toBe(400);
    lobby.findWaitingMatchByCode.mockResolvedValueOnce(undefined);
    expect((await request(app).post(`/api/games/${GAME_ID}/matches/join-by-code`).set(AUTH).send({ code: "ABCD23" })).status).toBe(404);
    lobby.findWaitingMatchByCode.mockResolvedValueOnce(match());
    lobby.joinMatch.mockResolvedValue({ ok: true, participant: { id: "p2" }, alreadyJoined: false, participantCount: 2 });
    const res = await request(app).post(`/api/games/${GAME_ID}/matches/join-by-code`).set(AUTH).send({ code: "abcd23" });
    expect(res.status).toBe(201);
    expect(lobby.joinMatch).toHaveBeenCalledWith(MATCH_ID, "user-1");
  });

  it("退出：已開賽 → 409；房主退出 = 取消並廣播", async () => {
    const { app, ctx } = createApp();
    lobby.getMatch.mockResolvedValue(match());
    lobby.leaveMatch.mockResolvedValueOnce("not_waiting");
    expect((await request(app).post(`/api/matches/${MATCH_ID}/leave`).set(AUTH)).status).toBe(409);
    lobby.leaveMatch.mockResolvedValueOnce("cancelled");
    const res = await request(app).post(`/api/matches/${MATCH_ID}/leave`).set(AUTH);
    expect(res.body).toEqual({ success: true, result: "cancelled" });
    expect(ctx.broadcastToMatch).toHaveBeenCalledWith(MATCH_ID, expect.objectContaining({ type: "match_cancelled" }));
  });
});

describe("房主：開賽 / 結束", () => {
  it("不是房主 → 403 且附可讀 message", async () => {
    lobby.getMatch.mockResolvedValue(match({ creatorId: "someone-else" }));
    const res = await request(createApp().app).post(`/api/matches/${MATCH_ID}/start`).set(AUTH);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("只有房主可以開始對戰");
  });

  it("開賽條件不足 → 400 顯示原因、不進倒數", async () => {
    lobby.getMatch.mockResolvedValue(match());
    lobby.countParticipants.mockResolvedValue(1);
    lobby.checkCanStart.mockReturnValue("至少需要 2 人才能開始（還差 1 人）");
    const res = await request(createApp().app).post(`/api/matches/${MATCH_ID}/start`).set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("還差 1 人");
    expect(life.beginCountdown).not.toHaveBeenCalled();
  });

  it("條件符合 → 交給伺服器倒數（beginCountdown）", async () => {
    const m = match();
    lobby.getMatch.mockResolvedValue(m);
    lobby.countParticipants.mockResolvedValue(2);
    lobby.checkCanStart.mockReturnValue(null);
    life.beginCountdown.mockResolvedValue({ ...m, status: "countdown" });
    const { app, ctx } = createApp();
    const res = await request(app).post(`/api/matches/${MATCH_ID}/start`).set(AUTH);
    expect(res.status).toBe(200);
    expect(life.beginCountdown).toHaveBeenCalledWith(m, ctx.broadcastToMatch);
  });

  it("結束：非房主 403；不在進行中 409；成功以 host_ended 結算", async () => {
    const { app, ctx } = createApp();
    lobby.getMatch.mockResolvedValueOnce(match({ creatorId: "x" }));
    expect((await request(app).post(`/api/matches/${MATCH_ID}/finish`).set(AUTH)).status).toBe(403);
    lobby.getMatch.mockResolvedValue(match({ status: "playing" }));
    life.finishMatch.mockResolvedValueOnce(false);
    expect((await request(app).post(`/api/matches/${MATCH_ID}/finish`).set(AUTH)).status).toBe(409);
    life.finishMatch.mockResolvedValueOnce(true);
    expect((await request(app).post(`/api/matches/${MATCH_ID}/finish`).set(AUTH)).status).toBe(200);
    expect(life.finishMatch).toHaveBeenLastCalledWith(MATCH_ID, ctx.broadcastToMatch, "host_ended");
  });

  it("倒數補救：非參賽者 403；參賽者且逾時 → 開賽", async () => {
    const { app } = createApp();
    lobby.getMatch.mockResolvedValue(match({ status: "countdown", updatedAt: new Date(Date.now() - 60_000).toISOString() }));
    lobby.isMatchParticipant.mockResolvedValueOnce(false);
    expect((await request(app).post(`/api/matches/${MATCH_ID}/recover`).set(AUTH)).status).toBe(403);
    lobby.isMatchParticipant.mockResolvedValueOnce(true);
    expect((await request(app).post(`/api/matches/${MATCH_ID}/recover`).set(AUTH)).status).toBe(200);
    expect(life.promoteToPlaying).toHaveBeenCalled();
  });

  it("前端送分入口停用 → 410", async () => {
    const res = await request(createApp().app).patch(`/api/matches/${MATCH_ID}/score`).set(AUTH).send({ score: 100 });
    expect(res.status).toBe(410);
  });
});
