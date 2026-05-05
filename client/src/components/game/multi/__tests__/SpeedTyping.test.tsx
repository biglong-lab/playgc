import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SpeedTyping, {
  SpeedTypingConfig,
  SpeedTypingState,
  TypingResult,
} from "../SpeedTyping";

const baseConfig: SpeedTypingConfig = {
  title: "競速打字測試",
  phrase: "快速打字比賽",
  maxSeconds: 30,
};

const emptyState: SpeedTypingState = { results: [], revealed: false };

const results: TypingResult[] = [
  { resultId: "rt1", userId: "u1", userName: "Alice", seconds: 8, accuracy: 100 },
  { resultId: "rt2", userId: "u2", userName: "Bob", seconds: 12, accuracy: 90 },
  { resultId: "rt3", userId: "u3", userName: "Carol", seconds: 6, accuracy: 95 },
];

const revealedState: SpeedTypingState = { results, revealed: true };

const BASE_NOW = 1000000;

function renderSt(overrides: Partial<Parameters<typeof SpeedTyping>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    now: BASE_NOW,
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<SpeedTyping {...props} />), props };
}

describe("SpeedTyping — 基本渲染", () => {
  it("顯示標題", () => {
    renderSt();
    expect(screen.getByTestId("st-title")).toHaveTextContent("競速打字測試");
  });

  it("顯示要打的文字", () => {
    renderSt();
    expect(screen.getByTestId("st-phrase")).toHaveTextContent("快速打字比賽");
  });

  it("顯示開始計時按鈕", () => {
    renderSt();
    expect(screen.getByTestId("st-start-btn")).toBeInTheDocument();
  });

  it("顯示完成人數", () => {
    renderSt();
    expect(screen.getByTestId("st-count")).toHaveTextContent("0");
  });

  it("顯示公布排行榜按鈕", () => {
    renderSt();
    expect(screen.getByTestId("st-reveal-btn")).toBeInTheDocument();
  });
});

describe("SpeedTyping — 計時互動", () => {
  it("點開始計時後顯示輸入框", () => {
    renderSt();
    fireEvent.click(screen.getByTestId("st-start-btn"));
    expect(screen.getByTestId("st-input")).toBeInTheDocument();
  });

  it("點開始計時後顯示計時器", () => {
    renderSt();
    fireEvent.click(screen.getByTestId("st-start-btn"));
    expect(screen.getByTestId("st-timer")).toBeInTheDocument();
  });

  it("計時器顯示剩餘時間", () => {
    renderSt();
    fireEvent.click(screen.getByTestId("st-start-btn"));
    expect(screen.getByTestId("st-timer")).toHaveTextContent("30s");
  });

  it("經過時間後計時器更新", () => {
    renderSt();
    fireEvent.click(screen.getByTestId("st-start-btn"));
    renderSt({ now: BASE_NOW + 10000 });
    const timer = screen.getByTestId("st-timer");
    expect(timer).toBeInTheDocument();
  });

  it("空輸入時送出鈕 disabled", () => {
    renderSt();
    fireEvent.click(screen.getByTestId("st-start-btn"));
    expect(screen.getByTestId("st-submit-btn")).toBeDisabled();
  });

  it("有輸入時送出鈕可點", () => {
    renderSt();
    fireEvent.click(screen.getByTestId("st-start-btn"));
    fireEvent.change(screen.getByTestId("st-input"), {
      target: { value: "快速" },
    });
    expect(screen.getByTestId("st-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    renderSt({ onSubmit });
    fireEvent.click(screen.getByTestId("st-start-btn"));
    fireEvent.change(screen.getByTestId("st-input"), {
      target: { value: "快速打字比賽" },
    });
    fireEvent.click(screen.getByTestId("st-submit-btn"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("已完成後顯示 st-my-result", () => {
    const myResult: TypingResult = {
      resultId: "rt99",
      userId: "u4",
      userName: "David",
      seconds: 10,
      accuracy: 100,
    };
    renderSt({
      state: { results: [myResult], revealed: false },
      myUserId: "u4",
    });
    expect(screen.getByTestId("st-my-result")).toBeInTheDocument();
  });

  it("點公布排行榜呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderSt({ onReveal });
    fireEvent.click(screen.getByTestId("st-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});

describe("SpeedTyping — 排行榜", () => {
  it("公布後顯示 st-result", () => {
    renderSt({ state: revealedState });
    expect(screen.getByTestId("st-result")).toBeInTheDocument();
  });

  it("顯示所有人結果", () => {
    renderSt({ state: revealedState });
    expect(screen.getByTestId("st-result-u1")).toBeInTheDocument();
    expect(screen.getByTestId("st-result-u2")).toBeInTheDocument();
    expect(screen.getByTestId("st-result-u3")).toBeInTheDocument();
  });

  it("Carol 最快（6秒）排第一", () => {
    renderSt({ state: revealedState });
    expect(screen.getByTestId("st-winner")).toHaveTextContent("Carol");
  });

  it("顯示最快者名字", () => {
    renderSt({ state: revealedState });
    expect(screen.getByTestId("st-winner")).toHaveTextContent("6秒");
  });

  it("無完成者顯示 st-empty", () => {
    renderSt({ state: { results: [], revealed: true } });
    expect(screen.getByTestId("st-empty")).toBeInTheDocument();
  });
});
