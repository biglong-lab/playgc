// VoteTeam 單元測試
//
// 覆蓋：
//   - 純函式 helpers：computeVoteResults / isVotingComplete / getProgressLabel / getWinnerIndex
//   - 元件互動：render 標題/選項、點選 → onCastVote、hasVoted 後 disabled
//   - 三種 votingMode 完成條件
//   - onComplete 觸發 + nextPageId 推導

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VoteTeam, {
  computeVoteResults,
  isVotingComplete,
  getProgressLabel,
  getWinnerIndex,
  type TeamVoteState,
} from "../VoteTeam";
import type { VoteConfig } from "@shared/schema";

// ============================================================================
// 純函式 helpers
// ============================================================================

describe("computeVoteResults", () => {
  it("無投票回零陣列", () => {
    const result = computeVoteResults([], 3);
    expect(result).toEqual([
      { optionIndex: 0, count: 0, percentage: 0 },
      { optionIndex: 1, count: 0, percentage: 0 },
      { optionIndex: 2, count: 0, percentage: 0 },
    ]);
  });

  it("依選項分類計票 + 計算百分比", () => {
    const ballots = [
      { userId: "u1", optionIndex: 0, votedAt: "2026-05-01" },
      { userId: "u2", optionIndex: 0, votedAt: "2026-05-01" },
      { userId: "u3", optionIndex: 1, votedAt: "2026-05-01" },
    ];
    const result = computeVoteResults(ballots, 2);
    expect(result[0]).toEqual({ optionIndex: 0, count: 2, percentage: 67 });
    expect(result[1]).toEqual({ optionIndex: 1, count: 1, percentage: 33 });
  });

  it("超出 optionIndex 範圍的票不計", () => {
    const ballots = [
      { userId: "u1", optionIndex: 5, votedAt: "2026-05-01" },
      { userId: "u2", optionIndex: -1, votedAt: "2026-05-01" },
      { userId: "u3", optionIndex: 0, votedAt: "2026-05-01" },
    ];
    const result = computeVoteResults(ballots, 2);
    // u1/u2 不計，u3 計（但分母仍是 ballots.length=3）
    expect(result[0].count).toBe(1);
    expect(result[1].count).toBe(0);
  });
});

