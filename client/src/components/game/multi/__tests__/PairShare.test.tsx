import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PairShare, { PairShareConfig, PairShareState, PairEntry, PairResult } from "../PairShare";

const baseConfig: PairShareConfig = {
  title: "配對分享測試",
  prompt: "加入後隨機配對一位夥伴",
  pairingMode: "random",
};

const emptyState: PairShareState = { entries: [], pairs: [], unpairedId: null, unpairedName: null, revealed: false };

const entries: PairEntry[] = [
  { entryId: "e1", userId: "u1", userName: "Alice" },
  { entryId: "e2", userId: "u2", userName: "Bob" },
  { entryId: "e3", userId: "u3", userName: "Carol" },
];

const pairs: PairResult[] = [
  { pairId: "pair-0", userAId: "u1", userAName: "Alice", userBId: "u2", userBName: "Bob" },
];

const revealedState: PairShareState = {
  entries,
  pairs,
  unpairedId: "u3",
  unpairedName: "Carol",
  revealed: true,
};

function renderPs(overrides: Partial<Parameters<typeof PairShare>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onJoin: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<PairShare {...props} />), props };
}

describe("PairShare — 基本渲染", () => {
  it("顯示標題", () => {
    renderPs();
    expect(screen.getByTestId("ps-title")).toHaveTextContent("配對分享測試");
  });

  it("顯示 prompt", () => {
    renderPs();
    expect(screen.getByTestId("ps-prompt")).toHaveTextContent("加入後隨機配對一位夥伴");
  });

  it("顯示加入按鈕", () => {
    renderPs();
    expect(screen.getByTestId("ps-join-btn")).toBeInTheDocument();
  });

  it("顯示已加入人數 0", () => {
    renderPs();
    expect(screen.getByTestId("ps-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderPs();
    expect(screen.getByTestId("ps-reveal-btn")).toBeInTheDocument();
  });
});

describe("PairShare — 互動", () => {
  it("點加入呼叫 onJoin", () => {
    const onJoin = vi.fn();
    renderPs({ onJoin });
    fireEvent.click(screen.getByTestId("ps-join-btn"));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderPs({ onReveal });
    fireEvent.click(screen.getByTestId("ps-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已加入者顯示 ps-my-entry", () => {
    const myEntry: PairEntry = { entryId: "e99", userId: "u4", userName: "David" };
    renderPs({ state: { ...emptyState, entries: [myEntry] } });
    expect(screen.getByTestId("ps-my-entry")).toBeInTheDocument();
  });

  it("已加入者不顯示加入按鈕", () => {
    const myEntry: PairEntry = { entryId: "e99", userId: "u4", userName: "David" };
    renderPs({ state: { ...emptyState, entries: [myEntry] } });
    expect(screen.queryByTestId("ps-join-btn")).not.toBeInTheDocument();
  });

  it("顯示已加入人數 3", () => {
    renderPs({ state: { ...emptyState, entries } });
    expect(screen.getByTestId("ps-count")).toHaveTextContent("3");
  });
});

describe("PairShare — 公布結果", () => {
  it("公布後顯示 ps-result", () => {
    renderPs({ state: revealedState });
    expect(screen.getByTestId("ps-result")).toBeInTheDocument();
  });

  it("顯示配對結果", () => {
    renderPs({ state: revealedState });
    expect(screen.getByTestId("ps-pair-pair-0")).toBeInTheDocument();
    expect(screen.getByTestId("ps-pair-pair-0")).toHaveTextContent("Alice");
    expect(screen.getByTestId("ps-pair-pair-0")).toHaveTextContent("Bob");
  });

  it("顯示未配對者", () => {
    renderPs({ state: revealedState });
    expect(screen.getByTestId("ps-unpaired")).toHaveTextContent("Carol");
  });

  it("無人加入顯示 ps-empty", () => {
    renderPs({ state: { ...emptyState, revealed: true } });
    expect(screen.getByTestId("ps-empty")).toBeInTheDocument();
  });
});
