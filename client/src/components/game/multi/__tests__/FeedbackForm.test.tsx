import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FeedbackForm, { FeedbackFormConfig, FeedbackFormState, FeedbackScore } from "../FeedbackForm";

const baseConfig: FeedbackFormConfig = {
  title: "回饋單測試",
  prompt: "請對以下各項評分",
  dimensions: ["內容", "講師", "環境"],
};

const emptyState: FeedbackFormState = { scores: [], revealed: false };

const scores: FeedbackScore[] = [
  { scoreId: "s1", userId: "u1", userName: "Alice", scores: { "內容": 5, "講師": 4, "環境": 3 } },
  { scoreId: "s2", userId: "u2", userName: "Bob", scores: { "內容": 4, "講師": 5, "環境": 4 } },
];

const revealedState: FeedbackFormState = { scores, revealed: true };

function renderFb(overrides: Partial<Parameters<typeof FeedbackForm>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<FeedbackForm {...props} />), props };
}

describe("FeedbackForm — 基本渲染", () => {
  it("顯示標題", () => {
    renderFb();
    expect(screen.getByTestId("fb-title")).toHaveTextContent("回饋單測試");
  });

  it("顯示 prompt", () => {
    renderFb();
    expect(screen.getByTestId("fb-prompt")).toHaveTextContent("請對以下各項評分");
  });

  it("顯示所有評分向度", () => {
    renderFb();
    expect(screen.getByTestId("fb-dim-0")).toHaveTextContent("內容");
    expect(screen.getByTestId("fb-dim-1")).toHaveTextContent("講師");
    expect(screen.getByTestId("fb-dim-2")).toHaveTextContent("環境");
  });

  it("顯示 1-5 評分按鈕", () => {
    renderFb();
    expect(screen.getByTestId("fb-score-0-1")).toBeInTheDocument();
    expect(screen.getByTestId("fb-score-0-5")).toBeInTheDocument();
  });

  it("未全部評分時送出鈕 disabled", () => {
    renderFb();
    expect(screen.getByTestId("fb-submit-btn")).toBeDisabled();
  });

  it("顯示公布按鈕", () => {
    renderFb();
    expect(screen.getByTestId("fb-reveal-btn")).toBeInTheDocument();
  });
});

describe("FeedbackForm — 互動", () => {
  it("全部評分後送出鈕可點", () => {
    renderFb();
    fireEvent.click(screen.getByTestId("fb-score-0-4"));
    fireEvent.click(screen.getByTestId("fb-score-1-5"));
    fireEvent.click(screen.getByTestId("fb-score-2-3"));
    expect(screen.getByTestId("fb-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶分數", () => {
    const onSubmit = vi.fn();
    renderFb({ onSubmit });
    fireEvent.click(screen.getByTestId("fb-score-0-5"));
    fireEvent.click(screen.getByTestId("fb-score-1-4"));
    fireEvent.click(screen.getByTestId("fb-score-2-3"));
    fireEvent.click(screen.getByTestId("fb-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith({ "內容": 5, "講師": 4, "環境": 3 });
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderFb({ onReveal });
    fireEvent.click(screen.getByTestId("fb-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已提交者顯示 fb-my-scores", () => {
    const myScore: FeedbackScore = {
      scoreId: "s99",
      userId: "u4",
      userName: "David",
      scores: { "內容": 5, "講師": 4, "環境": 5 },
    };
    renderFb({ state: { scores: [myScore], revealed: false } });
    expect(screen.getByTestId("fb-my-scores")).toBeInTheDocument();
  });

  it("已提交者不顯示評分按鈕", () => {
    const myScore: FeedbackScore = {
      scoreId: "s99",
      userId: "u4",
      userName: "David",
      scores: { "內容": 5, "講師": 4, "環境": 5 },
    };
    renderFb({ state: { scores: [myScore], revealed: false } });
    expect(screen.queryByTestId("fb-score-0-5")).not.toBeInTheDocument();
  });

  it("顯示已提交人數", () => {
    renderFb({ state: { scores, revealed: false } });
    expect(screen.getByTestId("fb-count")).toHaveTextContent("2");
  });
});

describe("FeedbackForm — 公布結果", () => {
  it("公布後顯示 fb-result", () => {
    renderFb({ state: revealedState });
    expect(screen.getByTestId("fb-result")).toBeInTheDocument();
  });

  it("顯示各向度平均分", () => {
    renderFb({ state: revealedState });
    expect(screen.getByTestId("fb-avg-0")).toBeInTheDocument();
    expect(screen.getByTestId("fb-avg-1")).toBeInTheDocument();
    expect(screen.getByTestId("fb-avg-2")).toBeInTheDocument();
  });

  it("內容平均分正確（5+4)/2=4.5）", () => {
    renderFb({ state: revealedState });
    expect(screen.getByTestId("fb-avg-0")).toHaveTextContent("4.5");
  });

  it("無回饋顯示 fb-empty", () => {
    renderFb({ state: { scores: [], revealed: true } });
    expect(screen.getByTestId("fb-empty")).toBeInTheDocument();
  });
});
