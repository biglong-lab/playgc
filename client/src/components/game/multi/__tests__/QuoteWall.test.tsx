import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuoteWall, { QuoteWallConfig, QuoteWallState, QuoteEntry } from "../QuoteWall";

const baseConfig: QuoteWallConfig = {
  title: "名言牆測試",
  prompt: "分享你喜歡的一句話",
  maxLength: 100,
  placeholder: "輸入名言...",
};

const emptyState: QuoteWallState = { quotes: [], revealed: false };

const quotes: QuoteEntry[] = [
  { quoteId: "q1", userId: "u1", userName: "Alice", text: "天行健，君子以自強不息", author: "易經" },
  { quoteId: "q2", userId: "u2", userName: "Bob", text: "凡走過，必留下痕跡", author: "" },
  { quoteId: "q3", userId: "u3", userName: "Carol", text: "成功是失敗之母", author: "某人" },
];

const revealedState: QuoteWallState = { quotes, revealed: true };

function renderQw(overrides: Partial<Parameters<typeof QuoteWall>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<QuoteWall {...props} />), props };
}

describe("QuoteWall — 基本渲染", () => {
  it("顯示標題", () => {
    renderQw();
    expect(screen.getByTestId("qw-title")).toHaveTextContent("名言牆測試");
  });

  it("顯示 prompt", () => {
    renderQw();
    expect(screen.getByTestId("qw-prompt")).toHaveTextContent("分享你喜歡的一句話");
  });

  it("顯示輸入框", () => {
    renderQw();
    expect(screen.getByTestId("qw-text-input")).toBeInTheDocument();
  });

  it("顯示作者輸入框", () => {
    renderQw();
    expect(screen.getByTestId("qw-author-input")).toBeInTheDocument();
  });

  it("顯示已分享人數 0", () => {
    renderQw();
    expect(screen.getByTestId("qw-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderQw();
    expect(screen.getByTestId("qw-reveal-btn")).toBeInTheDocument();
  });
});

describe("QuoteWall — 互動", () => {
  it("空輸入時送出鈕 disabled", () => {
    renderQw();
    expect(screen.getByTestId("qw-submit-btn")).toBeDisabled();
  });

  it("有輸入後送出鈕可點", () => {
    renderQw();
    fireEvent.change(screen.getByTestId("qw-text-input"), { target: { value: "知之為知之" } });
    expect(screen.getByTestId("qw-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶文字和作者", () => {
    const onSubmit = vi.fn();
    renderQw({ onSubmit });
    fireEvent.change(screen.getByTestId("qw-text-input"), { target: { value: "知之為知之" } });
    fireEvent.change(screen.getByTestId("qw-author-input"), { target: { value: "孔子" } });
    fireEvent.click(screen.getByTestId("qw-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("知之為知之", "孔子");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderQw({ onReveal });
    fireEvent.click(screen.getByTestId("qw-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已提交者顯示 qw-my-quote", () => {
    const myQuote: QuoteEntry = {
      quoteId: "q99",
      userId: "u4",
      userName: "David",
      text: "學而時習之",
      author: "論語",
    };
    renderQw({ state: { quotes: [myQuote], revealed: false } });
    expect(screen.getByTestId("qw-my-quote")).toHaveTextContent("學而時習之");
  });

  it("已提交者不顯示輸入框", () => {
    const myQuote: QuoteEntry = {
      quoteId: "q99",
      userId: "u4",
      userName: "David",
      text: "學而時習之",
      author: "",
    };
    renderQw({ state: { quotes: [myQuote], revealed: false } });
    expect(screen.queryByTestId("qw-text-input")).not.toBeInTheDocument();
  });

  it("已有 3 人分享顯示人數 3", () => {
    renderQw({ state: { quotes, revealed: false } });
    expect(screen.getByTestId("qw-count")).toHaveTextContent("3");
  });
});

describe("QuoteWall — 公布結果", () => {
  it("公布後顯示 qw-result", () => {
    renderQw({ state: revealedState });
    expect(screen.getByTestId("qw-result")).toBeInTheDocument();
  });

  it("顯示所有名言卡片", () => {
    renderQw({ state: revealedState });
    expect(screen.getByTestId("qw-quote-q1")).toBeInTheDocument();
    expect(screen.getByTestId("qw-quote-q2")).toBeInTheDocument();
    expect(screen.getByTestId("qw-quote-q3")).toBeInTheDocument();
  });

  it("顯示名言文字", () => {
    renderQw({ state: revealedState });
    expect(screen.getByTestId("qw-quote-q1")).toHaveTextContent("天行健，君子以自強不息");
  });

  it("顯示出處", () => {
    renderQw({ state: revealedState });
    expect(screen.getByTestId("qw-quote-q1")).toHaveTextContent("易經");
  });

  it("無名言顯示 qw-empty", () => {
    renderQw({ state: { quotes: [], revealed: true } });
    expect(screen.getByTestId("qw-empty")).toBeInTheDocument();
  });
});
