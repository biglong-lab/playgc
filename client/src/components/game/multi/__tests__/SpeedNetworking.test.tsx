import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SpeedNetworking from "../SpeedNetworking";
import type { SpeedNetworkingConfig, SpeedNetworkingState } from "../SpeedNetworking";

const defaultConfig: SpeedNetworkingConfig = {
  title: "⚡ 速配社交",
  prompt: "輪流認識新朋友！",
  roundDurationSeconds: 120,
  questions: ["你最近在做什麼？", "用一個詞描述你自己？"],
  showMatchedCount: true,
};

const waitingState: SpeedNetworkingState = {
  participants: [],
  currentRound: 1,
  roundStartedAt: null,
  phase: "waiting",
};

const p1 = { userId: "u1", userName: "Alice", matches: [], joinedAt: 1000 };
const p2 = { userId: "u2", userName: "Bob", matches: [], joinedAt: 2000 };
const p3 = { userId: "u3", userName: "Carol", matches: [], joinedAt: 3000 };

const mockProps = {
  config: defaultConfig,
  state: waitingState,
  myUserId: "u1",
  onJoin: vi.fn(),
  onMatchConfirm: vi.fn(),
  onNextRound: vi.fn(),
};

describe("SpeedNetworking", () => {
  it("顯示標題", () => {
    render(<SpeedNetworking {...mockProps} />);
    expect(screen.getByTestId("sn-title")).toHaveTextContent("速配社交");
  });

  it("顯示提示語", () => {
    render(<SpeedNetworking {...mockProps} />);
    expect(screen.getByTestId("sn-prompt")).toHaveTextContent("輪流認識新朋友！");
  });

  it("等待階段顯示加入按鈕", () => {
    render(<SpeedNetworking {...mockProps} />);
    expect(screen.getByTestId("sn-join-btn")).toBeInTheDocument();
  });

  it("點擊加入呼叫 onJoin", () => {
    const onJoin = vi.fn();
    render(<SpeedNetworking {...mockProps} onJoin={onJoin} />);
    fireEvent.click(screen.getByTestId("sn-join-btn"));
    expect(onJoin).toHaveBeenCalled();
  });

  it("已加入後顯示已加入訊息", () => {
    const state: SpeedNetworkingState = { ...waitingState, participants: [p1] };
    render(<SpeedNetworking {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("sn-joined-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("sn-join-btn")).not.toBeInTheDocument();
  });

  it("顯示等待中的參與者列表", () => {
    const state: SpeedNetworkingState = { ...waitingState, participants: [p1, p2] };
    render(<SpeedNetworking {...mockProps} state={state} />);
    expect(screen.getByTestId("sn-participant-u1")).toHaveTextContent("Alice");
    expect(screen.getByTestId("sn-participant-u2")).toHaveTextContent("Bob");
  });

  it("顯示參與人數", () => {
    const state: SpeedNetworkingState = { ...waitingState, participants: [p1, p2] };
    render(<SpeedNetworking {...mockProps} state={state} />);
    expect(screen.getByTestId("sn-participant-count")).toHaveTextContent("2");
  });

  it("顯示輪次", () => {
    const state: SpeedNetworkingState = { ...waitingState, participants: [p1, p2], currentRound: 2, phase: "networking", roundStartedAt: Date.now() };
    render(<SpeedNetworking {...mockProps} state={state} />);
    expect(screen.getByTestId("sn-round-num")).toHaveTextContent("2");
  });

  it("networking 階段顯示本輪問題", () => {
    const state: SpeedNetworkingState = {
      participants: [p1, p2],
      currentRound: 1,
      roundStartedAt: Date.now(),
      phase: "networking",
    };
    render(<SpeedNetworking {...mockProps} state={state} />);
    expect(screen.getByTestId("sn-question")).toHaveTextContent("你最近在做什麼？");
  });

  it("networking 階段顯示配對的對象名稱", () => {
    const state: SpeedNetworkingState = {
      participants: [p1, p2],
      currentRound: 1,
      roundStartedAt: Date.now(),
      phase: "networking",
    };
    render(<SpeedNetworking {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("sn-partner-name")).toBeInTheDocument();
  });

  it("點擊完成對話呼叫 onMatchConfirm", () => {
    const onMatchConfirm = vi.fn();
    const state: SpeedNetworkingState = {
      participants: [p1, p2],
      currentRound: 1,
      roundStartedAt: Date.now(),
      phase: "networking",
    };
    render(<SpeedNetworking {...mockProps} myUserId="u1" state={state} onMatchConfirm={onMatchConfirm} />);
    fireEvent.click(screen.getByTestId("sn-confirm-match-btn"));
    expect(onMatchConfirm).toHaveBeenCalled();
  });

  it("已確認的配對顯示已記錄", () => {
    const state: SpeedNetworkingState = {
      participants: [
        { ...p1, matches: [{ userId: "u2", userName: "Bob", matchedAt: 1000 }] },
        p2,
      ],
      currentRound: 1,
      roundStartedAt: Date.now(),
      phase: "networking",
    };
    render(<SpeedNetworking {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("sn-match-confirmed")).toBeInTheDocument();
    expect(screen.queryByTestId("sn-confirm-match-btn")).not.toBeInTheDocument();
  });

  it("點擊下一輪呼叫 onNextRound", () => {
    const onNextRound = vi.fn();
    const state: SpeedNetworkingState = {
      participants: [p1, p2],
      currentRound: 1,
      roundStartedAt: Date.now(),
      phase: "networking",
    };
    render(<SpeedNetworking {...mockProps} state={state} onNextRound={onNextRound} />);
    fireEvent.click(screen.getByTestId("sn-next-round-btn"));
    expect(onNextRound).toHaveBeenCalled();
  });

  it("顯示已認識人數", () => {
    const state: SpeedNetworkingState = {
      participants: [
        { ...p1, matches: [{ userId: "u2", userName: "Bob", matchedAt: 1000 }] },
        p2,
      ],
      currentRound: 1,
      roundStartedAt: Date.now(),
      phase: "networking",
    };
    render(<SpeedNetworking {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("sn-matched-count")).toHaveTextContent("1");
  });

  it("顯示已認識的人列表", () => {
    const state: SpeedNetworkingState = {
      participants: [
        { ...p1, matches: [{ userId: "u2", userName: "Bob", matchedAt: 1000 }] },
        p2,
      ],
      currentRound: 1,
      roundStartedAt: Date.now(),
      phase: "networking",
    };
    render(<SpeedNetworking {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("sn-match-u2")).toHaveTextContent("Bob");
  });

  it("人數不足時顯示等待提示", () => {
    const state: SpeedNetworkingState = {
      participants: [p1],
      currentRound: 1,
      roundStartedAt: Date.now(),
      phase: "networking",
    };
    render(<SpeedNetworking {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("sn-no-partner")).toBeInTheDocument();
  });

  it("done 階段顯示完成畫面", () => {
    const state: SpeedNetworkingState = {
      participants: [
        { ...p1, matches: [{ userId: "u2", userName: "Bob", matchedAt: 1000 }, { userId: "u3", userName: "Carol", matchedAt: 2000 }] },
        p2,
        p3,
      ],
      currentRound: 3,
      roundStartedAt: null,
      phase: "done",
    };
    render(<SpeedNetworking {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("sn-done-section")).toBeInTheDocument();
    expect(screen.getByTestId("sn-final-count")).toHaveTextContent("2");
  });

  it("done 階段顯示認識的人", () => {
    const state: SpeedNetworkingState = {
      participants: [
        { ...p1, matches: [{ userId: "u2", userName: "Bob", matchedAt: 1000 }] },
        p2,
      ],
      currentRound: 2,
      roundStartedAt: null,
      phase: "done",
    };
    render(<SpeedNetworking {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("sn-done-match-u2")).toHaveTextContent("Bob");
  });

  it("done 階段無認識則顯示空提示", () => {
    const state: SpeedNetworkingState = {
      participants: [p1, p2],
      currentRound: 2,
      roundStartedAt: null,
      phase: "done",
    };
    render(<SpeedNetworking {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("sn-no-matches")).toBeInTheDocument();
  });
});
