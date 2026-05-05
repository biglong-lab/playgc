import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SharedBoard from "../SharedBoard";
import type { SharedBoardConfig, SharedBoardState, BoardCard } from "../SharedBoard";

const config: SharedBoardConfig = {
  title: "開場共識牆",
  prompt: "寫下今天最期待的事",
  maxCardsPerPerson: 3,
};

const emptyState: SharedBoardState = { cards: [] };

const sampleCard: BoardCard = {
  id: "u1-1000",
  authorId: "u1",
  authorName: "Alice",
  text: "學到新技能",
  color: "#fef08a",
  createdAt: 1000,
};

const otherCard: BoardCard = {
  id: "u2-2000",
  authorId: "u2",
  authorName: "Bob",
  text: "認識新朋友",
  color: "#bbf7d0",
  createdAt: 2000,
};

describe("SharedBoard", () => {
  it("顯示標題", () => {
    render(
      <SharedBoard config={config} state={emptyState} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={vi.fn()} />,
    );
    expect(screen.getByText("開場共識牆")).toBeInTheDocument();
  });

  it("顯示 prompt", () => {
    render(
      <SharedBoard config={config} state={emptyState} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={vi.fn()} />,
    );
    expect(screen.getByText("寫下今天最期待的事")).toBeInTheDocument();
  });

  it("空白時顯示空板訊息", () => {
    render(
      <SharedBoard config={config} state={emptyState} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={vi.fn()} />,
    );
    expect(screen.getByText(/還沒有人張貼/)).toBeInTheDocument();
  });

  it("卡片列表顯示內容與作者", () => {
    const state: SharedBoardState = { cards: [sampleCard, otherCard] };
    render(
      <SharedBoard config={config} state={state} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={vi.fn()} />,
    );
    expect(screen.getByText("學到新技能")).toBeInTheDocument();
    expect(screen.getByText("認識新朋友")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("輸入文字後「張貼」按鈕可用", () => {
    render(
      <SharedBoard config={config} state={emptyState} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={vi.fn()} />,
    );
    const textarea = screen.getByPlaceholderText(/輸入你的想法/);
    fireEvent.change(textarea, { target: { value: "測試想法" } });
    const btn = screen.getByRole("button", { name: /張貼/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("空輸入時「張貼」按鈕禁用", () => {
    render(
      <SharedBoard config={config} state={emptyState} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={vi.fn()} />,
    );
    const btn = screen.getByRole("button", { name: /張貼/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("點擊張貼呼叫 onAddCard", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <SharedBoard config={config} state={emptyState} myUserId="u1" myUserName="Alice"
        onAddCard={onAdd} onDeleteCard={vi.fn()} />,
    );
    const textarea = screen.getByPlaceholderText(/輸入你的想法/);
    fireEvent.change(textarea, { target: { value: "我的想法" } });
    fireEvent.click(screen.getByRole("button", { name: /張貼/ }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("我的想法", expect.any(String)));
  });

  it("達到上限後 textarea 禁用", () => {
    const maxCards: BoardCard[] = Array.from({ length: 3 }, (_, i) => ({
      id: `u1-${i}`, authorId: "u1", authorName: "Alice",
      text: `卡片${i}`, color: "#fef08a", createdAt: i,
    }));
    const state: SharedBoardState = { cards: maxCards };
    render(
      <SharedBoard config={config} state={state} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={vi.fn()} />,
    );
    const textarea = screen.getByPlaceholderText(/輸入你的想法/) as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
    expect(screen.getByText(/已達上限/)).toBeInTheDocument();
  });

  it("自己的卡片有刪除按鈕", () => {
    const state: SharedBoardState = { cards: [sampleCard] };
    render(
      <SharedBoard config={config} state={state} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={vi.fn()} />,
    );
    expect(screen.getByLabelText("刪除卡片")).toBeInTheDocument();
  });

  it("別人的卡片沒有刪除按鈕", () => {
    const state: SharedBoardState = { cards: [otherCard] };
    render(
      <SharedBoard config={config} state={state} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={vi.fn()} />,
    );
    expect(screen.queryByLabelText("刪除卡片")).not.toBeInTheDocument();
  });

  it("點擊刪除呼叫 onDeleteCard", () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const state: SharedBoardState = { cards: [sampleCard] };
    render(
      <SharedBoard config={config} state={state} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={onDelete} />,
    );
    fireEvent.click(screen.getByLabelText("刪除卡片"));
    expect(onDelete).toHaveBeenCalledWith("u1-1000");
  });

  it("卡片計數 badge 顯示 myCardCount/maxCards", () => {
    const state: SharedBoardState = { cards: [sampleCard] };
    render(
      <SharedBoard config={config} state={state} myUserId="u1" myUserName="Alice"
        onAddCard={vi.fn()} onDeleteCard={vi.fn()} />,
    );
    expect(screen.getByText("1/3 張")).toBeInTheDocument();
  });
});
