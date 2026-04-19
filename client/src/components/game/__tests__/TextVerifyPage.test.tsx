/**
 * TextVerifyPage 測試 — 驗證：
 * 1. 精確匹配答案 → 通過（不呼叫 AI）
 * 2. answers 陣列（多答案）任一正確就過
 * 3. 大小寫不敏感（預設 caseSensitive=false）
 * 4. maxAttempts 耗盡 → 歸零 onComplete
 * 5. 答錯後 input 立即解除 disabled（P /loop 優化）
 * 6. 空輸入送出 → 提示不算嘗試次數
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TextVerifyPage from "../TextVerifyPage";
import type { TextVerifyConfig } from "@shared/schema";

function renderWith(config: TextVerifyConfig, onComplete = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    onComplete,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TextVerifyPage
          config={config}
          onComplete={onComplete}
          sessionId="s1"
          gameId="g1"
          variables={{}}
          onVariableUpdate={() => {}}
        />
      </QueryClientProvider>,
    ),
  };
}

function typeAnswer(value: string) {
  const input = screen.getByTestId("input-answer") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  return input;
}

describe("TextVerifyPage — 精確匹配", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("答案正確 → onComplete 帶 rewardPoints + nextPageId", async () => {
    const { onComplete } = renderWith({
      question: "首都是哪裡？",
      correctAnswer: "台北",
      rewardPoints: 30,
      nextPageId: "p-ok",
    });

    typeAnswer("台北");
    fireEvent.click(screen.getByTestId("button-submit-answer"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });

    expect(onComplete).toHaveBeenCalledWith(
      { points: 30, items: undefined },
      "p-ok",
    );
  });

  it("answers 陣列任一匹配就通過", async () => {
    const { onComplete } = renderWith({
      question: "選一個答案",
      answers: ["紅", "綠", "藍"],
    });

    typeAnswer("綠");
    fireEvent.click(screen.getByTestId("button-submit-answer"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it("預設不區分大小寫", async () => {
    const { onComplete } = renderWith({
      question: "請輸入",
      correctAnswer: "Hello",
    });

    typeAnswer("HELLO");
    fireEvent.click(screen.getByTestId("button-submit-answer"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });

    expect(onComplete).toHaveBeenCalled();
  });
});

describe("TextVerifyPage — 錯誤處理與重試", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("答錯後 input 立即可重新輸入（非 1 秒後）", async () => {
    const { onComplete } = renderWith({
      question: "Q",
      correctAnswer: "A",
      maxAttempts: 5,
    });

    typeAnswer("B");
    fireEvent.click(screen.getByTestId("button-submit-answer"));

    // 推進 600ms：第一次 submit 500ms 動畫完成，handleIncorrect 已跑過
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // 立即重新輸入（驗證 disabled 已解除）
    const input = screen.getByTestId("input-answer") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "A" } });
    expect(input.value).toBe("A");

    fireEvent.click(screen.getByTestId("button-submit-answer"));

    // 第二次 submit 流程：500ms 動畫 + 1500ms 過場 → 共需 2000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it("耗盡 maxAttempts → onComplete points:0", async () => {
    const { onComplete } = renderWith({
      question: "Q",
      correctAnswer: "A",
      maxAttempts: 2,
      nextPageId: "p-fail",
    });

    // 第一次錯 — 等 1s 讓 isCorrect 重置
    typeAnswer("X");
    fireEvent.click(screen.getByTestId("button-submit-answer"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // 第二次錯（達上限）— advance 至 fail onComplete 完成（500ms 動畫 + 2000ms 出場）
    typeAnswer("Y");
    fireEvent.click(screen.getByTestId("button-submit-answer"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(onComplete).toHaveBeenCalledWith({ points: 0 }, "p-fail");
  });

  it("空輸入按確認 → 按鈕 disabled，不扣嘗試次數", () => {
    const { onComplete } = renderWith({
      question: "Q",
      correctAnswer: "A",
      maxAttempts: 3,
    });

    // answer 為空時按鈕應該 disabled
    const submitBtn = screen.getByTestId("button-submit-answer") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
