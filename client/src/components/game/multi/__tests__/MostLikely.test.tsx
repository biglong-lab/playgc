import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MostLikely from "../MostLikely";
import type { MostLikelyConfig, MostLikelyState } from "../MostLikely";

const defaultConfig: MostLikelyConfig = {
  title: "👑 最有可能",
  questions: ["最有可能遲到的人？", "最有可能請客的人？"],
  showResults: true,
};

const alice = { userId: "u1", userName: "Alice" };
const bob = { userId: "u2", userName: "Bob" };
const carol = { userId: "u3", userName: "Carol" };

const baseState: MostLikelyState = {
  participants: [alice, bob, carol],
  votes: [],
  currentQuestionIndex: 0,
  revealed: false,
};

const mockProps = {
  config: defaultConfig,
  state: baseState,
  myUserId: "u1",
  onJoin: vi.fn(),
  onNominate: vi.fn(),
  onReveal: vi.fn(),
  onNext: vi.fn(),
};

describe("MostLikely", () => {
  it("顯示標題", () => {
    render(<MostLikely {...mockProps} />);
    expect(screen.getByTestId("ml-title")).toHaveTextContent("最有可能");
  });

  it("顯示進度", () => {
    render(<MostLikely {...mockProps} />);
    expect(screen.getByTestId("ml-progress")).toHaveTextContent("1 / 2");
  });

  it("顯示當前題目", () => {
    render(<MostLikely {...mockProps} />);
    expect(screen.getByTestId("ml-question")).toHaveTextContent("最有可能遲到的人");
  });

  it("顯示參與人數", () => {
    render(<MostLikely {...mockProps} />);
    expect(screen.getByTestId("ml-participant-count")).toHaveTextContent("3");
  });

  it("尚未加入顯示加入按鈕", () => {
    const state = { ...baseState, participants: [] };
    render(<MostLikely {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-join-btn")).toBeInTheDocument();
  });

  it("點擊加入呼叫 onJoin", () => {
    const state = { ...baseState, participants: [] };
    const onJoin = vi.fn();
    render(<MostLikely {...mockProps} state={state} onJoin={onJoin} />);
    fireEvent.click(screen.getByTestId("ml-join-btn"));
    expect(onJoin).toHaveBeenCalled();
  });

  it("已加入隱藏加入按鈕", () => {
    render(<MostLikely {...mockProps} />);
    expect(screen.queryByTestId("ml-join-btn")).not.toBeInTheDocument();
  });

  it("顯示其他參與者（不含自己）", () => {
    render(<MostLikely {...mockProps} />);
    expect(screen.getByTestId("ml-nominee-u2")).toBeInTheDocument();
    expect(screen.getByTestId("ml-nominee-u3")).toBeInTheDocument();
    expect(screen.queryByTestId("ml-nominee-u1")).not.toBeInTheDocument();
  });

  it("點擊提名呼叫 onNominate", () => {
    const onNominate = vi.fn();
    render(<MostLikely {...mockProps} onNominate={onNominate} />);
    fireEvent.click(screen.getByTestId("ml-nominee-u2"));
    expect(onNominate).toHaveBeenCalledWith("u2");
  });

  it("已投票顯示已投票訊息", () => {
    const state = {
      ...baseState,
      votes: [{ voterId: "u1", questionIndex: 0, nomineeId: "u2", nomineeName: "Bob" }],
    };
    render(<MostLikely {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-voted-msg")).toBeInTheDocument();
  });

  it("已投票後隱藏提名選項", () => {
    const state = {
      ...baseState,
      votes: [{ voterId: "u1", questionIndex: 0, nomineeId: "u2", nomineeName: "Bob" }],
    };
    render(<MostLikely {...mockProps} state={state} />);
    expect(screen.queryByTestId("ml-nominee-u2")).not.toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    render(<MostLikely {...mockProps} />);
    expect(screen.getByTestId("ml-reveal-btn")).toBeInTheDocument();
  });

  it("點擊揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    render(<MostLikely {...mockProps} onReveal={onReveal} />);
    fireEvent.click(screen.getByTestId("ml-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("揭曉後顯示結果", () => {
    const state = {
      ...baseState,
      votes: [
        { voterId: "u1", questionIndex: 0, nomineeId: "u2", nomineeName: "Bob" },
        { voterId: "u3", questionIndex: 0, nomineeId: "u2", nomineeName: "Bob" },
      ],
      revealed: true,
    };
    render(<MostLikely {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-results")).toBeInTheDocument();
    expect(screen.getByTestId("ml-result-u2")).toBeInTheDocument();
  });

  it("揭曉後顯示得票數", () => {
    const state = {
      ...baseState,
      votes: [{ voterId: "u1", questionIndex: 0, nomineeId: "u2", nomineeName: "Bob" }],
      revealed: true,
    };
    render(<MostLikely {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-vote-count-u2")).toHaveTextContent("1");
  });

  it("揭曉後最高票顯示桂冠", () => {
    const state = {
      ...baseState,
      votes: [
        { voterId: "u1", questionIndex: 0, nomineeId: "u2", nomineeName: "Bob" },
        { voterId: "u3", questionIndex: 0, nomineeId: "u2", nomineeName: "Bob" },
      ],
      revealed: true,
    };
    render(<MostLikely {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-top-u2")).toBeInTheDocument();
  });

  it("揭曉後顯示下一題按鈕", () => {
    const state = { ...baseState, revealed: true };
    render(<MostLikely {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-next-btn")).toBeInTheDocument();
  });

  it("最後一題顯示「結束」", () => {
    const state = { ...baseState, currentQuestionIndex: 1, revealed: true };
    render(<MostLikely {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-next-btn")).toHaveTextContent("結束");
  });

  it("點擊下一題呼叫 onNext", () => {
    const onNext = vi.fn();
    const state = { ...baseState, revealed: true };
    render(<MostLikely {...mockProps} state={state} onNext={onNext} />);
    fireEvent.click(screen.getByTestId("ml-next-btn"));
    expect(onNext).toHaveBeenCalled();
  });

  it("全部完成顯示結束畫面", () => {
    const state = { ...baseState, currentQuestionIndex: 2, revealed: false };
    render(<MostLikely {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-done")).toBeInTheDocument();
  });
});
