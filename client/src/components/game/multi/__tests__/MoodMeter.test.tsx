import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MoodMeter from "../MoodMeter";
import type { MoodMeterConfig, MoodMeterState } from "../MoodMeter";

const config: MoodMeterConfig = {
  title: "今日活力確認",
  question: "你現在的狀態是？",
};

const emptyState: MoodMeterState = { votes: {} };

describe("MoodMeter", () => {
  it("顯示標題", () => {
    render(<MoodMeter config={config} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("mood-meter-title")).toHaveTextContent("今日活力確認");
  });

  it("顯示 question", () => {
    render(<MoodMeter config={config} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByText("你現在的狀態是？")).toBeInTheDocument();
  });

  it("顯示 5 個選項按鈕", () => {
    render(<MoodMeter config={config} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`mood-btn-${i}`)).toBeInTheDocument();
    }
  });

  it("點擊選項呼叫 onVote", () => {
    const onVote = vi.fn().mockResolvedValue(undefined);
    render(<MoodMeter config={config} state={emptyState} myUserId="u1" onVote={onVote} />);
    fireEvent.click(screen.getByTestId("mood-btn-3"));
    expect(onVote).toHaveBeenCalledWith(3);
  });

  it("已投票顯示「你選了」訊息", () => {
    const state: MoodMeterState = { votes: { u1: 4 } };
    render(<MoodMeter config={config} state={state} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("mood-my-vote")).toBeInTheDocument();
  });

  it("有人投票後顯示分佈圖", () => {
    const state: MoodMeterState = { votes: { u1: 3, u2: 4, u3: 5 } };
    render(<MoodMeter config={config} state={state} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("mood-distribution")).toBeInTheDocument();
  });

  it("顯示平均值 badge", () => {
    const state: MoodMeterState = { votes: { u1: 4, u2: 4 } };
    render(<MoodMeter config={config} state={state} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("mood-meter-average")).toHaveTextContent("4.0");
  });

  it("空狀態不顯示分佈圖", () => {
    render(<MoodMeter config={config} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.queryByTestId("mood-distribution")).not.toBeInTheDocument();
  });

  it("空狀態不顯示平均 badge", () => {
    render(<MoodMeter config={config} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.queryByTestId("mood-meter-average")).not.toBeInTheDocument();
  });

  it("使用預設標題 🌡️ 活力確認", () => {
    render(<MoodMeter config={{}} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("mood-meter-title")).toHaveTextContent("🌡️ 活力確認");
  });

  it("分佈圖有 5 個 bar", () => {
    const state: MoodMeterState = { votes: { u1: 2 } };
    render(<MoodMeter config={config} state={state} myUserId="u1" onVote={vi.fn()} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`mood-bar-${i}`)).toBeInTheDocument();
    }
  });
});
