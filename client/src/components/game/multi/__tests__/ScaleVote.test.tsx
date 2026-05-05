import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ScaleVote, ScaleVoteConfig, ScaleVoteState } from "../ScaleVote";

const defaultConfig: ScaleVoteConfig = {
  title: "📊 滑桿投票",
  question: "你覺得這次培訓有多有用？",
  minLabel: "完全沒用",
  maxLabel: "非常有用",
  scaleMin: 0,
  scaleMax: 100,
  defaultValue: 50,
};

const emptyState: ScaleVoteState = { entries: [], revealed: false };

describe("ScaleVote", () => {
  it("renders title and question", () => {
    render(
      <ScaleVote config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sv-title")).toHaveTextContent("📊 滑桿投票");
    expect(screen.getByTestId("sv-question")).toHaveTextContent("你覺得這次培訓有多有用？");
  });

  it("shows empty indicator when no entries", () => {
    render(
      <ScaleVote config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sv-empty")).toBeInTheDocument();
  });

  it("shows slider and submit button", () => {
    render(
      <ScaleVote config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sv-slider")).toBeInTheDocument();
    expect(screen.getByTestId("sv-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit when submit button clicked", () => {
    const onSubmit = vi.fn();
    render(
      <ScaleVote config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("sv-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(50);
  });

  it("shows count badge", () => {
    const state: ScaleVoteState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "Alice", value: 75 }],
      revealed: false,
    };
    render(
      <ScaleVote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sv-count")).toHaveTextContent("1");
  });

  it("shows my-entry when user has submitted", () => {
    const state: ScaleVoteState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Me", value: 80 }],
      revealed: false,
    };
    render(
      <ScaleVote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sv-my-entry")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: ScaleVoteState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "Alice", value: 75 }],
      revealed: false,
    };
    render(
      <ScaleVote config={defaultConfig} state={state} userId="u1" isTeamLead onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sv-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when reveal button clicked", () => {
    const onReveal = vi.fn();
    const state: ScaleVoteState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "Alice", value: 75 }],
      revealed: false,
    };
    render(
      <ScaleVote config={defaultConfig} state={state} userId="u1" isTeamLead onSubmit={vi.fn()} onReveal={onReveal} />,
    );
    fireEvent.click(screen.getByTestId("sv-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows result with average when revealed", () => {
    const state: ScaleVoteState = {
      entries: [
        { entryId: "e1", userId: "u2", userName: "Alice", value: 80 },
        { entryId: "e2", userId: "u3", userName: "Bob", value: 60 },
      ],
      revealed: true,
    };
    render(
      <ScaleVote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sv-result")).toBeInTheDocument();
    expect(screen.getByTestId("sv-average")).toHaveTextContent("70");
  });

  it("shows individual entries when revealed", () => {
    const state: ScaleVoteState = {
      entries: [
        { entryId: "e1", userId: "u2", userName: "Alice", value: 80 },
        { entryId: "e2", userId: "u3", userName: "Bob", value: 60 },
      ],
      revealed: true,
    };
    render(
      <ScaleVote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sv-entry-e1")).toBeInTheDocument();
    expect(screen.getByTestId("sv-entry-e2")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: ScaleVoteState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "Alice", value: 75 }],
      revealed: false,
    };
    render(
      <ScaleVote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("sv-reveal-btn")).toBeNull();
  });
});
