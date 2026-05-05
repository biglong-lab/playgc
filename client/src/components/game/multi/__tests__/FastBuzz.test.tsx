import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FastBuzz, {
  FastBuzzConfig,
  FastBuzzState,
  BuzzRecord,
} from "../FastBuzz";

const BASE_CONFIG: FastBuzzConfig = {
  title: "搶答測試",
  questions: ["第一題", "第二題", "第三題"],
};

const WAITING_STATE: FastBuzzState = {
  currentQuestionIndex: 0,
  buzzes: [],
  phase: "waiting",
};

const OPEN_STATE: FastBuzzState = {
  ...WAITING_STATE,
  phase: "open",
};

const JUDGING_STATE: FastBuzzState = {
  currentQuestionIndex: 0,
  buzzes: [
    {
      buzzId: "b1",
      userId: "u1",
      userName: "Alice",
      buzzedAt: 1000,
      result: "pending",
      questionIndex: 0,
    },
    {
      buzzId: "b2",
      userId: "u2",
      userName: "Bob",
      buzzedAt: 2000,
      result: "pending",
      questionIndex: 0,
    },
  ],
  phase: "judging",
};

const DONE_STATE: FastBuzzState = {
  currentQuestionIndex: 2,
  buzzes: [
    {
      buzzId: "b1",
      userId: "u1",
      userName: "Alice",
      buzzedAt: 1000,
      result: "correct",
      questionIndex: 0,
    },
    {
      buzzId: "b2",
      userId: "u2",
      userName: "Bob",
      buzzedAt: 2000,
      result: "wrong",
      questionIndex: 1,
    },
  ],
  phase: "done",
};

function setup(
  state: FastBuzzState = WAITING_STATE,
  config: FastBuzzConfig = BASE_CONFIG,
  myUserId = "u1"
) {
  const onBuzz = vi.fn();
  const onJudge = vi.fn();
  const onAdvance = vi.fn();
  render(
    <FastBuzz
      config={config}
      state={state}
      myUserId={myUserId}
      onBuzz={onBuzz}
      onJudge={onJudge}
      onAdvance={onAdvance}
    />
  );
  return { onBuzz, onJudge, onAdvance };
}

describe("FastBuzz — 標題與基本顯示", () => {
  it("顯示標題", () => {
    setup();
    expect(screen.getByTestId("fb-title")).toHaveTextContent("搶答測試");
  });

  it("waiting phase 顯示等待開始", () => {
    setup();
    expect(screen.getByTestId("fb-phase")).toHaveTextContent("等待開始");
  });

  it("open phase 顯示搶答中", () => {
    setup(OPEN_STATE);
    expect(screen.getByTestId("fb-phase")).toHaveTextContent("搶答中");
  });

  it("judging phase 顯示判定中", () => {
    setup(JUDGING_STATE);
    expect(screen.getByTestId("fb-phase")).toHaveTextContent("判定中");
  });

  it("done phase 顯示結束", () => {
    setup(DONE_STATE);
    expect(screen.getByTestId("fb-phase")).toHaveTextContent("結束");
  });

  it("顯示題目數量", () => {
    setup();
    expect(screen.getByText(/共 3 題/)).toBeInTheDocument();
  });
});

describe("FastBuzz — waiting phase", () => {
  it("waiting 時有「開始第一題」按鈕", () => {
    setup();
    expect(screen.getByTestId("fb-advance-btn")).toHaveTextContent("開始第一題");
  });

  it("waiting 時不顯示題目", () => {
    setup();
    expect(screen.queryByTestId("fb-question")).toBeNull();
  });

  it("waiting 時不顯示搶答按鈕", () => {
    setup();
    expect(screen.queryByTestId("fb-buzz-btn")).toBeNull();
  });

  it("點擊開始第一題呼叫 onAdvance", () => {
    const { onAdvance } = setup();
    fireEvent.click(screen.getByTestId("fb-advance-btn"));
    expect(onAdvance).toHaveBeenCalledOnce();
  });
});

