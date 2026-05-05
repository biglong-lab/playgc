import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamHealthCheck from "../TeamHealthCheck";
import type { TeamHealthConfig, TeamHealthState } from "../TeamHealthCheck";

const defaultConfig: TeamHealthConfig = {
  title: "💪 團隊健康評估",
  dimensions: [
    { id: "safety", label: "心理安全感", emoji: "🛡️" },
    { id: "trust", label: "互相信任", emoji: "🤝" },
  ],
  scaleMin: 1,
  scaleMax: 5,
  anonymous: true,
  showResults: true,
};

const emptyState: TeamHealthState = { responses: [] };

const response1 = {
  userId: "u1",
  userName: "匿名",
  scores: { safety: 4, trust: 5 },
  submittedAt: 1000,
};
const response2 = {
  userId: "u2",
  userName: "匿名",
  scores: { safety: 2, trust: 3 },
  submittedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  localScores: {},
  onScoreChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe("TeamHealthCheck", () => {
  it("顯示標題", () => {
    render(<TeamHealthCheck {...mockProps} />);
    expect(screen.getByTestId("thc-title")).toHaveTextContent("團隊健康評估");
  });

  it("顯示所有維度", () => {
    render(<TeamHealthCheck {...mockProps} />);
    expect(screen.getByTestId("thc-dim-safety")).toBeInTheDocument();
    expect(screen.getByTestId("thc-dim-trust")).toBeInTheDocument();
  });

  it("顯示維度標籤", () => {
    render(<TeamHealthCheck {...mockProps} />);
    expect(screen.getByTestId("thc-dim-label-safety")).toHaveTextContent("心理安全感");
  });

  it("顯示評分按鈕 1-5", () => {
    render(<TeamHealthCheck {...mockProps} />);
    expect(screen.getByTestId("thc-score-safety-1")).toBeInTheDocument();
    expect(screen.getByTestId("thc-score-safety-5")).toBeInTheDocument();
  });

  it("點擊評分呼叫 onScoreChange", () => {
    const onScoreChange = vi.fn();
    render(<TeamHealthCheck {...mockProps} onScoreChange={onScoreChange} />);
    fireEvent.click(screen.getByTestId("thc-score-safety-4"));
    expect(onScoreChange).toHaveBeenCalledWith("safety", 4);
  });

  it("未全部評分時提交按鈕 disabled", () => {
    render(<TeamHealthCheck {...mockProps} />);
    expect(screen.getByTestId("thc-submit-btn")).toBeDisabled();
  });

  it("全部評分後提交按鈕啟用", () => {
    const localScores = { safety: 4, trust: 3 };
    render(<TeamHealthCheck {...mockProps} localScores={localScores} />);
    expect(screen.getByTestId("thc-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    const localScores = { safety: 4, trust: 3 };
    render(<TeamHealthCheck {...mockProps} localScores={localScores} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("thc-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交後顯示確認訊息", () => {
    const state: TeamHealthState = { responses: [response1] };
    render(<TeamHealthCheck {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("thc-submitted-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("thc-submit-btn")).not.toBeInTheDocument();
  });

  it("顯示回應人數", () => {
    const state: TeamHealthState = { responses: [response1, response2] };
    render(<TeamHealthCheck {...mockProps} state={state} />);
    expect(screen.getByTestId("thc-count")).toHaveTextContent("2");
  });

  it("有回應且 showResults=true 時顯示結果", () => {
    const state: TeamHealthState = { responses: [response1] };
    render(<TeamHealthCheck {...mockProps} state={state} />);
    expect(screen.getByTestId("thc-results")).toBeInTheDocument();
  });

  it("showResults=false 不顯示結果", () => {
    const config = { ...defaultConfig, showResults: false };
    const state: TeamHealthState = { responses: [response1] };
    render(<TeamHealthCheck {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("thc-results")).not.toBeInTheDocument();
  });

  it("顯示各維度平均分", () => {
    const state: TeamHealthState = { responses: [response1, response2] };
    render(<TeamHealthCheck {...mockProps} state={state} />);
    // safety avg = (4+2)/2 = 3
    expect(screen.getByTestId("thc-avg-safety")).toHaveTextContent("3");
  });

  it("顯示各維度結果條", () => {
    const state: TeamHealthState = { responses: [response1] };
    render(<TeamHealthCheck {...mockProps} state={state} />);
    expect(screen.getByTestId("thc-bar-safety")).toBeInTheDocument();
    expect(screen.getByTestId("thc-bar-trust")).toBeInTheDocument();
  });

  it("無回應時不顯示結果", () => {
    render(<TeamHealthCheck {...mockProps} />);
    expect(screen.queryByTestId("thc-results")).not.toBeInTheDocument();
  });

  it("未全部評分時顯示提示", () => {
    render(<TeamHealthCheck {...mockProps} localScores={{ safety: 4 }} />);
    expect(screen.getByTestId("thc-incomplete-hint")).toBeInTheDocument();
  });
});
