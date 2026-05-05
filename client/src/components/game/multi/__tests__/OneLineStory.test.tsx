import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OneLineStory, { OneLineStoryConfig, OneLineStoryState, StoryLine } from "../OneLineStory";

const baseConfig: OneLineStoryConfig = {
  title: "一句故事測試",
  prompt: "用一句話說一個故事",
  maxLength: 80,
};

const emptyState: OneLineStoryState = { lines: [], revealed: false };

const lines: StoryLine[] = [
  { lineId: "l1", userId: "u1", userName: "Alice", text: "那天，她發現了一封舊信" },
  { lineId: "l2", userId: "u2", userName: "Bob", text: "那天，雨突然停了" },
  { lineId: "l3", userId: "u3", userName: "Carol", text: "那天，他學會了說對不起" },
];

const revealedState: OneLineStoryState = { lines, revealed: true };

function renderOls(overrides: Partial<Parameters<typeof OneLineStory>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<OneLineStory {...props} />), props };
}

describe("OneLineStory — 基本渲染", () => {
  it("顯示標題", () => {
    renderOls();
    expect(screen.getByTestId("ols-title")).toHaveTextContent("一句故事測試");
  });

  it("顯示 prompt", () => {
    renderOls();
    expect(screen.getByTestId("ols-prompt")).toHaveTextContent("用一句話說一個故事");
  });

  it("顯示輸入框", () => {
    renderOls();
    expect(screen.getByTestId("ols-input")).toBeInTheDocument();
  });

  it("顯示故事數量 0", () => {
    renderOls();
    expect(screen.getByTestId("ols-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderOls();
    expect(screen.getByTestId("ols-reveal-btn")).toBeInTheDocument();
  });
});

describe("OneLineStory — 互動", () => {
  it("空輸入時送出鈕 disabled", () => {
    renderOls();
    expect(screen.getByTestId("ols-submit-btn")).toBeDisabled();
  });

  it("有輸入後送出鈕可點", () => {
    renderOls();
    fireEvent.change(screen.getByTestId("ols-input"), {
      target: { value: "那天，一切都改變了" },
    });
    expect(screen.getByTestId("ols-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶文字", () => {
    const onSubmit = vi.fn();
    renderOls({ onSubmit });
    fireEvent.change(screen.getByTestId("ols-input"), {
      target: { value: "那天，太陽特別圓" },
    });
    fireEvent.click(screen.getByTestId("ols-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("那天，太陽特別圓");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderOls({ onReveal });
    fireEvent.click(screen.getByTestId("ols-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已提交者顯示 ols-my-line", () => {
    const myLine: StoryLine = {
      lineId: "l99",
      userId: "u4",
      userName: "David",
      text: "那天，我學到了很多",
    };
    renderOls({
      state: { lines: [myLine], revealed: false },
      myUserId: "u4",
    });
    expect(screen.getByTestId("ols-my-line")).toHaveTextContent("那天，我學到了很多");
  });

  it("已提交者不顯示輸入框", () => {
    const myLine: StoryLine = {
      lineId: "l99",
      userId: "u4",
      userName: "David",
      text: "已提交",
    };
    renderOls({
      state: { lines: [myLine], revealed: false },
      myUserId: "u4",
    });
    expect(screen.queryByTestId("ols-input")).not.toBeInTheDocument();
  });

  it("已有 3 個故事顯示數量 3", () => {
    renderOls({ state: { lines, revealed: false } });
    expect(screen.getByTestId("ols-count")).toHaveTextContent("3");
  });
});

describe("OneLineStory — 公布結果", () => {
  it("公布後顯示 ols-result", () => {
    renderOls({ state: revealedState });
    expect(screen.getByTestId("ols-result")).toBeInTheDocument();
  });

  it("顯示所有故事行", () => {
    renderOls({ state: revealedState });
    expect(screen.getByTestId("ols-line-l1")).toBeInTheDocument();
    expect(screen.getByTestId("ols-line-l2")).toBeInTheDocument();
    expect(screen.getByTestId("ols-line-l3")).toBeInTheDocument();
  });

  it("顯示故事文字", () => {
    renderOls({ state: revealedState });
    expect(screen.getByTestId("ols-line-l1")).toHaveTextContent("那天，她發現了一封舊信");
  });

  it("第一個故事顯示 ols-first-badge", () => {
    renderOls({ state: revealedState });
    expect(screen.getByTestId("ols-first-badge")).toBeInTheDocument();
  });

  it("無故事顯示 ols-empty", () => {
    renderOls({ state: { lines: [], revealed: true } });
    expect(screen.getByTestId("ols-empty")).toBeInTheDocument();
  });
});
