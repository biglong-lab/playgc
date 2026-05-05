import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TwoTruths from "../TwoTruths";
import type { TwoTruthsConfig, TwoTruthsState } from "../TwoTruths";

const defaultConfig: TwoTruthsConfig = {
  title: "🤥 兩真一假",
  instructions: "寫下 2 個真實陳述和 1 個謊言",
  showScores: true,
};

const collectState: TwoTruthsState = {
  phase: "collect",
  entries: [],
  guesses: [],
  hostUserId: null,
};

const entry1 = {
  userId: "u1",
  userName: "Alice",
  statements: ["我養過一條蛇", "我去過 30 個國家", "我會說法語"],
  lieIdx: 1,
  submittedAt: 1000,
};

const entry2 = {
  userId: "u2",
  userName: "Bob",
  statements: ["我跑過馬拉松", "我是雙胞胎", "我怕貓"],
  lieIdx: 2,
  submittedAt: 2000,
};

const guessState: TwoTruthsState = {
  phase: "guess",
  entries: [entry1, entry2],
  guesses: [],
  hostUserId: "u1",
};

const revealState: TwoTruthsState = {
  phase: "reveal",
  entries: [entry1, entry2],
  guesses: [
    { guesserId: "u2", targetUserId: "u1", guessedIdx: 1 },
    { guesserId: "u1", targetUserId: "u2", guessedIdx: 2 },
  ],
  hostUserId: "u1",
};

describe("TwoTruths", () => {
  it("顯示標題", () => {
    render(
      <TwoTruths config={defaultConfig} state={collectState} myUserId="u1" drafts={["", "", ""]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("two-truths-title")).toHaveTextContent("兩真一假");
  });

  it("顯示說明文字", () => {
    render(
      <TwoTruths config={defaultConfig} state={collectState} myUserId="u1" drafts={["", "", ""]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("two-truths-instructions")).toBeInTheDocument();
  });

  it("collect 階段顯示表單", () => {
    render(
      <TwoTruths config={defaultConfig} state={collectState} myUserId="u1" drafts={["", "", ""]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("collect-form")).toBeInTheDocument();
    expect(screen.getByTestId("statement-input-0")).toBeInTheDocument();
    expect(screen.getByTestId("statement-input-1")).toBeInTheDocument();
    expect(screen.getByTestId("statement-input-2")).toBeInTheDocument();
  });

  it("輸入陳述呼叫 onDraftChange", () => {
    const onDraftChange = vi.fn();
    render(
      <TwoTruths config={defaultConfig} state={collectState} myUserId="u1" drafts={["", "", ""]} lieDraftIdx={2} onDraftChange={onDraftChange} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("statement-input-0"), { target: { value: "我會跳舞" } });
    expect(onDraftChange).toHaveBeenCalledWith(0, "我會跳舞");
  });

  it("點擊謊言標記呼叫 onLieSelect", () => {
    const onLieSelect = vi.fn();
    render(
      <TwoTruths config={defaultConfig} state={collectState} myUserId="u1" drafts={["A", "B", "C"]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={onLieSelect} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("lie-select-0"));
    expect(onLieSelect).toHaveBeenCalledWith(0);
  });

  it("有空白時提交按鈕 disabled", () => {
    render(
      <TwoTruths config={defaultConfig} state={collectState} myUserId="u1" drafts={["", "", ""]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("submit-statements-btn")).toBeDisabled();
  });

  it("三個陳述都填完後提交按鈕啟用", () => {
    render(
      <TwoTruths config={defaultConfig} state={collectState} myUserId="u1" drafts={["A", "B", "C"]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("submit-statements-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <TwoTruths config={defaultConfig} state={collectState} myUserId="u1" drafts={["A", "B", "C"]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={onSubmit} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("submit-statements-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交後顯示 submitted-msg", () => {
    const submittedState = { ...collectState, entries: [entry1] };
    render(
      <TwoTruths config={defaultConfig} state={submittedState} myUserId="u1" drafts={["A", "B", "C"]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("submitted-msg")).toBeInTheDocument();
  });

  it("guess 階段顯示所有玩家卡片", () => {
    render(
      <TwoTruths config={defaultConfig} state={guessState} myUserId="u2" drafts={["", "", ""]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("guess-phase")).toBeInTheDocument();
    expect(screen.getByTestId("guess-card-u1")).toBeInTheDocument();
    expect(screen.getByTestId("guess-card-u2")).toBeInTheDocument();
  });

  it("點擊猜測按鈕呼叫 onGuess", () => {
    const onGuess = vi.fn();
    render(
      <TwoTruths config={defaultConfig} state={guessState} myUserId="u2" drafts={["", "", ""]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={onGuess} onAdvancePhase={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("guess-btn-u1-0"));
    expect(onGuess).toHaveBeenCalledWith("u1", 0);
  });

  it("host 看到進下一階段按鈕", () => {
    render(
      <TwoTruths config={defaultConfig} state={guessState} myUserId="u1" drafts={["", "", ""]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("advance-to-reveal-btn")).toBeInTheDocument();
  });

  it("reveal 階段顯示揭曉資訊", () => {
    render(
      <TwoTruths config={defaultConfig} state={revealState} myUserId="u2" drafts={["", "", ""]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("reveal-phase")).toBeInTheDocument();
    expect(screen.getByTestId("reveal-card-u1")).toBeInTheDocument();
  });

  it("顯示已提交人數", () => {
    render(
      <TwoTruths config={defaultConfig} state={{ ...collectState, entries: [entry1] }} myUserId="u2" drafts={["", "", ""]} lieDraftIdx={2} onDraftChange={vi.fn()} onLieSelect={vi.fn()} onSubmit={vi.fn()} onGuess={vi.fn()} onAdvancePhase={vi.fn()} />,
    );
    expect(screen.getByTestId("player-count")).toHaveTextContent("1");
  });
});
