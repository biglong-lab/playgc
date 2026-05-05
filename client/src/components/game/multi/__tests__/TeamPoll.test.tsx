import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamPoll from "../TeamPoll";
import type { TeamPollConfig, TeamPollState } from "../TeamPoll";

const defaultConfig: TeamPollConfig = {
  title: "🗳️ 快速投票",
  question: "你最喜歡哪個城市？",
  options: [
    { id: "o1", label: "台北", emoji: "🏙️" },
    { id: "o2", label: "台南", emoji: "🏯" },
    { id: "o3", label: "花蓮", emoji: "🌊" },
  ],
  multiSelect: false,
  showResults: true,
  showVoterNames: true,
};

const emptyState: TeamPollState = { votes: [] };

const vote1 = {
  userId: "u1",
  userName: "Alice",
  selections: ["o1"],
  votedAt: 1000,
};
const vote2 = {
  userId: "u2",
  userName: "Bob",
  selections: ["o2"],
  votedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  localSelections: [],
  onToggleSelection: vi.fn(),
  onSubmit: vi.fn(),
};

describe("TeamPoll", () => {
  it("顯示標題", () => {
    render(<TeamPoll {...mockProps} />);
    expect(screen.getByTestId("tp-title")).toHaveTextContent("快速投票");
  });

  it("顯示問題", () => {
    render(<TeamPoll {...mockProps} />);
    expect(screen.getByTestId("tp-question")).toHaveTextContent("你最喜歡哪個城市");
  });

  it("顯示所有選項", () => {
    render(<TeamPoll {...mockProps} />);
    expect(screen.getByTestId("tp-option-o1")).toBeInTheDocument();
    expect(screen.getByTestId("tp-option-o2")).toBeInTheDocument();
    expect(screen.getByTestId("tp-option-o3")).toBeInTheDocument();
  });

  it("顯示選項標籤", () => {
    render(<TeamPoll {...mockProps} />);
    expect(screen.getByTestId("tp-label-o1")).toHaveTextContent("台北");
  });

  it("顯示選項 emoji", () => {
    render(<TeamPoll {...mockProps} />);
    expect(screen.getByTestId("tp-emoji-o1")).toHaveTextContent("🏙️");
  });

  it("無 emoji 時不顯示", () => {
    const config = {
      ...defaultConfig,
      options: [{ id: "o1", label: "台北" }],
    };
    render(<TeamPoll {...mockProps} config={config} />);
    expect(screen.queryByTestId("tp-emoji-o1")).not.toBeInTheDocument();
  });

  it("未選時提交按鈕 disabled", () => {
    render(<TeamPoll {...mockProps} />);
    expect(screen.getByTestId("tp-submit-btn")).toBeDisabled();
  });

  it("有選項時提交按鈕啟用", () => {
    render(<TeamPoll {...mockProps} localSelections={["o1"]} />);
    expect(screen.getByTestId("tp-submit-btn")).not.toBeDisabled();
  });

  it("點擊選項呼叫 onToggleSelection", () => {
    const onToggleSelection = vi.fn();
    render(<TeamPoll {...mockProps} onToggleSelection={onToggleSelection} />);
    fireEvent.click(screen.getByTestId("tp-option-o1"));
    expect(onToggleSelection).toHaveBeenCalledWith("o1");
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<TeamPoll {...mockProps} localSelections={["o1"]} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("tp-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已投票顯示已提交訊息", () => {
    const state: TeamPollState = { votes: [vote1] };
    render(<TeamPoll {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("tp-submitted-msg")).toBeInTheDocument();
    expect(screen.getByTestId("tp-count-total")).toHaveTextContent("1");
  });

  it("已投票後隱藏提交按鈕", () => {
    const state: TeamPollState = { votes: [vote1] };
    render(<TeamPoll {...mockProps} state={state} myUserId="u1" />);
    expect(screen.queryByTestId("tp-submit-btn")).not.toBeInTheDocument();
  });

  it("已投票後選項 disabled", () => {
    const state: TeamPollState = { votes: [vote1] };
    render(<TeamPoll {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("tp-option-o1")).toBeDisabled();
  });

  it("showResults=true 顯示得票數", () => {
    const state: TeamPollState = { votes: [vote1, vote2] };
    render(<TeamPoll {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("tp-count-o1")).toBeInTheDocument();
    expect(screen.getByTestId("tp-pct-o1")).toBeInTheDocument();
  });

  it("showResults=false 不顯示得票數", () => {
    const config = { ...defaultConfig, showResults: false };
    const state: TeamPollState = { votes: [vote1] };
    render(<TeamPoll {...mockProps} config={config} state={state} myUserId="u1" />);
    expect(screen.queryByTestId("tp-count-o1")).not.toBeInTheDocument();
  });

  it("showVoterNames=true 顯示投票者", () => {
    const state: TeamPollState = { votes: [vote1, vote2] };
    render(<TeamPoll {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("tp-voter-o1-u1")).toHaveTextContent("Alice");
  });

  it("showVoterNames=false 不顯示投票者", () => {
    const config = { ...defaultConfig, showVoterNames: false };
    const state: TeamPollState = { votes: [vote1] };
    render(<TeamPoll {...mockProps} config={config} state={state} myUserId="u1" />);
    expect(screen.queryByTestId("tp-voter-o1-u1")).not.toBeInTheDocument();
  });

  it("multiSelect=true 顯示多選提示", () => {
    const config = { ...defaultConfig, multiSelect: true };
    render(<TeamPoll {...mockProps} config={config} />);
    expect(screen.getByTestId("tp-multi-hint")).toBeInTheDocument();
  });

  it("multiSelect=false 不顯示多選提示", () => {
    render(<TeamPoll {...mockProps} />);
    expect(screen.queryByTestId("tp-multi-hint")).not.toBeInTheDocument();
  });

  it("0 票顯示等待提示", () => {
    render(<TeamPoll {...mockProps} />);
    expect(screen.getByTestId("tp-empty")).toBeInTheDocument();
  });

  it("有票後不顯示等待提示", () => {
    const state: TeamPollState = { votes: [vote1] };
    render(<TeamPoll {...mockProps} state={state} />);
    expect(screen.queryByTestId("tp-empty")).not.toBeInTheDocument();
  });
});
