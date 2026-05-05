import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeamTimeCapsule } from "../TeamTimeCapsule";

const mockUpdateState = vi.fn();
let mockState = { messages: [], opened: false };

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
    title: "Time Capsule",
    prompt: "Write for the future",
    openingDate: "2027-01-01",
  },
  isTeamLead: false,
};

describe("TeamTimeCapsule", () => {
  beforeEach(() => {
    mockUpdateState.mockClear();
    mockState = { messages: [], opened: false };
  });

  it("renders title, prompt and opening date", () => {
    render(<TeamTimeCapsule {...defaultProps} />);
    expect(screen.getByTestId("ttc-title")).toHaveTextContent("Time Capsule");
    expect(screen.getByTestId("ttc-prompt")).toHaveTextContent("Write for the future");
    expect(screen.getByTestId("ttc-opening-date")).toHaveTextContent("2027-01-01");
  });

  it("shows message count", () => {
    render(<TeamTimeCapsule {...defaultProps} />);
    expect(screen.getByTestId("ttc-count")).toHaveTextContent("已投入 0 封信");
  });

  it("shows input textarea", () => {
    render(<TeamTimeCapsule {...defaultProps} />);
    expect(screen.getByTestId("ttc-input")).toBeTruthy();
  });

  it("submit button disabled without text", () => {
    render(<TeamTimeCapsule {...defaultProps} />);
    const btn = screen.getByTestId("ttc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("submits message and updates state", () => {
    render(<TeamTimeCapsule {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ttc-input"), { target: { value: "Hello future!" } });
    fireEvent.click(screen.getByTestId("ttc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ userId: "u1", text: "Hello future!" }),
        ]),
      }),
    );
  });

  it("shows my-message after submission", () => {
    mockState = {
      messages: [{ msgId: "m1", userId: "u1", userName: "Alice", text: "Future note" }],
      opened: false,
    };
    render(<TeamTimeCapsule {...defaultProps} />);
    expect(screen.getByTestId("ttc-my-message")).toBeTruthy();
    expect(screen.queryByTestId("ttc-input")).toBeNull();
  });

  it("hides open button for non-team-lead", () => {
    render(<TeamTimeCapsule {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ttc-open-btn")).toBeNull();
  });

  it("shows open button for team lead", () => {
    render(<TeamTimeCapsule {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("ttc-open-btn")).toBeTruthy();
  });

  it("calls updateState with opened=true on open click", () => {
    render(<TeamTimeCapsule {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("ttc-open-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ opened: true }));
  });

  it("shows result when opened with messages", () => {
    mockState = {
      messages: [
        { msgId: "m1", userId: "u1", userName: "Alice", text: "See you in the future!" },
        { msgId: "m2", userId: "u2", userName: "Bob", text: "Keep going!" },
      ],
      opened: true,
    };
    render(<TeamTimeCapsule {...defaultProps} />);
    expect(screen.getByTestId("ttc-result")).toBeTruthy();
    expect(screen.getByTestId("ttc-msg-m1")).toBeTruthy();
    expect(screen.getByTestId("ttc-msg-m2")).toBeTruthy();
  });

  it("shows empty state when opened with no messages", () => {
    mockState = { messages: [], opened: true };
    render(<TeamTimeCapsule {...defaultProps} />);
    expect(screen.getByTestId("ttc-empty")).toBeTruthy();
  });
});
