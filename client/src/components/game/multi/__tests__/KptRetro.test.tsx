import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KptRetro } from "../KptRetro";

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
  config: { title: "KPT 回顧" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
});

describe("KptRetro", () => {
  it("顯示標題", () => {
    render(<KptRetro {...defaultProps} />);
    expect(screen.getByTestId("kpt-title")).toHaveTextContent("KPT 回顧");
  });

  it("顯示已回覆人數（初始 0）", () => {
    render(<KptRetro {...defaultProps} />);
    expect(screen.getByTestId("kpt-count")).toHaveTextContent("0");
  });

  it("顯示三個輸入欄", () => {
    render(<KptRetro {...defaultProps} />);
    expect(screen.getByTestId("kpt-keep-input")).toBeInTheDocument();
    expect(screen.getByTestId("kpt-problem-input")).toBeInTheDocument();
    expect(screen.getByTestId("kpt-try-input")).toBeInTheDocument();
  });

  it("全空時提交按鈕 disabled", () => {
    render(<KptRetro {...defaultProps} />);
    expect(screen.getByTestId("kpt-submit-btn")).toBeDisabled();
  });

  it("填入 keep 後按鈕 enabled", () => {
    render(<KptRetro {...defaultProps} />);
    fireEvent.change(screen.getByTestId("kpt-keep-input"), { target: { value: "每日站立會議" } });
    expect(screen.getByTestId("kpt-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState 帶入正確內容", () => {
    render(<KptRetro {...defaultProps} />);
    fireEvent.change(screen.getByTestId("kpt-keep-input"), { target: { value: "站立" } });
    fireEvent.change(screen.getByTestId("kpt-problem-input"), { target: { value: "溝通不足" } });
    fireEvent.change(screen.getByTestId("kpt-try-input"), { target: { value: "週報" } });
    fireEvent.click(screen.getByTestId("kpt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const called = mockUpdateState.mock.calls[0][0] as { entries: { keep: string; problem: string; try: string }[] };
    expect(called.entries[0].keep).toBe("站立");
    expect(called.entries[0].problem).toBe("溝通不足");
    expect(called.entries[0].try).toBe("週報");
  });

  it("已提交後顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", keep: "K1", problem: "P1", try: "T1" }],
      revealed: false,
    };
    render(<KptRetro {...defaultProps} />);
    expect(screen.getByTestId("kpt-my-entry")).toBeInTheDocument();
    expect(screen.getByTestId("kpt-my-entry")).toHaveTextContent("K1");
  });

  it("已提交後隱藏輸入欄", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", keep: "K1", problem: "", try: "" }],
      revealed: false,
    };
    render(<KptRetro {...defaultProps} />);
    expect(screen.queryByTestId("kpt-keep-input")).not.toBeInTheDocument();
  });

  it("isTeamLead 顯示公布按鈕", () => {
    render(<KptRetro {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("kpt-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長不顯示公布按鈕", () => {
    render(<KptRetro {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("kpt-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊公布結果 updateState revealed=true", () => {
    render(<KptRetro {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("kpt-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示三欄結果", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", keep: "K1", problem: "P1", try: "T1" }],
      revealed: true,
    };
    render(<KptRetro {...defaultProps} />);
    expect(screen.getByTestId("kpt-result")).toBeInTheDocument();
    expect(screen.getByTestId("kpt-col-keep")).toBeInTheDocument();
    expect(screen.getByTestId("kpt-col-problem")).toBeInTheDocument();
    expect(screen.getByTestId("kpt-col-try")).toBeInTheDocument();
  });

  it("isLoaded=false 顯示 loading spinner", () => {
    mockIsLoaded = false;
    render(<KptRetro {...defaultProps} />);
    expect(screen.getByTestId("kpt-loading")).toBeInTheDocument();
  });
});
