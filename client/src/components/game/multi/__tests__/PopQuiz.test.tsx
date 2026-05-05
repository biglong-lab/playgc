import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PopQuiz from "../PopQuiz";
import type { PopQuizConfig, PopQuizState, PlayerAnswer } from "../PopQuiz";

const defaultConfig: PopQuizConfig = {
  title: "🧠 知識競賽",
  questions: [
    { id: "q1", prompt: "台灣最大城市？", options: ["台北", "高雄", "台中", "台南"], correctIdx: 0, timeLimitSec: 30 },
    { id: "q2", prompt: "1+1=?", options: ["1", "2", "3", "4"], correctIdx: 1, timeLimitSec: 15 },
  ],
};

const introState: PopQuizState = {
  phase: "intro",
  currentQuestionIdx: 0,
  questionStartedAt: null,
  hostUserId: null,
  answers: [],
};

const questionState = (hostId = "u1"): PopQuizState => ({
  phase: "question",
  currentQuestionIdx: 0,
  questionStartedAt: Date.now(),
  hostUserId: hostId,
  answers: [],
});

const doneState = (answers: PlayerAnswer[]): PopQuizState => ({
  phase: "done",
  currentQuestionIdx: 1,
  questionStartedAt: null,
  hostUserId: "u1",
  answers,
});

const mockStart = vi.fn(() => Promise.resolve());
const mockAnswer = vi.fn(() => Promise.resolve());
const mockAdvance = vi.fn(() => Promise.resolve());

describe("PopQuiz", () => {
  it("intro 顯示標題和開始按鈕", () => {
    render(<PopQuiz config={defaultConfig} state={introState} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("pop-quiz-title")).toHaveTextContent("知識競賽");
    expect(screen.getByTestId("start-quiz-btn")).toBeInTheDocument();
  });

  it("點擊開始按鈕呼叫 onStart", async () => {
    const onStart = vi.fn(() => Promise.resolve());
    render(<PopQuiz config={defaultConfig} state={introState} myUserId="u1" onStart={onStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    fireEvent.click(screen.getByTestId("start-quiz-btn"));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
  });

  it("question phase 顯示題目內容", () => {
    render(<PopQuiz config={defaultConfig} state={questionState()} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("question-prompt")).toHaveTextContent("台灣最大城市？");
  });

  it("顯示題號 badge", () => {
    render(<PopQuiz config={defaultConfig} state={questionState()} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("question-badge")).toHaveTextContent("Q1 / 2");
  });

  it("顯示計時器", () => {
    render(<PopQuiz config={defaultConfig} state={questionState()} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("quiz-timer")).toBeInTheDocument();
  });

  it("顯示所有選項", () => {
    render(<PopQuiz config={defaultConfig} state={questionState()} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("option-0")).toHaveTextContent("台北");
    expect(screen.getByTestId("option-3")).toHaveTextContent("台南");
  });

  it("點擊選項呼叫 onAnswer", async () => {
    const onAnswer = vi.fn(() => Promise.resolve());
    render(<PopQuiz config={defaultConfig} state={questionState()} myUserId="u1" onStart={mockStart} onAnswer={onAnswer} onAdvance={mockAdvance} />);
    fireEvent.click(screen.getByTestId("option-0"));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("q1", 0));
  });

  it("已答題後選項停用", () => {
    const answered: PopQuizState = {
      ...questionState(),
      answers: [{ userId: "u1", questionId: "q1", selectedIdx: 0, answeredAt: Date.now() }],
    };
    render(<PopQuiz config={defaultConfig} state={answered} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("option-0")).toBeDisabled();
    expect(screen.getByTestId("option-1")).toBeDisabled();
  });

  it("答對顯示正確提示", () => {
    const answered: PopQuizState = {
      ...questionState(),
      answers: [{ userId: "u1", questionId: "q1", selectedIdx: 0, answeredAt: Date.now() }],
    };
    render(<PopQuiz config={defaultConfig} state={answered} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("answer-submitted")).toHaveTextContent("答對");
  });

  it("答錯顯示錯誤提示", () => {
    const answered: PopQuizState = {
      ...questionState(),
      answers: [{ userId: "u1", questionId: "q1", selectedIdx: 1, answeredAt: Date.now() }],
    };
    render(<PopQuiz config={defaultConfig} state={answered} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("answer-submitted")).toHaveTextContent("答錯");
  });

  it("host 看到下一題按鈕", () => {
    render(<PopQuiz config={defaultConfig} state={questionState("u1")} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("advance-btn")).toBeInTheDocument();
  });

  it("非 host 看不到下一題按鈕", () => {
    render(<PopQuiz config={defaultConfig} state={questionState("u2")} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.queryByTestId("advance-btn")).not.toBeInTheDocument();
  });

  it("done phase 顯示我的分數", () => {
    const answers: PlayerAnswer[] = [
      { userId: "u1", questionId: "q1", selectedIdx: 0, answeredAt: Date.now() },
      { userId: "u1", questionId: "q2", selectedIdx: 1, answeredAt: Date.now() },
    ];
    render(<PopQuiz config={defaultConfig} state={doneState(answers)} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("pop-quiz-done")).toBeInTheDocument();
    expect(screen.getByTestId("my-score")).toHaveTextContent("2");
  });

  it("顯示每題正確率", () => {
    const answers: PlayerAnswer[] = [
      { userId: "u1", questionId: "q1", selectedIdx: 0, answeredAt: Date.now() },
      { userId: "u2", questionId: "q1", selectedIdx: 1, answeredAt: Date.now() },
    ];
    render(<PopQuiz config={defaultConfig} state={doneState(answers)} myUserId="u1" onStart={mockStart} onAnswer={mockAnswer} onAdvance={mockAdvance} />);
    expect(screen.getByTestId("result-row-0")).toBeInTheDocument();
  });
});
