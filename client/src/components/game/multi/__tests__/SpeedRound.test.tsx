import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SpeedRound, SpeedRoundConfig, SpeedRoundState } from "../SpeedRound";

const defaultConfig: SpeedRoundConfig = {
  title: "⚡ 限時搶答",
  question: "台灣最高的山是哪座？",
  correctAnswer: "玉山",
  answerLabel: "輸入你的答案",
  maxLength: 60,
  hint: "超過 3000 公尺",
};

const emptyState: SpeedRoundState = { answers: [], revealed: false };

describe("SpeedRound", () => {
  it("renders title and question", () => {
    render(
      <SpeedRound config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sr-title")).toHaveTextContent("⚡ 限時搶答");
    expect(screen.getByTestId("sr-question")).toHaveTextContent("台灣最高的山是哪座？");
  });

  it("shows empty indicator when no answers", () => {
    render(
      <SpeedRound config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sr-empty")).toBeInTheDocument();
  });

  it("shows answer input and submit button", () => {
    render(
      <SpeedRound config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sr-answer-input")).toBeInTheDocument();
    expect(screen.getByTestId("sr-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with answer text", () => {
    const onSubmit = vi.fn();
    render(
      <SpeedRound config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("sr-answer-input"), { target: { value: "玉山" } });
    fireEvent.click(screen.getByTestId("sr-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("玉山");
  });

  it("does not submit empty answer", () => {
    const onSubmit = vi.fn();
    render(
      <SpeedRound config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("sr-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows count badge", () => {
    const state: SpeedRoundState = {
      answers: [{ answerId: "a1", userId: "u2", userName: "Alice", answer: "玉山", isCorrect: true, rank: 1 }],
      revealed: false,
    };
    render(
      <SpeedRound config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sr-count")).toHaveTextContent("1");
  });

  it("shows my-answer when user has submitted", () => {
    const state: SpeedRoundState = {
      answers: [{ answerId: "a1", userId: "u1", userName: "Me", answer: "玉山", isCorrect: true, rank: 1 }],
      revealed: false,
    };
    render(
      <SpeedRound config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sr-my-answer")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: SpeedRoundState = {
      answers: [{ answerId: "a1", userId: "u2", userName: "Alice", answer: "玉山", isCorrect: true, rank: 1 }],
      revealed: false,
    };
    render(
      <SpeedRound config={defaultConfig} state={state} userId="u1" isTeamLead onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sr-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when reveal button clicked", () => {
    const onReveal = vi.fn();
    const state: SpeedRoundState = {
      answers: [{ answerId: "a1", userId: "u2", userName: "Alice", answer: "玉山", isCorrect: true, rank: 1 }],
      revealed: false,
    };
    render(
      <SpeedRound config={defaultConfig} state={state} userId="u1" isTeamLead onSubmit={vi.fn()} onReveal={onReveal} />,
    );
    fireEvent.click(screen.getByTestId("sr-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows result and answer list when revealed", () => {
    const state: SpeedRoundState = {
      answers: [
        { answerId: "a1", userId: "u2", userName: "Alice", answer: "玉山", isCorrect: true, rank: 1 },
        { answerId: "a2", userId: "u3", userName: "Bob", answer: "阿里山", isCorrect: false, rank: 2 },
      ],
      revealed: true,
    };
    render(
      <SpeedRound config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sr-result")).toBeInTheDocument();
    expect(screen.getByTestId("sr-answer-a1")).toBeInTheDocument();
    expect(screen.getByTestId("sr-answer-a2")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: SpeedRoundState = {
      answers: [{ answerId: "a1", userId: "u2", userName: "Alice", answer: "玉山", isCorrect: true, rank: 1 }],
      revealed: false,
    };
    render(
      <SpeedRound config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("sr-reveal-btn")).toBeNull();
  });

  it("shows correct-count badge when someone is correct", () => {
    const state: SpeedRoundState = {
      answers: [{ answerId: "a1", userId: "u2", userName: "Alice", answer: "玉山", isCorrect: true, rank: 1 }],
      revealed: false,
    };
    render(
      <SpeedRound config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sr-correct-count")).toBeInTheDocument();
  });
});
