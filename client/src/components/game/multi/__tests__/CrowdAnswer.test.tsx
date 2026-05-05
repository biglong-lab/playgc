import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CrowdAnswer, {
  CrowdAnswerConfig,
  CrowdAnswerState,
} from "../CrowdAnswer";

const BASE_CONFIG: CrowdAnswerConfig = {
  title: "猜猜看測試",
  question: "台灣有幾座離島？",
  unit: "座",
  correctAnswer: 85,
};

const EMPTY_STATE: CrowdAnswerState = {
  guesses: [],
  revealed: false,
};

const WITH_GUESSES: CrowdAnswerState = {
  guesses: [
    { guessId: "g1", userId: "u1", userName: "Alice", value: 80 },
    { guessId: "g2", userId: "u2", userName: "Bob", value: 100 },
    { guessId: "g3", userId: "u3", userName: "Carol", value: 84 },
  ],
  revealed: false,
};

const REVEALED_STATE: CrowdAnswerState = {
  ...WITH_GUESSES,
  revealed: true,
};

function setup(
  state: CrowdAnswerState = EMPTY_STATE,
  config: CrowdAnswerConfig = BASE_CONFIG,
  myUserId = "u1"
) {
  const onSubmit = vi.fn();
  const onReveal = vi.fn();
  render(
    <CrowdAnswer
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={onSubmit}
      onReveal={onReveal}
    />
  );
  return { onSubmit, onReveal };
}

describe("CrowdAnswer — 標題與問題", () => {
  it("顯示標題", () => {
    setup();
    expect(screen.getByTestId("ca-title")).toHaveTextContent("猜猜看測試");
  });

  it("顯示問題", () => {
    setup();
    expect(screen.getByTestId("ca-question")).toHaveTextContent("台灣有幾座離島？");
  });

  it("顯示單位", () => {
    setup();
    expect(screen.getByText("座")).toBeInTheDocument();
  });
});

describe("CrowdAnswer — 未提交狀態", () => {
  it("顯示輸入框", () => {
    setup();
    expect(screen.getByTestId("ca-input")).toBeInTheDocument();
  });

  it("顯示提交按鈕", () => {
    setup();
    expect(screen.getByTestId("ca-submit-btn")).toBeInTheDocument();
  });

  it("輸入為空時提交按鈕 disabled", () => {
    setup();
    expect(screen.getByTestId("ca-submit-btn")).toBeDisabled();
  });

  it("輸入數字後提交按鈕可用", () => {
    setup();
    fireEvent.change(screen.getByTestId("ca-input"), { target: { value: "50" } });
    expect(screen.getByTestId("ca-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit 並帶數字", () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByTestId("ca-input"), { target: { value: "75" } });
    fireEvent.click(screen.getByTestId("ca-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(75);
  });

  it("顯示已提交人數", () => {
    setup(WITH_GUESSES);
    expect(screen.getByText(/已有 3 人提交/)).toBeInTheDocument();
  });
});

describe("CrowdAnswer — 已提交我的猜測", () => {
  it("已提交後顯示我的猜測", () => {
    setup(WITH_GUESSES);
    expect(screen.getByTestId("ca-my-guess")).toHaveTextContent("80");
  });

  it("已提交後不顯示輸入框", () => {
    setup(WITH_GUESSES);
    expect(screen.queryByTestId("ca-input")).toBeNull();
  });

  it("已提交後不顯示提交按鈕", () => {
    setup(WITH_GUESSES);
    expect(screen.queryByTestId("ca-submit-btn")).toBeNull();
  });
});

describe("CrowdAnswer — 公布答案按鈕", () => {
  it("未公布時顯示公布答案按鈕", () => {
    setup(WITH_GUESSES);
    expect(screen.getByTestId("ca-reveal-btn")).toBeInTheDocument();
  });

  it("點擊公布答案呼叫 onReveal", () => {
    const { onReveal } = setup(WITH_GUESSES);
    fireEvent.click(screen.getByTestId("ca-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("公布後不顯示公布按鈕", () => {
    setup(REVEALED_STATE);
    expect(screen.queryByTestId("ca-reveal-btn")).toBeNull();
  });
});

describe("CrowdAnswer — 公布後結果", () => {
  it("顯示正確答案", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("ca-correct-answer")).toHaveTextContent("85");
  });

  it("顯示最接近冠軍", () => {
    setup(REVEALED_STATE);
    // Carol guessed 84, diff=1; Alice guessed 80, diff=5; Bob guessed 100, diff=15
    expect(screen.getByTestId("ca-winner")).toHaveTextContent("Carol");
  });

  it("顯示所有猜測", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("ca-guess-u1")).toBeInTheDocument();
    expect(screen.getByTestId("ca-guess-u2")).toBeInTheDocument();
    expect(screen.getByTestId("ca-guess-u3")).toBeInTheDocument();
  });

  it("我的猜測有（我）標記", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("ca-guess-u1")).toHaveTextContent("（我）");
  });

  it("公布後無人提交顯示空狀態", () => {
    const emptyRevealed: CrowdAnswerState = { guesses: [], revealed: true };
    setup(emptyRevealed);
    expect(screen.getByTestId("ca-empty")).toBeInTheDocument();
  });

  it("差距計算正確 — Carol 差1", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("ca-guess-u3")).toHaveTextContent("差 1");
  });
});
