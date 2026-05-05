import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AskMeAnything } from "../AskMeAnything";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "測試員", email: "test@example.com" },
  }),
}));

const mockUpdateState = vi.fn();
let mockState = { questions: [], upvotes: [] };

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: true,
  }),
}));

const baseProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
  isTeamLead: false,
};

beforeEach(() => {
  mockUpdateState.mockClear();
  mockState = { questions: [], upvotes: [] };
});

describe("AskMeAnything", () => {
  it("顯示標題", () => {
    render(<AskMeAnything {...baseProps} />);
    expect(screen.getByTestId("ama-title")).toBeInTheDocument();
  });

  it("顯示提問提示", () => {
    render(<AskMeAnything {...baseProps} />);
    expect(screen.getByTestId("ama-prompt")).toBeInTheDocument();
  });

  it("顯示問題數量", () => {
    render(<AskMeAnything {...baseProps} />);
    expect(screen.getByTestId("ama-count")).toHaveTextContent("0");
  });

  it("無問題時顯示 empty 提示", () => {
    render(<AskMeAnything {...baseProps} />);
    expect(screen.getByTestId("ama-empty")).toBeInTheDocument();
  });

  it("提交按鈕在空白時 disabled", () => {
    render(<AskMeAnything {...baseProps} />);
    expect(screen.getByTestId("ama-submit-btn")).toBeDisabled();
  });

  it("輸入後可以提問", () => {
    render(<AskMeAnything {...baseProps} />);
    fireEvent.change(screen.getByTestId("ama-input"), { target: { value: "為什麼天空是藍色的？" } });
    expect(screen.getByTestId("ama-submit-btn")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("ama-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.questions).toHaveLength(1);
    expect(call.questions[0].text).toBe("為什麼天空是藍色的？");
  });

  it("顯示已有問題", () => {
    mockState = {
      questions: [{ questionId: "q1", userId: "u2", userName: "玩家2", text: "這是一個問題" }],
      upvotes: [],
    };
    render(<AskMeAnything {...baseProps} />);
    expect(screen.getByTestId("ama-question-q1")).toBeInTheDocument();
    expect(screen.getByTestId("ama-vote-count-q1")).toHaveTextContent("0");
  });

  it("點擊讚投票", () => {
    mockState = {
      questions: [{ questionId: "q1", userId: "u2", userName: "玩家2", text: "這是一個問題" }],
      upvotes: [],
    };
    render(<AskMeAnything {...baseProps} />);
    fireEvent.click(screen.getByTestId("ama-upvote-q1"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.upvotes).toHaveLength(1);
    expect(call.upvotes[0].questionId).toBe("q1");
    expect(call.upvotes[0].userId).toBe("u1");
  });

  it("已投票再點一次取消", () => {
    mockState = {
      questions: [{ questionId: "q1", userId: "u2", userName: "玩家2", text: "這是一個問題" }],
      upvotes: [{ upvoteId: "u1-q1", userId: "u1", questionId: "q1" }],
    };
    render(<AskMeAnything {...baseProps} />);
    fireEvent.click(screen.getByTestId("ama-upvote-q1"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.upvotes).toHaveLength(0);
  });

  it("顯示正確的票數", () => {
    mockState = {
      questions: [{ questionId: "q1", userId: "u2", userName: "玩家2", text: "這是一個問題" }],
      upvotes: [
        { upvoteId: "u1-q1", userId: "u1", questionId: "q1" },
        { upvoteId: "u3-q1", userId: "u3", questionId: "q1" },
      ],
    };
    render(<AskMeAnything {...baseProps} />);
    expect(screen.getByTestId("ama-vote-count-q1")).toHaveTextContent("2");
  });

  it("按 Enter 可提問", () => {
    render(<AskMeAnything {...baseProps} />);
    fireEvent.change(screen.getByTestId("ama-input"), { target: { value: "用 Enter 提問" } });
    fireEvent.keyDown(screen.getByTestId("ama-input"), { key: "Enter" });
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
  });
});
