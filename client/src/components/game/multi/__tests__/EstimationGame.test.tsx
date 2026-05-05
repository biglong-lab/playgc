import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EstimationGame from "../EstimationGame";
import type { EstimationGameConfig, EstimationGameState } from "../EstimationGame";

const defaultConfig: EstimationGameConfig = {
  title: "🃏 規劃撲克",
  question: "這個功能需要多少天？",
  unit: "天",
  options: ["1", "2", "3", "5", "8", "13", "21", "?"],
  showAverage: true,
  showAllEstimates: true,
};

const emptyState: EstimationGameState = { entries: [], revealed: false };

const entry1 = { userId: "u1", userName: "Alice", value: "5", submittedAt: 1000 };
const entry2 = { userId: "u2", userName: "Bob", value: "8", submittedAt: 2000 };
const entry3 = { userId: "u3", userName: "Carol", value: "3", submittedAt: 3000 };

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  localValue: "",
  onSelectValue: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

describe("EstimationGame", () => {
  it("顯示標題", () => {
    render(<EstimationGame {...mockProps} />);
    expect(screen.getByTestId("eg-title")).toHaveTextContent("規劃撲克");
  });

  it("顯示問題", () => {
    render(<EstimationGame {...mockProps} />);
    expect(screen.getByTestId("eg-question")).toHaveTextContent("這個功能需要多少天");
  });

  it("顯示單位", () => {
    render(<EstimationGame {...mockProps} />);
    expect(screen.getByTestId("eg-unit")).toHaveTextContent("天");
  });

  it("無單位時不顯示單位", () => {
    const config = { ...defaultConfig, unit: undefined };
    render(<EstimationGame {...mockProps} config={config} />);
    expect(screen.queryByTestId("eg-unit")).not.toBeInTheDocument();
  });

  it("顯示所有選項按鈕", () => {
    render(<EstimationGame {...mockProps} />);
    expect(screen.getByTestId("eg-opt-1")).toBeInTheDocument();
    expect(screen.getByTestId("eg-opt-5")).toBeInTheDocument();
    expect(screen.getByTestId("eg-opt-?")).toBeInTheDocument();
  });

  it("點擊選項呼叫 onSelectValue", () => {
    const onSelectValue = vi.fn();
    render(<EstimationGame {...mockProps} onSelectValue={onSelectValue} />);
    fireEvent.click(screen.getByTestId("eg-opt-8"));
    expect(onSelectValue).toHaveBeenCalledWith("8");
  });

  it("未選擇值時提交按鈕 disabled", () => {
    render(<EstimationGame {...mockProps} />);
    expect(screen.getByTestId("eg-submit-btn")).toBeDisabled();
  });

  it("未選擇值時顯示提示", () => {
    render(<EstimationGame {...mockProps} />);
    expect(screen.getByTestId("eg-no-value-hint")).toBeInTheDocument();
  });

  it("選擇值後提交按鈕啟用", () => {
    render(<EstimationGame {...mockProps} localValue="5" />);
    expect(screen.getByTestId("eg-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<EstimationGame {...mockProps} localValue="5" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("eg-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交後顯示確認卡片", () => {
    const state: EstimationGameState = { entries: [entry1], revealed: false };
    render(<EstimationGame {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("eg-submitted-card")).toBeInTheDocument();
    expect(screen.getByTestId("eg-submitted-msg")).toHaveTextContent("5");
  });

  it("已提交但未揭曉時顯示揭曉按鈕", () => {
    const state: EstimationGameState = { entries: [entry1], revealed: false };
    render(<EstimationGame {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("eg-reveal-btn")).toBeInTheDocument();
  });

  it("點擊揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    const state: EstimationGameState = { entries: [entry1], revealed: false };
    render(<EstimationGame {...mockProps} state={state} myUserId="u1" onReveal={onReveal} />);
    fireEvent.click(screen.getByTestId("eg-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("揭曉後不顯示揭曉按鈕", () => {
    const state: EstimationGameState = { entries: [entry1], revealed: true };
    render(<EstimationGame {...mockProps} state={state} myUserId="u1" />);
    expect(screen.queryByTestId("eg-reveal-btn")).not.toBeInTheDocument();
  });

  it("顯示提交人數", () => {
    const state: EstimationGameState = { entries: [entry1, entry2], revealed: false };
    render(<EstimationGame {...mockProps} state={state} />);
    expect(screen.getByTestId("eg-count")).toHaveTextContent("2");
  });

  it("揭曉後顯示結果區塊", () => {
    const state: EstimationGameState = { entries: [entry1, entry2, entry3], revealed: true };
    render(<EstimationGame {...mockProps} state={state} />);
    expect(screen.getByTestId("eg-results")).toBeInTheDocument();
  });

  it("揭曉後顯示統計數字", () => {
    const state: EstimationGameState = { entries: [entry1, entry2, entry3], revealed: true };
    render(<EstimationGame {...mockProps} state={state} />);
    expect(screen.getByTestId("eg-stats")).toBeInTheDocument();
    expect(screen.getByTestId("eg-min")).toHaveTextContent("3");
    expect(screen.getByTestId("eg-max")).toHaveTextContent("8");
  });

  it("showAverage=false 不顯示統計", () => {
    const config = { ...defaultConfig, showAverage: false };
    const state: EstimationGameState = { entries: [entry1, entry2], revealed: true };
    render(<EstimationGame {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("eg-stats")).not.toBeInTheDocument();
  });

  it("揭曉後顯示分佈圖", () => {
    const state: EstimationGameState = { entries: [entry1, entry2, entry3], revealed: true };
    render(<EstimationGame {...mockProps} state={state} />);
    expect(screen.getByTestId("eg-distribution")).toBeInTheDocument();
    expect(screen.getByTestId("eg-dist-5")).toBeInTheDocument();
    expect(screen.getByTestId("eg-dist-8")).toBeInTheDocument();
  });

  it("揭曉後顯示所有估算", () => {
    const state: EstimationGameState = { entries: [entry1, entry2], revealed: true };
    render(<EstimationGame {...mockProps} state={state} />);
    expect(screen.getByTestId("eg-all-entries")).toBeInTheDocument();
    expect(screen.getByTestId("eg-entry-u1")).toBeInTheDocument();
    expect(screen.getByTestId("eg-entry-u2")).toBeInTheDocument();
  });

  it("showAllEstimates=false 不顯示個別估算", () => {
    const config = { ...defaultConfig, showAllEstimates: false };
    const state: EstimationGameState = { entries: [entry1, entry2], revealed: true };
    render(<EstimationGame {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("eg-all-entries")).not.toBeInTheDocument();
  });

  it("未揭曉時不顯示結果", () => {
    const state: EstimationGameState = { entries: [entry1, entry2], revealed: false };
    render(<EstimationGame {...mockProps} state={state} />);
    expect(screen.queryByTestId("eg-results")).not.toBeInTheDocument();
  });
});
