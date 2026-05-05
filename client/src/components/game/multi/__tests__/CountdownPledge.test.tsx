import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CountdownPledge } from "../CountdownPledge";

const mockUpdateState = vi.fn();
let mockState = { pledges: [], startedAt: null, completions: [] };

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
    title: "Countdown Challenge",
    challengeText: "Complete in 5 minutes!",
    durationMinutes: 5,
    pledgePrompt: "I commit to...",
  },
  isTeamLead: false,
};

describe("CountdownPledge", () => {
  beforeEach(() => {
    mockUpdateState.mockClear();
    mockState = { pledges: [], startedAt: null, completions: [] };
  });

  it("renders title and challenge text", () => {
    render(<CountdownPledge {...defaultProps} />);
    expect(screen.getByTestId("cp-title")).toHaveTextContent("Countdown Challenge");
    expect(screen.getByTestId("cp-challenge")).toHaveTextContent("Complete in 5 minutes!");
  });

  it("shows pledge input when no pledge and not started", () => {
    render(<CountdownPledge {...defaultProps} />);
    expect(screen.getByTestId("cp-input")).toBeTruthy();
    expect(screen.getByTestId("cp-pledge-btn")).toBeTruthy();
  });

  it("pledge button disabled without text", () => {
    render(<CountdownPledge {...defaultProps} />);
    const btn = screen.getByTestId("cp-pledge-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("submits pledge on click", () => {
    render(<CountdownPledge {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cp-input"), { target: { value: "I will finish" } });
    fireEvent.click(screen.getByTestId("cp-pledge-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        pledges: expect.arrayContaining([
          expect.objectContaining({ userId: "u1", commitment: "I will finish" }),
        ]),
      }),
    );
  });

  it("shows my pledge after submission", () => {
    mockState = {
      pledges: [{ pledgeId: "p1", userId: "u1", userName: "Alice", commitment: "My pledge" }],
      startedAt: null,
      completions: [],
    };
    render(<CountdownPledge {...defaultProps} />);
    expect(screen.getByTestId("cp-my-pledge")).toHaveTextContent("My pledge");
  });

  it("does not show start button for non-team-lead", () => {
    render(<CountdownPledge {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("cp-start-btn")).toBeNull();
  });

  it("shows start button for team lead when not started", () => {
    render(<CountdownPledge {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("cp-start-btn")).toBeTruthy();
  });

  it("calls updateState with startedAt on start", () => {
    render(<CountdownPledge {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("cp-start-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: expect.any(Number) }),
    );
  });

  it("shows timer section when running", () => {
    mockState = { pledges: [], startedAt: Date.now() - 30000, completions: [] };
    render(<CountdownPledge {...defaultProps} />);
    expect(screen.getByTestId("cp-timer-section")).toBeTruthy();
    expect(screen.getByTestId("cp-timer")).toBeTruthy();
  });

  it("shows done button when running and no completion yet", () => {
    mockState = { pledges: [], startedAt: Date.now() - 10000, completions: [] };
    render(<CountdownPledge {...defaultProps} />);
    expect(screen.getByTestId("cp-done-btn")).toBeTruthy();
  });

  it("calls updateState with completion on done click", () => {
    mockState = { pledges: [], startedAt: Date.now() - 10000, completions: [] };
    render(<CountdownPledge {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cp-done-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        completions: expect.arrayContaining([
          expect.objectContaining({ userId: "u1" }),
        ]),
      }),
    );
  });

  it("shows completions list", () => {
    mockState = {
      pledges: [],
      startedAt: Date.now() - 10000,
      completions: [{ compId: "c1", userId: "u1", userName: "Alice", completedAt: Date.now() }],
    };
    render(<CountdownPledge {...defaultProps} />);
    expect(screen.getByTestId("cp-completions")).toBeTruthy();
    expect(screen.getByTestId("cp-comp-c1")).toBeTruthy();
  });

  it("shows pledge count", () => {
    render(<CountdownPledge {...defaultProps} />);
    expect(screen.getByTestId("cp-pledge-count")).toHaveTextContent("承諾數：0");
  });
});
