// 🏁 場次完成紀錄寫入 — 計分開關規則
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockStorage, mockUnlock, mockSquad } = vi.hoisted(() => ({
  mockStorage: {
    getGame: vi.fn(),
    getUser: vi.fn(),
    createLeaderboardEntry: vi.fn(),
    getPlayerProgress: vi.fn(),
  },
  mockUnlock: vi.fn(),
  mockSquad: vi.fn(),
}));

vi.mock("../storage", () => ({ storage: mockStorage }));
vi.mock("../services/achievement-unlock", () => ({ checkAndUnlockAchievements: mockUnlock }));
vi.mock("../services/squad-record-writer", () => ({ writeSquadRecordFromSession: mockSquad }));

import { recordSessionCompletion } from "../services/session-completion";
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
});
