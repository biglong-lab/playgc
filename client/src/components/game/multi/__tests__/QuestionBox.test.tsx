import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QuestionBox from "../QuestionBox";
import type { QuestionBoxConfig, QuestionBoxState, Question } from "../QuestionBox";

const defaultConfig: QuestionBoxConfig = {
  title: "📬 講師提問箱",
  prompt: "有什麼問題想問？",
  allowAnonymous: true,
  maxQuestionsPerPerson: 3,
  maxQuestionLength: 100,
};

const emptyState: QuestionBoxState = { questions: [] };

const makeQuestion = (id: string, text: string, authorId: string, votes: string[] = [], answered = false): Question => ({
  id,
  text,
  authorId,
  authorName: authorId === "u1" ? "Alice" : "Bob",
  votes,
  answered,
  createdAt: Date.now(),
});

const mockSubmit = vi.fn(() => Promise.resolve());
const mockVote = vi.fn(() => Promise.resolve());
const mockMark = vi.fn(() => Promise.resolve());

describe("QuestionBox", () => {
  it("顯示標題", () => {
    render(<QuestionBox config={defaultConfig} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    expect(screen.getByTestId("question-box-title")).toHaveTextContent("講師提問箱");
  });

  it("顯示提示語", () => {
    render(<QuestionBox config={defaultConfig} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    expect(screen.getByTestId("question-box-prompt")).toHaveTextContent("有什麼問題想問");
  });

  it("顯示輸入欄", () => {
    render(<QuestionBox config={defaultConfig} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    expect(screen.getByTestId("question-input")).toBeInTheDocument();
  });

  it("空輸入時送出按鈕停用", () => {
    render(<QuestionBox config={defaultConfig} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    expect(screen.getByTestId("submit-question-btn")).toBeDisabled();
  });

  it("有內容時可以送出", async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<QuestionBox config={defaultConfig} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={onSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    fireEvent.change(screen.getByTestId("question-input"), { target: { value: "這是一個問題？" } });
    fireEvent.click(screen.getByTestId("submit-question-btn"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("這是一個問題？"));
  });

  it("達到上限後送出停用", () => {
    const state: QuestionBoxState = {
      questions: [
        makeQuestion("q1", "問題一？", "u1"),
        makeQuestion("q2", "問題二？", "u1"),
        makeQuestion("q3", "問題三？", "u1"),
      ],
    };
    render(<QuestionBox config={defaultConfig} state={state} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    fireEvent.change(screen.getByTestId("question-input"), { target: { value: "又一個問題？" } });
    expect(screen.getByTestId("submit-question-btn")).toBeDisabled();
  });

  it("顯示問題總數", () => {
    const state: QuestionBoxState = { questions: [makeQuestion("q1", "問題一？", "u1"), makeQuestion("q2", "問題二？", "u2")] };
    render(<QuestionBox config={defaultConfig} state={state} myUserId="u3" myUserName="Carol" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    expect(screen.getByTestId("total-questions")).toHaveTextContent("2");
  });

  it("顯示問題 item", () => {
    const state: QuestionBoxState = { questions: [makeQuestion("q1", "為什麼天空是藍的？", "u2")] };
    render(<QuestionBox config={defaultConfig} state={state} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    expect(screen.getByTestId("question-item-q1")).toBeInTheDocument();
  });

  it("點讚呼叫 onVote", async () => {
    const onVote = vi.fn(() => Promise.resolve());
    const state: QuestionBoxState = { questions: [makeQuestion("q1", "問題？", "u2")] };
    render(<QuestionBox config={defaultConfig} state={state} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={onVote} onMarkAnswered={mockMark} />);
    fireEvent.click(screen.getByTestId("vote-btn-q1"));
    await waitFor(() => expect(onVote).toHaveBeenCalledWith("q1"));
  });

  it("顯示點讚數量", () => {
    const state: QuestionBoxState = { questions: [makeQuestion("q1", "問題？", "u2", ["u1", "u3"])] };
    render(<QuestionBox config={defaultConfig} state={state} myUserId="u4" myUserName="Dave" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    expect(screen.getByTestId("vote-count-q1")).toHaveTextContent("2");
  });

  it("自己的問題不能點讚", () => {
    const state: QuestionBoxState = { questions: [makeQuestion("q1", "我的問題？", "u1")] };
    render(<QuestionBox config={defaultConfig} state={state} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    expect(screen.getByTestId("vote-btn-q1")).toBeDisabled();
  });

  it("點擊已回答呼叫 onMarkAnswered", async () => {
    const onMark = vi.fn(() => Promise.resolve());
    const state: QuestionBoxState = { questions: [makeQuestion("q1", "問題？", "u2")] };
    render(<QuestionBox config={defaultConfig} state={state} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={onMark} />);
    fireEvent.click(screen.getByTestId("mark-answered-q1"));
    await waitFor(() => expect(onMark).toHaveBeenCalledWith("q1"));
  });

  it("已回答問題顯示在已回答區域", () => {
    const state: QuestionBoxState = { questions: [makeQuestion("q1", "已回答問題？", "u2", [], true)] };
    render(<QuestionBox config={defaultConfig} state={state} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    expect(screen.getByTestId("answered-item-q1")).toBeInTheDocument();
  });

  it("無問題顯示提示訊息", () => {
    render(<QuestionBox config={defaultConfig} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={mockSubmit} onVote={mockVote} onMarkAnswered={mockMark} />);
    expect(screen.getByTestId("empty-msg")).toBeInTheDocument();
  });
});
