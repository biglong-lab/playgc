import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StartStopContinue } from "../StartStopContinue";

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
  config: { title: "Start / Stop / Continue" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
});

describe("StartStopContinue", () => {
  it("顯示標題", () => {
    render(<StartStopContinue {...defaultProps} />);
    expect(screen.getByTestId("ssc-title")).toHaveTextContent("Start / Stop / Continue");
  });

  it("顯示已回覆人數（初始 0）", () => {
    render(<StartStopContinue {...defaultProps} />);
    expect(screen.getByTestId("ssc-count")).toHaveTextContent("0");
  });

  it("顯示三個輸入欄", () => {
    render(<StartStopContinue {...defaultProps} />);
    expect(screen.getByTestId("ssc-start-input")).toBeInTheDocument();
    expect(screen.getByTestId("ssc-stop-input")).toBeInTheDocument();
    expect(screen.getByTestId("ssc-continue-input")).toBeInTheDocument();
  });

  it("全空時提交按鈕 disabled", () => {
    render(<StartStopContinue {...defaultProps} />);
    expect(screen.getByTestId("ssc-submit-btn")).toBeDisabled();
  });

  it("填入 start 後按鈕 enabled", () => {
    render(<StartStopContinue {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ssc-start-input"), { target: { value: "每日站立" } });
    expect(screen.getByTestId("ssc-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState 帶入正確內容", () => {
    render(<StartStopContinue {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ssc-start-input"), { target: { value: "每日回顧" } });
    fireEvent.change(screen.getByTestId("ssc-stop-input"), { target: { value: "過長會議" } });
    fireEvent.change(screen.getByTestId("ssc-continue-input"), { target: { value: "1on1" } });
    fireEvent.click(screen.getByTestId("ssc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const called = mockUpdateState.mock.calls[0][0] as { entries: { start: string; stop: string; continue: string }[] };
    expect(called.entries[0].start).toBe("每日回顧");
    expect(called.entries[0].stop).toBe("過長會議");
    expect(called.entries[0].continue).toBe("1on1");
  });

  it("已提交後顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", start: "S1", stop: "P1", continue: "C1" }],
      revealed: false,
    };
    render(<StartStopContinue {...defaultProps} />);
    expect(screen.getByTestId("ssc-my-entry")).toBeInTheDocument();
  });

  it("已提交後隱藏輸入欄", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", start: "S1", stop: "", continue: "" }],
      revealed: false,
    };
    render(<StartStopContinue {...defaultProps} />);
    expect(screen.queryByTestId("ssc-start-input")).not.toBeInTheDocument();
  });

  it("isTeamLead 顯示公布按鈕", () => {
    render(<StartStopContinue {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ssc-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長不顯示公布按鈕", () => {
    render(<StartStopContinue {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ssc-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊公布結果 updateState revealed=true", () => {
    render(<StartStopContinue {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ssc-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示三欄結果", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", start: "S1", stop: "P1", continue: "C1" }],
      revealed: true,
    };
    render(<StartStopContinue {...defaultProps} />);
    expect(screen.getByTestId("ssc-result")).toBeInTheDocument();
    expect(screen.getByTestId("ssc-col-start")).toBeInTheDocument();
    expect(screen.getByTestId("ssc-col-stop")).toBeInTheDocument();
    expect(screen.getByTestId("ssc-col-continue")).toBeInTheDocument();
  });

  it("isLoaded=false 顯示 loading spinner", () => {
    mockIsLoaded = false;
    render(<StartStopContinue {...defaultProps} />);
    expect(screen.getByTestId("ssc-loading")).toBeInTheDocument();
  });
});
