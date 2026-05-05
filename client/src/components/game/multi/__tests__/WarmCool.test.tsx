import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WarmCool } from "../WarmCool";

const mockUpdateState = vi.fn();
let mockState = { entries: [], revealed: false };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: true,
  }),
}));

const defaultProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
  config: {
    title: "Warm / Cool Feedback",
    target: "This workshop",
    warmPrompt: "What went well?",
    coolPrompt: "What could improve?",
    maxLength: 100,
  },
  isTeamLead: false,
};

describe("WarmCool", () => {
  beforeEach(() => {
    mockUpdateState.mockClear();
    mockState = { entries: [], revealed: false };
  });

  it("renders title and count", () => {
    render(<WarmCool {...defaultProps} />);
    expect(screen.getByTestId("wc-title")).toHaveTextContent("Warm / Cool Feedback");
    expect(screen.getByTestId("wc-count")).toHaveTextContent("已回饋：0 人");
  });

  it("shows warm and cool inputs", () => {
    render(<WarmCool {...defaultProps} />);
    expect(screen.getByTestId("wc-warm-input")).toBeTruthy();
    expect(screen.getByTestId("wc-cool-input")).toBeTruthy();
  });

  it("submit disabled without both inputs", () => {
    render(<WarmCool {...defaultProps} />);
    const btn = screen.getByTestId("wc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("wc-warm-input"), { target: { value: "Great!" } });
    expect((screen.getByTestId("wc-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables submit when both inputs filled", () => {
    render(<WarmCool {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wc-warm-input"), { target: { value: "Great!" } });
    fireEvent.change(screen.getByTestId("wc-cool-input"), { target: { value: "Could be better" } });
    expect((screen.getByTestId("wc-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("submits entry on click", () => {
    render(<WarmCool {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wc-warm-input"), { target: { value: "Excellent!" } });
    fireEvent.change(screen.getByTestId("wc-cool-input"), { target: { value: "More breaks" } });
    fireEvent.click(screen.getByTestId("wc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({ userId: "u1", warm: "Excellent!", cool: "More breaks" }),
        ]),
      }),
    );
  });

  it("shows my-entry after submission", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", warm: "Good", cool: "Improve" }],
      revealed: false,
    };
    render(<WarmCool {...defaultProps} />);
    expect(screen.getByTestId("wc-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("wc-warm-input")).toBeNull();
  });

  it("hides reveal button for non-team-lead", () => {
    render(<WarmCool {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("wc-reveal-btn")).toBeNull();
  });

  it("shows reveal button for team lead", () => {
    render(<WarmCool {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("wc-reveal-btn")).toBeTruthy();
  });

  it("calls updateState with revealed=true on reveal", () => {
    render(<WarmCool {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("wc-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("shows all entries in result", () => {
    mockState = {
      entries: [
        { entryId: "e1", userId: "u1", userName: "Alice", warm: "Great", cool: "Less meetings" },
        { entryId: "e2", userId: "u2", userName: "Bob", warm: "Fun", cool: "More breaks" },
      ],
      revealed: true,
    };
    render(<WarmCool {...defaultProps} />);
    expect(screen.getByTestId("wc-result")).toBeTruthy();
    expect(screen.getByTestId("wc-entry-e1")).toBeTruthy();
    expect(screen.getByTestId("wc-entry-e2")).toBeTruthy();
  });

  it("shows empty when no entries revealed", () => {
    mockState = { entries: [], revealed: true };
    render(<WarmCool {...defaultProps} />);
    expect(screen.getByTestId("wc-empty")).toBeTruthy();
  });
});
