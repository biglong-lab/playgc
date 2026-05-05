import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlashCard } from "../FlashCard";

const mockUpdateState = vi.fn();
let mockState = { currentCardIndex: 0, answers: [], revealed: false };

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
    title: "Flash Quiz",
    cards: [
      { cardId: "c1", front: "What is TDD?", back: "Test-Driven Development" },
      { cardId: "c2", front: "What is CI?", back: "Continuous Integration" },
    ],
  },
  isTeamLead: false,
};

describe("FlashCard", () => {
  beforeEach(() => {
    mockUpdateState.mockClear();
    mockState = { currentCardIndex: 0, answers: [], revealed: false };
  });

  it("renders title and progress", () => {
    render(<FlashCard {...defaultProps} />);
    expect(screen.getByTestId("fc-title")).toHaveTextContent("Flash Quiz");
    expect(screen.getByTestId("fc-progress")).toHaveTextContent("1 / 2");
  });

  it("shows card front", () => {
    render(<FlashCard {...defaultProps} />);
    expect(screen.getByTestId("fc-front")).toHaveTextContent("What is TDD?");
  });

  it("shows answer input for players", () => {
    render(<FlashCard {...defaultProps} />);
    expect(screen.getByTestId("fc-answer-input")).toBeTruthy();
    expect(screen.getByTestId("fc-submit-btn")).toBeTruthy();
  });

  it("submit button disabled without answer text", () => {
    render(<FlashCard {...defaultProps} />);
    const btn = screen.getByTestId("fc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("submits answer on click", () => {
    render(<FlashCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("fc-answer-input"), { target: { value: "TDD means..." } });
    fireEvent.click(screen.getByTestId("fc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.arrayContaining([
          expect.objectContaining({ userId: "u1", cardId: "c1", answer: "TDD means..." }),
        ]),
      }),
    );
  });

  it("hides reveal button for non-team-lead", () => {
    render(<FlashCard {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("fc-reveal-btn")).toBeNull();
  });

  it("shows reveal button for team lead", () => {
    render(<FlashCard {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("fc-reveal-btn")).toBeTruthy();
  });

  it("shows card back when revealed", () => {
    mockState = { currentCardIndex: 0, answers: [], revealed: true };
    render(<FlashCard {...defaultProps} />);
    expect(screen.getByTestId("fc-back")).toHaveTextContent("Test-Driven Development");
  });

  it("shows self-score buttons when revealed and has answer", () => {
    mockState = {
      currentCardIndex: 0,
      answers: [{ answerId: "a1", userId: "u1", userName: "Alice", cardId: "c1", answer: "TDD", selfScore: null }],
      revealed: true,
    };
    render(<FlashCard {...defaultProps} />);
    expect(screen.getByTestId("fc-self-score")).toBeTruthy();
    expect(screen.getByTestId("fc-score-correct")).toBeTruthy();
    expect(screen.getByTestId("fc-score-wrong")).toBeTruthy();
  });

  it("calls updateState with selfScore=1 on correct click", () => {
    mockState = {
      currentCardIndex: 0,
      answers: [{ answerId: "a1", userId: "u1", userName: "Alice", cardId: "c1", answer: "TDD", selfScore: null }],
      revealed: true,
    };
    render(<FlashCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fc-score-correct"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        answers: expect.arrayContaining([
          expect.objectContaining({ answerId: "a1", selfScore: 1 }),
        ]),
      }),
    );
  });

  it("shows next button for team lead on revealed card", () => {
    mockState = { currentCardIndex: 0, answers: [], revealed: true };
    render(<FlashCard {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("fc-next-btn")).toBeTruthy();
  });

  it("shows finish button on last card", () => {
    mockState = { currentCardIndex: 1, answers: [], revealed: true };
    render(<FlashCard {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("fc-finish-btn")).toBeTruthy();
  });

  it("shows result screen when finished", () => {
    mockState = { currentCardIndex: 2, answers: [], revealed: false };
    render(<FlashCard {...defaultProps} />);
    expect(screen.getByTestId("fc-result")).toBeTruthy();
    expect(screen.getByTestId("fc-my-score")).toBeTruthy();
  });

  it("shows answer count", () => {
    render(<FlashCard {...defaultProps} />);
    expect(screen.getByTestId("fc-answer-count")).toHaveTextContent("作答數：0");
  });
});
