import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MeetingCheck } from "../MeetingCheck";

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
  config: { title: "會議結束確認", prompt: "這次會議如何？" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
});

describe("MeetingCheck", () => {
  it("顯示標題和提示", () => {
    render(<MeetingCheck {...defaultProps} />);
    expect(screen.getByTestId("mc-title")).toHaveTextContent("會議結束確認");
    expect(screen.getByTestId("mc-prompt")).toHaveTextContent("這次會議如何？");
  });

  it("顯示已回覆人數（初始 0）", () => {
    render(<MeetingCheck {...defaultProps} />);
    expect(screen.getByTestId("mc-count")).toHaveTextContent("0");
  });

  it("顯示 5 個星星按鈕", () => {
    render(<MeetingCheck {...defaultProps} />);
    expect(screen.getByTestId("mc-stars")).toBeInTheDocument();
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`mc-star-${i}`)).toBeInTheDocument();
    }
  });

  it("未選星星時提交按鈕 disabled", () => {
    render(<MeetingCheck {...defaultProps} />);
    expect(screen.getByTestId("mc-submit-btn")).toBeDisabled();
  });

  it("點擊星星後按鈕 enabled", () => {
    render(<MeetingCheck {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mc-star-4"));
    expect(screen.getByTestId("mc-submit-btn")).not.toBeDisabled();
  });

  it("點擊星星後顯示已選標籤", () => {
    render(<MeetingCheck {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mc-star-3"));
    expect(screen.getByTestId("mc-selected-label")).toHaveTextContent("3 星");
  });

  it("提交後呼叫 updateState 帶入正確 rating", () => {
    render(<MeetingCheck {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mc-star-5"));
    fireEvent.change(screen.getByTestId("mc-takeaway-input"), { target: { value: "學到新技巧" } });
    fireEvent.click(screen.getByTestId("mc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const called = mockUpdateState.mock.calls[0][0] as { entries: { rating: number; takeaway: string }[] };
    expect(called.entries[0].rating).toBe(5);
    expect(called.entries[0].takeaway).toBe("學到新技巧");
  });

  it("已提交後顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", rating: 4, takeaway: "很有幫助" }],
      revealed: false,
    };
    render(<MeetingCheck {...defaultProps} />);
    expect(screen.getByTestId("mc-my-entry")).toBeInTheDocument();
  });

  it("已提交後隱藏星星選擇", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", rating: 4, takeaway: "" }],
      revealed: false,
    };
    render(<MeetingCheck {...defaultProps} />);
    expect(screen.queryByTestId("mc-stars")).not.toBeInTheDocument();
  });

  it("isTeamLead + 已提交 → 顯示公布按鈕", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", rating: 5, takeaway: "" }],
      revealed: false,
    };
    render(<MeetingCheck {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("mc-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長不顯示公布按鈕", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", rating: 5, takeaway: "" }],
      revealed: false,
    };
    render(<MeetingCheck {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("mc-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊公布 updateState revealed=true", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", rating: 5, takeaway: "" }],
      revealed: false,
    };
    render(<MeetingCheck {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("mc-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示平均分數", () => {
    mockState = {
      entries: [
        { entryId: "e1", userId: "u1", userName: "Alice", rating: 4, takeaway: "很棒" },
        { entryId: "e2", userId: "u2", userName: "Bob", rating: 2, takeaway: "" },
      ],
      revealed: true,
    };
    render(<MeetingCheck {...defaultProps} />);
    expect(screen.getByTestId("mc-result")).toBeInTheDocument();
    expect(screen.getByTestId("mc-avg")).toHaveTextContent("3.0");
  });

  it("revealed=true 顯示有收穫的 entry", () => {
    mockState = {
      entries: [
        { entryId: "e1", userId: "u1", userName: "Alice", rating: 5, takeaway: "學到 OKR" },
      ],
      revealed: true,
    };
    render(<MeetingCheck {...defaultProps} />);
    expect(screen.getByTestId("mc-entry-e1")).toBeInTheDocument();
  });

  it("isLoaded=false 顯示 loading spinner", () => {
    mockIsLoaded = false;
    render(<MeetingCheck {...defaultProps} />);
    expect(screen.getByTestId("mc-loading")).toBeInTheDocument();
  });
});
