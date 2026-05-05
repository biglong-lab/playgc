import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RetroBoard from "../RetroBoard";
import type { RetroBoardConfig, RetroBoardState, RetroCard } from "../RetroBoard";

const defaultConfig: RetroBoardConfig = {
  title: "📋 Sprint 回顧",
  prompt: "分享你的想法",
  columns: [
    { id: "keep", label: "繼續做", emoji: "✅", color: "green" },
    { id: "stop", label: "停止做", emoji: "🛑", color: "red" },
    { id: "start", label: "開始做", emoji: "🚀", color: "blue" },
  ],
  maxCardsPerColumn: 3,
  allowVoting: true,
};

const addState: RetroBoardState = {
  cards: [],
  phase: "add",
  hostUserId: "u1",
};

const card1: RetroCard = {
  id: "c1",
  columnId: "keep",
  userId: "u1",
  userName: "Alice",
  text: "每日站立會議",
  votes: [],
  addedAt: 1000,
};

const card2: RetroCard = {
  id: "c2",
  columnId: "stop",
  userId: "u2",
  userName: "Bob",
  text: "過多文件",
  votes: ["u1"],
  addedAt: 2000,
};

describe("RetroBoard", () => {
  it("顯示標題", () => {
    render(
      <RetroBoard config={defaultConfig} state={addState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("retro-title")).toHaveTextContent("Sprint 回顧");
  });

  it("顯示提示語", () => {
    render(
      <RetroBoard config={defaultConfig} state={addState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("retro-prompt")).toHaveTextContent("分享你的想法");
  });

  it("顯示三個欄位", () => {
    render(
      <RetroBoard config={defaultConfig} state={addState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("retro-column-keep")).toBeInTheDocument();
    expect(screen.getByTestId("retro-column-stop")).toBeInTheDocument();
    expect(screen.getByTestId("retro-column-start")).toBeInTheDocument();
  });

  it("add 階段顯示表單", () => {
    render(
      <RetroBoard config={defaultConfig} state={addState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("add-card-form")).toBeInTheDocument();
  });

  it("點擊欄位選擇呼叫 onColumnSelect", () => {
    const onColumnSelect = vi.fn();
    render(
      <RetroBoard config={defaultConfig} state={addState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={onColumnSelect} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("col-select-keep"));
    expect(onColumnSelect).toHaveBeenCalledWith("keep");
  });

  it("文字輸入呼叫 onTextChange", () => {
    const onTextChange = vi.fn();
    render(
      <RetroBoard config={defaultConfig} state={addState} myUserId="u1" draftColumnId="keep" draftText="" onColumnSelect={vi.fn()} onTextChange={onTextChange} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("card-text-input"), { target: { value: "新想法" } });
    expect(onTextChange).toHaveBeenCalledWith("新想法");
  });

  it("欄位未選或文字空白時加入按鈕 disabled", () => {
    render(
      <RetroBoard config={defaultConfig} state={addState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("add-card-btn")).toBeDisabled();
  });

  it("欄位與文字都有時加入按鈕啟用", () => {
    render(
      <RetroBoard config={defaultConfig} state={addState} myUserId="u1" draftColumnId="keep" draftText="好想法" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("add-card-btn")).not.toBeDisabled();
  });

  it("點擊加入呼叫 onAddCard", () => {
    const onAddCard = vi.fn();
    render(
      <RetroBoard config={defaultConfig} state={addState} myUserId="u1" draftColumnId="keep" draftText="好想法" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={onAddCard} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("add-card-btn"));
    expect(onAddCard).toHaveBeenCalled();
  });

  it("顯示已加卡片", () => {
    render(
      <RetroBoard config={defaultConfig} state={{ ...addState, cards: [card1] }} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("card-c1")).toBeInTheDocument();
  });

  it("顯示卡片文字與作者", () => {
    render(
      <RetroBoard config={defaultConfig} state={{ ...addState, cards: [card1] }} myUserId="u2" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("card-text-c1")).toHaveTextContent("每日站立會議");
    expect(screen.getByTestId("card-author-c1")).toHaveTextContent("Alice");
  });

  it("vote 階段非自己的卡片顯示投票按鈕", () => {
    const voteState: RetroBoardState = { ...addState, cards: [card2], phase: "vote" };
    render(
      <RetroBoard config={defaultConfig} state={voteState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("vote-btn-c2")).toBeInTheDocument();
  });

  it("點擊投票呼叫 onVote", () => {
    const onVote = vi.fn();
    const voteState: RetroBoardState = { ...addState, cards: [card2], phase: "vote" };
    render(
      <RetroBoard config={defaultConfig} state={voteState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={onVote} onAdvancePhase={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("vote-btn-c2"));
    expect(onVote).toHaveBeenCalledWith("c2");
  });

  it("host 在 add 階段看到開始投票按鈕", () => {
    render(
      <RetroBoard config={defaultConfig} state={{ ...addState, cards: [card1] }} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("start-vote-btn")).toBeInTheDocument();
  });

  it("host 在 vote 階段看到結束按鈕", () => {
    const voteState: RetroBoardState = { ...addState, phase: "vote" };
    render(
      <RetroBoard config={defaultConfig} state={voteState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("finish-retro-btn")).toBeInTheDocument();
  });

  it("done 階段顯示完成訊息", () => {
    const doneState: RetroBoardState = { ...addState, phase: "done" };
    render(
      <RetroBoard config={defaultConfig} state={doneState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("retro-done")).toBeInTheDocument();
  });

  it("顯示卡片總數", () => {
    render(
      <RetroBoard config={defaultConfig} state={{ ...addState, cards: [card1, card2] }} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("card-count")).toHaveTextContent("2");
  });

  it("顯示投票數", () => {
    const voteState: RetroBoardState = { ...addState, cards: [card2], phase: "vote" };
    render(
      <RetroBoard config={defaultConfig} state={voteState} myUserId="u1" draftColumnId="" draftText="" onColumnSelect={vi.fn()} onTextChange={vi.fn()} onAddCard={vi.fn()} onVote={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("vote-count-c2")).toHaveTextContent("1");
  });
});
