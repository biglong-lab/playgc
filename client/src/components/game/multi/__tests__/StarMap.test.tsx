import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StarMap } from "../StarMap";

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
    title: "Team Star Map",
    prompt: "Rate each dimension",
    dimensions: [
      { id: "comm", label: "Communication" },
      { id: "trust", label: "Trust" },
    ],
    max: 5,
  },
  isTeamLead: false,
};

describe("StarMap", () => {
  beforeEach(() => {
    mockUpdateState.mockClear();
    mockState = { entries: [], revealed: false };
  });

  it("renders title and prompt", () => {
    render(<StarMap {...defaultProps} />);
    expect(screen.getByTestId("sm-title")).toHaveTextContent("Team Star Map");
    expect(screen.getByTestId("sm-prompt")).toHaveTextContent("Rate each dimension");
  });

  it("shows entry count", () => {
    render(<StarMap {...defaultProps} />);
    expect(screen.getByTestId("sm-count")).toHaveTextContent("已評分：0 人");
  });

  it("renders sliders for each dimension", () => {
    render(<StarMap {...defaultProps} />);
    expect(screen.getByTestId("sm-dim-comm")).toBeTruthy();
    expect(screen.getByTestId("sm-dim-trust")).toBeTruthy();
    expect(screen.getByTestId("sm-slider-comm")).toBeTruthy();
    expect(screen.getByTestId("sm-slider-trust")).toBeTruthy();
  });

  it("submits entry on button click", () => {
    render(<StarMap {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({ userId: "u1", userName: "Alice" }),
        ]),
      }),
    );
  });

  it("shows my-entry after submission", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", scores: { comm: 4, trust: 3 } }],
      revealed: false,
    };
    render(<StarMap {...defaultProps} />);
    expect(screen.getByTestId("sm-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("sm-form")).toBeNull();
  });

  it("hides reveal button for non-team-lead", () => {
    render(<StarMap {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("sm-reveal-btn")).toBeNull();
  });

  it("shows reveal button for team lead", () => {
    render(<StarMap {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("sm-reveal-btn")).toBeTruthy();
  });

  it("calls updateState with revealed=true on reveal", () => {
    render(<StarMap {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("sm-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("shows result bars when revealed", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", scores: { comm: 4, trust: 3 } }],
      revealed: true,
    };
    render(<StarMap {...defaultProps} />);
    expect(screen.getByTestId("sm-result")).toBeTruthy();
    expect(screen.getByTestId("sm-avg-comm")).toBeTruthy();
    expect(screen.getByTestId("sm-avg-trust")).toBeTruthy();
    expect(screen.getByTestId("sm-bar-comm")).toBeTruthy();
  });

  it("shows empty state when no entries revealed", () => {
    mockState = { entries: [], revealed: true };
    render(<StarMap {...defaultProps} />);
    expect(screen.getByTestId("sm-empty")).toBeTruthy();
  });
});
