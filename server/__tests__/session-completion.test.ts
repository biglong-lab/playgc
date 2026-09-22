// 🏁 場次完成紀錄寫入 — 計分開關規則
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockStorage, mockUnlock, mockSquad, mockDeferred, mockLbRows } = vi.hoisted(() => ({
  mockStorage: {
    getGame: vi.fn(),
    getUser: vi.fn(),
    getSession: vi.fn(),
    createLeaderboardEntry: vi.fn(),
    getPlayerProgress: vi.fn(),
  },
  mockUnlock: vi.fn(),
  mockSquad: vi.fn(),
  mockDeferred: vi.fn(),
  mockLbRows: vi.fn(),
}));

vi.mock("../storage", () => ({ storage: mockStorage }));
vi.mock("../services/achievement-unlock", () => ({ checkAndUnlockAchievements: mockUnlock }));
vi.mock("../services/squad-record-writer", () => ({
  writeSquadRecordFromSession: mockSquad,
  triggerDeferredSessionRewards: mockDeferred,
}));
vi.mock("../db", () => {
  const chain = { from: () => chain, where: () => chain, limit: () => mockLbRows() };
  return { db: { select: () => chain } };
});

import { recordSessionCompletion, backfillClaimedCompletions } from "../services/session-completion";
import type { GameSession } from "@shared/schema";

function session(score: number): GameSession {
  return { id: "s-1", gameId: "g-1", score, teamName: "隊", playerName: null } as unknown as GameSession;
}

describe("recordSessionCompletion", () => {
  beforeEach(() => {
    Object.values(mockStorage).forEach((f) => f.mockReset());
    mockUnlock.mockReset();
    mockSquad.mockReset();
    mockStorage.getUser.mockResolvedValue({ firstName: "小明" });
    mockStorage.getPlayerProgress.mockResolvedValue([{ userId: "u-1", inventory: [] }]);
    mockDeferred.mockReset().mockResolvedValue(true);
    mockLbRows.mockReset().mockResolvedValue([]);
  });

  it("計分遊戲有分數 → 排行榜 + 成就 + 隊伍戰績（既有行為）", async () => {
    mockStorage.getGame.mockResolvedValue({ id: "g-1", scoringEnabled: true });
    await recordSessionCompletion(session(80), "u-1");
    expect(mockStorage.createLeaderboardEntry).toHaveBeenCalledWith(expect.objectContaining({ totalScore: 80 }));
    expect(mockUnlock).toHaveBeenCalled();
    expect(mockSquad).toHaveBeenCalled();
  });

  it("計分遊戲 0 分 → 都不寫（維持既有規則）", async () => {
    mockStorage.getGame.mockResolvedValue({ id: "g-1", scoringEnabled: null });
    await recordSessionCompletion(session(0), "u-1");
    expect(mockStorage.createLeaderboardEntry).not.toHaveBeenCalled();
    expect(mockUnlock).not.toHaveBeenCalled();
    expect(mockSquad).not.toHaveBeenCalled();
  });

  it("不計分遊戲 → 不寫排行榜，但完成就記錄成就與隊伍戰績", async () => {
    mockStorage.getGame.mockResolvedValue({ id: "g-1", scoringEnabled: false });
    await recordSessionCompletion(session(0), "u-1");
    expect(mockStorage.createLeaderboardEntry).not.toHaveBeenCalled();
    expect(mockUnlock).toHaveBeenCalledWith(expect.objectContaining({ gameCompleted: true }));
    expect(mockSquad).toHaveBeenCalled();
  });

  it("不計分遊戲即使帶分數也不上排行榜", async () => {
    mockStorage.getGame.mockResolvedValue({ id: "g-1", scoringEnabled: false });
    await recordSessionCompletion(session(50), "u-1");
    expect(mockStorage.createLeaderboardEntry).not.toHaveBeenCalled();
  });

  describe("🎟️ 身份規則：訪客延後、認領補寫", () => {
    it("訪客完成 → 不寫排行榜、不跑成就；隊伍戰績照寫", async () => {
      mockStorage.getGame.mockResolvedValue({ id: "g-1", scoringEnabled: true });
      await recordSessionCompletion(session(80), "anon-1", { isGuest: true });
      expect(mockStorage.createLeaderboardEntry).not.toHaveBeenCalled();
      expect(mockUnlock).not.toHaveBeenCalled();
      expect(mockSquad).toHaveBeenCalled();
    });

    it("認領補寫：已通關 → 以正式帳號補排行榜、成就、獎勵", async () => {
      mockStorage.getGame.mockResolvedValue({ id: "g-1", scoringEnabled: true });
      mockStorage.getSession.mockResolvedValue({ ...session(80), status: "completed" });
      const n = await backfillClaimedCompletions(["s-1"], "real-1");
      expect(n).toBe(1);
      expect(mockStorage.createLeaderboardEntry).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "s-1", totalScore: 80 }));
      expect(mockUnlock).toHaveBeenCalledWith(expect.objectContaining({ userId: "real-1" }));
      expect(mockDeferred).toHaveBeenCalledWith("s-1", "real-1");
    });

    it("這場已有排行榜紀錄（隊友寫過）→ 不重複寫", async () => {
      mockStorage.getGame.mockResolvedValue({ id: "g-1", scoringEnabled: true });
      mockStorage.getSession.mockResolvedValue({ ...session(80), status: "completed" });
      mockLbRows.mockResolvedValue([{ id: 9 }]);
      await backfillClaimedCompletions(["s-1"], "real-1");
      expect(mockStorage.createLeaderboardEntry).not.toHaveBeenCalled();
    });

    it("未完成的場次 → 不補寫", async () => {
      mockStorage.getSession.mockResolvedValue({ ...session(0), status: "playing" });
      expect(await backfillClaimedCompletions(["s-1"], "real-1")).toBe(0);
      expect(mockUnlock).not.toHaveBeenCalled();
      expect(mockDeferred).not.toHaveBeenCalled();
    });

    it("不計分遊戲 → 不上排行榜，但補成就與獎勵", async () => {
      mockStorage.getGame.mockResolvedValue({ id: "g-1", scoringEnabled: false });
      mockStorage.getSession.mockResolvedValue({ ...session(0), status: "completed" });
      await backfillClaimedCompletions(["s-1"], "real-1");
      expect(mockStorage.createLeaderboardEntry).not.toHaveBeenCalled();
      expect(mockUnlock).toHaveBeenCalled();
      expect(mockDeferred).toHaveBeenCalled();
    });
  });
});
