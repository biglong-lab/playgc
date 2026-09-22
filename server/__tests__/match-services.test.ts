// 🏁 賽事服務的純規則（2026-09-23 P1）：設定快照 / 開賽條件 / 排名 / 接力分段 / 場次掛勾
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLife } = vi.hoisted(() => ({
  mockLife: {
    linkMatchSession: vi.fn(),
    syncMatchScoreFromSession: vi.fn(),
    isRelayLegSession: vi.fn(),
    completeMatchParticipant: vi.fn(),
  },
}));
vi.mock("../db", () => ({ db: {} }));

import { buildMatchSettings, checkCanStart, matchModeOf } from "../services/match-lobby";
import { rankParticipants } from "../services/match-lifecycle";
import { relayLegsOf } from "../services/relay-lifecycle";

describe("buildMatchSettings（遊戲設定 → 賽事快照）", () => {
  it("競賽：分鐘換秒、人數沿用設定；0 分鐘 = 不限時", () => {
    const { settings, maxTeams } = buildMatchSettings({ timeLimitMinutes: 10, minParticipants: 3, maxParticipants: 8 }, "competitive");
    expect(settings).toMatchObject({ timeLimit: 600, minParticipants: 3, maxParticipants: 8, countdownSeconds: 3 });
    expect(maxTeams).toBe(8);
    expect(buildMatchSettings({ timeLimitMinutes: 0 }, "competitive").settings.timeLimit).toBeUndefined();
  });

  it("接力：人數上下限 = 棒數，分段一起拍快照", () => {
    const segs = [{ fromPage: 1, toPage: 2 }, { fromPage: 3, toPage: 5 }];
    const { settings, maxTeams } = buildMatchSettings({ relaySegments: segs, minParticipants: 9 }, "relay");
    expect(settings).toMatchObject({ minParticipants: 2, maxParticipants: 2, relaySegments: segs });
    expect(maxTeams).toBe(2);
  });

  it("沒設定 → 系統預設（最少 2 人、最多 10 人、倒數 3 秒）", () => {
    expect(buildMatchSettings(null, "competitive").settings).toMatchObject({ minParticipants: 2, maxParticipants: 10, countdownSeconds: 3 });
  });
});

describe("checkCanStart / matchModeOf", () => {
  it("讀快照裡的人數與分段", () => {
    expect(checkCanStart({ matchMode: "competitive", settings: { minParticipants: 3 } as never }, 2)).toContain("還差 1 人");
    const relay = { matchMode: "relay", settings: { relaySegments: [{ fromPage: 1, toPage: 1 }, { fromPage: 2, toPage: 2 }] } as never };
    expect(checkCanStart(relay, 2)).toBeNull();
    expect(checkCanStart(relay, 3)).toContain("剛好 2 人");
  });

  it("只有 competitive / relay 會開賽事", () => {
    expect(matchModeOf({ gameMode: "relay" })).toBe("relay");
    expect(matchModeOf({ gameMode: "team" })).toBeNull();
  });
});

describe("rankParticipants", () => {
  it("分數高者先；同分先完成者先；未完成排最後", () => {
    const t = (s: number) => new Date(2026, 8, 23, 10, 0, s);
    const ranked = rankParticipants([
      { id: "a", currentScore: 50, completedAt: null },
      { id: "b", currentScore: 80, completedAt: t(30) },
      { id: "c", currentScore: 50, completedAt: t(10) },
      { id: "d", currentScore: 80, completedAt: t(20) },
    ]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([["d", 1], ["b", 2], ["c", 3], ["a", 4]]);
  });
});

describe("relayLegsOf", () => {
  it("快照分段 → 棒次（1-based）；沒設定 → 空", () => {
    expect(relayLegsOf({ settings: { relaySegments: [{ fromPage: 1, toPage: 4 }] } as never })).toEqual([{ segment: 1, fromPage: 1, toPage: 4 }]);
    expect(relayLegsOf({ settings: null })).toEqual([]);
  });
});

describe("match-session-hooks", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("../services/match-lifecycle", () => mockLife);
    Object.values(mockLife).forEach((f) => f.mockReset());
  });

  it("matchId 不是 UUID → 不綁定、不查 DB", async () => {
    const { linkSessionToMatch } = await import("../services/match-session-hooks");
    expect(await linkSessionToMatch("../../etc", "u1", "s1")).toBe(false);
    expect(mockLife.linkMatchSession).not.toHaveBeenCalled();
  });

  it("綁定失敗（拋錯）→ 回 false，不影響場次建立", async () => {
    mockLife.linkMatchSession.mockRejectedValue(new Error("db down"));
    const { linkSessionToMatch } = await import("../services/match-session-hooks");
    expect(await linkSessionToMatch("11111111-1111-4111-8111-111111111111", "u1", "s1")).toBe(false);
  });

  it("沒有 WS 廣播（測試環境）→ 完成處理直接略過", async () => {
    const { completeMatchForSession } = await import("../services/match-session-hooks");
    await completeMatchForSession("s1", "u1", 10, undefined);
    expect(mockLife.completeMatchParticipant).not.toHaveBeenCalled();
  });

  it("有廣播 → 把驗證後分數交給賽事完成處理", async () => {
    const broadcast = vi.fn();
    const { completeMatchForSession } = await import("../services/match-session-hooks");
    await completeMatchForSession("s1", "u1", 42, broadcast);
    expect(mockLife.completeMatchParticipant).toHaveBeenCalledWith("s1", "u1", 42, broadcast);
  });
});
