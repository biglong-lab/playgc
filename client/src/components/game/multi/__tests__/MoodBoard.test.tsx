import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MoodBoard, MoodBoardConfig, MoodBoardState } from "../MoodBoard";

const defaultConfig: MoodBoardConfig = {
  title: "🎨 情緒看板",
  prompt: "選一個 emoji 代表你的心情",
  emojiPool: ["😊", "😌", "🤔", "🔥"],
  notePlaceholder: "說說為什麼...",
  maxLength: 60,
};

const emptyState: MoodBoardState = { entries: [], revealed: false };

describe("MoodBoard", () => {
  it("renders title and prompt", () => {
    render(
      <MoodBoard config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("mb-title")).toHaveTextContent("🎨 情緒看板");
    expect(screen.getByTestId("mb-prompt")).toHaveTextContent("選一個 emoji");
  });

  it("renders all emoji buttons from pool", () => {
    render(
      <MoodBoard config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("mb-emoji-btn-😊")).toBeInTheDocument();
    expect(screen.getByTestId("mb-emoji-btn-😌")).toBeInTheDocument();
    expect(screen.getByTestId("mb-emoji-btn-🤔")).toBeInTheDocument();
    expect(screen.getByTestId("mb-emoji-btn-🔥")).toBeInTheDocument();
  });

  it("shows empty indicator when no entries", () => {
    render(
      <MoodBoard config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("mb-empty")).toBeInTheDocument();
  });

  it("shows count", () => {
    const state: MoodBoardState = {
      entries: [{ boardId: "b1", userId: "u2", userName: "Alice", emoji: "😊", note: "開心" }],
      revealed: false,
    };
    render(
      <MoodBoard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("mb-count")).toHaveTextContent("1");
  });

  it("renders note input", () => {
    render(
      <MoodBoard config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("mb-note-input")).toBeInTheDocument();
  });

  it("shows submit button when user has not submitted", () => {
    render(
      <MoodBoard config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("mb-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with emoji and note", () => {
    const onSubmit = vi.fn();
    render(
      <MoodBoard config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("mb-emoji-btn-😊"));
    fireEvent.change(screen.getByTestId("mb-note-input"), { target: { value: "今天很順利" } });
    fireEvent.click(screen.getByTestId("mb-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("😊", "今天很順利");
  });

  it("does not submit when no emoji selected", () => {
    const onSubmit = vi.fn();
    render(
      <MoodBoard config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("mb-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with empty note if none provided", () => {
    const onSubmit = vi.fn();
    render(
      <MoodBoard config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("mb-emoji-btn-🔥"));
    fireEvent.click(screen.getByTestId("mb-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("🔥", "");
  });

  it("shows my-entry when user has submitted", () => {
    const state: MoodBoardState = {
      entries: [{ boardId: "b1", userId: "u1", userName: "Me", emoji: "😊", note: "開心" }],
      revealed: false,
    };
    render(
      <MoodBoard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("mb-my-entry")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: MoodBoardState = {
      entries: [{ boardId: "b1", userId: "u1", userName: "Me", emoji: "😊", note: "" }],
      revealed: false,
    };
    render(
      <MoodBoard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} isTeamLead />,
    );
    expect(screen.getByTestId("mb-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when reveal clicked", () => {
    const onReveal = vi.fn();
    const state: MoodBoardState = {
      entries: [{ boardId: "b1", userId: "u1", userName: "Me", emoji: "😊", note: "" }],
      revealed: false,
    };
    render(
      <MoodBoard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={onReveal} isTeamLead />,
    );
    fireEvent.click(screen.getByTestId("mb-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows result and entries when revealed", () => {
    const state: MoodBoardState = {
      entries: [
        { boardId: "b1", userId: "u2", userName: "Alice", emoji: "😊", note: "很好" },
        { boardId: "b2", userId: "u3", userName: "Bob", emoji: "🔥", note: "亢奮" },
      ],
      revealed: true,
    };
    render(
      <MoodBoard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("mb-result")).toBeInTheDocument();
    expect(screen.getByTestId("mb-entry-b1")).toBeInTheDocument();
    expect(screen.getByTestId("mb-entry-b2")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: MoodBoardState = {
      entries: [{ boardId: "b1", userId: "u1", userName: "Me", emoji: "😊", note: "" }],
      revealed: false,
    };
    render(
      <MoodBoard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("mb-reveal-btn")).toBeNull();
  });

  it("does not show submit after user submitted", () => {
    const state: MoodBoardState = {
      entries: [{ boardId: "b1", userId: "u1", userName: "Me", emoji: "😊", note: "" }],
      revealed: false,
    };
    render(
      <MoodBoard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("mb-submit-btn")).toBeNull();
  });

  it("shows emoji count summary when revealed", () => {
    const state: MoodBoardState = {
      entries: [
        { boardId: "b1", userId: "u2", userName: "Alice", emoji: "😊", note: "" },
        { boardId: "b2", userId: "u3", userName: "Bob", emoji: "😊", note: "" },
      ],
      revealed: true,
    };
    render(
      <MoodBoard config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("mb-emoji-😊")).toBeInTheDocument();
  });
});