describe("FastBuzz — open phase", () => {
  it("open 時顯示題目", () => {
    setup(OPEN_STATE);
    expect(screen.getByTestId("fb-question")).toHaveTextContent("第一題");
  });

  it("open 時顯示搶答按鈕", () => {
    setup(OPEN_STATE);
    expect(screen.getByTestId("fb-buzz-btn")).toBeInTheDocument();
  });

  it("未按鈴時搶答按鈕可用", () => {
    setup(OPEN_STATE, BASE_CONFIG, "u99");
    expect(screen.getByTestId("fb-buzz-btn")).not.toBeDisabled();
  });

  it("已按鈴時搶答按鈕 disabled", () => {
    const buzzedState: FastBuzzState = {
      ...OPEN_STATE,
      buzzes: [
        {
          buzzId: "b1",
          userId: "u1",
          userName: "Alice",
          buzzedAt: 1000,
          result: "pending",
          questionIndex: 0,
        },
      ],
    };
    setup(buzzedState);
    expect(screen.getByTestId("fb-buzz-btn")).toBeDisabled();
  });

  it("點擊搶答呼叫 onBuzz", () => {
    const { onBuzz } = setup(OPEN_STATE, BASE_CONFIG, "u99");
    fireEvent.click(screen.getByTestId("fb-buzz-btn"));
    expect(onBuzz).toHaveBeenCalledOnce();
  });

  it("open 時 advance 按鈕顯示「關閉搶答」", () => {
    setup(OPEN_STATE);
    expect(screen.getByTestId("fb-advance-btn")).toHaveTextContent("關閉搶答");
  });
});

describe("FastBuzz — judging phase", () => {
  it("judging 時顯示題目", () => {
    setup(JUDGING_STATE);
    expect(screen.getByTestId("fb-question")).toHaveTextContent("第一題");
  });

  it("judging 時顯示最快搶答者", () => {
    setup(JUDGING_STATE);
    expect(screen.getByTestId("fb-first-buzz")).toHaveTextContent("Alice");
  });

  it("judging 時顯示答對按鈕", () => {
    setup(JUDGING_STATE);
    expect(screen.getByTestId("fb-correct-btn")).toBeInTheDocument();
  });

  it("judging 時顯示答錯按鈕", () => {
    setup(JUDGING_STATE);
    expect(screen.getByTestId("fb-wrong-btn")).toBeInTheDocument();
  });

  it("點擊答對呼叫 onJudge(buzzId, true)", () => {
    const { onJudge } = setup(JUDGING_STATE);
    fireEvent.click(screen.getByTestId("fb-correct-btn"));
    expect(onJudge).toHaveBeenCalledWith("b1", true);
  });

  it("點擊答錯呼叫 onJudge(buzzId, false)", () => {
    const { onJudge } = setup(JUDGING_STATE);
    fireEvent.click(screen.getByTestId("fb-wrong-btn"));
    expect(onJudge).toHaveBeenCalledWith("b1", false);
  });

  it("judging advance 按鈕顯示「下一題」", () => {
    setup(JUDGING_STATE);
    expect(screen.getByTestId("fb-advance-btn")).toHaveTextContent("下一題");
  });

  it("尚無人搶答時顯示提示", () => {
    const noBuzzState: FastBuzzState = { ...JUDGING_STATE, buzzes: [] };
    setup(noBuzzState);
    expect(screen.getByText("尚無人搶答")).toBeInTheDocument();
  });
});

describe("FastBuzz — done phase", () => {
  it("done 時不顯示 advance 按鈕", () => {
    setup(DONE_STATE);
    expect(screen.queryByTestId("fb-advance-btn")).toBeNull();
  });

  it("done 時顯示排行榜", () => {
    setup(DONE_STATE);
    expect(screen.getByTestId("fb-score-u1")).toBeInTheDocument();
  });

  it("done 時顯示冠軍", () => {
    setup(DONE_STATE);
    expect(screen.getByTestId("fb-winner")).toHaveTextContent("Alice");
  });

  it("done 時無得分顯示空提示", () => {
    const emptyDone: FastBuzzState = { ...DONE_STATE, buzzes: [] };
    setup(emptyDone);
    expect(screen.getByTestId("fb-empty")).toBeInTheDocument();
  });

  it("正確計算得分", () => {
    setup(DONE_STATE);
    expect(screen.getByTestId("fb-score-u1")).toHaveTextContent("1 分");
    expect(screen.getByTestId("fb-score-u2")).toHaveTextContent("0 分");
  });
});
