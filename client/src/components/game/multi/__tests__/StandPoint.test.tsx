import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StandPoint, StandPointConfig, StandPointState } from "../StandPoint";

const defaultConfig: StandPointConfig = {
  title: "🗣️ 立場陳述",
  issue: "你支持遠端工作嗎？",
  stances: ["支持", "中立", "反對"],
  reasonLabel: "說明理由",
  maxLength: 150,
};

const emptyState: StandPointState = { positions: [], revealed: false };

describe("StandPoint", () => {
  it("renders title and issue", () => {
    render(
      <StandPoint config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sp-title")).toHaveTextContent("🗣️ 立場陳述");
    expect(screen.getByTestId("sp-issue")).toHaveTextContent("你支持遠端工作嗎？");
  });

  it("renders all stance buttons", () => {
    render(
      <StandPoint config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sp-stance-支持")).toBeInTheDocument();
    expect(screen.getByTestId("sp-stance-中立")).toBeInTheDocument();
    expect(screen.getByTestId("sp-stance-反對")).toBeInTheDocument();
  });

  it("shows empty indicator when no positions", () => {
    render(
      <StandPoint config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sp-empty")).toBeInTheDocument();
  });

  it("shows count", () => {
    const state: StandPointState = {
      positions: [{ posId: "p1", userId: "u2", userName: "Alice", stance: "支持", reason: "效率高" }],
      revealed: false,
    };
    render(
      <StandPoint config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sp-count")).toHaveTextContent("1");
  });

  it("shows reason input", () => {
    render(
      <StandPoint config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sp-reason-input")).toBeInTheDocument();
  });

  it("shows submit button when user has not submitted", () => {
    render(
      <StandPoint config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sp-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with stance and reason", () => {
    const onSubmit = vi.fn();
    render(
      <StandPoint config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("sp-stance-支持"));
    fireEvent.change(screen.getByTestId("sp-reason-input"), { target: { value: "可以節省通勤" } });
    fireEvent.click(screen.getByTestId("sp-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("支持", "可以節省通勤");
  });

  it("does not submit when no stance selected", () => {
    const onSubmit = vi.fn();
    render(
      <StandPoint config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("sp-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows my-position when user has submitted", () => {
    const state: StandPointState = {
      positions: [{ posId: "p1", userId: "u1", userName: "Me", stance: "支持", reason: "效率" }],
      revealed: false,
    };
    render(
      <StandPoint config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sp-my-position")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: StandPointState = {
      positions: [{ posId: "p1", userId: "u1", userName: "Me", stance: "支持", reason: "" }],
      revealed: false,
    };
    render(
      <StandPoint config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} isTeamLead />,
    );
    expect(screen.getByTestId("sp-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when clicked", () => {
    const onReveal = vi.fn();
    const state: StandPointState = {
      positions: [{ posId: "p1", userId: "u1", userName: "Me", stance: "支持", reason: "" }],
      revealed: false,
    };
    render(
      <StandPoint config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={onReveal} isTeamLead />,
    );
    fireEvent.click(screen.getByTestId("sp-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows results when revealed", () => {
    const state: StandPointState = {
      positions: [
        { posId: "p1", userId: "u2", userName: "Alice", stance: "支持", reason: "彈性" },
        { posId: "p2", userId: "u3", userName: "Bob", stance: "反對", reason: "溝通難" },
      ],
      revealed: true,
    };
    render(
      <StandPoint config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("sp-result")).toBeInTheDocument();
    expect(screen.getByTestId("sp-pos-p1")).toBeInTheDocument();
    expect(screen.getByTestId("sp-pos-p2")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: StandPointState = {
      positions: [{ posId: "p1", userId: "u1", userName: "Me", stance: "支持", reason: "" }],
      revealed: false,
    };
    render(
      <StandPoint config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("sp-reveal-btn")).toBeNull();
  });

  it("does not show submit after submitted", () => {
    const state: StandPointState = {
      positions: [{ posId: "p1", userId: "u1", userName: "Me", stance: "支持", reason: "" }],
      revealed: false,
    };
    render(
      <StandPoint config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("sp-submit-btn")).toBeNull();
  });
});
