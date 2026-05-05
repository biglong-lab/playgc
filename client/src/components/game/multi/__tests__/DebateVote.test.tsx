import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DebateVote from "../DebateVote";
import type { DebateVoteConfig, DebateVoteState, DebateVoteEntry } from "../DebateVote";

const defaultConfig: DebateVoteConfig = {
  title: "🗳️ 即時辯論投票",
  topic: "AI 將取代大多數人類工作",
  proLabel: "正方：同意",
  conLabel: "反方：不同意",
  proEmoji: "👍",
  conEmoji: "👎",
  showVoterCount: true,
  allowSwitch: true,
};

const emptyState: DebateVoteState = { votes: [] };

const vote1: DebateVoteEntry = { userId: "u1", userName: "Alice", side: "pro", votedAt: 1000, switchCount: 0 };
const vote2: DebateVoteEntry = { userId: "u2", userName: "Bob", side: "con", votedAt: 2000, switchCount: 1 };
const vote3: DebateVoteEntry = { userId: "u3", userName: "Carol", side: "pro", votedAt: 3000, switchCount: 0 };

describe("DebateVote", () => {
  it("顯示標題", () => {
    render(<DebateVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("debate-title")).toHaveTextContent("即時辯論投票");
  });

  it("顯示辯論主題", () => {
    render(<DebateVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("debate-topic")).toHaveTextContent("AI 將取代大多數人類工作");
  });

  it("顯示正方按鈕", () => {
    render(<DebateVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("pro-btn")).toHaveTextContent("正方：同意");
  });

  it("顯示反方按鈕", () => {
    render(<DebateVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("con-btn")).toHaveTextContent("反方：不同意");
  });

  it("未投票時顯示引導訊息", () => {
    render(<DebateVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("no-vote-msg")).toBeInTheDocument();
  });

  it("點擊正方呼叫 onVote('pro')", () => {
    const onVote = vi.fn();
    render(<DebateVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={onVote} />);
    fireEvent.click(screen.getByTestId("pro-btn"));
    expect(onVote).toHaveBeenCalledWith("pro");
  });

  it("點擊反方呼叫 onVote('con')", () => {
    const onVote = vi.fn();
    render(<DebateVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={onVote} />);
    fireEvent.click(screen.getByTestId("con-btn"));
    expect(onVote).toHaveBeenCalledWith("con");
  });

  it("已投正方時顯示我的投票狀態", () => {
    const state: DebateVoteState = { votes: [vote1] };
    render(<DebateVote config={defaultConfig} state={state} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("my-vote-status")).toHaveTextContent("正方：同意");
  });

  it("已投正方時反方按鈕仍可點（allowSwitch=true）", () => {
    const state: DebateVoteState = { votes: [vote1] };
    render(<DebateVote config={defaultConfig} state={state} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("con-btn")).not.toBeDisabled();
  });

  it("allowSwitch=false 時已投正方，正方按鈕 disabled", () => {
    const config = { ...defaultConfig, allowSwitch: false };
    const state: DebateVoteState = { votes: [vote1] };
    render(<DebateVote config={config} state={state} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("pro-btn")).toBeDisabled();
  });

  it("顯示正反比例", () => {
    const state: DebateVoteState = { votes: [vote1, vote3, vote2] };
    render(<DebateVote config={defaultConfig} state={state} myUserId="u9" onVote={vi.fn()} />);
    expect(screen.getByTestId("pro-pct")).toHaveTextContent("67%");
  });

  it("showVoterCount=true 時顯示正反人數", () => {
    const state: DebateVoteState = { votes: [vote1, vote3, vote2] };
    render(<DebateVote config={defaultConfig} state={state} myUserId="u9" onVote={vi.fn()} />);
    expect(screen.getByTestId("pro-count")).toHaveTextContent("2 人");
    expect(screen.getByTestId("con-count")).toHaveTextContent("1 人");
  });

  it("showVoterCount=true 時顯示總參與人數", () => {
    const state: DebateVoteState = { votes: [vote1, vote2] };
    render(<DebateVote config={defaultConfig} state={state} myUserId="u9" onVote={vi.fn()} />);
    expect(screen.getByTestId("total-count")).toHaveTextContent("2 位參與");
  });

  it("顯示最新投票者列表", () => {
    const state: DebateVoteState = { votes: [vote1, vote2] };
    render(<DebateVote config={defaultConfig} state={state} myUserId="u9" onVote={vi.fn()} />);
    expect(screen.getByTestId("voter-u1")).toBeInTheDocument();
    expect(screen.getByTestId("voter-u2")).toBeInTheDocument();
  });

  it("換邊次數 > 0 時顯示換邊計數", () => {
    const state: DebateVoteState = { votes: [vote2] };
    render(<DebateVote config={defaultConfig} state={state} myUserId="u2" onVote={vi.fn()} />);
    expect(screen.getByTestId("switch-count")).toHaveTextContent("1 次");
  });

  it("0 票時正反各 50%", () => {
    render(<DebateVote config={defaultConfig} state={emptyState} myUserId="u1" onVote={vi.fn()} />);
    const proBar = screen.getByTestId("pro-bar");
    expect(proBar).toHaveStyle("width: 50%");
  });

  it("allowSwitch=false 已投票後兩個按鈕都 disabled", () => {
    const config = { ...defaultConfig, allowSwitch: false };
    const state: DebateVoteState = { votes: [vote1] };
    render(<DebateVote config={config} state={state} myUserId="u1" onVote={vi.fn()} />);
    expect(screen.getByTestId("pro-btn")).toBeDisabled();
    expect(screen.getByTestId("con-btn")).toBeDisabled();
  });
});
