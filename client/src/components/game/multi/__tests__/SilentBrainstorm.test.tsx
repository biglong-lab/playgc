import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SilentBrainstorm from "../SilentBrainstorm";
import type { SilentBrainstormConfig, SilentBrainstormState } from "../SilentBrainstorm";

const defaultConfig: SilentBrainstormConfig = {
  title: "🧠 靜默腦力激盪",
  question: "如何提升協作效率？",
  maxLength: 100,
  maxIdeasPerPerson: 2,
  showAuthor: true,
};

const emptyState: SilentBrainstormState = { ideas: [], revealed: false };

const idea1 = { ideaId: "i1", userId: "u1", userName: "Alice", content: "定期同步", votes: [] };
const idea2 = { ideaId: "i2", userId: "u2", userName: "Bob", content: "減少會議", votes: ["u1"] };

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
  onVote: vi.fn(),
};

describe("SilentBrainstorm", () => {
  it("顯示標題", () => {
    render(<SilentBrainstorm {...mockProps} />);
    expect(screen.getByTestId("sb-title")).toHaveTextContent("靜默腦力激盪");
  });

  it("顯示問題", () => {
    render(<SilentBrainstorm {...mockProps} />);
    expect(screen.getByTestId("sb-question")).toHaveTextContent("如何提升協作效率？");
  });

  it("未揭曉時顯示輸入框", () => {
    render(<SilentBrainstorm {...mockProps} />);
    expect(screen.getByTestId("sb-input")).toBeInTheDocument();
  });

  it("輸入文字呼叫 onDraftChange", () => {
    const onDraftChange = vi.fn();
    render(<SilentBrainstorm {...mockProps} onDraftChange={onDraftChange} />);
    fireEvent.change(screen.getByTestId("sb-input"), { target: { value: "想法A" } });
    expect(onDraftChange).toHaveBeenCalledWith("想法A");
  });

  it("顯示剩餘字數", () => {
    render(<SilentBrainstorm {...mockProps} draftText="Hi" />);
    expect(screen.getByTestId("sb-chars-left")).toHaveTextContent("98");
  });

  it("空白時提交按鈕 disabled", () => {
    render(<SilentBrainstorm {...mockProps} draftText="" />);
    expect(screen.getByTestId("sb-submit-btn")).toBeDisabled();
  });

  it("有文字時提交按鈕可用", () => {
    render(<SilentBrainstorm {...mockProps} draftText="想法" />);
    expect(screen.getByTestId("sb-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<SilentBrainstorm {...mockProps} draftText="想法" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("sb-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("達上限時顯示已達上限提示", () => {
    const state = { ideas: [idea1, { ...idea1, ideaId: "i3" }], revealed: false };
    render(<SilentBrainstorm {...mockProps} state={state} />);
    expect(screen.getByTestId("sb-limit-msg")).toBeInTheDocument();
  });

  it("達上限時隱藏輸入框", () => {
    const state = { ideas: [idea1, { ...idea1, ideaId: "i3" }], revealed: false };
    render(<SilentBrainstorm {...mockProps} state={state} />);
    expect(screen.queryByTestId("sb-input")).not.toBeInTheDocument();
  });

  it("顯示已提交數量", () => {
    const state = { ideas: [idea1], revealed: false };
    render(<SilentBrainstorm {...mockProps} state={state} />);
    expect(screen.getByTestId("sb-count")).toHaveTextContent("1");
  });

  it("顯示揭曉按鈕", () => {
    render(<SilentBrainstorm {...mockProps} />);
    expect(screen.getByTestId("sb-reveal-btn")).toBeInTheDocument();
  });

  it("點擊揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    render(<SilentBrainstorm {...mockProps} onReveal={onReveal} />);
    fireEvent.click(screen.getByTestId("sb-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("揭曉後顯示所有想法", () => {
    const state = { ideas: [idea1, idea2], revealed: true };
    render(<SilentBrainstorm {...mockProps} state={state} />);
    expect(screen.getByTestId("sb-idea-i1")).toBeInTheDocument();
    expect(screen.getByTestId("sb-idea-i2")).toBeInTheDocument();
  });

  it("揭曉後顯示想法內容", () => {
    const state = { ideas: [idea1], revealed: true };
    render(<SilentBrainstorm {...mockProps} state={state} />);
    expect(screen.getByTestId("sb-content-i1")).toHaveTextContent("定期同步");
  });

  it("showAuthor=true 顯示作者", () => {
    const state = { ideas: [idea1], revealed: true };
    render(<SilentBrainstorm {...mockProps} state={state} />);
    expect(screen.getByTestId("sb-author-i1")).toHaveTextContent("Alice");
  });

  it("showAuthor=false 隱藏作者", () => {
    const config = { ...defaultConfig, showAuthor: false };
    const state = { ideas: [idea1], revealed: true };
    render(<SilentBrainstorm {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("sb-author-i1")).not.toBeInTheDocument();
  });

  it("點擊投票呼叫 onVote", () => {
    const onVote = vi.fn();
    const state = { ideas: [idea1], revealed: true };
    render(<SilentBrainstorm {...mockProps} state={state} onVote={onVote} />);
    fireEvent.click(screen.getByTestId("sb-vote-i1"));
    expect(onVote).toHaveBeenCalledWith("i1");
  });

  it("顯示投票數", () => {
    const state = { ideas: [idea2], revealed: true };
    render(<SilentBrainstorm {...mockProps} state={state} />);
    expect(screen.getByTestId("sb-vote-count-i2")).toHaveTextContent("1");
  });

  it("揭曉後無想法顯示空白提示", () => {
    const state = { ideas: [], revealed: true };
    render(<SilentBrainstorm {...mockProps} state={state} />);
    expect(screen.getByTestId("sb-empty")).toBeInTheDocument();
  });
});
