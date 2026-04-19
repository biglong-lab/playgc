/**
 * ChoiceVerifyPage 測試 — 驗證：
 * 1. Quiz 模式答對通過 + rewardPerQuestion 計分
 * 2. Quiz 模式未過關時只重考答錯題（P1.6 優化）
 * 3. Legacy options 單選答對/答錯分支
 * 4. passingScore 邊界行為
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ChoiceVerifyPage from "../ChoiceVerifyPage";
import type { ChoiceVerifyConfig } from "@shared/schema";

function renderWith(config: ChoiceVerifyConfig, onComplete = vi.fn()) {
  return {
    onComplete,
    ...render(
      <ChoiceVerifyPage
        config={config}
        onComplete={onComplete}
        sessionId="s1"
        variables={{}}
        onVariableUpdate={() => {}}
      />,
    ),
  };
}

describe("ChoiceVerifyPage — Quiz 模式", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("全部答對 → 通過並計分（rewardPerQuestion × 題數）", async () => {
    const { onComplete } = renderWith({
      title: "基礎測驗",
      questions: [
        { question: "1+1=?", options: ["1", "2", "3"], correctAnswer: 1 },
        { question: "2+2=?", options: ["3", "4", "5"], correctAnswer: 1 },
      ],
      passingScore: 0.6,
      rewardPerQuestion: 10,
      nextPageId: "p-next",
    });

    // 第一題答 "2"
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByTestId("button-next-question"));
    // 第二題答 "4"
    fireEvent.click(screen.getByText("4"));
    fireEvent.click(screen.getByTestId("button-next-question"));

    // 等 2s setTimeout 跑完
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(onComplete).toHaveBeenCalledWith(
      { points: 20, items: undefined },
      "p-next",
    );
  });

  it("未過關時只重考答錯題（只顯示 wrong questions）", async () => {
    const { onComplete } = renderWith({
      questions: [
        { question: "Q1", options: ["A", "B"], correctAnswer: 0 },
        { question: "Q2", options: ["A", "B"], correctAnswer: 1 },
        { question: "Q3", options: ["A", "B"], correctAnswer: 0 },
      ],
      passingScore: 1, // 100%：必定會走重考分支
    });

    // Q1 錯（選 B）
    fireEvent.click(screen.getByText("B"));
    fireEvent.click(screen.getByTestId("button-next-question"));
    // Q2 對（選 B）
    fireEvent.click(screen.getByText("B"));
    fireEvent.click(screen.getByTestId("button-next-question"));
    // Q3 錯（選 B）
    fireEvent.click(screen.getByText("B"));
    fireEvent.click(screen.getByTestId("button-next-question"));

    // 等 2.5s setTimeout 重設
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });

    // 此時應該進入重考，且顯示「重考 #1」badge + 本輪 1/2（只剩兩題錯）
    expect(screen.getByText(/重考 #1/)).toBeTruthy();
    expect(screen.getByText(/第 1 題（本輪 1\/2）/)).toBeTruthy();

    // onComplete 不應該被呼叫（還在重考中）
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("重考答對所有錯題 → 通過並計分（以全部題數為分母）", async () => {
    const { onComplete } = renderWith({
      questions: [
        { question: "Q1", options: ["A", "B"], correctAnswer: 0 },
        { question: "Q2", options: ["A", "B"], correctAnswer: 1 },
      ],
      passingScore: 1,
      rewardPerQuestion: 5,
    });

    // 首輪 Q1 對 Q2 錯
    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByTestId("button-next-question"));
    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByTestId("button-next-question"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });

    // 重考 Q2，這次選 B 答對
    fireEvent.click(screen.getByText("B"));
    fireEvent.click(screen.getByTestId("button-next-question"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    // 全對：2 題 × 5 = 10 分
    expect(onComplete).toHaveBeenCalledWith(
      { points: 10, items: undefined },
      undefined,
    );
  });
});

describe("ChoiceVerifyPage — Legacy 單選模式", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("答對 → 走對應的 nextPageId", async () => {
    const { onComplete } = renderWith({
      question: "選 A 還是 B？",
      options: [
        { text: "A", correct: true, nextPageId: "page-A" },
        { text: "B", correct: false, nextPageId: "page-B" },
      ],
    });

    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByTestId("button-submit-choice"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(onComplete).toHaveBeenCalledWith({ points: 10 }, "page-A");
  });

  it("答錯 → 不 onComplete，允許重新選擇", async () => {
    const { onComplete } = renderWith({
      question: "選對的",
      options: [
        { text: "正確", correct: true },
        { text: "錯誤", correct: false },
      ],
    });

    fireEvent.click(screen.getByText("錯誤"));
    fireEvent.click(screen.getByTestId("button-submit-choice"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("未設定 options + questions → 顯示 fallback", () => {
    renderWith({});
    expect(screen.getByText(/尚未設定選項/)).toBeTruthy();
  });
});
