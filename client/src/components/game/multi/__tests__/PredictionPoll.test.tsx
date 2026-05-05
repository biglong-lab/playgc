import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PredictionPoll, {
  PredictionPollConfig,
  PredictionPollState,
  PollOption,
} from "../PredictionPoll";

const options: PollOption[] = [
  { optionId: "a", label: "貓咪" },
  { optionId: "b", label: "狗狗" },
  { optionId: "c", label: "兔子" },
];

const baseConfig: PredictionPollConfig = {
  title: "寵物偏好預測",
  question: "你覺得大家最喜歡哪種寵物？",
  options,
};

const predictState: PredictionPollState = {
  predictions: [],
  answers: [],
  phase: "predict",
};

const answerState: PredictionPollState = {
  predictions: [
    { userId: "u1", userName: "Alice", predictedOptionId: "a" },
    { userId: "u2", userName: "Bob", predictedOptionId: "b" },
  ],
  answers: [],
  phase: "answer",
};

const resultState: PredictionPollState = {
  predictions: [
    { userId: "u1", userName: "Alice", predictedOptionId: "a" },
    { userId: "u2", userName: "Bob", predictedOptionId: "a" },
    { userId: "u3", userName: "Carol", predictedOptionId: "b" },
  ],
  answers: [
    { userId: "u1", answeredOptionId: "a" },
    { userId: "u2", answeredOptionId: "a" },
    { userId: "u3", answeredOptionId: "b" },
  ],
  phase: "result",
};

function renderPp(
  overrides: Partial<Parameters<typeof PredictionPoll>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: predictState,
    myUserId: "u1",
    onPredict: vi.fn(),
    onAnswer: vi.fn(),
    onAdvancePhase: vi.fn(),
    ...overrides,
  };
  return { ...render(<PredictionPoll {...props} />), props };
}

describe("PredictionPoll — 基本渲染", () => {
  it("顯示標題", () => {
    renderPp();
    expect(screen.getByTestId("pp-title")).toHaveTextContent(
      "寵物偏好預測"
    );
  });

  it("顯示問題", () => {
    renderPp();
    expect(screen.getByTestId("pp-question")).toHaveTextContent(
      "你覺得大家最喜歡哪種寵物？"
    );
  });

  it("顯示階段標籤（預測）", () => {
    renderPp();
    expect(screen.getByTestId("pp-phase")).toHaveTextContent("預測");
  });
});

describe("PredictionPoll — 預測階段", () => {
  it("顯示所有選項按鈕", () => {
    renderPp();
    expect(screen.getByTestId("pp-predict-a")).toBeInTheDocument();
    expect(screen.getByTestId("pp-predict-b")).toBeInTheDocument();
    expect(screen.getByTestId("pp-predict-c")).toBeInTheDocument();
  });

  it("點預測選項呼叫 onPredict", () => {
    const onPredict = vi.fn();
    renderPp({ onPredict });
    fireEvent.click(screen.getByTestId("pp-predict-b"));
    expect(onPredict).toHaveBeenCalledWith("b");
  });

  it("已預測後選項按鈕 disabled", () => {
    renderPp({
      state: {
        ...predictState,
        predictions: [
          { userId: "u1", userName: "Alice", predictedOptionId: "a" },
        ],
      },
    });
    expect(screen.getByTestId("pp-predict-a")).toBeDisabled();
    expect(screen.getByTestId("pp-predict-b")).toBeDisabled();
  });

  it("已預測後顯示確認訊息", () => {
    renderPp({
      state: {
        ...predictState,
        predictions: [
          { userId: "u1", userName: "Alice", predictedOptionId: "a" },
        ],
      },
    });
    expect(screen.getByTestId("pp-predicted-msg")).toBeInTheDocument();
  });

  it("顯示預測人數", () => {
    renderPp();
    expect(screen.getByTestId("pp-prediction-count")).toBeInTheDocument();
  });

  it("點進入作答呼叫 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderPp({ onAdvancePhase });
    fireEvent.click(screen.getByTestId("pp-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });
});

describe("PredictionPoll — 作答階段", () => {
  it("顯示作答階段標籤", () => {
    renderPp({ state: answerState });
    expect(screen.getByTestId("pp-phase")).toHaveTextContent("作答");
  });

  it("顯示作答選項按鈕", () => {
    renderPp({ state: answerState });
    expect(screen.getByTestId("pp-answer-a")).toBeInTheDocument();
    expect(screen.getByTestId("pp-answer-b")).toBeInTheDocument();
    expect(screen.getByTestId("pp-answer-c")).toBeInTheDocument();
  });

  it("點作答選項呼叫 onAnswer", () => {
    const onAnswer = vi.fn();
    renderPp({ state: answerState, onAnswer });
    fireEvent.click(screen.getByTestId("pp-answer-c"));
    expect(onAnswer).toHaveBeenCalledWith("c");
  });

  it("已作答後選項按鈕 disabled", () => {
    renderPp({
      state: {
        ...answerState,
        answers: [{ userId: "u1", answeredOptionId: "a" }],
      },
    });
    expect(screen.getByTestId("pp-answer-a")).toBeDisabled();
  });

  it("已作答後顯示確認訊息", () => {
    renderPp({
      state: {
        ...answerState,
        answers: [{ userId: "u1", answeredOptionId: "b" }],
      },
    });
    expect(screen.getByTestId("pp-answered-msg")).toBeInTheDocument();
  });

  it("顯示作答人數", () => {
    renderPp({ state: answerState });
    expect(screen.getByTestId("pp-answer-count")).toBeInTheDocument();
  });

  it("點揭曉結果呼叫 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderPp({ state: answerState, onAdvancePhase });
    fireEvent.click(screen.getByTestId("pp-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });
});

describe("PredictionPoll — 結果階段", () => {
  it("顯示結果階段標籤", () => {
    renderPp({ state: resultState });
    expect(screen.getByTestId("pp-phase")).toHaveTextContent("結果");
  });

  it("顯示 pp-result", () => {
    renderPp({ state: resultState });
    expect(screen.getByTestId("pp-result")).toBeInTheDocument();
  });

  it("顯示得票最多選項", () => {
    renderPp({ state: resultState });
    expect(screen.getByTestId("pp-winner")).toBeInTheDocument();
    expect(screen.getByTestId("pp-winner")).toHaveTextContent("貓咪");
  });

  it("顯示各選項進度條", () => {
    renderPp({ state: resultState });
    expect(screen.getByTestId("pp-bar-a")).toBeInTheDocument();
    expect(screen.getByTestId("pp-bar-b")).toBeInTheDocument();
  });

  it("顯示猜對統計", () => {
    renderPp({ state: resultState });
    expect(screen.getByTestId("pp-accuracy")).toBeInTheDocument();
  });

  it("猜對時顯示正確提示", () => {
    renderPp({ state: resultState, myUserId: "u1" });
    expect(screen.getByTestId("pp-my-accuracy")).toHaveTextContent(
      "✅ 你猜對了！"
    );
  });

  it("猜錯時顯示錯誤提示", () => {
    renderPp({ state: resultState, myUserId: "u3" });
    expect(screen.getByTestId("pp-my-accuracy")).toHaveTextContent(
      "❌ 你猜錯了"
    );
  });

  it("無作答資料時顯示 pp-empty", () => {
    renderPp({
      state: { predictions: [], answers: [], phase: "result" },
    });
    expect(screen.getByTestId("pp-empty")).toBeInTheDocument();
  });

  it("有作答資料時不顯示 pp-empty", () => {
    renderPp({ state: resultState });
    expect(screen.queryByTestId("pp-empty")).not.toBeInTheDocument();
  });
});
