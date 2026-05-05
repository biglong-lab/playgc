import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AgreementMatrix from "../AgreementMatrix";
import type { AgreementMatrixConfig, AgreementMatrixState } from "../AgreementMatrix";

const defaultConfig: AgreementMatrixConfig = {
  title: "📊 回顧評分",
  instructions: "請評估以下陳述",
  statements: [
    { id: "s1", text: "溝通順暢" },
    { id: "s2", text: "目標清晰" },
    { id: "s3", text: "士氣高昂" },
  ],
  showResults: true,
};

const emptyState: AgreementMatrixState = { responses: [] };

const resp1 = {
  userId: "u1",
  userName: "Alice",
  ratings: { s1: 3, s2: 2, s3: 3 },
  submittedAt: 1000,
};

const resp2 = {
  userId: "u2",
  userName: "Bob",
  ratings: { s1: 1, s2: 3, s3: 2 },
  submittedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  localRatings: {} as Record<string, number>,
  onRate: vi.fn(),
  onSubmit: vi.fn(),
};

describe("AgreementMatrix", () => {
  it("顯示標題", () => {
    render(<AgreementMatrix {...mockProps} />);
    expect(screen.getByTestId("am-title")).toHaveTextContent("回顧評分");
  });

  it("顯示說明文字", () => {
    render(<AgreementMatrix {...mockProps} />);
    expect(screen.getByTestId("am-instructions")).toHaveTextContent("請評估以下陳述");
  });

  it("無說明時不顯示說明", () => {
    const config = { ...defaultConfig, instructions: undefined };
    render(<AgreementMatrix {...mockProps} config={config} />);
    expect(screen.queryByTestId("am-instructions")).not.toBeInTheDocument();
  });

  it("顯示所有陳述句", () => {
    render(<AgreementMatrix {...mockProps} />);
    expect(screen.getByTestId("am-stmt-s1")).toBeInTheDocument();
    expect(screen.getByTestId("am-stmt-s2")).toBeInTheDocument();
    expect(screen.getByTestId("am-stmt-s3")).toBeInTheDocument();
  });

  it("顯示陳述句文字", () => {
    render(<AgreementMatrix {...mockProps} />);
    expect(screen.getByTestId("am-stmt-text-s1")).toHaveTextContent("溝通順暢");
  });

  it("每個陳述句顯示三個評分按鈕", () => {
    render(<AgreementMatrix {...mockProps} />);
    expect(screen.getByTestId("am-rate-s1-3")).toBeInTheDocument();
    expect(screen.getByTestId("am-rate-s1-2")).toBeInTheDocument();
    expect(screen.getByTestId("am-rate-s1-1")).toBeInTheDocument();
  });

  it("點擊評分按鈕呼叫 onRate", () => {
    const onRate = vi.fn();
    render(<AgreementMatrix {...mockProps} onRate={onRate} />);
    fireEvent.click(screen.getByTestId("am-rate-s2-3"));
    expect(onRate).toHaveBeenCalledWith("s2", 3);
  });

  it("未全部評分時提交按鈕 disabled", () => {
    render(<AgreementMatrix {...mockProps} />);
    expect(screen.getByTestId("am-submit-btn")).toBeDisabled();
  });

  it("未全部評分時顯示提示", () => {
    render(<AgreementMatrix {...mockProps} />);
    expect(screen.getByTestId("am-incomplete-hint")).toBeInTheDocument();
  });

  it("全部評分後提交按鈕啟用", () => {
    const localRatings = { s1: 3, s2: 2, s3: 1 };
    render(<AgreementMatrix {...mockProps} localRatings={localRatings} />);
    expect(screen.getByTestId("am-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    const localRatings = { s1: 3, s2: 2, s3: 1 };
    render(<AgreementMatrix {...mockProps} localRatings={localRatings} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("am-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交後顯示確認訊息", () => {
    const state: AgreementMatrixState = { responses: [resp1] };
    render(<AgreementMatrix {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("am-submitted-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("am-submit-btn")).not.toBeInTheDocument();
  });

  it("顯示回應人數", () => {
    const state: AgreementMatrixState = { responses: [resp1, resp2] };
    render(<AgreementMatrix {...mockProps} state={state} />);
    expect(screen.getByTestId("am-count")).toHaveTextContent("2");
  });

  it("有回應且 showResults=true 時顯示結果", () => {
    const state: AgreementMatrixState = { responses: [resp1, resp2] };
    render(<AgreementMatrix {...mockProps} state={state} />);
    expect(screen.getByTestId("am-results")).toBeInTheDocument();
  });

  it("showResults=false 不顯示結果", () => {
    const config = { ...defaultConfig, showResults: false };
    const state: AgreementMatrixState = { responses: [resp1] };
    render(<AgreementMatrix {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("am-results")).not.toBeInTheDocument();
  });

  it("無回應時不顯示結果", () => {
    render(<AgreementMatrix {...mockProps} />);
    expect(screen.queryByTestId("am-results")).not.toBeInTheDocument();
  });

  it("結果區塊顯示每個陳述句", () => {
    const state: AgreementMatrixState = { responses: [resp1, resp2] };
    render(<AgreementMatrix {...mockProps} state={state} />);
    expect(screen.getByTestId("am-result-s1")).toBeInTheDocument();
    expect(screen.getByTestId("am-result-s2")).toBeInTheDocument();
    expect(screen.getByTestId("am-result-s3")).toBeInTheDocument();
  });

  it("結果區塊顯示分佈條", () => {
    const state: AgreementMatrixState = { responses: [resp1, resp2] };
    render(<AgreementMatrix {...mockProps} state={state} />);
    expect(screen.getByTestId("am-bar-s1-3")).toBeInTheDocument();
    expect(screen.getByTestId("am-bar-s1-1")).toBeInTheDocument();
  });

  it("結果區塊顯示各選項數量", () => {
    const state: AgreementMatrixState = { responses: [resp1, resp2] };
    render(<AgreementMatrix {...mockProps} state={state} />);
    expect(screen.getByTestId("am-count-s1-3")).toBeInTheDocument();
  });

  it("空回應人數為 0", () => {
    render(<AgreementMatrix {...mockProps} />);
    expect(screen.getByTestId("am-count")).toHaveTextContent("0");
  });
});
