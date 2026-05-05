import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LetterToSelf from "../LetterToSelf";
import type { LetterToSelfConfig, LetterToSelfState } from "../LetterToSelf";

const defaultConfig: LetterToSelfConfig = {
  title: "✉️ 給未來自己的信",
  prompt: "你想對三個月後的自己說什麼？",
  maxLength: 300,
  showAuthor: true,
};

const emptyState: LetterToSelfState = { letters: [], revealed: false };

const mockLetter = {
  letterId: "l1",
  userId: "u1",
  userName: "Alice",
  content: "繼續努力！",
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

describe("LetterToSelf", () => {
  it("顯示標題", () => {
    render(<LetterToSelf {...mockProps} />);
    expect(screen.getByTestId("lts-title")).toHaveTextContent("給未來自己的信");
  });

  it("顯示提示文字", () => {
    render(<LetterToSelf {...mockProps} />);
    expect(screen.getByTestId("lts-prompt")).toHaveTextContent("你想對三個月後的自己說什麼？");
  });

  it("尚未提交顯示輸入框", () => {
    render(<LetterToSelf {...mockProps} />);
    expect(screen.getByTestId("lts-input")).toBeInTheDocument();
  });

  it("輸入文字呼叫 onDraftChange", () => {
    const onDraftChange = vi.fn();
    render(<LetterToSelf {...mockProps} onDraftChange={onDraftChange} />);
    fireEvent.change(screen.getByTestId("lts-input"), { target: { value: "Hello" } });
    expect(onDraftChange).toHaveBeenCalledWith("Hello");
  });

  it("顯示剩餘字數", () => {
    render(<LetterToSelf {...mockProps} draftText="Hello" />);
    expect(screen.getByTestId("lts-chars-left")).toHaveTextContent("295");
  });

  it("空白時提交按鈕 disabled", () => {
    render(<LetterToSelf {...mockProps} draftText="" />);
    expect(screen.getByTestId("lts-submit-btn")).toBeDisabled();
  });

  it("有文字時提交按鈕可用", () => {
    render(<LetterToSelf {...mockProps} draftText="Hello" />);
    expect(screen.getByTestId("lts-submit-btn")).not.toBeDisabled();
  });

  it("點擊寄出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<LetterToSelf {...mockProps} draftText="Hello" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("lts-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交後顯示已寄出訊息", () => {
    const state = { ...emptyState, letters: [mockLetter] };
    render(<LetterToSelf {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("lts-submitted-msg")).toBeInTheDocument();
  });

  it("已提交後隱藏輸入框", () => {
    const state = { ...emptyState, letters: [mockLetter] };
    render(<LetterToSelf {...mockProps} state={state} myUserId="u1" />);
    expect(screen.queryByTestId("lts-input")).not.toBeInTheDocument();
  });

  it("顯示已寄出信件數量", () => {
    const state = { ...emptyState, letters: [mockLetter] };
    render(<LetterToSelf {...mockProps} state={state} />);
    expect(screen.getByTestId("lts-count")).toHaveTextContent("1");
  });

  it("顯示揭曉按鈕", () => {
    render(<LetterToSelf {...mockProps} />);
    expect(screen.getByTestId("lts-reveal-btn")).toBeInTheDocument();
  });

  it("點擊揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    render(<LetterToSelf {...mockProps} onReveal={onReveal} />);
    fireEvent.click(screen.getByTestId("lts-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("揭曉後顯示信件區塊", () => {
    const state = { letters: [mockLetter], revealed: true };
    render(<LetterToSelf {...mockProps} state={state} />);
    expect(screen.getByTestId("lts-revealed-section")).toBeInTheDocument();
  });

  it("揭曉後顯示各封信", () => {
    const state = { letters: [mockLetter], revealed: true };
    render(<LetterToSelf {...mockProps} state={state} />);
    expect(screen.getByTestId("lts-letter-l1")).toBeInTheDocument();
    expect(screen.getByTestId("lts-content-l1")).toHaveTextContent("繼續努力！");
  });

  it("showAuthor=true 顯示作者", () => {
    const state = { letters: [mockLetter], revealed: true };
    render(<LetterToSelf {...mockProps} state={state} />);
    expect(screen.getByTestId("lts-author-l1")).toHaveTextContent("Alice");
  });

  it("showAuthor=false 隱藏作者", () => {
    const config = { ...defaultConfig, showAuthor: false };
    const state = { letters: [mockLetter], revealed: true };
    render(<LetterToSelf {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("lts-author-l1")).not.toBeInTheDocument();
  });

  it("揭曉後無信件顯示空白提示", () => {
    const state = { letters: [], revealed: true };
    render(<LetterToSelf {...mockProps} state={state} />);
    expect(screen.getByTestId("lts-empty")).toBeInTheDocument();
  });

  it("已提交後顯示預覽摘要", () => {
    const state = { ...emptyState, letters: [mockLetter] };
    render(<LetterToSelf {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("lts-my-preview")).toBeInTheDocument();
  });
});
