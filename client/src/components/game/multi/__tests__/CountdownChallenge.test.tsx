import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CountdownChallenge from "../CountdownChallenge";
import type {
  CountdownChallengeConfig,
  CountdownChallengeState,
} from "../CountdownChallenge";

const defaultConfig: CountdownChallengeConfig = {
  title: "⏱️ 限時挑戰",
  challenge: "在 30 秒內說出 5 種台灣小吃！",
  durationSeconds: 30,
  successLabel: "完成了！",
  failLabel: "放棄",
  showLeaderboard: true,
};

const notStartedState: CountdownChallengeState = { startedAt: null, entries: [] };

const NOW = 1000000;
const startedState: CountdownChallengeState = {
  startedAt: NOW - 5000,
  entries: [],
};

const expiredState: CountdownChallengeState = {
  startedAt: NOW - 35000,
  entries: [],
};

const entryCompleted = {
  userId: "u1",
  userName: "Alice",
  completed: true,
  completedAt: NOW - 5000 + 12000,
};
const entryFailed = {
  userId: "u2",
  userName: "Bob",
  completed: false,
};

const mockProps = {
  config: defaultConfig,
  state: notStartedState,
  myUserId: "u1",
  nowMs: NOW,
  onStart: vi.fn(),
  onComplete: vi.fn(),
  onFail: vi.fn(),
};

describe("CountdownChallenge", () => {
  it("顯示標題", () => {
    render(<CountdownChallenge {...mockProps} />);
    expect(screen.getByTestId("cc-title")).toHaveTextContent("限時挑戰");
  });

  it("顯示挑戰說明", () => {
    render(<CountdownChallenge {...mockProps} />);
    expect(screen.getByTestId("cc-challenge")).toHaveTextContent("30 秒內說出 5 種");
  });

  it("未開始顯示開始按鈕", () => {
    render(<CountdownChallenge {...mockProps} />);
    expect(screen.getByTestId("cc-start-btn")).toBeInTheDocument();
  });

  it("未開始顯示等待提示", () => {
    render(<CountdownChallenge {...mockProps} />);
    expect(screen.getByTestId("cc-waiting")).toBeInTheDocument();
  });

  it("未開始顯示總時長", () => {
    render(<CountdownChallenge {...mockProps} />);
    expect(screen.getByTestId("cc-timer")).toHaveTextContent("30");
  });

  it("點擊開始呼叫 onStart", () => {
    const onStart = vi.fn();
    render(<CountdownChallenge {...mockProps} onStart={onStart} />);
    fireEvent.click(screen.getByTestId("cc-start-btn"));
    expect(onStart).toHaveBeenCalled();
  });

  it("進行中隱藏開始按鈕", () => {
    render(<CountdownChallenge {...mockProps} state={startedState} />);
    expect(screen.queryByTestId("cc-start-btn")).not.toBeInTheDocument();
  });

  it("進行中顯示完成按鈕", () => {
    render(<CountdownChallenge {...mockProps} state={startedState} />);
    expect(screen.getByTestId("cc-complete-btn")).toBeInTheDocument();
  });

  it("進行中顯示放棄按鈕", () => {
    render(<CountdownChallenge {...mockProps} state={startedState} />);
    expect(screen.getByTestId("cc-fail-btn")).toBeInTheDocument();
  });

  it("點擊完成呼叫 onComplete", () => {
    const onComplete = vi.fn();
    render(<CountdownChallenge {...mockProps} state={startedState} onComplete={onComplete} />);
    fireEvent.click(screen.getByTestId("cc-complete-btn"));
    expect(onComplete).toHaveBeenCalled();
  });

  it("點擊放棄呼叫 onFail", () => {
    const onFail = vi.fn();
    render(<CountdownChallenge {...mockProps} state={startedState} onFail={onFail} />);
    fireEvent.click(screen.getByTestId("cc-fail-btn"));
    expect(onFail).toHaveBeenCalled();
  });

  it("時間到顯示到期訊息", () => {
    render(<CountdownChallenge {...mockProps} state={expiredState} />);
    expect(screen.getByTestId("cc-expired-msg")).toBeInTheDocument();
  });

  it("時間到計時器顯示 0", () => {
    render(<CountdownChallenge {...mockProps} state={expiredState} />);
    expect(screen.getByTestId("cc-timer")).toHaveTextContent("0");
  });

  it("已記錄結果後顯示我的結果", () => {
    const state: CountdownChallengeState = {
      startedAt: NOW - 5000,
      entries: [entryCompleted],
    };
    render(<CountdownChallenge {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("cc-my-result")).toBeInTheDocument();
  });

  it("完成後隱藏完成/放棄按鈕", () => {
    const state: CountdownChallengeState = {
      startedAt: NOW - 5000,
      entries: [entryCompleted],
    };
    render(<CountdownChallenge {...mockProps} state={state} myUserId="u1" />);
    expect(screen.queryByTestId("cc-complete-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cc-fail-btn")).not.toBeInTheDocument();
  });

  it("showLeaderboard=true 顯示排行榜", () => {
    const state: CountdownChallengeState = {
      startedAt: NOW - 15000,
      entries: [entryCompleted, entryFailed],
    };
    render(<CountdownChallenge {...mockProps} state={state} />);
    expect(screen.getByTestId("cc-leaderboard")).toBeInTheDocument();
  });

  it("排行榜顯示完成者", () => {
    const state: CountdownChallengeState = {
      startedAt: NOW - 15000,
      entries: [entryCompleted],
    };
    render(<CountdownChallenge {...mockProps} state={state} />);
    expect(screen.getByTestId("cc-entry-u1")).toBeInTheDocument();
  });

  it("排行榜顯示未完成者", () => {
    const state: CountdownChallengeState = {
      startedAt: NOW - 15000,
      entries: [entryFailed],
    };
    render(<CountdownChallenge {...mockProps} state={state} />);
    expect(screen.getByTestId("cc-fail-entry-u2")).toBeInTheDocument();
  });

  it("showLeaderboard=false 不顯示排行榜", () => {
    const config = { ...defaultConfig, showLeaderboard: false };
    const state: CountdownChallengeState = {
      startedAt: NOW - 15000,
      entries: [entryCompleted],
    };
    render(<CountdownChallenge {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("cc-leaderboard")).not.toBeInTheDocument();
  });
});
