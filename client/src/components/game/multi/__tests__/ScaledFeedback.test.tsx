import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ScaledFeedback from "../ScaledFeedback";
import type { ScaledFeedbackConfig, ScaledFeedbackState } from "../ScaledFeedback";

const defaultConfig: ScaledFeedbackConfig = {
  title: "📊 活動回饋",
  instructions: "請為各項目評分",
  questions: [
    { id: "q1", text: "整體滿意度", minLabel: "很差", maxLabel: "很好" },
    { id: "q2", text: "活動流程", minLabel: "混亂", maxLabel: "流暢" },
  ],
  scale: 5,
  showResults: true,
};

const emptyState: ScaledFeedbackState = { responses: [] };

const resp1 = {
  userId: "u1",
  userName: "Alice",
  ratings: { q1: 5, q2: 4 },
  submittedAt: 1000,
};

const resp2 = {
  userId: "u2",
  userName: "Bob",
  ratings: { q1: 3, q2: 5 },
  submittedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  localRatings: {},
  onRatingChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe("ScaledFeedback", () => {
  it("顯示標題", () => {
    render(<ScaledFeedback {...mockProps} />);
    expect(screen.getByTestId("sf-title")).toHaveTextContent("活動回饋");
  });

  it("顯示說明文字", () => {
    render(<ScaledFeedback {...mockProps} />);
    expect(screen.getByTestId("sf-instructions")).toHaveTextContent("請為各項目評分");
  });

  it("無說明時不顯示", () => {
    const config = { ...defaultConfig, instructions: undefined };
    render(<ScaledFeedback {...mockProps} config={config} />);
    expect(screen.queryByTestId("sf-instructions")).not.toBeInTheDocument();
  });

  it("顯示每個題目", () => {
    render(<ScaledFeedback {...mockProps} />);
    expect(screen.getByTestId("sf-question-q1")).toBeInTheDocument();
    expect(screen.getByTestId("sf-question-q2")).toBeInTheDocument();
  });

  it("顯示題目文字", () => {
    render(<ScaledFeedback {...mockProps} />);
    expect(screen.getByTestId("sf-text-q1")).toHaveTextContent("整體滿意度");
  });

  it("顯示量表最小/最大標籤", () => {
    render(<ScaledFeedback {...mockProps} />);
    expect(screen.getByTestId("sf-min-label-q1")).toHaveTextContent("很差");
    expect(screen.getByTestId("sf-max-label-q1")).toHaveTextContent("很好");
  });

  it("scale=5 顯示 5 個按鈕", () => {
    render(<ScaledFeedback {...mockProps} />);
    expect(screen.getByTestId("sf-btn-q1-1")).toBeInTheDocument();
    expect(screen.getByTestId("sf-btn-q1-5")).toBeInTheDocument();
    expect(screen.queryByTestId("sf-btn-q1-6")).not.toBeInTheDocument();
  });

  it("scale=10 顯示 10 個按鈕", () => {
    const config = { ...defaultConfig, scale: 10 as const };
    render(<ScaledFeedback {...mockProps} config={config} />);
    expect(screen.getByTestId("sf-btn-q1-10")).toBeInTheDocument();
    expect(screen.queryByTestId("sf-btn-q1-11")).not.toBeInTheDocument();
  });

  it("點擊評分按鈕呼叫 onRatingChange", () => {
    const onRatingChange = vi.fn();
    render(<ScaledFeedback {...mockProps} onRatingChange={onRatingChange} />);
    fireEvent.click(screen.getByTestId("sf-btn-q1-3"));
    expect(onRatingChange).toHaveBeenCalledWith("q1", 3);
  });

  it("未完成所有題目時提交按鈕 disabled", () => {
    render(<ScaledFeedback {...mockProps} />);
    expect(screen.getByTestId("sf-submit-btn")).toBeDisabled();
  });

  it("未完成時顯示提示", () => {
    render(<ScaledFeedback {...mockProps} localRatings={{ q1: 3 }} />);
    expect(screen.getByTestId("sf-incomplete-hint")).toBeInTheDocument();
  });

  it("全部完成後提交按鈕啟用", () => {
    render(<ScaledFeedback {...mockProps} localRatings={{ q1: 5, q2: 4 }} />);
    expect(screen.getByTestId("sf-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<ScaledFeedback {...mockProps} localRatings={{ q1: 5, q2: 4 }} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("sf-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交顯示已提交訊息", () => {
    const state: ScaledFeedbackState = { responses: [resp1] };
    render(<ScaledFeedback {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("sf-submitted-msg")).toBeInTheDocument();
    expect(screen.getByTestId("sf-count")).toHaveTextContent("1");
  });

  it("已提交後隱藏輸入區", () => {
    const state: ScaledFeedbackState = { responses: [resp1] };
    render(<ScaledFeedback {...mockProps} state={state} myUserId="u1" />);
    expect(screen.queryByTestId("sf-submit-btn")).not.toBeInTheDocument();
  });

  it("showResults=true 顯示結果", () => {
    const state: ScaledFeedbackState = { responses: [resp1] };
    render(<ScaledFeedback {...mockProps} state={state} />);
    expect(screen.getByTestId("sf-results")).toBeInTheDocument();
  });

  it("showResults=false 不顯示結果", () => {
    const config = { ...defaultConfig, showResults: false };
    const state: ScaledFeedbackState = { responses: [resp1] };
    render(<ScaledFeedback {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("sf-results")).not.toBeInTheDocument();
  });

  it("顯示每個題目的結果區塊", () => {
    const state: ScaledFeedbackState = { responses: [resp1, resp2] };
    render(<ScaledFeedback {...mockProps} state={state} />);
    expect(screen.getByTestId("sf-result-q1")).toBeInTheDocument();
    expect(screen.getByTestId("sf-result-q2")).toBeInTheDocument();
  });

  it("顯示平均值", () => {
    const state: ScaledFeedbackState = { responses: [resp1, resp2] };
    render(<ScaledFeedback {...mockProps} state={state} />);
    // q1: (5+3)/2 = 4
    expect(screen.getByTestId("sf-avg-q1")).toHaveTextContent("4");
  });

  it("顯示分布長條圖", () => {
    const state: ScaledFeedbackState = { responses: [resp1] };
    render(<ScaledFeedback {...mockProps} state={state} />);
    expect(screen.getByTestId("sf-bar-q1-5")).toBeInTheDocument();
  });

  it("0 回應時顯示等待提示", () => {
    render(<ScaledFeedback {...mockProps} />);
    expect(screen.getByTestId("sf-empty")).toBeInTheDocument();
  });
});
