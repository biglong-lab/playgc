import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GroupTimer from "../GroupTimer";
import type { GroupTimerConfig, GroupTimerState } from "../GroupTimer";

const config: GroupTimerConfig = {
  title: "限時倒數",
  durationSeconds: 120,
  message: "完成任務！",
  completedText: "時間到，請回來！",
};

const notStartedState: GroupTimerState = { startedAt: null, startedBy: null };

describe("GroupTimer", () => {
  it("顯示標題", () => {
    render(<GroupTimer config={config} state={notStartedState} myUserId="u1" onStart={vi.fn()} />);
    expect(screen.getByTestId("group-timer-title")).toHaveTextContent("限時倒數");
  });

  it("未開始時顯示開始按鈕", () => {
    render(<GroupTimer config={config} state={notStartedState} myUserId="u1" onStart={vi.fn()} />);
    expect(screen.getByTestId("group-timer-start-btn")).toBeInTheDocument();
  });

  it("未開始時顯示初始時間（durationSeconds）", () => {
    render(<GroupTimer config={config} state={notStartedState} myUserId="u1" onStart={vi.fn()} />);
    expect(screen.getByTestId("group-timer-display")).toHaveTextContent("02:00");
  });

  it("點擊開始呼叫 onStart", async () => {
    const onStart = vi.fn().mockResolvedValue(undefined);
    render(<GroupTimer config={config} state={notStartedState} myUserId="u1" onStart={onStart} />);
    fireEvent.click(screen.getByTestId("group-timer-start-btn"));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
  });

  it("倒數進行中不顯示開始按鈕", () => {
    const state: GroupTimerState = { startedAt: Date.now() - 5000, startedBy: "u2" };
    render(<GroupTimer config={config} state={state} myUserId="u1" onStart={vi.fn()} />);
    expect(screen.queryByTestId("group-timer-start-btn")).not.toBeInTheDocument();
  });

  it("倒數進行中顯示時間（約 115 秒）", () => {
    const state: GroupTimerState = { startedAt: Date.now() - 5000, startedBy: "u1" };
    render(<GroupTimer config={config} state={state} myUserId="u1" onStart={vi.fn()} />);
    const display = screen.getByTestId("group-timer-display");
    // 5 秒過去，應該顯示約 01:55（允許 ±2 秒誤差）
    expect(display.textContent).toMatch(/^01:[5][34]$|^01:[5][5]$/);
  });

  it("顯示進度條", () => {
    const state: GroupTimerState = { startedAt: Date.now() - 30000, startedBy: "u1" };
    render(<GroupTimer config={config} state={state} myUserId="u1" onStart={vi.fn()} />);
    expect(screen.getByTestId("group-timer-bar")).toBeInTheDocument();
  });

  it("倒數完成後顯示完成畫面", () => {
    // durationSeconds = 120, startedAt = 121 秒前
    const state: GroupTimerState = { startedAt: Date.now() - 121000, startedBy: "u2" };
    render(<GroupTimer config={config} state={state} myUserId="u1" onStart={vi.fn()} />);
    expect(screen.getByTestId("group-timer-completed")).toBeInTheDocument();
    expect(screen.getByText("時間到！")).toBeInTheDocument();
    expect(screen.getByText("時間到，請回來！")).toBeInTheDocument();
  });

  it("完成後不顯示開始按鈕", () => {
    const state: GroupTimerState = { startedAt: Date.now() - 121000, startedBy: "u2" };
    render(<GroupTimer config={config} state={state} myUserId="u1" onStart={vi.fn()} />);
    expect(screen.queryByTestId("group-timer-start-btn")).not.toBeInTheDocument();
  });

  it("自己啟動時顯示「你已啟動」提示", () => {
    const state: GroupTimerState = { startedAt: Date.now() - 5000, startedBy: "u1" };
    render(<GroupTimer config={config} state={state} myUserId="u1" onStart={vi.fn()} />);
    expect(screen.getByTestId("group-timer-info")).toHaveTextContent("你已啟動");
  });

  it("他人啟動時顯示「倒數進行中」提示", () => {
    const state: GroupTimerState = { startedAt: Date.now() - 5000, startedBy: "u2" };
    render(<GroupTimer config={config} state={state} myUserId="u1" onStart={vi.fn()} />);
    expect(screen.getByTestId("group-timer-info")).toHaveTextContent("倒數進行中");
  });

  it("使用預設標題（無 title 設定）", () => {
    const cfg: GroupTimerConfig = { durationSeconds: 60 };
    render(<GroupTimer config={cfg} state={notStartedState} myUserId="u1" onStart={vi.fn()} />);
    expect(screen.getByTestId("group-timer-title")).toHaveTextContent("⏱️ 限時倒數");
  });
});
