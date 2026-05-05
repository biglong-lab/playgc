import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HeatMap, { HeatMapConfig, HeatMapState, HeatVote } from "../HeatMap";

const baseConfig: HeatMapConfig = {
  title: "熱區投票測試",
  rowLabels: ["高", "低"],
  colLabels: ["快", "慢"],
};

const emptyState: HeatMapState = { votes: [], revealed: false };

const votes: HeatVote[] = [
  { voteId: "v1", userId: "u1", userName: "Alice", row: 0, col: 0 },
  { voteId: "v2", userId: "u2", userName: "Bob", row: 0, col: 0 },
  { voteId: "v3", userId: "u3", userName: "Carol", row: 1, col: 1 },
];

const revealedState: HeatMapState = { votes, revealed: true };

function renderHm(overrides: Partial<Parameters<typeof HeatMap>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onVote: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<HeatMap {...props} />), props };
}

describe("HeatMap — 基本渲染", () => {
  it("顯示標題", () => {
    renderHm();
    expect(screen.getByTestId("hm-title")).toHaveTextContent("熱區投票測試");
  });

  it("顯示已投票人數 0", () => {
    renderHm();
    expect(screen.getByTestId("hm-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderHm();
    expect(screen.getByTestId("hm-reveal-btn")).toBeInTheDocument();
  });

  it("顯示矩陣按鈕 (0,0)", () => {
    renderHm();
    expect(screen.getByTestId("hm-btn-0-0")).toBeInTheDocument();
  });

  it("顯示矩陣按鈕 (1,1)", () => {
    renderHm();
    expect(screen.getByTestId("hm-btn-1-1")).toBeInTheDocument();
  });
});

describe("HeatMap — 互動", () => {
  it("點格子呼叫 onVote", () => {
    const onVote = vi.fn();
    renderHm({ onVote });
    fireEvent.click(screen.getByTestId("hm-btn-0-1"));
    expect(onVote).toHaveBeenCalledWith(0, 1);
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderHm({ onReveal });
    fireEvent.click(screen.getByTestId("hm-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已投票後顯示 hm-my-vote", () => {
    const myVote: HeatVote = { voteId: "v99", userId: "u4", userName: "David", row: 0, col: 0 };
    renderHm({ state: { votes: [myVote], revealed: false } });
    expect(screen.getByTestId("hm-my-vote")).toBeInTheDocument();
  });

  it("已投票後不顯示投票格", () => {
    const myVote: HeatVote = { voteId: "v99", userId: "u4", userName: "David", row: 0, col: 0 };
    renderHm({ state: { votes: [myVote], revealed: false } });
    expect(screen.queryByTestId("hm-btn-0-0")).not.toBeInTheDocument();
  });

  it("已有 3 票顯示人數 3", () => {
    renderHm({ state: { votes, revealed: false } });
    expect(screen.getByTestId("hm-count")).toHaveTextContent("3");
  });
});

describe("HeatMap — 公布結果", () => {
  it("公布後顯示 hm-result", () => {
    renderHm({ state: revealedState });
    expect(screen.getByTestId("hm-result")).toBeInTheDocument();
  });

  it("顯示 row 標籤", () => {
    renderHm({ state: revealedState });
    expect(screen.getByTestId("hm-row-0")).toHaveTextContent("高");
    expect(screen.getByTestId("hm-row-1")).toHaveTextContent("低");
  });

  it("顯示 col 標籤", () => {
    renderHm({ state: revealedState });
    expect(screen.getByTestId("hm-col-0")).toHaveTextContent("快");
    expect(screen.getByTestId("hm-col-1")).toHaveTextContent("慢");
  });

  it("顯示格子票數 (0,0) = 2", () => {
    renderHm({ state: revealedState });
    expect(screen.getByTestId("hm-cell-0-0")).toHaveTextContent("2");
  });

  it("顯示格子票數 (1,1) = 1", () => {
    renderHm({ state: revealedState });
    expect(screen.getByTestId("hm-cell-1-1")).toHaveTextContent("1");
  });

  it("顯示總票數", () => {
    renderHm({ state: revealedState });
    expect(screen.getByTestId("hm-total")).toHaveTextContent("3");
  });
});
