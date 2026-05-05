import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TokenVote, TokenVoteConfig, TokenVoteState } from "../TokenVote";

const baseConfig: TokenVoteConfig = {
  title: "代幣投票測試",
  question: "請分配代幣",
  options: ["A", "B", "C"],
  totalTokens: 6,
};

const emptyState: TokenVoteState = { votes: [], revealed: false };

function makeDist(id: string, userId: string, distribution: number[]) {
  return { distId: id, userId, userName: `U${userId}`, distribution };
}

describe("TokenVote", () => {
  it("顯示標題和問題", () => {
    render(
      <TokenVote
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tv-title")).toHaveTextContent("代幣投票測試");
    expect(screen.getByTestId("tv-question")).toHaveTextContent("請分配代幣");
  });

  it("未投票時顯示選項和代幣控制", () => {
    render(
      <TokenVote
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tv-option-0")).toBeInTheDocument();
    expect(screen.getByTestId("tv-plus-0")).toBeInTheDocument();
    expect(screen.getByTestId("tv-minus-0")).toBeInTheDocument();
  });

  it("剩餘代幣顯示正確", () => {
    render(
      <TokenVote
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tv-remaining")).toHaveTextContent("剩 6 代幣");
  });

  it("點擊 + 增加代幣", () => {
    render(
      <TokenVote
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("tv-plus-0"));
    expect(screen.getByTestId("tv-val-0")).toHaveTextContent("1");
    expect(screen.getByTestId("tv-remaining")).toHaveTextContent("剩 5 代幣");
  });

  it("無人投票時顯示 tv-empty", () => {
    render(
      <TokenVote
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tv-empty")).toBeInTheDocument();
  });

  it("代幣全部分配後可提交，點擊呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <TokenVote
        config={{ ...baseConfig, totalTokens: 1 }}
        state={emptyState}
        userId="u1"
        onSubmit={onSubmit}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("tv-plus-0"));
    fireEvent.click(screen.getByTestId("tv-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith([1, 0, 0]);
  });

  it("已投票時顯示 tv-my-entry", () => {
    const state: TokenVoteState = {
      votes: [makeDist("d1", "u1", [3, 2, 1])],
      revealed: false,
    };
    render(
      <TokenVote
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tv-my-entry")).toBeInTheDocument();
  });

  it("isTeamLead 且有投票時顯示揭曉按鈕", () => {
    const state: TokenVoteState = {
      votes: [makeDist("d1", "u2", [3, 2, 1])],
      revealed: false,
    };
    render(
      <TokenVote
        config={baseConfig}
        state={state}
        userId="u1"
        isTeamLead
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tv-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示 tv-result", () => {
    const state: TokenVoteState = {
      votes: [
        makeDist("d1", "u1", [4, 1, 1]),
        makeDist("d2", "u2", [2, 3, 1]),
      ],
      revealed: true,
    };
    render(
      <TokenVote
        config={baseConfig}
        state={state}
        userId="u3"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tv-result")).toBeInTheDocument();
    expect(screen.getByTestId("tv-result-0")).toBeInTheDocument();
  });

  it("揭曉後無資料顯示 tv-empty", () => {
    const state: TokenVoteState = { votes: [], revealed: true };
    render(
      <TokenVote
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tv-empty")).toBeInTheDocument();
  });

  it("tv-count 顯示正確", () => {
    const state: TokenVoteState = {
      votes: [makeDist("d1", "u1", [3, 2, 1]), makeDist("d2", "u2", [1, 2, 3])],
      revealed: false,
    };
    render(
      <TokenVote
        config={baseConfig}
        state={state}
        userId="u3"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("tv-count")).toHaveTextContent("2 人已投票");
  });
});
