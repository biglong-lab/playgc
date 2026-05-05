import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfidenceVote } from "../ConfidenceVote";

let mockState: Record<string, unknown> = {};
const mockUpdateState = vi.fn((s: unknown) => { mockState = s as Record<string, unknown>; });
let mockIsLoaded = true;

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
  config: { title: "信心投票", question: "你對這個決定的信心？" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLoaded = true;
  mockState = { votes: [], revealed: false };
});

describe("ConfidenceVote", () => {
  it("顯示標題和問題", () => {
    render(<ConfidenceVote {...defaultProps} />);
    expect(screen.getByTestId("cv-title")).toHaveTextContent("信心投票");
    expect(screen.getByTestId("cv-question")).toHaveTextContent("你對這個決定的信心？");
  });

  it("顯示已投票人數（初始 0）", () => {
    render(<ConfidenceVote {...defaultProps} />);
    expect(screen.getByTestId("cv-count")).toHaveTextContent("0");
  });

  it("顯示 5 個星星按鈕", () => {
    render(<ConfidenceVote {...defaultProps} />);
    expect(screen.getByTestId("cv-stars")).toBeInTheDocument();
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`cv-star-${i}`)).toBeInTheDocument();
    }
  });

  it("點擊星星呼叫 updateState 帶入正確分數", () => {
    render(<ConfidenceVote {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cv-star-4"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const called = mockUpdateState.mock.calls[0][0] as { votes: { score: number }[] };
    expect(called.votes[0].score).toBe(4);
  });

  it("已投票後顯示 my-vote badge", () => {
    mockState = {
      votes: [{ voteId: "v1", userId: "u1", userName: "Alice", score: 3 }],
      revealed: false,
    };
    render(<ConfidenceVote {...defaultProps} />);
    expect(screen.getByTestId("cv-my-vote")).toBeInTheDocument();
  });

  it("已投票後隱藏星星選擇", () => {
    mockState = {
      votes: [{ voteId: "v1", userId: "u1", userName: "Alice", score: 3 }],
      revealed: false,
    };
    render(<ConfidenceVote {...defaultProps} />);
    expect(screen.queryByTestId("cv-stars")).not.toBeInTheDocument();
  });

  it("isTeamLead + 已投票 → 顯示公布按鈕", () => {
    mockState = {
      votes: [{ voteId: "v1", userId: "u1", userName: "Alice", score: 5 }],
      revealed: false,
    };
    render(<ConfidenceVote {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("cv-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長不顯示公布按鈕", () => {
    mockState = {
      votes: [{ voteId: "v1", userId: "u1", userName: "Alice", score: 5 }],
      revealed: false,
    };
    render(<ConfidenceVote {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("cv-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊公布結果 updateState revealed=true", () => {
    mockState = {
      votes: [{ voteId: "v1", userId: "u1", userName: "Alice", score: 5 }],
      revealed: false,
    };
    render(<ConfidenceVote {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("cv-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示平均分數", () => {
    mockState = {
      votes: [
        { voteId: "v1", userId: "u1", userName: "Alice", score: 4 },
        { voteId: "v2", userId: "u2", userName: "Bob", score: 2 },
      ],
      revealed: true,
    };
    render(<ConfidenceVote {...defaultProps} />);
    expect(screen.getByTestId("cv-result")).toBeInTheDocument();
    expect(screen.getByTestId("cv-avg")).toHaveTextContent("3.0");
  });

  it("revealed=true 顯示分佈長條圖", () => {
    mockState = {
      votes: [
        { voteId: "v1", userId: "u1", userName: "Alice", score: 5 },
        { voteId: "v2", userId: "u2", userName: "Bob", score: 3 },
      ],
      revealed: true,
    };
    render(<ConfidenceVote {...defaultProps} />);
    expect(screen.getByTestId("cv-dist-5")).toBeInTheDocument();
    expect(screen.getByTestId("cv-dist-3")).toBeInTheDocument();
  });

  it("isLoaded=false 顯示 loading spinner", () => {
    mockIsLoaded = false;
    render(<ConfidenceVote {...defaultProps} />);
    expect(screen.getByTestId("cv-loading")).toBeInTheDocument();
  });
});
