import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OpenQuestion from "../OpenQuestion";
import type { OpenQuestionConfig, OpenQuestionState } from "../OpenQuestion";

const defaultConfig: OpenQuestionConfig = {
  title: "💬 今日收穫",
  question: "你今天最大的收穫是什麼？",
  maxLength: 80,
  maxAnswersPerPerson: 2,
  showAuthor: true,
  placeholder: "分享你的想法…",
};

const emptyState: OpenQuestionState = { answers: [] };

const ans1 = {
  id: "a1",
  text: "學到了新的合作方式",
  authorId: "u1",
  authorName: "Alice",
  submittedAt: 2000,
};

const ans2 = {
  id: "a2",
  text: "認識了很多新朋友",
  authorId: "u2",
  authorName: "Bob",
  submittedAt: 1000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe("OpenQuestion", () => {
  it("顯示標題", () => {
    render(<OpenQuestion {...mockProps} />);
    expect(screen.getByTestId("oq-title")).toHaveTextContent("今日收穫");
  });

  it("顯示問題", () => {
    render(<OpenQuestion {...mockProps} />);
    expect(screen.getByTestId("oq-question")).toHaveTextContent("你今天最大的收穫是什麼");
  });

  it("顯示輸入框", () => {
    render(<OpenQuestion {...mockProps} />);
    expect(screen.getByTestId("oq-input")).toBeInTheDocument();
  });

  it("placeholder 顯示", () => {
    render(<OpenQuestion {...mockProps} />);
    expect(screen.getByTestId("oq-input")).toHaveAttribute("placeholder", "分享你的想法…");
  });

  it("空草稿時提交按鈕 disabled", () => {
    render(<OpenQuestion {...mockProps} />);
    expect(screen.getByTestId("oq-submit-btn")).toBeDisabled();
  });

  it("有草稿時提交按鈕啟用", () => {
    render(<OpenQuestion {...mockProps} draftText="我的回答" />);
    expect(screen.getByTestId("oq-submit-btn")).not.toBeDisabled();
  });

  it("輸入時呼叫 onDraftChange", () => {
    const onDraftChange = vi.fn();
    render(<OpenQuestion {...mockProps} onDraftChange={onDraftChange} />);
    fireEvent.change(screen.getByTestId("oq-input"), { target: { value: "測試" } });
    expect(onDraftChange).toHaveBeenCalledWith("測試");
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<OpenQuestion {...mockProps} draftText="我的想法" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("oq-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("顯示剩餘字數", () => {
    render(<OpenQuestion {...mockProps} draftText="12345" />);
    expect(screen.getByTestId("oq-chars-left")).toHaveTextContent("75");
  });

  it("顯示回答數量", () => {
    const state: OpenQuestionState = { answers: [ans1, ans2] };
    render(<OpenQuestion {...mockProps} state={state} />);
    expect(screen.getByTestId("oq-count")).toHaveTextContent("2");
  });

  it("空回答列表顯示提示", () => {
    render(<OpenQuestion {...mockProps} />);
    expect(screen.getByTestId("oq-empty")).toBeInTheDocument();
  });

  it("有回答時不顯示空提示", () => {
    const state: OpenQuestionState = { answers: [ans1] };
    render(<OpenQuestion {...mockProps} state={state} />);
    expect(screen.queryByTestId("oq-empty")).not.toBeInTheDocument();
  });

  it("顯示每則回答", () => {
    const state: OpenQuestionState = { answers: [ans1, ans2] };
    render(<OpenQuestion {...mockProps} state={state} />);
    expect(screen.getByTestId("oq-answer-a1")).toBeInTheDocument();
    expect(screen.getByTestId("oq-answer-a2")).toBeInTheDocument();
  });

  it("顯示回答文字", () => {
    const state: OpenQuestionState = { answers: [ans1] };
    render(<OpenQuestion {...mockProps} state={state} />);
    expect(screen.getByTestId("oq-text-a1")).toHaveTextContent("學到了新的合作方式");
  });

  it("showAuthor=true 顯示作者", () => {
    const state: OpenQuestionState = { answers: [ans1] };
    render(<OpenQuestion {...mockProps} state={state} />);
    expect(screen.getByTestId("oq-author-a1")).toHaveTextContent("Alice");
  });

  it("showAuthor=false 不顯示作者", () => {
    const config = { ...defaultConfig, showAuthor: false };
    const state: OpenQuestionState = { answers: [ans1] };
    render(<OpenQuestion {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("oq-author-a1")).not.toBeInTheDocument();
  });

  it("達到上限時顯示提示並隱藏輸入", () => {
    const state: OpenQuestionState = {
      answers: [
        ans1,
        { ...ans1, id: "a3", text: "第二則回答" },
      ],
    };
    render(<OpenQuestion {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("oq-limit-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("oq-input")).not.toBeInTheDocument();
  });

  it("maxAnswersPerPerson=1 只能提交一次", () => {
    const config = { ...defaultConfig, maxAnswersPerPerson: 1 };
    const state: OpenQuestionState = { answers: [ans1] };
    render(<OpenQuestion {...mockProps} config={config} state={state} myUserId="u1" />);
    expect(screen.getByTestId("oq-limit-msg")).toBeInTheDocument();
  });
});
