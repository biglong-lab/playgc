import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GroupDecision, { GroupDecisionConfig, GroupDecisionState, DecisionVote } from "../GroupDecision";

const baseConfig: GroupDecisionConfig = {
  title: "群體決策測試",
  question: "你支持哪個方案？",
  options: ["方案 A", "方案 B", "方案 C"],
};

const emptyState: GroupDecisionState = { votes: [], revealed: false };

const votes: DecisionVote[] = [
  { voteId: "v1", userId: "u1", userName: "Alice", choice: "方案 A" },
  { voteId: "v2", userId: "u2", userName: "Bob", choice: "方案 A" },
  { voteId: "v3", userId: "u3", userName: "Carol", choice: "方案 B" },
];

const revealedState: GroupDecisionState = { votes, revealed: true };

function renderGd(overrides: Partial<Parameters<typeof GroupDecision>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onVote: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<GroupDecision {...props} />), props };
}

describe("GroupDecision — 基本渲染", () => {
  it("顯示標題", () => {
    renderGd();
    expect(screen.getByTestId("gd-title")).toHaveTextContent("群體決策測試");
  });

  it("顯示問題", () => {
    renderGd();
    expect(screen.getByTestId("gd-question")).toHaveTextContent("你支持哪個方案？");
  });

  it("顯示選項按鈕", () => {
    renderGd();
    expect(screen.getByTestId("gd-option-0")).toHaveTextContent("方案 A");
    expect(screen.getByTestId("gd-option-1")).toHaveTextContent("方案 B");
    expect(screen.getByTestId("gd-option-2")).toHaveTextContent("方案 C");
  });

  it("顯示已投票人數 0", () => {
    renderGd();
    expect(screen.getByTestId("gd-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderGd();
    expect(screen.getByTestId("gd-reveal-btn")).toBeInTheDocument();
  });
});

describe("GroupDecision — 互動", () => {
  it("點選項呼叫 onVote 帶選項文字", () => {
    const onVote = vi.fn();
    renderGd({ onVote });
    fireEvent.click(screen.getByTestId("gd-option-1"));
    expect(onVote).toHaveBeenCalledWith("方案 B");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderGd({ onReveal });
    fireEvent.click(screen.getByTestId("gd-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已投票者顯示 gd-my-vote", () => {
    const myVote: DecisionVote = {
      voteId: "v99",
      userId: "u4",
      userName: "David",
      choice: "方案 C",
    };
    renderGd({ state: { votes: [myVote], revealed: false } });
    expect(screen.getByTestId("gd-my-vote")).toHaveTextContent("方案 C");
  });

  it("已投票者不顯示選項按鈕", () => {
    const myVote: DecisionVote = {
      voteId: "v99",
      userId: "u4",
      userName: "David",
      choice: "方案 A",
    };
    renderGd({ state: { votes: [myVote], revealed: false } });
    expect(screen.queryByTestId("gd-option-0")).not.toBeInTheDocument();
  });

  it("已有 3 票顯示人數 3", () => {
    renderGd({ state: { votes, revealed: false } });
    expect(screen.getByTestId("gd-count")).toHaveTextContent("3");
  });
});

describe("GroupDecision — 公布結果", () => {
  it("公布後顯示 gd-result", () => {
    renderGd({ state: revealedState });
    expect(screen.getByTestId("gd-result")).toBeInTheDocument();
  });

  it("顯示所有選項計票", () => {
    renderGd({ state: revealedState });
    expect(screen.getByTestId("gd-tally-0")).toHaveTextContent("方案 A");
    expect(screen.getByTestId("gd-tally-1")).toHaveTextContent("方案 B");
    expect(screen.getByTestId("gd-tally-2")).toHaveTextContent("方案 C");
  });

  it("顯示勝出方案（方案 A 2 票）", () => {
    renderGd({ state: revealedState });
    expect(screen.getByTestId("gd-winner")).toHaveTextContent("方案 A");
  });

  it("無人投票顯示 gd-empty", () => {
    renderGd({ state: { votes: [], revealed: true } });
    expect(screen.getByTestId("gd-empty")).toBeInTheDocument();
  });
});
