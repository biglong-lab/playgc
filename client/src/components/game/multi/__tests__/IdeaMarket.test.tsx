import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { IdeaMarket, IdeaMarketConfig, IdeaMarketState } from "../IdeaMarket";

const defaultConfig: IdeaMarketConfig = {
  title: "💡 創意市場",
  prompt: "提交你的點子並為最佳點子投票",
  voteLabel: "投票",
  votesPerPlayer: 3,
  maxLength: 100,
  submissionLabel: "提交你的點子",
};

const emptyState: IdeaMarketState = { ideas: [], revealed: false };

describe("IdeaMarket", () => {
  it("renders title and prompt", () => {
    render(
      <IdeaMarket config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("im-title")).toHaveTextContent("💡 創意市場");
    expect(screen.getByTestId("im-prompt")).toHaveTextContent("提交你的點子並為最佳點子投票");
  });

  it("shows empty indicator when no ideas", () => {
    render(
      <IdeaMarket config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("im-empty")).toBeInTheDocument();
  });

  it("shows title input and submit button", () => {
    render(
      <IdeaMarket config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("im-title-input")).toBeInTheDocument();
    expect(screen.getByTestId("im-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with title and description", () => {
    const onSubmit = vi.fn();
    render(
      <IdeaMarket config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("im-title-input"), { target: { value: "遠端工作" } });
    fireEvent.change(screen.getByTestId("im-desc-input"), { target: { value: "彈性上班" } });
    fireEvent.click(screen.getByTestId("im-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("遠端工作", "彈性上班");
  });

  it("does not submit without title", () => {
    const onSubmit = vi.fn();
    render(
      <IdeaMarket config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("im-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows count badge", () => {
    const state: IdeaMarketState = {
      ideas: [{ ideaId: "i1", userId: "u2", userName: "Alice", title: "Idea A", description: "", votes: 2, voters: ["u3"] }],
      revealed: false,
    };
    render(
      <IdeaMarket config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("im-count")).toHaveTextContent("1");
  });

  it("shows my-idea when user has submitted", () => {
    const state: IdeaMarketState = {
      ideas: [{ ideaId: "i1", userId: "u1", userName: "Me", title: "My Idea", description: "", votes: 0, voters: [] }],
      revealed: false,
    };
    render(
      <IdeaMarket config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("im-my-idea")).toBeInTheDocument();
  });

  it("shows vote buttons for ideas", () => {
    const state: IdeaMarketState = {
      ideas: [{ ideaId: "i1", userId: "u2", userName: "Alice", title: "Idea A", description: "", votes: 1, voters: [] }],
      revealed: false,
    };
    render(
      <IdeaMarket config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("im-vote-i1")).toBeInTheDocument();
  });

  it("calls onVote when vote button clicked", () => {
    const onVote = vi.fn();
    const state: IdeaMarketState = {
      ideas: [{ ideaId: "i1", userId: "u2", userName: "Alice", title: "Idea A", description: "", votes: 0, voters: [] }],
      revealed: false,
    };
    render(
      <IdeaMarket config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onVote={onVote} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("im-vote-i1"));
    expect(onVote).toHaveBeenCalledWith("i1");
  });

  it("shows reveal button for team lead when ideas exist", () => {
    const state: IdeaMarketState = {
      ideas: [{ ideaId: "i1", userId: "u2", userName: "Alice", title: "Idea A", description: "", votes: 1, voters: ["u1"] }],
      revealed: false,
    };
    render(
      <IdeaMarket config={defaultConfig} state={state} userId="u1" isTeamLead onSubmit={vi.fn()} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("im-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when reveal button clicked", () => {
    const onReveal = vi.fn();
    const state: IdeaMarketState = {
      ideas: [{ ideaId: "i1", userId: "u2", userName: "Alice", title: "Idea A", description: "", votes: 1, voters: ["u1"] }],
      revealed: false,
    };
    render(
      <IdeaMarket config={defaultConfig} state={state} userId="u1" isTeamLead onSubmit={vi.fn()} onVote={vi.fn()} onReveal={onReveal} />,
    );
    fireEvent.click(screen.getByTestId("im-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows ranked results when revealed", () => {
    const state: IdeaMarketState = {
      ideas: [
        { ideaId: "i1", userId: "u2", userName: "Alice", title: "Idea A", description: "", votes: 5, voters: [] },
        { ideaId: "i2", userId: "u3", userName: "Bob", title: "Idea B", description: "", votes: 2, voters: [] },
      ],
      revealed: true,
    };
    render(
      <IdeaMarket config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("im-result")).toBeInTheDocument();
    expect(screen.getByTestId("im-ranked-i1")).toBeInTheDocument();
    expect(screen.getByTestId("im-ranked-i2")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: IdeaMarketState = {
      ideas: [{ ideaId: "i1", userId: "u2", userName: "Alice", title: "Idea A", description: "", votes: 1, voters: [] }],
      revealed: false,
    };
    render(
      <IdeaMarket config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("im-reveal-btn")).toBeNull();
  });

  it("shows votes-left badge", () => {
    render(
      <IdeaMarket config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onVote={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("im-votes-left")).toBeInTheDocument();
  });
});
