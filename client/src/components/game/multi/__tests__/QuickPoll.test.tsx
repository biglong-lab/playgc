import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QuickPoll, QuickPollConfig, QuickPollState } from "../QuickPoll";

const defaultConfig: QuickPollConfig = {
  title: "📊 快速民調",
  question: "你最喜歡哪個選項？",
  options: ["選項 A", "選項 B", "選項 C"],
  maxLength: 40,
};

const emptyState: QuickPollState = { votes: [], revealed: false };

describe("QuickPoll", () => {
  it("renders title and question", () => {
    render(
      <QuickPoll config={defaultConfig} state={emptyState} userId="u1" onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("qp-title")).toHaveTextContent("📊 快速民調");
    expect(screen.getByTestId("qp-question")).toHaveTextContent("你最喜歡哪個選項？");
  });

  it("shows all option buttons", () => {
    render(
      <QuickPoll config={defaultConfig} state={emptyState} userId="u1" onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("qp-option-選項 A")).toBeInTheDocument();
    expect(screen.getByTestId("qp-option-選項 B")).toBeInTheDocument();
    expect(screen.getByTestId("qp-option-選項 C")).toBeInTheDocument();
  });

  it("shows empty indicator when no votes", () => {
    render(
      <QuickPoll config={defaultConfig} state={emptyState} userId="u1" onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("qp-empty")).toBeInTheDocument();
  });

  it("calls onVote when option clicked", () => {
    const onVote = vi.fn();
    render(
      <QuickPoll config={defaultConfig} state={emptyState} userId="u1" onVote={onVote} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("qp-option-選項 A"));
    expect(onVote).toHaveBeenCalledWith("選項 A");
  });

  it("shows count badge", () => {
    const state: QuickPollState = {
      votes: [{ voteId: "v1", userId: "u2", userName: "Alice", option: "選項 A" }],
      revealed: false,
    };
    render(
      <QuickPoll config={defaultConfig} state={state} userId="u1" onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("qp-count")).toHaveTextContent("1");
  });

  it("shows my-vote indicator after voting", () => {
    const state: QuickPollState = {
      votes: [{ voteId: "v1", userId: "u1", userName: "Me", option: "選項 B" }],
      revealed: false,
    };
    render(
      <QuickPoll config={defaultConfig} state={state} userId="u1" onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("qp-my-vote")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: QuickPollState = {
      votes: [{ voteId: "v1", userId: "u2", userName: "Alice", option: "選項 A" }],
      revealed: false,
    };
    render(
      <QuickPoll config={defaultConfig} state={state} userId="u1" isTeamLead onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("qp-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when clicked", () => {
    const onReveal = vi.fn();
    const state: QuickPollState = {
      votes: [{ voteId: "v1", userId: "u2", userName: "Alice", option: "選項 A" }],
      revealed: false,
    };
    render(
      <QuickPoll config={defaultConfig} state={state} userId="u1" isTeamLead onVote={vi.fn()} onReveal={onReveal} />,
    );
    fireEvent.click(screen.getByTestId("qp-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows tally when revealed", () => {
    const state: QuickPollState = {
      votes: [
        { voteId: "v1", userId: "u2", userName: "Alice", option: "選項 A" },
        { voteId: "v2", userId: "u3", userName: "Bob", option: "選項 B" },
        { voteId: "v3", userId: "u4", userName: "Carol", option: "選項 A" },
      ],
      revealed: true,
    };
    render(
      <QuickPoll config={defaultConfig} state={state} userId="u1" onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("qp-result")).toBeInTheDocument();
    expect(screen.getByTestId("qp-tally-選項 A")).toBeInTheDocument();
    expect(screen.getByTestId("qp-tally-選項 B")).toBeInTheDocument();
    expect(screen.getByTestId("qp-tally-選項 C")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: QuickPollState = {
      votes: [{ voteId: "v1", userId: "u2", userName: "Alice", option: "選項 A" }],
      revealed: false,
    };
    render(
      <QuickPoll config={defaultConfig} state={state} userId="u1" onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("qp-reveal-btn")).toBeNull();
  });
});
