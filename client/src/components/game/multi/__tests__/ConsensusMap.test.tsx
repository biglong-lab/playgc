import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConsensusMap, ConsensusMapConfig, ConsensusMapState } from "../ConsensusMap";

const defaultConfig: ConsensusMapConfig = {
  title: "🗺️ 共識地圖",
  prompt: "評估各主題的可行性與重要性",
  topics: ["遠端工作", "彈性時間", "培訓計劃"],
  xLabel: "可行性",
  yLabel: "重要性",
  axisMin: 1,
  axisMax: 5,
};

const emptyState: ConsensusMapState = { entries: [], revealed: false };

describe("ConsensusMap", () => {
  it("renders title and prompt", () => {
    render(
      <ConsensusMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("cm-title")).toHaveTextContent("🗺️ 共識地圖");
    expect(screen.getByTestId("cm-prompt")).toHaveTextContent("評估各主題的可行性與重要性");
  });

  it("renders topic buttons", () => {
    render(
      <ConsensusMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("cm-topic-遠端工作")).toBeInTheDocument();
    expect(screen.getByTestId("cm-topic-彈性時間")).toBeInTheDocument();
    expect(screen.getByTestId("cm-topic-培訓計劃")).toBeInTheDocument();
  });

  it("renders axis rating buttons", () => {
    render(
      <ConsensusMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("cm-feasibility-1")).toBeInTheDocument();
    expect(screen.getByTestId("cm-feasibility-5")).toBeInTheDocument();
    expect(screen.getByTestId("cm-importance-3")).toBeInTheDocument();
  });

  it("shows empty indicator when no entries", () => {
    render(
      <ConsensusMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("cm-empty")).toBeInTheDocument();
  });

  it("shows count", () => {
    const state: ConsensusMapState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "Alice", topic: "遠端工作", feasibility: 4, importance: 5 }],
      revealed: false,
    };
    render(
      <ConsensusMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("cm-count")).toHaveTextContent("1");
  });

  it("shows submit button", () => {
    render(
      <ConsensusMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("cm-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with topic and ratings", () => {
    const onSubmit = vi.fn();
    render(
      <ConsensusMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("cm-topic-遠端工作"));
    fireEvent.click(screen.getByTestId("cm-feasibility-4"));
    fireEvent.click(screen.getByTestId("cm-importance-5"));
    fireEvent.click(screen.getByTestId("cm-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("遠端工作", 4, 5);
  });

  it("does not submit without topic selected", () => {
    const onSubmit = vi.fn();
    render(
      <ConsensusMap config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("cm-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows my-entry when user has submitted", () => {
    const state: ConsensusMapState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Me", topic: "遠端工作", feasibility: 4, importance: 5 }],
      revealed: false,
    };
    render(
      <ConsensusMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("cm-my-entry")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: ConsensusMapState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "Alice", topic: "遠端工作", feasibility: 4, importance: 5 }],
      revealed: false,
    };
    render(
      <ConsensusMap config={defaultConfig} state={state} userId="u1" isTeamLead onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("cm-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when clicked", () => {
    const onReveal = vi.fn();
    const state: ConsensusMapState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "Alice", topic: "遠端工作", feasibility: 4, importance: 5 }],
      revealed: false,
    };
    render(
      <ConsensusMap config={defaultConfig} state={state} userId="u1" isTeamLead onSubmit={vi.fn()} onReveal={onReveal} />,
    );
    fireEvent.click(screen.getByTestId("cm-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows quadrant result when revealed", () => {
    const state: ConsensusMapState = {
      entries: [
        { entryId: "e1", userId: "u2", userName: "Alice", topic: "遠端工作", feasibility: 4, importance: 5 },
        { entryId: "e2", userId: "u3", userName: "Bob", topic: "彈性時間", feasibility: 2, importance: 2 },
      ],
      revealed: true,
    };
    render(
      <ConsensusMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("cm-result")).toBeInTheDocument();
    expect(screen.getByTestId("cm-entry-e1")).toBeInTheDocument();
    expect(screen.getByTestId("cm-entry-e2")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: ConsensusMapState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "Alice", topic: "遠端工作", feasibility: 4, importance: 5 }],
      revealed: false,
    };
    render(
      <ConsensusMap config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("cm-reveal-btn")).toBeNull();
  });
});
