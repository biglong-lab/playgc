import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FutureIdea, FutureIdeaConfig, FutureIdeaState } from "../FutureIdea";

const defaultConfig: FutureIdeaConfig = {
  title: "未來願景",
  prompt: "描述你對未來的想法與期待",
  horizon: "一年後",
  maxLength: 200,
};

const emptyState: FutureIdeaState = { visions: [], revealed: false };

describe("FutureIdea", () => {
  it("renders title and prompt", () => {
    render(
      <FutureIdea
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fi-title")).toHaveTextContent("未來願景");
    expect(screen.getByTestId("fi-prompt")).toHaveTextContent("描述你對未來的想法與期待");
  });

  it("renders horizon label", () => {
    render(
      <FutureIdea
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fi-horizon")).toHaveTextContent("一年後");
  });

  it("renders text input", () => {
    render(
      <FutureIdea
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fi-input")).toBeInTheDocument();
  });

  it("shows empty state message", () => {
    render(
      <FutureIdea
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fi-empty")).toBeInTheDocument();
  });

  it("shows count correctly", () => {
    const state: FutureIdeaState = {
      visions: [{ visionId: "v1", userId: "u2", userName: "Alice", text: "創業" }],
      revealed: false,
    };
    render(
      <FutureIdea
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fi-count")).toHaveTextContent("1");
  });

  it("shows submit button when user has not submitted", () => {
    render(
      <FutureIdea
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fi-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with text content", () => {
    const onSubmit = vi.fn();
    render(
      <FutureIdea
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={onSubmit}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("fi-input"), { target: { value: "環遊世界" } });
    fireEvent.click(screen.getByTestId("fi-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("環遊世界");
  });

  it("does not submit when input is empty", () => {
    const onSubmit = vi.fn();
    render(
      <FutureIdea
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={onSubmit}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("fi-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows my-vision after user submits", () => {
    const state: FutureIdeaState = {
      visions: [{ visionId: "v1", userId: "u1", userName: "Me", text: "環遊世界" }],
      revealed: false,
    };
    render(
      <FutureIdea
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fi-my-vision")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: FutureIdeaState = {
      visions: [{ visionId: "v1", userId: "u1", userName: "Me", text: "夢想" }],
      revealed: false,
    };
    render(
      <FutureIdea
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
        isTeamLead
      />,
    );
    expect(screen.getByTestId("fi-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when reveal clicked", () => {
    const onReveal = vi.fn();
    const state: FutureIdeaState = {
      visions: [{ visionId: "v1", userId: "u1", userName: "Me", text: "夢想" }],
      revealed: false,
    };
    render(
      <FutureIdea
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={onReveal}
        isTeamLead
      />,
    );
    fireEvent.click(screen.getByTestId("fi-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows results when revealed", () => {
    const state: FutureIdeaState = {
      visions: [{ visionId: "v1", userId: "u2", userName: "Alice", text: "環遊世界" }],
      revealed: true,
    };
    render(
      <FutureIdea
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fi-result")).toBeInTheDocument();
    expect(screen.getByTestId("fi-vision-v1")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: FutureIdeaState = {
      visions: [{ visionId: "v1", userId: "u1", userName: "Me", text: "夢想" }],
      revealed: false,
    };
    render(
      <FutureIdea
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("fi-reveal-btn")).toBeNull();
  });

  it("does not show submit after user submitted", () => {
    const state: FutureIdeaState = {
      visions: [{ visionId: "v1", userId: "u1", userName: "Me", text: "夢想" }],
      revealed: false,
    };
    render(
      <FutureIdea
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("fi-submit-btn")).toBeNull();
  });

  it("shows multiple visions when revealed", () => {
    const state: FutureIdeaState = {
      visions: [
        { visionId: "v1", userId: "u2", userName: "Alice", text: "創業" },
        { visionId: "v2", userId: "u3", userName: "Bob", text: "環遊世界" },
      ],
      revealed: true,
    };
    render(
      <FutureIdea
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("fi-vision-v1")).toBeInTheDocument();
    expect(screen.getByTestId("fi-vision-v2")).toBeInTheDocument();
  });
});
