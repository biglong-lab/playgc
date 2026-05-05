import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TruthOrMyth, {
  type TruthOrMythConfig,
  type TruthOrMythState,
} from "../TruthOrMyth";

const config: TruthOrMythConfig = {
  title: "真偽大考驗",
  statements: [
    { stmtId: "s1", text: "章魚有三顆心臟", isTrue: true },
    { stmtId: "s2", text: "人類只使用10%大腦", isTrue: false },
  ],
};

const initialState: TruthOrMythState = {
  votes: [],
  currentIndex: 0,
  revealedUpTo: 0,
};

const baseProps = {
  config,
  state: initialState,
  myUserId: "u1",
  onVote: vi.fn(),
  onNext: vi.fn(),
  onReveal: vi.fn(),
};

function renderTOM(overrides = {}) {
  return render(<TruthOrMyth {...baseProps} {...overrides} />);
}

describe("TruthOrMyth — 基本渲染", () => {
  it("顯示標題", () => {
    renderTOM();
    expect(screen.getByTestId("tom-title")).toHaveTextContent("真偽大考驗");
  });

  it("顯示第一題文字", () => {
    renderTOM();
    expect(screen.getByTestId("tom-statement")).toHaveTextContent("章魚有三顆心臟");
  });

  it("顯示進度 1/2", () => {
    renderTOM();
    expect(screen.getByTestId("tom-progress")).toHaveTextContent("第 1 / 2 題");
  });

  it("顯示投票按鈕（真的/假的）", () => {
    renderTOM();
    expect(screen.getByTestId("tom-vote-truth")).toBeInTheDocument();
    expect(screen.getByTestId("tom-vote-myth")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderTOM();
    expect(screen.getByTestId("tom-reveal-btn")).toBeInTheDocument();
  });
});

describe("TruthOrMyth — 投票", () => {
  it("點「真的」觸發 onVote('truth')", () => {
    const onVote = vi.fn();
    renderTOM({ onVote });
    fireEvent.click(screen.getByTestId("tom-vote-truth"));
    expect(onVote).toHaveBeenCalledWith("truth");
  });

  it("點「假的」觸發 onVote('myth')", () => {
    const onVote = vi.fn();
    renderTOM({ onVote });
    fireEvent.click(screen.getByTestId("tom-vote-myth"));
    expect(onVote).toHaveBeenCalledWith("myth");
  });

  const stateWithMyVote: TruthOrMythState = {
    votes: [{ userId: "u1", userName: "Alice", stmtId: "s1", answer: "truth" }],
    currentIndex: 0,
    revealedUpTo: 0,
  };

  it("已投票顯示確認訊息", () => {
    renderTOM({ state: stateWithMyVote });
    expect(screen.getByTestId("tom-voted-msg")).toBeInTheDocument();
  });

  it("已投票隱藏投票按鈕", () => {
    renderTOM({ state: stateWithMyVote });
    expect(screen.queryByTestId("tom-vote-truth")).not.toBeInTheDocument();
  });
});

describe("TruthOrMyth — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderTOM({ onReveal });
    fireEvent.click(screen.getByTestId("tom-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedState: TruthOrMythState = {
    votes: [
      { userId: "u1", userName: "Alice", stmtId: "s1", answer: "truth" },
      { userId: "u2", userName: "Bob", stmtId: "s1", answer: "myth" },
    ],
    currentIndex: 0,
    revealedUpTo: 1,
  };

  it("揭曉後顯示結果區", () => {
    renderTOM({ state: revealedState });
    expect(screen.getByTestId("tom-result")).toBeInTheDocument();
  });

  it("揭曉後顯示真票數", () => {
    renderTOM({ state: revealedState });
    expect(screen.getByTestId("tom-truth-count")).toHaveTextContent("1");
  });

  it("揭曉後顯示假票數", () => {
    renderTOM({ state: revealedState });
    expect(screen.getByTestId("tom-myth-count")).toHaveTextContent("1");
  });

  it("非最後一題：顯示下一題按鈕", () => {
    renderTOM({ state: revealedState });
    expect(screen.getByTestId("tom-next-btn")).toBeInTheDocument();
  });

  it("最後一題揭曉：顯示查看分數按鈕", () => {
    const lastState: TruthOrMythState = {
      votes: [{ userId: "u1", userName: "Alice", stmtId: "s2", answer: "truth" }],
      currentIndex: 1,
      revealedUpTo: 2,
    };
    renderTOM({ state: lastState });
    expect(screen.getByTestId("tom-score-btn")).toBeInTheDocument();
  });

  it("點下一題觸發 onNext", () => {
    const onNext = vi.fn();
    renderTOM({ state: revealedState, onNext });
    fireEvent.click(screen.getByTestId("tom-next-btn"));
    expect(onNext).toHaveBeenCalledOnce();
  });
});

describe("TruthOrMyth — 最終計分板", () => {
  const finalState: TruthOrMythState = {
    votes: [
      { userId: "u1", userName: "Alice", stmtId: "s1", answer: "truth" },
      { userId: "u1", userName: "Alice", stmtId: "s2", answer: "myth" },
    ],
    currentIndex: 2,
    revealedUpTo: 2,
  };

  it("顯示 tom-scoreboard", () => {
    renderTOM({ state: finalState });
    expect(screen.getByTestId("tom-scoreboard")).toBeInTheDocument();
  });

  it("顯示玩家分數卡", () => {
    renderTOM({ state: finalState });
    expect(screen.getByTestId("tom-score-u1")).toBeInTheDocument();
  });

  it("無玩家時顯示 tom-no-players", () => {
    const emptyFinal: TruthOrMythState = {
      votes: [],
      currentIndex: 2,
      revealedUpTo: 2,
    };
    renderTOM({ state: emptyFinal });
    expect(screen.getByTestId("tom-no-players")).toBeInTheDocument();
  });
});
