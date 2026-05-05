import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MultiVote from "../MultiVote";
import type { MultiVoteConfig, MultiVoteState, VoteRecord } from "../MultiVote";

const defaultConfig: MultiVoteConfig = {
  title: "🗳️ 最佳活動投票",
  question: "哪個攤位最好玩？",
  options: [
    { id: "a", label: "射氣球", emoji: "🎈" },
    { id: "b", label: "套圈圈", emoji: "⭕" },
    { id: "c", label: "打水槍", emoji: "💦" },
  ],
  showResultsAfterVote: true,
  showVoterCount: true,
};

const emptyState: MultiVoteState = { votes: [] };
const mockOnVote = vi.fn(() => Promise.resolve());

const makeVote = (userId: string, optionId: string): VoteRecord => ({
  userId,
  userName: `user-${userId}`,
  optionIds: [optionId],
  votedAt: Date.now(),
});

describe("MultiVote", () => {
  it("顯示標題", () => {
    render(<MultiVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.getByTestId("multi-vote-title")).toHaveTextContent("最佳活動投票");
  });

  it("顯示問題", () => {
    render(<MultiVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.getByTestId("multi-vote-question")).toHaveTextContent("哪個攤位最好玩？");
  });

  it("顯示三個選項", () => {
    render(<MultiVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.getByTestId("vote-option-a")).toBeInTheDocument();
    expect(screen.getByTestId("vote-option-b")).toBeInTheDocument();
    expect(screen.getByTestId("vote-option-c")).toBeInTheDocument();
  });

  it("未投票時選項可點擊", () => {
    render(<MultiVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.getByTestId("vote-option-a")).not.toBeDisabled();
  });

  it("點擊選項後呼叫 onVote", async () => {
    const onVote = vi.fn(() => Promise.resolve());
    render(<MultiVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={onVote} />);
    fireEvent.click(screen.getByTestId("vote-option-b"));
    await waitFor(() => {
      expect(onVote).toHaveBeenCalledWith(["b"]);
    });
  });

  it("已投票時顯示確認訊息", () => {
    const state: MultiVoteState = { votes: [makeVote("u1", "a")] };
    render(<MultiVote config={defaultConfig} state={state} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.getByTestId("vote-submitted-msg")).toBeInTheDocument();
  });

  it("已投票時選項停用", () => {
    const state: MultiVoteState = { votes: [makeVote("u1", "a")] };
    render(<MultiVote config={defaultConfig} state={state} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.getByTestId("vote-option-a")).toBeDisabled();
    expect(screen.getByTestId("vote-option-b")).toBeDisabled();
  });

  it("已投票後顯示百分比", () => {
    const state: MultiVoteState = {
      votes: [makeVote("u1", "a"), makeVote("u2", "a"), makeVote("u3", "b")],
    };
    render(<MultiVote config={defaultConfig} state={state} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.getByTestId("vote-pct-a")).toHaveTextContent("67%");
    expect(screen.getByTestId("vote-pct-b")).toHaveTextContent("33%");
  });

  it("顯示投票人數徽章", () => {
    const state: MultiVoteState = { votes: [makeVote("u1", "a"), makeVote("u2", "b")] };
    render(<MultiVote config={defaultConfig} state={state} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.getByTestId("vote-voter-count")).toHaveTextContent("2 票");
  });

  it("未投票時不顯示結果", () => {
    const state: MultiVoteState = { votes: [makeVote("u2", "a")] };
    render(<MultiVote config={defaultConfig} state={state} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.queryByTestId("vote-pct-a")).not.toBeInTheDocument();
  });

  it("showResultsAfterVote=false 投後不顯示百分比", () => {
    const cfg = { ...defaultConfig, showResultsAfterVote: false };
    const state: MultiVoteState = { votes: [makeVote("u1", "a")] };
    render(<MultiVote config={cfg} state={state} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.queryByTestId("vote-pct-a")).not.toBeInTheDocument();
  });

  it("無投票時不顯示人數徽章", () => {
    render(<MultiVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.queryByTestId("vote-voter-count")).not.toBeInTheDocument();
  });

  it("投後顯示即時結果說明", () => {
    const state: MultiVoteState = { votes: [makeVote("u1", "a")] };
    render(<MultiVote config={defaultConfig} state={state} myUserId="u1" onVote={mockOnVote} />);
    expect(screen.getByTestId("vote-results-note")).toBeInTheDocument();
  });
});