describe("isVotingComplete", () => {
  const makeState = (overrides: Partial<TeamVoteState>): TeamVoteState => ({
    ballots: [],
    totalMembers: 4,
    votingMode: "majority",
    ...overrides,
  });

  it("無 state → false", () => {
    expect(isVotingComplete(undefined)).toBe(false);
  });

  // 🛡️ 2026-07-04 Phase A2：門檻改與 server 一致（ceil(n/2)）——
  //   4 人 ceil(4/2)=2 票即完成（原 client `>n/2` 要 3 票、兩端判定不同步）
  it("majority：達 ceil(n/2) 即 true（4 人 2 票過、1 票還沒）", () => {
    expect(
      isVotingComplete(
        makeState({
          ballots: [{ userId: "u1", optionIndex: 0, votedAt: "" }],
        }),
      ),
    ).toBe(false);
    expect(
      isVotingComplete(
        makeState({
          ballots: [
            { userId: "u1", optionIndex: 0, votedAt: "" },
            { userId: "u2", optionIndex: 1, votedAt: "" },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("unanimous：必須全員投完", () => {
    const ballots3 = [
      { userId: "u1", optionIndex: 0, votedAt: "" },
      { userId: "u2", optionIndex: 0, votedAt: "" },
      { userId: "u3", optionIndex: 0, votedAt: "" },
    ];
    expect(
      isVotingComplete(makeState({ votingMode: "unanimous", ballots: ballots3 })),
    ).toBe(false);

    expect(
      isVotingComplete(
        makeState({
          votingMode: "unanimous",
          ballots: [...ballots3, { userId: "u4", optionIndex: 0, votedAt: "" }],
        }),
      ),
    ).toBe(true);
  });

  it("display：1 票就 true（每位玩家投完自己即可）", () => {
    expect(
      isVotingComplete(
        makeState({
          votingMode: "display",
          ballots: [{ userId: "u1", optionIndex: 0, votedAt: "" }],
        }),
      ),
    ).toBe(true);
  });
});

describe("getProgressLabel", () => {
  it("無 state → 等待建立投票", () => {
    expect(getProgressLabel(undefined)).toBe("等待建立投票...");
  });

  it("majority 顯示「需過半」", () => {
    const result = getProgressLabel({
      ballots: [{ userId: "u1", optionIndex: 0, votedAt: "" }],
      totalMembers: 4,
      votingMode: "majority",
    });
    expect(result).toContain("1 / 4");
    expect(result).toContain("需過半");
  });

  it("unanimous 顯示「需全員」", () => {
    const result = getProgressLabel({
      ballots: [],
      totalMembers: 3,
      votingMode: "unanimous",
    });
    expect(result).toContain("0 / 3");
    expect(result).toContain("需全員");
  });
});

describe("getWinnerIndex", () => {
  it("無投票 → 0", () => {
    expect(getWinnerIndex([], 3)).toBe(0);
  });

  it("最高票 index 勝出", () => {
    const ballots = [
      { userId: "u1", optionIndex: 1, votedAt: "" },
      { userId: "u2", optionIndex: 1, votedAt: "" },
      { userId: "u3", optionIndex: 0, votedAt: "" },
    ];
    expect(getWinnerIndex(ballots, 3)).toBe(1);
  });

  it("平手取最早 index", () => {
    const ballots = [
      { userId: "u1", optionIndex: 0, votedAt: "" },
      { userId: "u2", optionIndex: 1, votedAt: "" },
    ];
    expect(getWinnerIndex(ballots, 2)).toBe(0);
  });
});

// ============================================================================
// 元件互動
// ============================================================================

const baseConfig: VoteConfig = {
  title: "晚餐吃什麼？",
  question: "選一家",
  options: [
    { text: "牛肉麵", nextPageId: "page-beef" },
    { text: "披薩", nextPageId: "page-pizza" },
    { text: "壽司", nextPageId: "page-sushi" },
  ],
  showResults: true,
};

const baseProps = {
  config: baseConfig,
  myUserId: "me",
  teamId: "team-1",
  voteState: undefined as TeamVoteState | undefined,
  onEnsureVote: vi.fn(),
  onCastVote: vi.fn(),
  onComplete: vi.fn(),
};

describe("VoteTeam 元件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("render 標題、問題、3 個選項按鈕", () => {
    render(<VoteTeam {...baseProps} />);
    expect(screen.getByText("晚餐吃什麼？")).toBeInTheDocument();
    expect(screen.getByText("選一家")).toBeInTheDocument();
    expect(screen.getByTestId("vote-team-option-0")).toBeInTheDocument();
    expect(screen.getByTestId("vote-team-option-1")).toBeInTheDocument();
    expect(screen.getByTestId("vote-team-option-2")).toBeInTheDocument();
  });

  it("初次掛載自動呼叫 onEnsureVote 一次", async () => {
    const onEnsureVote = vi.fn();
    render(<VoteTeam {...baseProps} onEnsureVote={onEnsureVote} />);
    await waitFor(() => expect(onEnsureVote).toHaveBeenCalledTimes(1));
  });

  it("點選項呼叫 onCastVote", async () => {
    const onCastVote = vi.fn();
    render(<VoteTeam {...baseProps} onCastVote={onCastVote} />);
    fireEvent.click(screen.getByTestId("vote-team-option-1"));
    await waitFor(() => expect(onCastVote).toHaveBeenCalledWith(1));
  });

  it("已投票後選項全部 disabled", () => {
    const voteState: TeamVoteState = {
      ballots: [{ userId: "me", optionIndex: 0, votedAt: "2026-05-01" }],
      totalMembers: 4,
      votingMode: "majority",
    };
    render(<VoteTeam {...baseProps} voteState={voteState} />);
    expect(screen.getByTestId("vote-team-option-0")).toBeDisabled();
    expect(screen.getByTestId("vote-team-option-1")).toBeDisabled();
    expect(screen.getByText("你已投票")).toBeInTheDocument();
  });

  it("無選項時顯示空狀態", () => {
    const config: VoteConfig = { ...baseConfig, options: [] };
    render(<VoteTeam {...baseProps} config={config} />);
    expect(screen.getByTestId("vote-team-empty")).toBeInTheDocument();
  });

  it("達 majority 條件 → 1 秒後 onComplete 帶 winner 的 nextPageId", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const voteState: TeamVoteState = {
      ballots: [
        { userId: "u1", optionIndex: 1, votedAt: "" }, // 披薩
        { userId: "u2", optionIndex: 1, votedAt: "" }, // 披薩（贏）
        { userId: "u3", optionIndex: 0, votedAt: "" },
      ],
      totalMembers: 4,
      votingMode: "majority",
    };
    render(<VoteTeam {...baseProps} voteState={voteState} onComplete={onComplete} />);

    // 1 秒延遲
    await vi.advanceTimersByTimeAsync(1100);
    expect(onComplete).toHaveBeenCalledWith(undefined, "page-pizza");
    vi.useRealTimers();
  });

  it("nextPageStrategy='self' → 走自己投的選項", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const config: VoteConfig = { ...baseConfig, nextPageStrategy: "self" };
    const voteState: TeamVoteState = {
      ballots: [
        { userId: "me", optionIndex: 2, votedAt: "" }, // 我選壽司
        { userId: "u1", optionIndex: 0, votedAt: "" },
        { userId: "u2", optionIndex: 0, votedAt: "" },
      ],
      totalMembers: 4,
      votingMode: "majority",
    };
    render(
      <VoteTeam {...baseProps} config={config} voteState={voteState} onComplete={onComplete} />,
    );

    await vi.advanceTimersByTimeAsync(1100);
    expect(onComplete).toHaveBeenCalledWith(undefined, "page-sushi");
    vi.useRealTimers();
  });

  it("votingMode='display' 第 1 票就觸發完成", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const voteState: TeamVoteState = {
      ballots: [{ userId: "me", optionIndex: 1, votedAt: "" }],
      totalMembers: 4,
      votingMode: "display",
    };
    render(<VoteTeam {...baseProps} voteState={voteState} onComplete={onComplete} />);

    await vi.advanceTimersByTimeAsync(1100);
    expect(onComplete).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("未達標時不呼叫 onComplete", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const voteState: TeamVoteState = {
      ballots: [{ userId: "u1", optionIndex: 0, votedAt: "" }], // 1/4 未過半
      totalMembers: 4,
      votingMode: "majority",
    };
    render(<VoteTeam {...baseProps} voteState={voteState} onComplete={onComplete} />);
    vi.advanceTimersByTime(2000);
    expect(onComplete).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("showResults=false 隱藏票數百分比", () => {
    const config: VoteConfig = { ...baseConfig, showResults: false };
    const voteState: TeamVoteState = {
      ballots: [{ userId: "u1", optionIndex: 0, votedAt: "" }],
      totalMembers: 4,
      votingMode: "majority",
    };
    render(<VoteTeam {...baseProps} config={config} voteState={voteState} />);
    // 精準匹配「N 票（X%）」格式（避開進度文字「N/M 人已投票（...）」）
    expect(screen.queryByText(/\d+\s*票（\d+%）/)).not.toBeInTheDocument();
  });
});
