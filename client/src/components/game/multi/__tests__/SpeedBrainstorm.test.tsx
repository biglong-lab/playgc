import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpeedBrainstorm } from "../SpeedBrainstorm";

const mockUpdateState = vi.fn();
let mockState = { ideas: [], startedAt: null, revealed: false };

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
    title: "Speed Brainstorm",
    prompt: "What ideas do you have?",
    timerSeconds: 60,
    maxIdeas: 3,
    maxLength: 40,
  },
  isTeamLead: false,
};

describe("SpeedBrainstorm", () => {
  beforeEach(() => {
    mockUpdateState.mockClear();
    mockState = { ideas: [], startedAt: null, revealed: false };
  });

  it("renders title and prompt", () => {
    render(<SpeedBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("sb-title")).toHaveTextContent("Speed Brainstorm");
    expect(screen.getByTestId("sb-prompt")).toHaveTextContent("What ideas do you have?");
  });

  it("shows idea count", () => {
    render(<SpeedBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("sb-count")).toHaveTextContent("共 0 個想法");
  });

  it("hides start button for non-team-lead", () => {
    render(<SpeedBrainstorm {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("sb-start-btn")).toBeNull();
  });

  it("shows start button for team lead when not started", () => {
    render(<SpeedBrainstorm {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("sb-start-btn")).toBeTruthy();
  });

  it("calls updateState with startedAt on start", () => {
    render(<SpeedBrainstorm {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("sb-start-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: expect.any(Number) }),
    );
  });

  it("shows input when timer is running", () => {
    mockState = { ideas: [], startedAt: Date.now() - 5000, revealed: false };
    render(<SpeedBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("sb-input")).toBeTruthy();
    expect(screen.getByTestId("sb-add-btn")).toBeTruthy();
    expect(screen.getByTestId("sb-timer")).toBeTruthy();
  });

  it("add button disabled without input", () => {
    mockState = { ideas: [], startedAt: Date.now() - 5000, revealed: false };
    render(<SpeedBrainstorm {...defaultProps} />);
    const btn = screen.getByTestId("sb-add-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("submits idea and updates state", () => {
    mockState = { ideas: [], startedAt: Date.now() - 5000, revealed: false };
    render(<SpeedBrainstorm {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sb-input"), { target: { value: "New idea!" } });
    fireEvent.click(screen.getByTestId("sb-add-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        ideas: expect.arrayContaining([
          expect.objectContaining({ userId: "u1", text: "New idea!" }),
        ]),
      }),
    );
  });

  it("shows reveal button for team lead when started", () => {
    mockState = { ideas: [], startedAt: Date.now() - 5000, revealed: false };
    render(<SpeedBrainstorm {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("sb-reveal-btn")).toBeTruthy();
  });

  it("calls updateState with revealed=true on reveal", () => {
    mockState = { ideas: [], startedAt: Date.now() - 5000, revealed: false };
    render(<SpeedBrainstorm {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("sb-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("shows ideas wall when revealed", () => {
    mockState = {
      ideas: [{ ideaId: "i1", userId: "u2", userName: "Bob", text: "Great idea" }],
      startedAt: Date.now() - 70000,
      revealed: true,
    };
    render(<SpeedBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("sb-result")).toBeTruthy();
    expect(screen.getByTestId("sb-idea-i1")).toBeTruthy();
  });

  it("shows empty state in result when no ideas", () => {
    mockState = { ideas: [], startedAt: Date.now() - 70000, revealed: true };
    render(<SpeedBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("sb-empty")).toBeTruthy();
  });
});
