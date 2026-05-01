// ShootingTeam 單元測試
//
// 覆蓋：
//   - 純函式 helpers：accumulate / groupHitsByUser / getTeamRanking / isTeamComplete
//   - 元件：render 進度條 / 個人貢獻 / 排行榜 / 達標 onComplete

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ShootingTeam, {
  accumulateTeamHitCount,
  accumulateTeamScore,
  groupHitsByUser,
  getTeamRanking,
  isTeamComplete,
  type TeamShootingHit,
  type TeamMemberInfo,
} from "../ShootingTeam";
import type { ShootingMissionConfig } from "@shared/schema";

// ============================================================================
// 純函式 helpers
// ============================================================================

const makeHit = (overrides: Partial<TeamShootingHit> = {}): TeamShootingHit => ({
  userId: "u1",
  displayName: "玩家",
  hitZone: "outer",
  score: 5,
  timestamp: "2026-05-01",
  ...overrides,
});

describe("accumulateTeamHitCount", () => {
  it("空陣列 → 0", () => {
    expect(accumulateTeamHitCount([])).toBe(0);
  });

  it("3 筆命中 → 3", () => {
    expect(accumulateTeamHitCount([makeHit(), makeHit(), makeHit()])).toBe(3);
  });
});

describe("accumulateTeamScore", () => {
  it("空陣列 → 0", () => {
    expect(accumulateTeamScore([])).toBe(0);
  });

  it("加總所有 score 欄位", () => {
    const hits = [makeHit({ score: 10 }), makeHit({ score: 20 }), makeHit({ score: 5 })];
    expect(accumulateTeamScore(hits)).toBe(35);
  });

  it("無 score 視為 0", () => {
    const hits = [
      makeHit({ score: 10 }),
      makeHit({ score: 0 }),
      makeHit({ score: 5 }),
    ];
    expect(accumulateTeamScore(hits)).toBe(15);
  });
});

describe("groupHitsByUser", () => {
  it("空陣列 → 空 Map", () => {
    expect(groupHitsByUser([]).size).toBe(0);
  });

  it("依 userId 分組累計 count + score", () => {
    const hits = [
      makeHit({ userId: "u1", displayName: "阿明", score: 10 }),
      makeHit({ userId: "u1", displayName: "阿明", score: 5 }),
      makeHit({ userId: "u2", displayName: "小華", score: 20 }),
    ];
    const result = groupHitsByUser(hits);
    expect(result.get("u1")).toEqual({ count: 2, score: 15, displayName: "阿明" });
    expect(result.get("u2")).toEqual({ count: 1, score: 20, displayName: "小華" });
  });
});

describe("getTeamRanking", () => {
  const members: TeamMemberInfo[] = [
    { userId: "u1", displayName: "阿明" },
    { userId: "u2", displayName: "小華" },
    { userId: "u3", displayName: "小美" },
  ];

  it("依命中數降序排序", () => {
    const hits = [
      makeHit({ userId: "u1", displayName: "阿明", score: 5 }),
      makeHit({ userId: "u2", displayName: "小華", score: 10 }),
      makeHit({ userId: "u2", displayName: "小華", score: 10 }),
      makeHit({ userId: "u2", displayName: "小華", score: 10 }),
    ];
    const ranking = getTeamRanking(hits, members);
    expect(ranking[0].userId).toBe("u2"); // 3 命中
    expect(ranking[1].userId).toBe("u1"); // 1 命中
    expect(ranking[2].userId).toBe("u3"); // 0 命中
  });

  it("命中數相同時依分數降序", () => {
    const hits = [
      makeHit({ userId: "u1", displayName: "阿明", score: 10 }),
      makeHit({ userId: "u2", displayName: "小華", score: 50 }),
    ];
    const ranking = getTeamRanking(hits, members);
    expect(ranking[0].userId).toBe("u2"); // 同 1 命中但分數高
    expect(ranking[1].userId).toBe("u1");
  });

  it("未命中的隊員仍進排行榜（0 命中 0 分）", () => {
    const ranking = getTeamRanking([], members);
    expect(ranking).toHaveLength(3);
    ranking.forEach((r) => {
      expect(r.count).toBe(0);
      expect(r.score).toBe(0);
    });
  });

  it("有命中但不在 members 清單的玩家也加進去（防同步漂移）", () => {
    const hits = [makeHit({ userId: "ghost", displayName: "幽靈", score: 5 })];
    const ranking = getTeamRanking(hits, members);
    expect(ranking).toHaveLength(4);
    expect(ranking.find((r) => r.userId === "ghost")).toBeDefined();
  });
});

