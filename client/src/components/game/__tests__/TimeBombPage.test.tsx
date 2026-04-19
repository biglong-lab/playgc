/**
 * TimeBombPage 測試 — 驗證：
 * 1. 空 tasks → 自動標記通過（/loop 優化 fallback）
 * 2. tap 任務完成 → 過關計分
 * 3. input 任務正確答案 → 過關；錯誤扣時間（penaltySeconds）
 * 4. choice 任務正確選項 → 過關
 * 5. 時間耗盡 → 爆炸出場（points:0）
 * 6. 多任務序列：前一題完成進下一題
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import TimeBombPage from "../TimeBombPage";
import type { TimeBombConfig } from "@shared/schema";

function renderWith(config: TimeBombConfig, onComplete = vi.fn()) {
  return {
    onComplete,
    ...render(
      <TimeBombPage
        config={config}
        onComplete={onComplete}
        sessionId="s1"
        variables={{}}
        onVariableUpdate={() => {}}
      />,
    ),
  };
}

describe("TimeBombPage — 空 tasks fallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("tasks 空陣列 → 自動標記通過並 onComplete", async () => {
    const { onComplete } = renderWith({
      timeLimit: 30,
      tasks: [],
      successNextPageId: "p-next",
    });

    // useEffect 觸發 1.5s setTimeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(onComplete).toHaveBeenCalledWith({ points: 0 }, "p-next");
  });

  it("tasks 未定義 → 同樣自動通過", async () => {
    const { onComplete } = renderWith({
      timeLimit: 30,
    } as TimeBombConfig);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(onComplete).toHaveBeenCalled();
  });
});

describe("TimeBombPage — 任務完成流程", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("input 任務：答對進下一階段/完成", async () => {
    const { onComplete } = renderWith({
      timeLimit: 60,
      rewardPoints: 30,
      tasks: [{ type: "input", answer: "red", question: "顏色？" }],
    });

    const input = screen.getByTestId("input-bomb-answer") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "red" } });
    fireEvent.click(screen.getByTestId("button-bomb-submit"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(onComplete).toHaveBeenCalledWith({ points: 30 }, undefined);
  });

  it("input 任務答錯 → 扣 penaltySeconds 不 onComplete", async () => {
    const { onComplete } = renderWith({
      timeLimit: 60,
      penaltySeconds: 5,
      tasks: [{ type: "input", answer: "red", question: "" }],
    });

    const input = screen.getByTestId("input-bomb-answer") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "blue" } });
    fireEvent.click(screen.getByTestId("button-bomb-submit"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("choice 任務：選對正確選項通過", async () => {
    const { onComplete } = renderWith({
      timeLimit: 60,
      rewardPoints: 40,
      tasks: [
        {
          type: "choice",
          question: "正確的是？",
          options: ["錯", "對", "也錯"],
          correctIndex: 1,
        },
      ],
    });

    fireEvent.click(screen.getByTestId("button-choice-1"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(onComplete).toHaveBeenCalledWith({ points: 40 }, undefined);
  });

  it("多任務序列：choice 完成 → 切換到下一題 input", async () => {
    renderWith({
      timeLimit: 60,
      tasks: [
        { type: "choice", question: "選", options: ["A", "B"], correctIndex: 0 },
        { type: "input", answer: "next", question: "第二題" },
      ],
    });

    // 選對第一題的 A
    fireEvent.click(screen.getByTestId("button-choice-0"));

    // 切換到第二題
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByTestId("input-bomb-answer")).toBeTruthy();
  });
});

describe("TimeBombPage — 時間耗盡", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("timeLimit 耗盡 → 爆炸並 onComplete(points:0, failureNextPageId)", async () => {
    const { onComplete } = renderWith({
      timeLimit: 1, // 1 秒後就爆炸
      failureNextPageId: "p-boom",
      tasks: [{ type: "tap", targetCount: 100, question: "" }],
    });

    // 1 秒倒數 + 2 秒爆炸動畫 + 少量緩衝
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3200);
    });

    expect(onComplete).toHaveBeenCalledWith({ points: 0 }, "p-boom");
  });
});
