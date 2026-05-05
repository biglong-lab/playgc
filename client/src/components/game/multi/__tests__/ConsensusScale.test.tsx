import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConsensusScale from "../ConsensusScale";
import type { ConsensusScaleConfig, ConsensusScaleState, ScaleResponse } from "../ConsensusScale";

const defaultConfig: ConsensusScaleConfig = {
  title: "📊 共識量表",
  question: "你對這個提案的支持程度？",
  scaleMin: 1,
  scaleMax: 5,
  minLabel: "完全不同意",
  maxLabel: "完全同意",
  showAverage: true,
  showDistribution: true,
};

const emptyState: ConsensusScaleState = { responses: [] };

const r1: ScaleResponse = { userId: "u1", userName: "Alice", value: 4, respondedAt: 1000 };
const r2: ScaleResponse = { userId: "u2", userName: "Bob", value: 2, respondedAt: 2000 };
const r3: ScaleResponse = { userId: "u3", userName: "Carol", value: 4, respondedAt: 3000 };

describe("ConsensusScale", () => {
  it("顯示標題", () => {
    render(<ConsensusScale config={defaultConfig} state={emptyState} myUserId="u1" onSelect={vi.fn()} />);
    expect(screen.getByTestId("scale-title")).toHaveTextContent("共識量表");
  });

  it("顯示問題", () => {
    render(<ConsensusScale config={defaultConfig} state={emptyState} myUserId="u1" onSelect={vi.fn()} />);
    expect(screen.getByTestId("scale-question")).toHaveTextContent("你對這個提案的支持程度？");
  });

  it("顯示最小標籤", () => {
    render(<ConsensusScale config={defaultConfig} state={emptyState} myUserId="u1" onSelect={vi.fn()} />);
    expect(screen.getByTestId("min-label")).toHaveTextContent("完全不同意");
  });

  it("顯示最大標籤", () => {
    render(<ConsensusScale config={defaultConfig} state={emptyState} myUserId="u1" onSelect={vi.fn()} />);
    expect(screen.getByTestId("max-label")).toHaveTextContent("完全同意");
  });

  it("顯示 1 到 5 的量表按鈕", () => {
    render(<ConsensusScale config={defaultConfig} state={emptyState} myUserId="u1" onSelect={vi.fn()} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`scale-btn-${i}`)).toBeInTheDocument();
    }
  });

  it("顯示作答人數為 0", () => {
    render(<ConsensusScale config={defaultConfig} state={emptyState} myUserId="u1" onSelect={vi.fn()} />);
    expect(screen.getByTestId("response-count")).toHaveTextContent("0 人已作答");
  });

  it("未選擇時顯示引導訊息", () => {
    render(<ConsensusScale config={defaultConfig} state={emptyState} myUserId="u1" onSelect={vi.fn()} />);
    expect(screen.getByTestId("no-selection-msg")).toBeInTheDocument();
  });

  it("點擊量表按鈕呼叫 onSelect", () => {
    const onSelect = vi.fn();
    render(<ConsensusScale config={defaultConfig} state={emptyState} myUserId="u1" onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("scale-btn-3"));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("已選擇時顯示我的選擇", () => {
    const state: ConsensusScaleState = { responses: [r1] };
    render(<ConsensusScale config={defaultConfig} state={state} myUserId="u1" onSelect={vi.fn()} />);
    expect(screen.getByTestId("my-selection")).toHaveTextContent("4");
  });

  it("顯示正確的作答人數", () => {
    const state: ConsensusScaleState = { responses: [r1, r2, r3] };
    render(<ConsensusScale config={defaultConfig} state={state} myUserId="u9" onSelect={vi.fn()} />);
    expect(screen.getByTestId("response-count")).toHaveTextContent("3 人已作答");
  });

  it("showAverage=true 顯示平均值", () => {
    const state: ConsensusScaleState = { responses: [r1, r2, r3] };
    render(<ConsensusScale config={defaultConfig} state={state} myUserId="u9" onSelect={vi.fn()} />);
    // (4+2+4)/3 = 3.3
    expect(screen.getByTestId("average-value")).toHaveTextContent("3.3");
  });

  it("showAverage=false 不顯示平均值", () => {
    const config = { ...defaultConfig, showAverage: false };
    const state: ConsensusScaleState = { responses: [r1] };
    render(<ConsensusScale config={config} state={state} myUserId="u9" onSelect={vi.fn()} />);
    expect(screen.queryByTestId("average-value")).not.toBeInTheDocument();
  });

  it("showDistribution=true 顯示分佈圖", () => {
    const state: ConsensusScaleState = { responses: [r1, r2] };
    render(<ConsensusScale config={defaultConfig} state={state} myUserId="u9" onSelect={vi.fn()} />);
    expect(screen.getByTestId("distribution-chart")).toBeInTheDocument();
  });

  it("分佈圖顯示正確計數", () => {
    const state: ConsensusScaleState = { responses: [r1, r3] };
    render(<ConsensusScale config={defaultConfig} state={state} myUserId="u9" onSelect={vi.fn()} />);
    expect(screen.getByTestId("dist-count-4")).toHaveTextContent("2");
    expect(screen.getByTestId("dist-count-2")).toHaveTextContent("0");
  });

  it("showDistribution=false 不顯示分佈圖", () => {
    const config = { ...defaultConfig, showDistribution: false };
    const state: ConsensusScaleState = { responses: [r1] };
    render(<ConsensusScale config={config} state={state} myUserId="u9" onSelect={vi.fn()} />);
    expect(screen.queryByTestId("distribution-chart")).not.toBeInTheDocument();
  });

  it("7 分量表顯示 1 到 7 的按鈕", () => {
    const config = { ...defaultConfig, scaleMax: 7 };
    render(<ConsensusScale config={config} state={emptyState} myUserId="u1" onSelect={vi.fn()} />);
    for (let i = 1; i <= 7; i++) {
      expect(screen.getByTestId(`scale-btn-${i}`)).toBeInTheDocument();
    }
  });
});