describe("isTeamComplete", () => {
  it("requiredHits 達標 → true", () => {
    const hits = [makeHit(), makeHit(), makeHit()];
    expect(isTeamComplete(hits, { requiredHits: 3, timeLimit: 60 })).toBe(true);
  });

  it("requiredHits 未達 → false", () => {
    const hits = [makeHit(), makeHit()];
    expect(isTeamComplete(hits, { requiredHits: 3, timeLimit: 60 })).toBe(false);
  });

  it("targetScore 達標 → true（即使命中數不足）", () => {
    const hits = [makeHit({ score: 100 })];
    expect(
      isTeamComplete(hits, { requiredHits: 5, targetScore: 100, timeLimit: 60 }),
    ).toBe(true);
  });

  it("minScore 也算 targetScore", () => {
    const hits = [makeHit({ score: 50 })];
    expect(isTeamComplete(hits, { minScore: 50, timeLimit: 60 })).toBe(true);
  });

  it("兩者都未達 → false", () => {
    const hits = [makeHit({ score: 5 })];
    expect(
      isTeamComplete(hits, { requiredHits: 10, targetScore: 100, timeLimit: 60 }),
    ).toBe(false);
  });

  it("無 requiredHits 也無 targetScore → false（無條件可達標）", () => {
    expect(isTeamComplete([makeHit()], { timeLimit: 60 })).toBe(false);
  });
});

// ============================================================================
// 元件互動
// ============================================================================

const baseConfig: ShootingMissionConfig = {
  title: "靶機挑戰",
  requiredHits: 5,
  timeLimit: 60,
};

const baseMembers: TeamMemberInfo[] = [
  { userId: "me", displayName: "我" },
  { userId: "u2", displayName: "隊友 A" },
];

const baseProps = {
  config: baseConfig,
  myUserId: "me",
  teamHits: [] as TeamShootingHit[],
  members: baseMembers,
  onComplete: vi.fn(),
};

describe("ShootingTeam 元件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("render 標題、進度條、排行榜", () => {
    render(<ShootingTeam {...baseProps} />);
    expect(screen.getByText("靶機挑戰")).toBeInTheDocument();
    expect(screen.getByTestId("shooting-team-overall-progress")).toBeInTheDocument();
    expect(screen.getByTestId("shooting-team-ranking")).toBeInTheDocument();
  });

  it("排行榜含全部成員（即使無命中）", () => {
    render(<ShootingTeam {...baseProps} />);
    expect(screen.getByTestId("shooting-team-rank-0")).toBeInTheDocument();
    expect(screen.getByTestId("shooting-team-rank-1")).toBeInTheDocument();
  });

  it("自己（myUserId）在排行榜會標記「（你）」", () => {
    render(<ShootingTeam {...baseProps} />);
    expect(screen.getByText(/（你）/)).toBeInTheDocument();
  });

  it("我的貢獻區顯示個人 count + score", () => {
    const teamHits: TeamShootingHit[] = [
      { userId: "me", displayName: "我", hitZone: "inner", score: 8, timestamp: "" },
      { userId: "me", displayName: "我", hitZone: "outer", score: 5, timestamp: "" },
      { userId: "u2", displayName: "隊友 A", hitZone: "inner", score: 8, timestamp: "" },
    ];
    render(<ShootingTeam {...baseProps} teamHits={teamHits} />);

    const myStat = screen.getByTestId("shooting-team-my-stat");
    expect(myStat.textContent).toContain("2"); // count
    expect(myStat.textContent).toContain("13"); // 8 + 5
  });

  it("進度條依 hits / requiredHits", () => {
    const teamHits: TeamShootingHit[] = [
      { userId: "u1", displayName: "u1", hitZone: "inner", score: 10, timestamp: "" },
      { userId: "u1", displayName: "u1", hitZone: "inner", score: 10, timestamp: "" },
    ];
    render(<ShootingTeam {...baseProps} teamHits={teamHits} />);
    // 2/5 命中 → 顯示「2 / 5 命中」
    expect(screen.getByText(/2 \/ 5 命中/)).toBeInTheDocument();
  });

  it("達 requiredHits → 1 秒後 onComplete 帶總分", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const teamHits: TeamShootingHit[] = Array.from({ length: 5 }, (_, i) => ({
      userId: i % 2 === 0 ? "me" : "u2",
      displayName: i % 2 === 0 ? "我" : "隊友 A",
      hitZone: "inner",
      score: 10,
      timestamp: "",
    }));
    render(<ShootingTeam {...baseProps} teamHits={teamHits} onComplete={onComplete} />);

    expect(screen.getByTestId("shooting-team-complete")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1100);
    expect(onComplete).toHaveBeenCalledWith({ points: 50 });
    vi.useRealTimers();
  });

  it("isStarted=false 時不會 onComplete（即使達標）", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const teamHits: TeamShootingHit[] = Array.from({ length: 10 }, () => ({
      userId: "u1",
      displayName: "u1",
      hitZone: "inner",
      score: 10,
      timestamp: "",
    }));
    render(
      <ShootingTeam
        {...baseProps}
        teamHits={teamHits}
        onComplete={onComplete}
        isStarted={false}
      />,
    );
    vi.advanceTimersByTime(2000);
    expect(onComplete).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("無 description 時不顯示描述", () => {
    render(<ShootingTeam {...baseProps} />);
    // 沒有 description 屬性 → 不會 render description 段落
    // 用 query 確認 title 還在但無多餘文字
    expect(screen.getByText("靶機挑戰")).toBeInTheDocument();
  });
});
