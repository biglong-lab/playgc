import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TwoByTwo } from "../TwoByTwo";

const mockUpdateState = vi.fn();
let mockState = { placements: [], revealed: false };

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
    title: "Priority Matrix",
    prompt: "Place your idea",
    xLowLabel: "Hard",
    xHighLabel: "Easy",
    yLowLabel: "Low Impact",
    yHighLabel: "High Impact",
    itemLabel: "Your idea",
  },
  isTeamLead: false,
};

describe("TwoByTwo", () => {
  beforeEach(() => {
    mockUpdateState.mockClear();
    mockState = { placements: [], revealed: false };
  });

  it("renders title and prompt", () => {
    render(<TwoByTwo {...defaultProps} />);
    expect(screen.getByTestId("tb2-title")).toHaveTextContent("Priority Matrix");
    expect(screen.getByTestId("tb2-prompt")).toHaveTextContent("Place your idea");
  });

  it("shows placement count", () => {
    render(<TwoByTwo {...defaultProps} />);
    expect(screen.getByTestId("tb2-count")).toHaveTextContent("已放置：0 個");
  });

  it("shows label input and grid", () => {
    render(<TwoByTwo {...defaultProps} />);
    expect(screen.getByTestId("tb2-label-input")).toBeTruthy();
    expect(screen.getByTestId("tb2-grid")).toBeTruthy();
  });

  it("submit button disabled without label and position", () => {
    render(<TwoByTwo {...defaultProps} />);
    const btn = screen.getByTestId("tb2-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("does not show reveal button for non-team-lead", () => {
    render(<TwoByTwo {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("tb2-reveal-btn")).toBeNull();
  });

  it("shows reveal button for team lead", () => {
    render(<TwoByTwo {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("tb2-reveal-btn")).toBeTruthy();
  });

  it("reveals result when state.revealed is true", () => {
    mockState = { placements: [], revealed: true };
    render(<TwoByTwo {...defaultProps} />);
    expect(screen.getByTestId("tb2-result")).toBeTruthy();
    expect(screen.getByTestId("tb2-empty")).toHaveTextContent("尚無放置");
  });

  it("shows my placements list", () => {
    mockState = {
      placements: [
        { placementId: "p1", userId: "u1", userName: "Alice", label: "Idea A", x: 50, y: 80 },
      ],
      revealed: false,
    };
    render(<TwoByTwo {...defaultProps} />);
    expect(screen.getByTestId("tb2-my-placements")).toBeTruthy();
    expect(screen.getByTestId("tb2-my-p1")).toBeTruthy();
  });

  it("shows dots in revealed state", () => {
    mockState = {
      placements: [
        { placementId: "d1", userId: "u2", userName: "Bob", label: "Plan B", x: 70, y: 30 },
      ],
      revealed: true,
    };
    render(<TwoByTwo {...defaultProps} />);
    expect(screen.getByTestId("tb2-dot-d1")).toBeTruthy();
  });

  it("calls updateState with revealed=true on reveal click", () => {
    render(<TwoByTwo {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("tb2-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });
});
