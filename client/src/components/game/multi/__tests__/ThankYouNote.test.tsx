import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ThankYouNote, ThankYouNoteConfig, ThankYouNoteState } from "../ThankYouNote";

const defaultConfig: ThankYouNoteConfig = {
  title: "💌 感謝便條",
  prompt: "寫一張感謝便條給你想感謝的人",
  recipientLabel: "感謝誰",
  messageLabel: "感謝的話",
  maxLength: 150,
  anonymous: false,
};

const emptyState: ThankYouNoteState = { notes: [], revealed: false };

describe("ThankYouNote", () => {
  it("renders title and prompt", () => {
    render(
      <ThankYouNote config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("tyn-title")).toHaveTextContent("💌 感謝便條");
    expect(screen.getByTestId("tyn-prompt")).toHaveTextContent("寫一張感謝便條給你想感謝的人");
  });

  it("renders recipient and message inputs", () => {
    render(
      <ThankYouNote config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("tyn-recipient-input")).toBeInTheDocument();
    expect(screen.getByTestId("tyn-message-input")).toBeInTheDocument();
  });

  it("shows empty indicator when no notes", () => {
    render(
      <ThankYouNote config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("tyn-empty")).toBeInTheDocument();
  });

  it("shows count", () => {
    const state: ThankYouNoteState = {
      notes: [{ noteId: "n1", fromUserId: "u2", fromUserName: "Alice", recipient: "Bob", message: "謝謝你" }],
      revealed: false,
    };
    render(
      <ThankYouNote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("tyn-count")).toHaveTextContent("1");
  });

  it("shows submit button when user has not submitted", () => {
    render(
      <ThankYouNote config={defaultConfig} state={emptyState} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("tyn-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with recipient and message", () => {
    const onSubmit = vi.fn();
    render(
      <ThankYouNote config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("tyn-recipient-input"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByTestId("tyn-message-input"), { target: { value: "謝謝你的幫助！" } });
    fireEvent.click(screen.getByTestId("tyn-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("Alice", "謝謝你的幫助！");
  });

  it("does not submit when recipient is empty", () => {
    const onSubmit = vi.fn();
    render(
      <ThankYouNote config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("tyn-message-input"), { target: { value: "謝謝你" } });
    fireEvent.click(screen.getByTestId("tyn-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit when message is empty", () => {
    const onSubmit = vi.fn();
    render(
      <ThankYouNote config={defaultConfig} state={emptyState} userId="u1" onSubmit={onSubmit} onReveal={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("tyn-recipient-input"), { target: { value: "Alice" } });
    fireEvent.click(screen.getByTestId("tyn-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows my-note when user has submitted", () => {
    const state: ThankYouNoteState = {
      notes: [{ noteId: "n1", fromUserId: "u1", fromUserName: "Me", recipient: "Alice", message: "謝謝！" }],
      revealed: false,
    };
    render(
      <ThankYouNote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("tyn-my-note")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: ThankYouNoteState = {
      notes: [{ noteId: "n1", fromUserId: "u1", fromUserName: "Me", recipient: "Alice", message: "謝謝！" }],
      revealed: false,
    };
    render(
      <ThankYouNote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} isTeamLead />,
    );
    expect(screen.getByTestId("tyn-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when reveal clicked", () => {
    const onReveal = vi.fn();
    const state: ThankYouNoteState = {
      notes: [{ noteId: "n1", fromUserId: "u1", fromUserName: "Me", recipient: "Alice", message: "謝謝！" }],
      revealed: false,
    };
    render(
      <ThankYouNote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={onReveal} isTeamLead />,
    );
    fireEvent.click(screen.getByTestId("tyn-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows notes grouped by recipient when revealed", () => {
    const state: ThankYouNoteState = {
      notes: [
        { noteId: "n1", fromUserId: "u2", fromUserName: "Alice", recipient: "Bob", message: "謝謝你！" },
        { noteId: "n2", fromUserId: "u3", fromUserName: "Carol", recipient: "Bob", message: "你很棒！" },
      ],
      revealed: true,
    };
    render(
      <ThankYouNote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("tyn-result")).toBeInTheDocument();
    expect(screen.getByTestId("tyn-recipient-Bob")).toBeInTheDocument();
    expect(screen.getByTestId("tyn-note-n1")).toBeInTheDocument();
    expect(screen.getByTestId("tyn-note-n2")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: ThankYouNoteState = {
      notes: [{ noteId: "n1", fromUserId: "u1", fromUserName: "Me", recipient: "Alice", message: "謝謝！" }],
      revealed: false,
    };
    render(
      <ThankYouNote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("tyn-reveal-btn")).toBeNull();
  });

  it("does not show submit after user submitted", () => {
    const state: ThankYouNoteState = {
      notes: [{ noteId: "n1", fromUserId: "u1", fromUserName: "Me", recipient: "Alice", message: "謝謝！" }],
      revealed: false,
    };
    render(
      <ThankYouNote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.queryByTestId("tyn-submit-btn")).toBeNull();
  });

  it("shows multiple recipients when revealed", () => {
    const state: ThankYouNoteState = {
      notes: [
        { noteId: "n1", fromUserId: "u2", fromUserName: "Alice", recipient: "Bob", message: "謝謝你" },
        { noteId: "n2", fromUserId: "u3", fromUserName: "Carol", recipient: "Dave", message: "你好棒" },
      ],
      revealed: true,
    };
    render(
      <ThankYouNote config={defaultConfig} state={state} userId="u1" onSubmit={vi.fn()} onReveal={vi.fn()} />,
    );
    expect(screen.getByTestId("tyn-recipient-Bob")).toBeInTheDocument();
    expect(screen.getByTestId("tyn-recipient-Dave")).toBeInTheDocument();
  });
});
