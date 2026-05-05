import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignalMap } from "../SignalMap";

const mockUpdateState = vi.fn();
let mockState = { votes: [], revealed: false };

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
    title: "Signal Check",
    prompt: "Are you ready?",
    greenLabel: "Ready",
    yellowLabel: "Almost",
    redLabel: "Not yet",
  },
  isTeamLead: false,
};

describe("SignalMap", () => {
  beforeEach(() => {
    mockUpdateState.mockClear();
    mockState = { votes: [], revealed: false };
  });

  it("renders title and prompt", () => {
    render(<SignalMap {...defaultProps} />);
    expect(screen.getByTestId("sig-title")).toHaveTextContent("Signal Check");
    expect(screen.getByTestId("sig-prompt")).toHaveTextContent("Are you ready?");
  });

  it("shows vote count", () => {
    render(<SignalMap {...defaultProps} />);
    expect(screen.getByTestId("sig-count")).toHaveTextContent("已回應：0 人");
  });

  it("shows three signal buttons", () => {
    render(<SignalMap {...defaultProps} />);
    expect(screen.getByTestId("sig-green-btn")).toBeTruthy();
    expect(screen.getByTestId("sig-yellow-btn")).toBeTruthy();
    expect(screen.getByTestId("sig-red-btn")).toBeTruthy();
  });

  it("submit button disabled without selection", () => {
    render(<SignalMap {...defaultProps} />);
    const btn = screen.getByTestId("sig-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("submits green vote", () => {
    render(<SignalMap {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sig-green-btn"));
    fireEvent.click(screen.getByTestId("sig-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        votes: expect.arrayContaining([
          expect.objectContaining({ userId: "u1", signal: "green" }),
        ]),
      }),
    );
  });

  it("submits with comment", () => {
    render(<SignalMap {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sig-yellow-btn"));
    fireEvent.change(screen.getByTestId("sig-comment-input"), { target: { value: "Need more info" } });
    fireEvent.click(screen.getByTestId("sig-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        votes: expect.arrayContaining([
          expect.objectContaining({ signal: "yellow", comment: "Need more info" }),
        ]),
      }),
    );
  });

  it("shows my-vote after submission", () => {
    mockState = {
      votes: [{ voteId: "v1", userId: "u1", userName: "Alice", signal: "green", comment: "" }],
      revealed: false,
    };
    render(<SignalMap {...defaultProps} />);
    expect(screen.getByTestId("sig-my-vote")).toBeTruthy();
  });

  it("hides reveal button for non-team-lead", () => {
    render(<SignalMap {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("sig-reveal-btn")).toBeNull();
  });

  it("shows reveal button for team lead", () => {
    render(<SignalMap {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("sig-reveal-btn")).toBeTruthy();
  });

  it("calls updateState with revealed=true on reveal", () => {
    render(<SignalMap {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("sig-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("shows result with signal counts", () => {
    mockState = {
      votes: [
        { voteId: "v1", userId: "u1", userName: "Alice", signal: "green", comment: "" },
        { voteId: "v2", userId: "u2", userName: "Bob", signal: "yellow", comment: "Not sure" },
        { voteId: "v3", userId: "u3", userName: "Carol", signal: "green", comment: "" },
      ],
      revealed: true,
    };
    render(<SignalMap {...defaultProps} />);
    expect(screen.getByTestId("sig-result")).toBeTruthy();
    expect(screen.getByTestId("sig-green-count")).toHaveTextContent("2");
    expect(screen.getByTestId("sig-yellow-count")).toHaveTextContent("1");
    expect(screen.getByTestId("sig-votes-green")).toBeTruthy();
    expect(screen.getByTestId("sig-votes-yellow")).toBeTruthy();
  });

  it("shows empty state when no votes revealed", () => {
    mockState = { votes: [], revealed: true };
    render(<SignalMap {...defaultProps} />);
    expect(screen.getByTestId("sig-empty")).toBeTruthy();
  });
});
