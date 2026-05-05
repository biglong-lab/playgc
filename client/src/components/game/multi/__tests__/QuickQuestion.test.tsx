import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QuickQuestion from "../QuickQuestion";
import type { QuickQuestionConfig, QuickQuestionState, QuickQuestionResponse } from "../QuickQuestion";

const config: QuickQuestionConfig = {
  title: "快問快答",
  question: "一個詞描述今天？",
  maxLength: 40,
  anonymous: true,
};

const emptyState: QuickQuestionState = { responses: [] };

const makeResponse = (userId: string, text: string): QuickQuestionResponse => ({
  id: `id-${userId}`,
  text,
  submittedAt: Date.now(),
  userId,
  userName: userId === "u1" ? "Alice" : "Bob",
});

describe("QuickQuestion", () => {
  it("顯示標題", () => {
    render(<QuickQuestion config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    expect(screen.getByTestId("quick-question-title")).toHaveTextContent("快問快答");
  });

  it("顯示問題", () => {
    render(<QuickQuestion config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    expect(screen.getByTestId("quick-question-prompt")).toHaveTextContent("一個詞描述今天？");
  });

  it("顯示輸入框", () => {
    render(<QuickQuestion config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    expect(screen.getByTestId("quick-question-input")).toBeInTheDocument();
  });

  it("未輸入時送出按鈕禁用", () => {
    render(<QuickQuestion config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    const btn = screen.getByTestId("quick-question-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入後送出按鈕可用", () => {
    render(<QuickQuestion config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByTestId("quick-question-input"), { target: { value: "快樂" } });
    const btn = screen.getByTestId("quick-question-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("點擊送出呼叫 onSubmit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuickQuestion config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId("quick-question-input"), { target: { value: "快樂" } });
    fireEvent.click(screen.getByTestId("quick-question-submit-btn"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("快樂"));
  });

  it("已提交顯示感謝畫面", () => {
    const state: QuickQuestionState = { responses: [makeResponse("u1", "快樂")] };
    render(<QuickQuestion config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    expect(screen.getByTestId("quick-question-submitted")).toBeInTheDocument();
    expect(screen.getAllByText(/快樂/).length).toBeGreaterThanOrEqual(1);
  });

  it("有回答時顯示答案牆", () => {
    const state: QuickQuestionState = { responses: [makeResponse("u2", "充實")] };
    render(<QuickQuestion config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    expect(screen.getByTestId("quick-question-wall")).toBeInTheDocument();
  });

  it("答案牆顯示回應內容", () => {
    const state: QuickQuestionState = { responses: [makeResponse("u2", "充實")] };
    render(<QuickQuestion config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    expect(screen.getByTestId(`response-chip-id-u2`)).toBeInTheDocument();
    expect(screen.getByText("充實")).toBeInTheDocument();
  });

  it("顯示回答人數 badge", () => {
    const state: QuickQuestionState = { responses: [makeResponse("u2", "充實"), makeResponse("u3", "快樂")] };
    render(<QuickQuestion config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    expect(screen.getByTestId("quick-question-count")).toHaveTextContent("2 人已回答");
  });

  it("anonymous=true 時不顯示名字", () => {
    const state: QuickQuestionState = { responses: [makeResponse("u2", "充實")] };
    render(<QuickQuestion config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });

  it("anonymous=false 時顯示名字", () => {
    const cfg = { ...config, anonymous: false };
    const response: QuickQuestionResponse = { id: "id-u2", text: "充實", submittedAt: Date.now(), userId: "u2", userName: "Bob" };
    const state: QuickQuestionState = { responses: [response] };
    render(<QuickQuestion config={cfg} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it("使用預設標題（無 title）", () => {
    const cfg: QuickQuestionConfig = { question: "測試問題" };
    render(<QuickQuestion config={cfg} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />);
    expect(screen.getByTestId("quick-question-title")).toHaveTextContent("💬 快問快答");
  });
});
