// 🔐 場次參賽者判斷
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockProgress, mockTeamRows } = vi.hoisted(() => ({
  mockProgress: vi.fn(),
  mockTeamRows: vi.fn(),
}));

vi.mock("../storage", () => ({ storage: { getPlayerProgressByUser: mockProgress } }));
vi.mock("../db", () => {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => mockTeamRows(),
  };
  return { db: { select: () => chain } };
});

import { isSessionParticipant } from "../services/session-access";

describe("isSessionParticipant", () => {
  beforeEach(() => {
    mockProgress.mockReset();
    mockTeamRows.mockReset().mockResolvedValue([]);
  });

  it("在此場次有自己的進度 → 是參賽者（不必查隊伍）", async () => {
    mockProgress.mockResolvedValue({ id: "p1" });
    expect(await isSessionParticipant("s1", "u1")).toBe(true);
    expect(mockTeamRows).not.toHaveBeenCalled();
  });

  it("隊伍共用場次的成員（剛開賽還沒進度）→ 是參賽者", async () => {
    mockProgress.mockResolvedValue(undefined);
    mockTeamRows.mockResolvedValue([{ one: 1 }]);
    expect(await isSessionParticipant("s1", "u1")).toBe(true);
  });

  it("沒有進度也不是隊員 → 不是參賽者", async () => {
    mockProgress.mockResolvedValue(undefined);
    expect(await isSessionParticipant("s1", "stranger")).toBe(false);
  });

  it("缺參數 → false", async () => {
    expect(await isSessionParticipant("", "u1")).toBe(false);
    expect(mockProgress).not.toHaveBeenCalled();
  });
});
