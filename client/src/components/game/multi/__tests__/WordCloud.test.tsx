import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WordCloud, { WordCloudConfig, WordCloudState } from "../WordCloud";

const baseConfig: WordCloudConfig = {
  title: "心情文字雲",
  prompt: "用一到三個詞描述今天的心情",
  maxWords: 3,
  maxWordLength: 8,
  showAuthor: false,
};

const emptyState: WordCloudState = { entries: [], revealed: false };

const entries = [
  { wordId: "w1", userId: "u2", userName: "Bob", words: ["開心", "期待"] },
  { wordId: "w2", userId: "u3", userName: "Carol", words: ["開心", "平靜"] },
  { wordId: "w3", userId: "u4", userName: "Dave", words: ["疲累"] },
];

const revealedState: WordCloudState = { entries, revealed: true };

function renderWc(
  overrides: Partial<Parameters<typeof WordCloud>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<WordCloud {...props} />), props };
}

describe("WordCloud — 基本渲染", () => {
  it("顯示標題", () => {
    renderWc();
    expect(screen.getByTestId("wc-title")).toHaveTextContent("心情文字雲");
  });

  it("顯示提示語", () => {
    renderWc();
    expect(screen.getByTestId("wc-prompt")).toBeInTheDocument();
  });

  it("顯示送出數量", () => {
    renderWc();
    expect(screen.getByTestId("wc-count")).toBeInTheDocument();
  });
});

describe("WordCloud — 送出詞語", () => {
  it("顯示輸入框", () => {
    renderWc();
    expect(screen.getByTestId("wc-word-input-0")).toBeInTheDocument();
  });

  it("空白時送出鈕 disabled", () => {
    renderWc();
    expect(screen.getByTestId("wc-submit-btn")).toBeDisabled();
  });

  it("有內容時送出鈕可點", () => {
    renderWc();
    fireEvent.change(screen.getByTestId("wc-word-input-0"), {
      target: { value: "開心" },
    });
    expect(screen.getByTestId("wc-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    renderWc({ onSubmit });
    fireEvent.change(screen.getByTestId("wc-word-input-0"), {
      target: { value: "開心" },
    });
    fireEvent.click(screen.getByTestId("wc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(["開心"]);
  });

  it("已送出後顯示確認訊息", () => {
    renderWc({
      state: {
        entries: [
          {
            wordId: "w99",
            userId: "u1",
            userName: "Alice",
            words: ["快樂"],
          },
        ],
        revealed: false,
      },
    });
    expect(screen.getByTestId("wc-submitted-msg")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderWc();
    expect(screen.getByTestId("wc-reveal-btn")).toBeInTheDocument();
  });

  it("點揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderWc({ onReveal });
    fireEvent.click(screen.getByTestId("wc-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已揭曉後不顯示揭曉按鈕", () => {
    renderWc({ state: revealedState });
    expect(
      screen.queryByTestId("wc-reveal-btn")
    ).not.toBeInTheDocument();
  });
});

describe("WordCloud — 揭曉結果", () => {
  it("顯示文字雲容器", () => {
    renderWc({ state: revealedState });
    expect(screen.getByTestId("wc-cloud")).toBeInTheDocument();
  });

  it("顯示出現的詞語", () => {
    renderWc({ state: revealedState });
    expect(screen.getByTestId("wc-word-開心")).toBeInTheDocument();
  });

  it("高頻詞語顯示次數", () => {
    renderWc({ state: revealedState });
    expect(screen.getByTestId("wc-freq-開心")).toHaveTextContent("2");
  });

  it("低頻詞語不顯示次數標記", () => {
    renderWc({ state: revealedState });
    expect(
      screen.queryByTestId("wc-freq-疲累")
    ).not.toBeInTheDocument();
  });

  it("無詞語時顯示 wc-empty", () => {
    renderWc({ state: { entries: [], revealed: true } });
    expect(screen.getByTestId("wc-empty")).toBeInTheDocument();
  });

  it("showAuthor=true 時顯示作者", () => {
    renderWc({
      config: { ...baseConfig, showAuthor: true },
      state: revealedState,
    });
    expect(screen.getByTestId("wc-author-u2")).toBeInTheDocument();
  });

  it("showAuthor=false 時隱藏作者", () => {
    renderWc({ state: revealedState });
    expect(
      screen.queryByTestId("wc-author-u2")
    ).not.toBeInTheDocument();
  });
});
