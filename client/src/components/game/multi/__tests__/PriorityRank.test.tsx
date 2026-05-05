import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PriorityRank from "../PriorityRank";
import type { PriorityRankConfig, PriorityRankState } from "../PriorityRank";

const defaultConfig: PriorityRankConfig = {
  title: "🏆 優先順序排名",
  question: "請依重要程度排列",
  items: [
    { id: "a", label: "提升效率", emoji: "⚡" },
    { id: "b", label: "降低成本", emoji: "💰" },
    { id: "c", label: "增加收入", emoji: "📈" },
  ],
  showConsensus: true,
};

const emptyState: PriorityRankState = { rankings: [] };
const initialRanks = ["a", "b", "c"];

const ranking1 = { userId: "u1", userName: "Alice", ranks: ["a", "b", "c"], submittedAt: 1000 };
const ranking2 = { userId: "u2", userName: "Bob", ranks: ["c", "a", "b"], submittedAt: 2000 };

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  localRanks: initialRanks,
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  onSubmit: vi.fn(),
};

describe("PriorityRank", () => {
  it("顯示標題", () => {
    render(<PriorityRank {...mockProps} />);
    expect(screen.getByTestId("pr-title")).toHaveTextContent("優先順序排名");
  });

  it("顯示問題", () => {
    render(<PriorityRank {...mockProps} />);
    expect(screen.getByTestId("pr-question")).toHaveTextContent("請依重要程度排列");
  });

  it("顯示所有項目", () => {
    render(<PriorityRank {...mockProps} />);
    expect(screen.getByTestId("pr-item-a")).toBeInTheDocument();
    expect(screen.getByTestId("pr-item-b")).toBeInTheDocument();
    expect(screen.getByTestId("pr-item-c")).toBeInTheDocument();
  });

  it("顯示項目標籤", () => {
    render(<PriorityRank {...mockProps} />);
    expect(screen.getByTestId("pr-label-a")).toHaveTextContent("提升效率");
  });

  it("顯示排名順序", () => {
    render(<PriorityRank {...mockProps} />);
    expect(screen.getByTestId("pr-rank-a")).toHaveTextContent("1");
    expect(screen.getByTestId("pr-rank-b")).toHaveTextContent("2");
    expect(screen.getByTestId("pr-rank-c")).toHaveTextContent("3");
  });

  it("第一項的上移按鈕 disabled", () => {
    render(<PriorityRank {...mockProps} />);
    expect(screen.getByTestId("pr-up-a")).toBeDisabled();
  });

  it("最後一項的下移按鈕 disabled", () => {
    render(<PriorityRank {...mockProps} />);
    expect(screen.getByTestId("pr-down-c")).toBeDisabled();
  });

  it("點擊上移呼叫 onMoveUp", () => {
    const onMoveUp = vi.fn();
    render(<PriorityRank {...mockProps} onMoveUp={onMoveUp} />);
    fireEvent.click(screen.getByTestId("pr-up-b"));
    expect(onMoveUp).toHaveBeenCalledWith(1);
  });

  it("點擊下移呼叫 onMoveDown", () => {
    const onMoveDown = vi.fn();
    render(<PriorityRank {...mockProps} onMoveDown={onMoveDown} />);
    fireEvent.click(screen.getByTestId("pr-down-a"));
    expect(onMoveDown).toHaveBeenCalledWith(0);
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<PriorityRank {...mockProps} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("pr-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交時顯示確認訊息", () => {
    const state: PriorityRankState = { rankings: [ranking1] };
    render(<PriorityRank {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("pr-submitted-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("pr-submit-btn")).not.toBeInTheDocument();
  });

  it("顯示回應人數", () => {
    const state: PriorityRankState = { rankings: [ranking1, ranking2] };
    render(<PriorityRank {...mockProps} state={state} />);
    expect(screen.getByTestId("pr-count")).toHaveTextContent("2");
  });

  it("有回應且 showConsensus=true 時顯示共識排名", () => {
    const state: PriorityRankState = { rankings: [ranking1, ranking2] };
    render(<PriorityRank {...mockProps} state={state} />);
    expect(screen.getByTestId("pr-consensus")).toBeInTheDocument();
  });

  it("showConsensus=false 不顯示共識排名", () => {
    const config = { ...defaultConfig, showConsensus: false };
    const state: PriorityRankState = { rankings: [ranking1] };
    render(<PriorityRank {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("pr-consensus")).not.toBeInTheDocument();
  });

  it("無回應時不顯示共識排名", () => {
    render(<PriorityRank {...mockProps} />);
    expect(screen.queryByTestId("pr-consensus")).not.toBeInTheDocument();
  });

  it("共識排名顯示各項目", () => {
    const state: PriorityRankState = { rankings: [ranking1, ranking2] };
    render(<PriorityRank {...mockProps} state={state} />);
    expect(screen.getByTestId("pr-consensus-a")).toBeInTheDocument();
    expect(screen.getByTestId("pr-consensus-b")).toBeInTheDocument();
    expect(screen.getByTestId("pr-consensus-c")).toBeInTheDocument();
  });
});
