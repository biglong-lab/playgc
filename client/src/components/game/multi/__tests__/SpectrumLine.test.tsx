import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SpectrumLine from "../SpectrumLine";
import type { SpectrumLineConfig, SpectrumLineState } from "../SpectrumLine";

const defaultConfig: SpectrumLineConfig = {
  title: "🎯 工作風格光譜",
  instructions: "拖動滑桿，告訴大家你的風格",
  questions: [
    { id: "q1", leftLabel: "內向", rightLabel: "外向", leftEmoji: "🤫", rightEmoji: "📢" },
    { id: "q2", leftLabel: "計畫型", rightLabel: "即興型", leftEmoji: "📋", rightEmoji: "🎲" },
  ],
  showResults: true,
  showNames: true,
};

const emptyState: SpectrumLineState = { placements: [] };

const placement1 = {
  userId: "u1",
  userName: "Alice",
  positions: { q1: 20, q2: 80 },
  submittedAt: 1000,
};

const placement2 = {
  userId: "u2",
  userName: "Bob",
  positions: { q1: 60, q2: 40 },
  submittedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  localPositions: { q1: 50, q2: 50 },
  onPositionChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe("SpectrumLine", () => {
  it("顯示標題", () => {
    render(<SpectrumLine {...mockProps} />);
    expect(screen.getByTestId("sl-title")).toHaveTextContent("工作風格光譜");
  });

  it("顯示說明文字", () => {
    render(<SpectrumLine {...mockProps} />);
    expect(screen.getByTestId("sl-instructions")).toHaveTextContent("拖動滑桿");
  });

  it("無說明時不顯示說明", () => {
    const config = { ...defaultConfig, instructions: undefined };
    render(<SpectrumLine {...mockProps} config={config} />);
    expect(screen.queryByTestId("sl-instructions")).not.toBeInTheDocument();
  });

  it("顯示所有問題", () => {
    render(<SpectrumLine {...mockProps} />);
    expect(screen.getByTestId("sl-question-q1")).toBeInTheDocument();
    expect(screen.getByTestId("sl-question-q2")).toBeInTheDocument();
  });

  it("顯示左右端標籤", () => {
    render(<SpectrumLine {...mockProps} />);
    expect(screen.getByTestId("sl-left-q1")).toHaveTextContent("內向");
    expect(screen.getByTestId("sl-right-q1")).toHaveTextContent("外向");
  });

  it("顯示滑桿", () => {
    render(<SpectrumLine {...mockProps} />);
    expect(screen.getByTestId("sl-slider-q1")).toBeInTheDocument();
  });

  it("滑桿初始值為 50", () => {
    render(<SpectrumLine {...mockProps} />);
    expect(screen.getByTestId("sl-slider-q1")).toHaveValue("50");
  });

  it("滑桿變化呼叫 onPositionChange", () => {
    const onPositionChange = vi.fn();
    render(<SpectrumLine {...mockProps} onPositionChange={onPositionChange} />);
    fireEvent.change(screen.getByTestId("sl-slider-q2"), { target: { value: "75" } });
    expect(onPositionChange).toHaveBeenCalledWith("q2", 75);
  });

  it("初始值 50 顯示中間型", () => {
    render(<SpectrumLine {...mockProps} />);
    expect(screen.getByTestId("sl-value-q1")).toHaveTextContent("中間型");
  });

  it("左偏值顯示左端標籤", () => {
    const localPositions = { q1: 10, q2: 50 };
    render(<SpectrumLine {...mockProps} localPositions={localPositions} />);
    expect(screen.getByTestId("sl-value-q1")).toHaveTextContent("偏內向");
  });

  it("右偏值顯示右端標籤", () => {
    const localPositions = { q1: 90, q2: 50 };
    render(<SpectrumLine {...mockProps} localPositions={localPositions} />);
    expect(screen.getByTestId("sl-value-q1")).toHaveTextContent("偏外向");
  });

  it("提交按鈕可點擊（預設50已設定）", () => {
    render(<SpectrumLine {...mockProps} />);
    expect(screen.getByTestId("sl-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<SpectrumLine {...mockProps} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("sl-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交時顯示確認訊息", () => {
    const state: SpectrumLineState = { placements: [placement1] };
    render(<SpectrumLine {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("sl-submitted-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("sl-submit-btn")).not.toBeInTheDocument();
  });

  it("顯示回應人數", () => {
    const state: SpectrumLineState = { placements: [placement1, placement2] };
    render(<SpectrumLine {...mockProps} state={state} />);
    expect(screen.getByTestId("sl-count")).toHaveTextContent("2");
  });

  it("有回應且 showResults=true 時顯示結果", () => {
    const state: SpectrumLineState = { placements: [placement1, placement2] };
    render(<SpectrumLine {...mockProps} state={state} />);
    expect(screen.getByTestId("sl-results")).toBeInTheDocument();
  });

  it("結果顯示各問題分布", () => {
    const state: SpectrumLineState = { placements: [placement1, placement2] };
    render(<SpectrumLine {...mockProps} state={state} />);
    expect(screen.getByTestId("sl-result-q1")).toBeInTheDocument();
    expect(screen.getByTestId("sl-result-q2")).toBeInTheDocument();
  });

  it("結果顯示平均點", () => {
    const state: SpectrumLineState = { placements: [placement1, placement2] };
    render(<SpectrumLine {...mockProps} state={state} />);
    expect(screen.getByTestId("sl-avg-q1")).toBeInTheDocument();
  });

  it("結果顯示每個人的點位", () => {
    const state: SpectrumLineState = { placements: [placement1, placement2] };
    render(<SpectrumLine {...mockProps} state={state} />);
    expect(screen.getByTestId("sl-dot-q1-u1")).toBeInTheDocument();
    expect(screen.getByTestId("sl-dot-q1-u2")).toBeInTheDocument();
  });

  it("showResults=false 不顯示結果", () => {
    const config = { ...defaultConfig, showResults: false };
    const state: SpectrumLineState = { placements: [placement1] };
    render(<SpectrumLine {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("sl-results")).not.toBeInTheDocument();
  });

  it("空回應人數為 0", () => {
    render(<SpectrumLine {...mockProps} />);
    expect(screen.getByTestId("sl-count")).toHaveTextContent("0");
  });
});
