import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TimedChallenge, {
  TimedChallengeConfig,
  TimedChallengeState,
} from "../TimedChallenge";

const BASE_CONFIG: TimedChallengeConfig = {
  title: "限時挑戰測試",
  challengeText: "請完成你的任務！",
  durationSeconds: 60,
};

const WAITING: TimedChallengeState = {
  completions: [],
  phase: "waiting",
  startedAt: null,
};

const RUNNING: TimedChallengeState = {
  completions: [],
  phase: "running",
  startedAt: Date.now() - 10000,
};

const RUNNING_WITH_COMPLETIONS: TimedChallengeState = {
  completions: [
    { completionId: "c1", userId: "u1", userName: "Alice", completedAt: RUNNING.startedAt! + 5000 },
    { completionId: "c2", userId: "u2", userName: "Bob", completedAt: RUNNING.startedAt! + 8000 },
  ],
  phase: "running",
  startedAt: RUNNING.startedAt,
};

const ENDED: TimedChallengeState = {
  completions: [
    { completionId: "c1", userId: "u1", userName: "Alice", completedAt: 1000 },
    { completionId: "c2", userId: "u2", userName: "Bob", completedAt: 2000 },
  ],
  phase: "ended",
  startedAt: 0,
};

function setup(
  state: TimedChallengeState = WAITING,
  config: TimedChallengeConfig = BASE_CONFIG,
  myUserId = "u1",
  now = Date.now()
) {
  const onStart = vi.fn();
  const onComplete = vi.fn();
  const onEnd = vi.fn();
  render(
    <TimedChallenge
      config={config}
      state={state}
      myUserId={myUserId}
      now={now}
      onStart={onStart}
      onComplete={onComplete}
      onEnd={onEnd}
    />
  );
  return { onStart, onComplete, onEnd };
}

describe("TimedChallenge — 標題與挑戰文字", () => {
  it("顯示標題", () => {
    setup();
    expect(screen.getByTestId("tc-title")).toHaveTextContent("限時挑戰測試");
  });

  it("顯示挑戰內容", () => {
    setup();
    expect(screen.getByTestId("tc-challenge")).toHaveTextContent("請完成你的任務！");
  });

  it("waiting phase 顯示準備中", () => {
    setup();
    expect(screen.getByTestId("tc-phase")).toHaveTextContent("準備中");
  });

  it("running phase 顯示挑戰進行中", () => {
    setup(RUNNING);
    expect(screen.getByTestId("tc-phase")).toHaveTextContent("挑戰進行中");
  });

  it("ended phase 顯示結束", () => {
    setup(ENDED);
    expect(screen.getByTestId("tc-phase")).toHaveTextContent("結束");
  });
});

describe("TimedChallenge — waiting phase", () => {
  it("顯示開始按鈕", () => {
    setup();
    expect(screen.getByTestId("tc-start-btn")).toBeInTheDocument();
  });

  it("顯示限時秒數", () => {
    setup();
    expect(screen.getByText(/60 秒/)).toBeInTheDocument();
  });

  it("點擊開始呼叫 onStart", () => {
    const { onStart } = setup();
    fireEvent.click(screen.getByTestId("tc-start-btn"));
    expect(onStart).toHaveBeenCalledOnce();
  });
});

describe("TimedChallenge — running phase", () => {
  it("顯示倒數計時", () => {
    const startedAt = Date.now() - 10000;
    const state: TimedChallengeState = { ...RUNNING, startedAt };
    setup(state, BASE_CONFIG, "u99", startedAt + 10000);
    expect(screen.getByTestId("tc-countdown")).toHaveTextContent("50s");
  });

  it("顯示完成按鈕", () => {
    setup(RUNNING, BASE_CONFIG, "u99");
    expect(screen.getByTestId("tc-complete-btn")).toBeInTheDocument();
  });

  it("點擊完成呼叫 onComplete", () => {
    const { onComplete } = setup(RUNNING, BASE_CONFIG, "u99");
    fireEvent.click(screen.getByTestId("tc-complete-btn"));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("已完成後不顯示完成按鈕", () => {
    setup(RUNNING_WITH_COMPLETIONS);
    expect(screen.queryByTestId("tc-complete-btn")).toBeNull();
  });

  it("顯示已完成人數", () => {
    setup(RUNNING_WITH_COMPLETIONS);
    expect(screen.getByTestId("tc-done-count")).toHaveTextContent("2");
  });

  it("顯示提前結束按鈕", () => {
    setup(RUNNING);
    expect(screen.getByTestId("tc-end-btn")).toBeInTheDocument();
  });

  it("點擊提前結束呼叫 onEnd", () => {
    const { onEnd } = setup(RUNNING);
    fireEvent.click(screen.getByTestId("tc-end-btn"));
    expect(onEnd).toHaveBeenCalledOnce();
  });
});

describe("TimedChallenge — ended phase", () => {
  it("顯示冠軍", () => {
    setup(ENDED);
    expect(screen.getByTestId("tc-winner")).toHaveTextContent("Alice");
  });

  it("顯示排名列表", () => {
    setup(ENDED);
    expect(screen.getByTestId("tc-result-u1")).toBeInTheDocument();
    expect(screen.getByTestId("tc-result-u2")).toBeInTheDocument();
  });

  it("我的完成標記（我）", () => {
    setup(ENDED);
    expect(screen.getByTestId("tc-result-u1")).toHaveTextContent("（我）");
  });

  it("無人完成顯示空狀態", () => {
    const emptyEnded: TimedChallengeState = { completions: [], phase: "ended", startedAt: 0 };
    setup(emptyEnded);
    expect(screen.getByTestId("tc-empty")).toBeInTheDocument();
  });
});
