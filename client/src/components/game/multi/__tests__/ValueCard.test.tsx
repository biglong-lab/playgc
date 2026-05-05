import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ValueCard, ValueCardConfig, ValueCardState } from "../ValueCard";

const defaultConfig: ValueCardConfig = {
  title: "🃏 價值卡選單",
  prompt: "選出最重要的幾張",
  cardPool: ["誠信", "創新", "合作", "卓越"],
  maxSelect: 2,
};

const emptyState: ValueCardState = { selections: [], revealed: false };

describe("ValueCard", () => {
  it("renders title and prompt", () => {
    render(
      <ValueCard config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("vc-title")).toHaveTextContent("🃏 價值卡選單");
    expect(screen.getByTestId("vc-prompt")).toHaveTextContent("選出最重要的幾張");
  });

  it("renders all cards from pool", () => {
    render(
      <ValueCard config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("vc-card-誠信")).toBeInTheDocument();
    expect(screen.getByTestId("vc-card-創新")).toBeInTheDocument();
    expect(screen.getByTestId("vc-card-合作")).toBeInTheDocument();
    expect(screen.getByTestId("vc-card-卓越")).toBeInTheDocument();
  });

  it("shows empty indicator when no selections", () => {
    render(
      <ValueCard config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("vc-empty")).toBeInTheDocument();
  });

  it("shows count", () => {
    const state: ValueCardState = {
      selections: [{ selectionId: "s1", userId: "u2", userName: "Alice", cards: ["誠信"] }],
      revealed: false,
    };
    render(
      <ValueCard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("vc-count")).toHaveTextContent("1");
  });

  it("shows submit button when user has not submitted", () => {
    render(
      <ValueCard config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("vc-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with selected cards", () => {
    const onSubmit = vi.fn();
    render(
      <ValueCard config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("vc-card-誠信"));
    fireEvent.click(screen.getByTestId("vc-card-合作"));
    fireEvent.click(screen.getByTestId("vc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(["誠信", "合作"]);
  });

  it("does not submit when no cards selected", () => {
    const onSubmit = vi.fn();
    render(
      <ValueCard config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("vc-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cannot select more than maxSelect cards", () => {
    const onSubmit = vi.fn();
    render(
      <ValueCard config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("vc-card-誠信"));
    fireEvent.click(screen.getByTestId("vc-card-創新"));
    fireEvent.click(screen.getByTestId("vc-card-合作"));
    fireEvent.click(screen.getByTestId("vc-submit-btn"));
    // Should only submit the first two
    expect(onSubmit).toHaveBeenCalledWith(["誠信", "創新"]);
  });

  it("shows my-selection when user has submitted", () => {
    const state: ValueCardState = {
      selections: [{ selectionId: "s1", userId: "u1", userName: "Me", cards: ["誠信", "合作"] }],
      revealed: false,
    };
    render(
      <ValueCard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("vc-my-selection")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: ValueCardState = {
      selections: [{ selectionId: "s1", userId: "u1", userName: "Me", cards: ["誠信"] }],
      revealed: false,
    };
    render(
      <ValueCard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} isTeamLead />,
    );
    expect(screen.getByTestId("vc-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when reveal clicked", () => {
    const onReveal = vi.fn();
    const state: ValueCardState = {
      selections: [{ selectionId: "s1", userId: "u1", userName: "Me", cards: ["誠信"] }],
      revealed: false,
    };
    render(
      <ValueCard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={onReveal} isTeamLead />,
    );
    fireEvent.click(screen.getByTestId("vc-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows tally when revealed", () => {
    const state: ValueCardState = {
      selections: [
        { selectionId: "s1", userId: "u2", userName: "Alice", cards: ["誠信", "合作"] },
        { selectionId: "s2", userId: "u3", userName: "Bob", cards: ["誠信", "創新"] },
      ],
      revealed: true,
    };
    render(
      <ValueCard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("vc-result")).toBeInTheDocument();
    expect(screen.getByTestId("vc-tally-誠信")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: ValueCardState = {
      selections: [{ selectionId: "s1", userId: "u1", userName: "Me", cards: ["誠信"] }],
      revealed: false,
    };
    render(
      <ValueCard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("vc-reveal-btn")).toBeNull();
  });

  it("does not show submit after user submitted", () => {
    const state: ValueCardState = {
      selections: [{ selectionId: "s1", userId: "u1", userName: "Me", cards: ["誠信"] }],
      revealed: false,
    };
    render(
      <ValueCard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("vc-submit-btn")).toBeNull();
  });
});
