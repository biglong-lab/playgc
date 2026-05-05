import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlusEvenBetter } from "../PlusEvenBetter";

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
  config: { title: "Plus / Even Better" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
});

describe("PlusEvenBetter", () => {
  it("顯示標題", () => {
    render(<PlusEvenBetter {...defaultProps} />);
    expect(screen.getByTestId("peb-title")).toHaveTextContent("Plus / Even Better");
  });

  it("顯示已回覆人數（初始 0）", () => {
    render(<PlusEvenBetter {...defaultProps} />);
    expect(screen.getByTestId("peb-count")).toHaveTextContent("0");
  });

  it("顯示兩個輸入欄", () => {
    render(<PlusEvenBetter {...defaultProps} />);
    expect(screen.getByTestId("peb-plus-input")).toBeInTheDocument();
    expect(screen.getByTestId("peb-even-better-input")).toBeInTheDocument();
  });

  it("全空時提交按鈕 disabled", () => {
    render(<PlusEvenBetter {...defaultProps} />);
    expect(screen.getByTestId("peb-submit-btn")).toBeDisabled();
  });

  it("填入 plus 後按鈕 enabled", () => {
    render(<PlusEvenBetter {...defaultProps} />);
    fireEvent.change(screen.getByTestId("peb-plus-input"), { target: { value: "團隊溝通很順暢" } });
    expect(screen.getByTestId("peb-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState 帶入正確內容", () => {
    render(<PlusEvenBetter {...defaultProps} />);
    fireEvent.change(screen.getByTestId("peb-plus-input"), { target: { value: "溝通好" } });
    fireEvent.change(screen.getByTestId("peb-even-better-input"), { target: { value: "節奏可加快" } });
    fireEvent.click(screen.getByTestId("peb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const called = mockUpdateState.mock.calls[0][0] as { entries: { plus: string; evenBetter: string }[] };
    expect(called.entries[0].plus).toBe("溝通好");
    expect(called.entries[0].evenBetter).toBe("節奏可加快");
  });

  it("已提交後顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", plus: "P1", evenBetter: "EB1" }],
      revealed: false,
    };
    render(<PlusEvenBetter {...defaultProps} />);
    expect(screen.getByTestId("peb-my-entry")).toBeInTheDocument();
    expect(screen.getByTestId("peb-my-entry")).toHaveTextContent("P1");
  });

  it("已提交後隱藏輸入欄", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", plus: "P1", evenBetter: "" }],
      revealed: false,
    };
    render(<PlusEvenBetter {...defaultProps} />);
    expect(screen.queryByTestId("peb-plus-input")).not.toBeInTheDocument();
  });

  it("isTeamLead 顯示公布按鈕", () => {
    render(<PlusEvenBetter {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("peb-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長不顯示公布按鈕", () => {
    render(<PlusEvenBetter {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("peb-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊公布 updateState revealed=true", () => {
    render(<PlusEvenBetter {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("peb-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示兩欄結果", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", plus: "P1", evenBetter: "EB1" }],
      revealed: true,
    };
    render(<PlusEvenBetter {...defaultProps} />);
    expect(screen.getByTestId("peb-result")).toBeInTheDocument();
    expect(screen.getByTestId("peb-col-plus")).toBeInTheDocument();
    expect(screen.getByTestId("peb-col-evenBetter")).toBeInTheDocument();
  });

  it("isLoaded=false 顯示 loading spinner", () => {
    mockIsLoaded = false;
    render(<PlusEvenBetter {...defaultProps} />);
    expect(screen.getByTestId("peb-loading")).toBeInTheDocument();
  });
});
