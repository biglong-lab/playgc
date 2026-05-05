import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamGoal } from "../TeamGoal";

let mockState: Record<string, unknown> = {};
const mockUpdateState = vi.fn((s: unknown) => { mockState = s as Record<string, unknown>; });
let mockIsLoaded = true;

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
  config: { title: "團隊目標", prompt: "你認為最重要的目標是什麼？" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
});

describe("TeamGoal", () => {
  it("顯示標題和提示", () => {
    render(<TeamGoal {...defaultProps} />);
    expect(screen.getByTestId("tg-title")).toHaveTextContent("團隊目標");
    expect(screen.getByTestId("tg-prompt")).toHaveTextContent("你認為最重要的目標是什麼？");
  });

  it("顯示已提交人數（初始 0）", () => {
    render(<TeamGoal {...defaultProps} />);
    expect(screen.getByTestId("tg-count")).toHaveTextContent("0");
  });

  it("顯示輸入欄位", () => {
    render(<TeamGoal {...defaultProps} />);
    expect(screen.getByTestId("tg-input")).toBeInTheDocument();
  });

  it("空輸入時提交按鈕 disabled", () => {
    render(<TeamGoal {...defaultProps} />);
    expect(screen.getByTestId("tg-submit-btn")).toBeDisabled();
  });

  it("填入目標後按鈕 enabled", () => {
    render(<TeamGoal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tg-input"), { target: { value: "提升產品品質" } });
    expect(screen.getByTestId("tg-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState 帶入正確 goal", () => {
    render(<TeamGoal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tg-input"), { target: { value: "達成 OKR" } });
    fireEvent.click(screen.getByTestId("tg-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const called = mockUpdateState.mock.calls[0][0] as { entries: { goal: string }[] };
    expect(called.entries[0].goal).toBe("達成 OKR");
  });

  it("已提交後顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", goal: "Q3 目標" }],
      revealed: false,
    };
    render(<TeamGoal {...defaultProps} />);
    expect(screen.getByTestId("tg-my-entry")).toBeInTheDocument();
    expect(screen.getByTestId("tg-my-entry")).toHaveTextContent("Q3 目標");
  });

  it("已提交後隱藏輸入欄", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", goal: "Q3 目標" }],
      revealed: false,
    };
    render(<TeamGoal {...defaultProps} />);
    expect(screen.queryByTestId("tg-input")).not.toBeInTheDocument();
  });

  it("isTeamLead 顯示展示按鈕", () => {
    render(<TeamGoal {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("tg-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長不顯示展示按鈕", () => {
    render(<TeamGoal {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("tg-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊展示呼叫 updateState revealed=true", () => {
    render(<TeamGoal {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("tg-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示 tg-result 及每筆 entry", () => {
    mockState = {
      entries: [
        { entryId: "e1", userId: "u1", userName: "Alice", goal: "目標 A" },
        { entryId: "e2", userId: "u2", userName: "Bob", goal: "目標 B" },
      ],
      revealed: true,
    };
    render(<TeamGoal {...defaultProps} />);
    expect(screen.getByTestId("tg-result")).toBeInTheDocument();
    expect(screen.getByTestId("tg-entry-e1")).toBeInTheDocument();
    expect(screen.getByTestId("tg-entry-e2")).toBeInTheDocument();
  });

  it("revealed + 無提交顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<TeamGoal {...defaultProps} />);
    expect(screen.getByTestId("tg-empty")).toBeInTheDocument();
  });

  it("isLoaded=false 顯示 loading spinner", () => {
    mockIsLoaded = false;
    render(<TeamGoal {...defaultProps} />);
    expect(screen.getByTestId("tg-loading")).toBeInTheDocument();
  });
});
