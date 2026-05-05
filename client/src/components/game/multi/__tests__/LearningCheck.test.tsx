import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LearningCheck, LearningCheckConfig, LearningCheckState } from "../LearningCheck";

const defaultConfig: LearningCheckConfig = {
  title: "📊 學習確認",
  prompt: "評估自己的掌握程度",
  topics: ["概念理解", "實作能力"],
  selfRateLabel: "掌握度 1-5",
  maxLength: 100,
};

const emptyState: LearningCheckState = { checks: [], revealed: false };

describe("LearningCheck", () => {
  it("renders title and prompt", () => {
    render(
      <LearningCheck config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("lc-title")).toHaveTextContent("📊 學習確認");
    expect(screen.getByTestId("lc-prompt")).toHaveTextContent("評估自己的掌握程度");
  });

  it("renders rating buttons for each topic", () => {
    render(
      <LearningCheck config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("lc-rate-概念理解-1")).toBeInTheDocument();
    expect(screen.getByTestId("lc-rate-概念理解-5")).toBeInTheDocument();
    expect(screen.getByTestId("lc-rate-實作能力-3")).toBeInTheDocument();
  });

  it("shows empty indicator when no checks", () => {
    render(
      <LearningCheck config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("lc-empty")).toBeInTheDocument();
  });

  it("shows count", () => {
    const state: LearningCheckState = {
      checks: [{ checkId: "c1", userId: "u2", userName: "Alice", ratings: { "概念理解": 4, "實作能力": 3 }, note: "" }],
      revealed: false,
    };
    render(
      <LearningCheck config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("lc-count")).toHaveTextContent("1");
  });

  it("shows note input", () => {
    render(
      <LearningCheck config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("lc-note-input")).toBeInTheDocument();
  });

  it("shows submit button", () => {
    render(
      <LearningCheck config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("lc-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with ratings and note", () => {
    const onSubmit = vi.fn();
    render(
      <LearningCheck config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("lc-rate-概念理解-4"));
    fireEvent.click(screen.getByTestId("lc-rate-實作能力-3"));
    fireEvent.change(screen.getByTestId("lc-note-input"), { target: { value: "需要再練習" } });
    fireEvent.click(screen.getByTestId("lc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith({ "概念理解": 4, "實作能力": 3 }, "需要再練習");
  });

  it("does not submit when not all topics rated", () => {
    const onSubmit = vi.fn();
    render(
      <LearningCheck config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("lc-rate-概念理解-4"));
    fireEvent.click(screen.getByTestId("lc-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows my-entry when user has submitted", () => {
    const state: LearningCheckState = {
      checks: [{ checkId: "c1", userId: "u1", userName: "Me", ratings: { "概念理解": 4, "實作能力": 3 }, note: "" }],
      revealed: false,
    };
    render(
      <LearningCheck config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("lc-my-entry")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: LearningCheckState = {
      checks: [{ checkId: "c1", userId: "u1", userName: "Me", ratings: { "概念理解": 4, "實作能力": 3 }, note: "" }],
      revealed: false,
    };
    render(
      <LearningCheck config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} isTeamLead />,
    );
    expect(screen.getByTestId("lc-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when clicked", () => {
    const onReveal = vi.fn();
    const state: LearningCheckState = {
      checks: [{ checkId: "c1", userId: "u1", userName: "Me", ratings: { "概念理解": 4, "實作能力": 3 }, note: "" }],
      revealed: false,
    };
    render(
      <LearningCheck config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={onReveal} isTeamLead />,
    );
    fireEvent.click(screen.getByTestId("lc-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows averages when revealed", () => {
    const state: LearningCheckState = {
      checks: [
        { checkId: "c1", userId: "u2", userName: "Alice", ratings: { "概念理解": 4, "實作能力": 2 }, note: "" },
        { checkId: "c2", userId: "u3", userName: "Bob", ratings: { "概念理解": 2, "實作能力": 4 }, note: "" },
      ],
      revealed: true,
    };
    render(
      <LearningCheck config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("lc-result")).toBeInTheDocument();
    expect(screen.getByTestId("lc-avg-概念理解")).toBeInTheDocument();
    expect(screen.getByTestId("lc-avg-實作能力")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: LearningCheckState = {
      checks: [{ checkId: "c1", userId: "u1", userName: "Me", ratings: { "概念理解": 4, "實作能力": 3 }, note: "" }],
      revealed: false,
    };
    render(
      <LearningCheck config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("lc-reveal-btn")).toBeNull();
  });

  it("does not show submit after submitted", () => {
    const state: LearningCheckState = {
      checks: [{ checkId: "c1", userId: "u1", userName: "Me", ratings: { "概念理解": 4, "實作能力": 3 }, note: "" }],
      revealed: false,
    };
    render(
      <LearningCheck config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("lc-submit-btn")).toBeNull();
  });
});
