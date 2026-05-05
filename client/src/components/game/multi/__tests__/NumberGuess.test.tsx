import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NumberGuess, {
  type NumberGuessConfig,
  type NumberGuessState,
} from "../NumberGuess";

const config: NumberGuessConfig = {
  title: "數字競猜",
  question: "你每週開幾小時的會？",
  unit: "小時",
  minValue: 0,
  maxValue: 40,
  showAuthor: true,
};

const emptyState: NumberGuessState = { guesses: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftValue: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderNG(overrides = {}) {
  return render(<NumberGuess {...baseProps} {...overrides} />);
}

describe("NumberGuess — 基本渲染", () => {
  it("顯示標題", () => {
    renderNG();
    expect(screen.getByTestId("ng-title")).toHaveTextContent("數字競猜");
  });

  it("顯示問題", () => {
    renderNG();
    expect(screen.getByTestId("ng-question")).toBeInTheDocument();
  });

  it("顯示輸入框", () => {
    renderNG();
    expect(screen.getByTestId("ng-input")).toBeInTheDocument();
  });

  it("顯示已回答人數 0", () => {
    renderNG();
    expect(screen.getByTestId("ng-count")).toHaveTextContent("0");
  });

  it("顯示揭曉按鈕", () => {
    renderNG();
    expect(screen.getByTestId("ng-reveal-btn")).toBeInTheDocument();
  });
});

describe("NumberGuess — 送出邏輯", () => {
  it("空白時送出按鈕 disabled", () => {
    renderNG({ draftValue: "" });
    expect(screen.getByTestId("ng-submit-btn")).toBeDisabled();
  });

  it("超出範圍（41）時 disabled", () => {
    renderNG({ draftValue: "41" });
    expect(screen.getByTestId("ng-submit-btn")).toBeDisabled();
  });

  it("超出範圍時顯示錯誤訊息", () => {
    renderNG({ draftValue: "41" });
    expect(screen.getByTestId("ng-error")).toBeInTheDocument();
  });

  it("有效範圍（20）時可送出", () => {
    renderNG({ draftValue: "20" });
    expect(screen.getByTestId("ng-submit-btn")).not.toBeDisabled();
  });

  it("邊界值（0）可送出", () => {
    renderNG({ draftValue: "0" });
    expect(screen.getByTestId("ng-submit-btn")).not.toBeDisabled();
  });

  it("邊界值（40）可送出", () => {
    renderNG({ draftValue: "40" });
    expect(screen.getByTestId("ng-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderNG({ draftValue: "15", onSubmit });
    fireEvent.click(screen.getByTestId("ng-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderNG({ onDraftChange });
    fireEvent.change(screen.getByTestId("ng-input"), { target: { value: "10" } });
    expect(onDraftChange).toHaveBeenCalledWith("10");
  });
});

describe("NumberGuess — 已送出狀態", () => {
  const stateWithMyGuess: NumberGuessState = {
    guesses: [
      { entryId: "g1", userId: "u1", userName: "Alice", value: 15 },
    ],
    revealed: false,
  };

  it("已送出顯示確認訊息", () => {
    renderNG({ state: stateWithMyGuess });
    expect(screen.getByTestId("ng-submitted-msg")).toBeInTheDocument();
  });

  it("已送出顯示數字值", () => {
    renderNG({ state: stateWithMyGuess });
    expect(screen.getByTestId("ng-submitted-msg")).toHaveTextContent("15");
  });

  it("已送出隱藏輸入框", () => {
    renderNG({ state: stateWithMyGuess });
    expect(screen.queryByTestId("ng-input")).not.toBeInTheDocument();
  });
});

describe("NumberGuess — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderNG({ onReveal });
    fireEvent.click(screen.getByTestId("ng-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: NumberGuessState = { guesses: [], revealed: true };

  it("揭曉空白顯示 ng-empty", () => {
    renderNG({ state: revealedEmpty });
    expect(screen.getByTestId("ng-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderNG({ state: revealedEmpty });
    expect(screen.queryByTestId("ng-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWith3: NumberGuessState = {
    guesses: [
      { entryId: "g1", userId: "u1", userName: "Alice", value: 5 },
      { entryId: "g2", userId: "u2", userName: "Bob", value: 10 },
      { entryId: "g3", userId: "u3", userName: "Charlie", value: 5 },
    ],
    revealed: true,
  };

  it("顯示 ng-result 容器", () => {
    renderNG({ state: revealedWith3 });
    expect(screen.getByTestId("ng-result")).toBeInTheDocument();
  });

  it("顯示統計卡片", () => {
    renderNG({ state: revealedWith3 });
    expect(screen.getByTestId("ng-stats")).toBeInTheDocument();
  });

  it("平均值計算正確（20/3≈6.7）", () => {
    renderNG({ state: revealedWith3 });
    expect(screen.getByTestId("ng-avg")).toHaveTextContent("6.7");
  });

  it("最小值 5", () => {
    renderNG({ state: revealedWith3 });
    expect(screen.getByTestId("ng-min")).toHaveTextContent("5");
  });

  it("最大值 10", () => {
    renderNG({ state: revealedWith3 });
    expect(screen.getByTestId("ng-max")).toHaveTextContent("10");
  });

  it("顯示直方圖 bar（值 5）", () => {
    renderNG({ state: revealedWith3 });
    expect(screen.getByTestId("ng-bar-5")).toBeInTheDocument();
  });

  it("顯示直方圖 bar（值 10）", () => {
    renderNG({ state: revealedWith3 });
    expect(screen.getByTestId("ng-bar-10")).toBeInTheDocument();
  });

  it("值 5 的 bar 顯示 ×2", () => {
    renderNG({ state: revealedWith3 });
    expect(screen.getByTestId("ng-bar-5")).toHaveTextContent("×2");
  });
});
