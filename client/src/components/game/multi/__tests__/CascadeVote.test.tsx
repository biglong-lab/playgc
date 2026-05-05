import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CascadeVote } from "../CascadeVote";
import type { CascadeVoteConfig, CascadeVoteState } from "../CascadeVote";

const cfg: CascadeVoteConfig = {
  title: "連續投票",
  questions: [
    { questionId: "q1", text: "第一題？", options: ["A", "B", "C"] },
    { questionId: "q2", text: "第二題？", options: ["X", "Y"] },
  ],
};

const emptyState: CascadeVoteState = { currentIndex: 0, answers: [], finished: false };

const answeredState: CascadeVoteState = {
  currentIndex: 0,
  answers: [{ answerId: "u1-q1", userId: "u1", userName: "Alice", questionId: "q1", optionIndex: 0 }],
  finished: false,
};

const finishedState: CascadeVoteState = {
  currentIndex: 1,
  answers: [
    { answerId: "u1-q1", userId: "u1", userName: "Alice", questionId: "q1", optionIndex: 0 },
    { answerId: "u1-q2", userId: "u1", userName: "Alice", questionId: "q2", optionIndex: 1 },
  ],
  finished: true,
};

function make(overrides: Partial<Parameters<typeof CascadeVote>[0]> = {}) {
  const defaults = {
    config: cfg,
    state: emptyState,
    userId: "u1",
    isLoaded: true,
    onAnswer: vi.fn(),
    onAdvance: vi.fn(),
    onFinish: vi.fn(),
  };
  return render(<CascadeVote {...defaults} {...overrides} />);
}

describe("CascadeVote", () => {
  it("顯示標題與目前題目", () => {
    make();
    expect(screen.getByTestId("cv-title").textContent).toBe("連續投票");
    expect(screen.getByTestId("cv-question-text").textContent).toBe("第一題？");
  });

  it("顯示題目進度", () => {
    make();
    expect(screen.getByTestId("cv-question-index").textContent).toContain("1");
    expect(screen.getByTestId("cv-question-index").textContent).toContain("2");
  });

  it("顯示選項按鈕", () => {
    make();
    expect(screen.getByTestId("cv-options")).toBeTruthy();
    expect(screen.getByTestId("cv-option-0").textContent).toBe("A");
    expect(screen.getByTestId("cv-option-1").textContent).toBe("B");
  });

  it("點選選項呼叫 onAnswer", () => {
    const onAnswer = vi.fn();
    make({ onAnswer });
    fireEvent.click(screen.getByTestId("cv-option-0"));
    expect(onAnswer).toHaveBeenCalledWith("q1", 0);
  });

  it("已回答時顯示 cv-my-answer", () => {
    make({ state: answeredState, userId: "u1" });
    expect(screen.getByTestId("cv-my-answer")).toBeTruthy();
  });

  it("隊長看到下一題按鈕", () => {
    make({ isTeamLead: true });
    expect(screen.getByTestId("cv-advance-btn")).toBeTruthy();
  });

  it("非隊長看不到 advance 按鈕", () => {
    make({ isTeamLead: false });
    expect(screen.queryByTestId("cv-advance-btn")).toBeNull();
  });

  it("最後一題顯示結束按鈕", () => {
    make({
      state: { ...emptyState, currentIndex: 1 },
      isTeamLead: true,
    });
    expect(screen.getByTestId("cv-finish-btn")).toBeTruthy();
  });

  it("點擊下一題呼叫 onAdvance", () => {
    const onAdvance = vi.fn();
    make({ isTeamLead: true, onAdvance });
    fireEvent.click(screen.getByTestId("cv-advance-btn"));
    expect(onAdvance).toHaveBeenCalled();
  });

  it("finished 狀態顯示摘要", () => {
    make({ state: finishedState });
    expect(screen.getByTestId("cv-finished")).toBeTruthy();
    expect(screen.getByTestId("cv-summary-0")).toBeTruthy();
    expect(screen.getByTestId("cv-summary-1")).toBeTruthy();
  });

  it("loading 時顯示 spinner", () => {
    const { container } = make({ isLoaded: false });
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});
