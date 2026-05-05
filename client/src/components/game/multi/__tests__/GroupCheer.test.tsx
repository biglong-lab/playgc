import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GroupCheer from "../GroupCheer";
import type { GroupCheerConfig, GroupCheerState } from "../GroupCheer";

const defaultConfig: GroupCheerConfig = {
  title: "💪 集體應援",
  goal: 100,
  tapEmoji: "👏",
  celebrateMessage: "大家一起做到了！",
};

const emptyState: GroupCheerState = { totalTaps: 0, tapsByUser: {} };

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  onTap: vi.fn(),
};

describe("GroupCheer", () => {
  it("顯示標題", () => {
    render(<GroupCheer {...mockProps} />);
    expect(screen.getByTestId("gc-title")).toHaveTextContent("集體應援");
  });

  it("顯示目標數", () => {
    render(<GroupCheer {...mockProps} />);
    expect(screen.getByTestId("gc-goal")).toHaveTextContent("100");
  });

  it("顯示當前總點擊數", () => {
    render(<GroupCheer {...mockProps} />);
    expect(screen.getByTestId("gc-total")).toHaveTextContent("0");
  });

  it("顯示百分比", () => {
    const state = { totalTaps: 50, tapsByUser: {} };
    render(<GroupCheer {...mockProps} state={state} />);
    expect(screen.getByTestId("gc-pct")).toHaveTextContent("50%");
  });

  it("顯示進度條", () => {
    render(<GroupCheer {...mockProps} />);
    expect(screen.getByTestId("gc-bar")).toBeInTheDocument();
  });

  it("未達標顯示點擊按鈕", () => {
    render(<GroupCheer {...mockProps} />);
    expect(screen.getByTestId("gc-tap-btn")).toBeInTheDocument();
  });

  it("點擊按鈕呼叫 onTap", () => {
    const onTap = vi.fn();
    render(<GroupCheer {...mockProps} onTap={onTap} />);
    fireEvent.click(screen.getByTestId("gc-tap-btn"));
    expect(onTap).toHaveBeenCalled();
  });

  it("顯示我的貢獻次數", () => {
    const state = { totalTaps: 3, tapsByUser: { u1: 3 } };
    render(<GroupCheer {...mockProps} state={state} />);
    expect(screen.getByTestId("gc-my-taps")).toHaveTextContent("3");
  });

  it("無貢獻時我的次數為 0", () => {
    render(<GroupCheer {...mockProps} />);
    expect(screen.getByTestId("gc-my-taps")).toHaveTextContent("0");
  });

  it("達標後顯示慶祝區塊", () => {
    const state = { totalTaps: 100, tapsByUser: { u1: 100 } };
    render(<GroupCheer {...mockProps} state={state} />);
    expect(screen.getByTestId("gc-celebrate")).toBeInTheDocument();
    expect(screen.getByText("大家一起做到了！")).toBeInTheDocument();
  });

  it("達標後隱藏點擊按鈕", () => {
    const state = { totalTaps: 100, tapsByUser: { u1: 100 } };
    render(<GroupCheer {...mockProps} state={state} />);
    expect(screen.queryByTestId("gc-tap-btn")).not.toBeInTheDocument();
  });

  it("超過目標百分比上限為 100%", () => {
    const state = { totalTaps: 150, tapsByUser: {} };
    render(<GroupCheer {...mockProps} state={state} />);
    expect(screen.getByTestId("gc-pct")).toHaveTextContent("100%");
  });

  it("顯示貢獻排行榜", () => {
    const state = { totalTaps: 5, tapsByUser: { u1: 3, u2: 2 } };
    render(<GroupCheer {...mockProps} state={state} />);
    expect(screen.getByTestId("gc-leaderboard")).toBeInTheDocument();
    expect(screen.getByTestId("gc-rank-u1")).toBeInTheDocument();
    expect(screen.getByTestId("gc-rank-count-u1")).toHaveTextContent("3");
  });

  it("無貢獻者時不顯示排行榜", () => {
    render(<GroupCheer {...mockProps} />);
    expect(screen.queryByTestId("gc-leaderboard")).not.toBeInTheDocument();
  });
});
