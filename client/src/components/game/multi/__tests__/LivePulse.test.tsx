import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LivePulse from "../LivePulse";
import type { LivePulseConfig, LivePulseState, TapEvent } from "../LivePulse";

const defaultConfig: LivePulseConfig = {
  title: "⚡ 即時活力計",
  subtitle: "一起點擊！",
  prompt: "點擊提升活力！",
  maxLevel: 200,
};

const emptyState: LivePulseState = { taps: [], totalTaps: 0 };

const tap1: TapEvent = { userId: "u1", userName: "Alice", count: 10, lastAt: 1000 };
const tap2: TapEvent = { userId: "u2", userName: "Bob", count: 5, lastAt: 2000 };

describe("LivePulse", () => {
  it("顯示標題", () => {
    render(<LivePulse config={defaultConfig} state={emptyState} myUserId="u1" onTap={vi.fn()} />);
    expect(screen.getByTestId("pulse-title")).toHaveTextContent("即時活力計");
  });

  it("顯示副標題", () => {
    render(<LivePulse config={defaultConfig} state={emptyState} myUserId="u1" onTap={vi.fn()} />);
    expect(screen.getByTestId("pulse-subtitle")).toHaveTextContent("一起點擊！");
  });

  it("顯示總點擊次數為 0", () => {
    render(<LivePulse config={defaultConfig} state={emptyState} myUserId="u1" onTap={vi.fn()} />);
    expect(screen.getByTestId("total-taps")).toHaveTextContent("0");
  });

  it("顯示我的點擊為 0（未點擊）", () => {
    render(<LivePulse config={defaultConfig} state={emptyState} myUserId="u1" onTap={vi.fn()} />);
    expect(screen.getByTestId("my-tap-count")).toHaveTextContent("0");
  });

  it("顯示參與人數", () => {
    const state: LivePulseState = { taps: [tap1, tap2], totalTaps: 15 };
    render(<LivePulse config={defaultConfig} state={state} myUserId="u3" onTap={vi.fn()} />);
    expect(screen.getByTestId("participant-count")).toHaveTextContent("2");
  });

  it("顯示正確的總點擊數", () => {
    const state: LivePulseState = { taps: [tap1, tap2], totalTaps: 15 };
    render(<LivePulse config={defaultConfig} state={state} myUserId="u3" onTap={vi.fn()} />);
    expect(screen.getByTestId("total-taps")).toHaveTextContent("15");
  });

  it("顯示我的點擊數", () => {
    const state: LivePulseState = { taps: [tap1, tap2], totalTaps: 15 };
    render(<LivePulse config={defaultConfig} state={state} myUserId="u1" onTap={vi.fn()} />);
    expect(screen.getByTestId("my-tap-count")).toHaveTextContent("10");
  });

  it("顯示點擊按鈕", () => {
    render(<LivePulse config={defaultConfig} state={emptyState} myUserId="u1" onTap={vi.fn()} />);
    expect(screen.getByTestId("tap-btn")).toBeInTheDocument();
  });

  it("點擊按鈕呼叫 onTap", () => {
    const onTap = vi.fn();
    render(<LivePulse config={defaultConfig} state={emptyState} myUserId="u1" onTap={onTap} />);
    fireEvent.click(screen.getByTestId("tap-btn"));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("顯示活力進度條", () => {
    render(<LivePulse config={defaultConfig} state={emptyState} myUserId="u1" onTap={vi.fn()} />);
    expect(screen.getByTestId("pulse-bar")).toBeInTheDocument();
  });

  it("有人點擊後進度條有寬度", () => {
    const state: LivePulseState = { taps: [tap1], totalTaps: 100 };
    render(<LivePulse config={defaultConfig} state={state} myUserId="u3" onTap={vi.fn()} />);
    const bar = screen.getByTestId("pulse-bar");
    expect(bar).toHaveStyle("width: 50%");
  });

  it("顯示 emoji 活力等級", () => {
    render(<LivePulse config={defaultConfig} state={emptyState} myUserId="u1" onTap={vi.fn()} />);
    expect(screen.getByTestId("pulse-emoji")).toBeInTheDocument();
  });

  it("顯示活力排行", () => {
    const state: LivePulseState = { taps: [tap1, tap2], totalTaps: 15 };
    render(<LivePulse config={defaultConfig} state={state} myUserId="u3" onTap={vi.fn()} />);
    expect(screen.getByTestId("top-tappers")).toBeInTheDocument();
    expect(screen.getByTestId("tapper-u1")).toBeInTheDocument();
    expect(screen.getByTestId("tapper-u2")).toBeInTheDocument();
  });

  it("排行顯示正確點擊數", () => {
    const state: LivePulseState = { taps: [tap1, tap2], totalTaps: 15 };
    render(<LivePulse config={defaultConfig} state={state} myUserId="u3" onTap={vi.fn()} />);
    expect(screen.getByTestId("tapper-count-u1")).toHaveTextContent("10");
    expect(screen.getByTestId("tapper-count-u2")).toHaveTextContent("5");
  });

  it("排行第一是點擊最多的人", () => {
    const state: LivePulseState = { taps: [tap2, tap1], totalTaps: 15 };
    render(<LivePulse config={defaultConfig} state={state} myUserId="u3" onTap={vi.fn()} />);
    expect(screen.getByTestId("tapper-name-u1")).toHaveTextContent("Alice");
  });

  it("進度不超過 100%", () => {
    const state: LivePulseState = { taps: [tap1], totalTaps: 500 };
    render(<LivePulse config={defaultConfig} state={state} myUserId="u1" onTap={vi.fn()} />);
    const bar = screen.getByTestId("pulse-bar");
    expect(bar).toHaveStyle("width: 100%");
  });

  it("下個里程碑顯示剩餘次數", () => {
    const state: LivePulseState = { taps: [tap1], totalTaps: 30 };
    render(<LivePulse config={defaultConfig} state={state} myUserId="u1" onTap={vi.fn()} />);
    expect(screen.getByTestId("next-milestone")).toHaveTextContent("20");
  });
});
