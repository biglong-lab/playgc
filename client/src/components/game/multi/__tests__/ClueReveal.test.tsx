import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ClueReveal, {
  ClueRevealConfig,
  ClueRevealState,
  ClueGuess,
} from "../ClueReveal";

const baseConfig: ClueRevealConfig = {
  title: "解謎測試",
  clues: ["它是圓的", "它是橙色的", "它長在樹上"],
  minCluesBeforeGuess: 1,
};

const initialState: ClueRevealState = {
  revealedCount: 0,
  guesses: [],
  phase: "playing",
};

const twoCluesState: ClueRevealState = {
  revealedCount: 2,
  guesses: [],
  phase: "playing",
};

const guesses: ClueGuess[] = [
  { guessId: "g1", userId: "u1", userName: "Alice", text: "橘子", afterClueCount: 2, correct: null },
  { guessId: "g2", userId: "u2", userName: "Bob", text: "蘋果", afterClueCount: 1, correct: false },
];

const withGuessesState: ClueRevealState = {
  revealedCount: 2,
  guesses,
  phase: "playing",
};

function renderCr(overrides: Partial<Parameters<typeof ClueReveal>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: initialState,
    myUserId: "u3",
    onGuess: vi.fn(),
    onRevealNext: vi.fn(),
    onMarkGuess: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
  return { ...render(<ClueReveal {...props} />), props };
}

describe("ClueReveal — 基本渲染", () => {
  it("顯示標題", () => {
    renderCr();
    expect(screen.getByTestId("cr-title")).toHaveTextContent("解謎測試");
  });

  it("顯示公布線索計數", () => {
    renderCr();
    expect(screen.getByTestId("cr-revealed-count")).toHaveTextContent("0 / 3");
  });

  it("有線索公布後顯示計數更新", () => {
    renderCr({ state: twoCluesState });
    expect(screen.getByTestId("cr-revealed-count")).toHaveTextContent("2 / 3");
  });

  it("顯示已公布的線索", () => {
    renderCr({ state: twoCluesState });
    expect(screen.getByTestId("cr-clue-0")).toHaveTextContent("它是圓的");
    expect(screen.getByTestId("cr-clue-1")).toHaveTextContent("它是橙色的");
    expect(screen.queryByTestId("cr-clue-2")).not.toBeInTheDocument();
  });

  it("顯示公布下一條線索按鈕", () => {
    renderCr({ state: twoCluesState });
    expect(screen.getByTestId("cr-reveal-next-btn")).toBeInTheDocument();
  });

  it("所有線索都公布後不顯示公布按鈕", () => {
    renderCr({ state: { revealedCount: 3, guesses: [], phase: "playing" } });
    expect(screen.queryByTestId("cr-reveal-next-btn")).not.toBeInTheDocument();
  });

  it("顯示結束遊戲按鈕", () => {
    renderCr();
    expect(screen.getByTestId("cr-finish-btn")).toBeInTheDocument();
  });
});

describe("ClueReveal — 互動", () => {
  it("點公布下一條呼叫 onRevealNext", () => {
    const onRevealNext = vi.fn();
    renderCr({ state: twoCluesState, onRevealNext });
    fireEvent.click(screen.getByTestId("cr-reveal-next-btn"));
    expect(onRevealNext).toHaveBeenCalledTimes(1);
  });

  it("minCluesBeforeGuess=1 公布1條後顯示猜測輸入框", () => {
    renderCr({
      state: { revealedCount: 1, guesses: [], phase: "playing" },
      config: { ...baseConfig, minCluesBeforeGuess: 1 },
    });
    expect(screen.getByTestId("cr-guess-input")).toBeInTheDocument();
  });

  it("未達 minCluesBeforeGuess 不顯示猜測輸入框", () => {
    renderCr({
      state: { revealedCount: 0, guesses: [], phase: "playing" },
      config: { ...baseConfig, minCluesBeforeGuess: 1 },
    });
    expect(screen.queryByTestId("cr-guess-input")).not.toBeInTheDocument();
  });

  it("空輸入時送出鈕 disabled", () => {
    renderCr({
      state: { revealedCount: 1, guesses: [], phase: "playing" },
    });
    expect(screen.getByTestId("cr-guess-submit")).toBeDisabled();
  });

  it("有輸入時送出鈕可點", () => {
    renderCr({
      state: { revealedCount: 1, guesses: [], phase: "playing" },
    });
    fireEvent.change(screen.getByTestId("cr-guess-input"), {
      target: { value: "橘子" },
    });
    expect(screen.getByTestId("cr-guess-submit")).not.toBeDisabled();
  });

  it("點送出呼叫 onGuess", () => {
    const onGuess = vi.fn();
    renderCr({
      state: { revealedCount: 1, guesses: [], phase: "playing" },
      onGuess,
    });
    fireEvent.change(screen.getByTestId("cr-guess-input"), {
      target: { value: "橘子" },
    });
    fireEvent.click(screen.getByTestId("cr-guess-submit"));
    expect(onGuess).toHaveBeenCalledWith("橘子");
  });

  it("已猜過顯示 cr-my-guess", () => {
    renderCr({
      state: withGuessesState,
      myUserId: "u1",
    });
    expect(screen.getByTestId("cr-my-guess")).toHaveTextContent("橘子");
  });

  it("點結束遊戲呼叫 onFinish", () => {
    const onFinish = vi.fn();
    renderCr({ onFinish });
    fireEvent.click(screen.getByTestId("cr-finish-btn"));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe("ClueReveal — 猜測標記", () => {
  it("顯示所有猜測", () => {
    renderCr({ state: withGuessesState });
    expect(screen.getByTestId("cr-guess-g1")).toBeInTheDocument();
    expect(screen.getByTestId("cr-guess-g2")).toBeInTheDocument();
  });

  it("未標記猜測顯示正確/錯誤按鈕", () => {
    renderCr({ state: withGuessesState });
    expect(screen.getByTestId("cr-correct-g1")).toBeInTheDocument();
    expect(screen.getByTestId("cr-wrong-g1")).toBeInTheDocument();
  });

  it("點正確呼叫 onMarkGuess true", () => {
    const onMarkGuess = vi.fn();
    renderCr({ state: withGuessesState, onMarkGuess });
    fireEvent.click(screen.getByTestId("cr-correct-g1"));
    expect(onMarkGuess).toHaveBeenCalledWith("g1", true);
  });

  it("點錯誤呼叫 onMarkGuess false", () => {
    const onMarkGuess = vi.fn();
    renderCr({ state: withGuessesState, onMarkGuess });
    fireEvent.click(screen.getByTestId("cr-wrong-g1"));
    expect(onMarkGuess).toHaveBeenCalledWith("g1", false);
  });

  it("已標記錯誤的猜測不顯示標記按鈕", () => {
    renderCr({ state: withGuessesState });
    expect(screen.queryByTestId("cr-correct-g2")).not.toBeInTheDocument();
  });
});
