import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MeetingRating } from "../MeetingRating";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
const mockUpdateState = vi.fn();

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "Alice", email: "alice@test.com" },
  }),
}));

const baseProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
};

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("MeetingRating", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<MeetingRating {...baseProps} />);
    expect(screen.getByTestId("mr-loading")).toBeTruthy();
  });

  it("顯示標題與會議名稱", () => {
    render(<MeetingRating {...baseProps} config={{ title: "今日評分", meetingName: "週會" }} />);
    expect(screen.getByTestId("mr-title").textContent).toContain("今日評分");
    expect(screen.getByTestId("mr-meeting-name").textContent).toContain("週會");
  });

  it("顯示預設標題", () => {
    render(<MeetingRating {...baseProps} />);
    expect(screen.getByTestId("mr-title").textContent).toContain("會議評分");
  });

  it("顯示已評分人數", () => {
    render(<MeetingRating {...baseProps} />);
    expect(screen.getByTestId("mr-count").textContent).toContain("0");
  });

  it("未提交前顯示評分表單", () => {
    render(<MeetingRating {...baseProps} />);
    expect(screen.getByTestId("mr-form")).toBeTruthy();
    expect(screen.getByTestId("mr-submit-btn")).toBeTruthy();
  });

  it("預設提交按鈕 disabled", () => {
    render(<MeetingRating {...baseProps} />);
    const btn = screen.getByTestId("mr-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("點擊所有維度分數後可提交", () => {
    render(<MeetingRating {...baseProps} />);
    ["useful", "focused", "implement", "time"].forEach((dim) => {
      fireEvent.click(screen.getByTestId(`mr-score-${dim}-3`));
    });
    const btn = screen.getByTestId("mr-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState", () => {
    render(<MeetingRating {...baseProps} />);
    ["useful", "focused", "implement", "time"].forEach((dim) => {
      fireEvent.click(screen.getByTestId(`mr-score-${dim}-5`));
    });
    fireEvent.click(screen.getByTestId("mr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as { entries: { scores: Record<string, number> }[] };
    expect(call.entries.length).toBe(1);
    expect(call.entries[0].scores.useful).toBe(5);
  });

  it("可以輸入回饋文字", () => {
    render(<MeetingRating {...baseProps} />);
    const input = screen.getByTestId("mr-feedback-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "很棒的會議！" } });
    expect(input.value).toBe("很棒的會議！");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1",
        userId: "u1",
        userName: "Alice",
        scores: { useful: 5, focused: 4, implement: 3, time: 5 },
        feedback: "",
      }],
      revealed: false,
    };
    render(<MeetingRating {...baseProps} />);
    expect(screen.getByTestId("mr-my-entry")).toBeTruthy();
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<MeetingRating {...baseProps} />);
    expect(screen.queryByTestId("mr-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<MeetingRating {...baseProps} isTeamLead />);
    expect(screen.getByTestId("mr-reveal-btn")).toBeTruthy();
  });

  it("點揭示按鈕呼叫 updateState revealed=true", () => {
    render(<MeetingRating {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("mr-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true })
    );
  });

  it("revealed 顯示結果區與空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<MeetingRating {...baseProps} />);
    expect(screen.getByTestId("mr-result")).toBeTruthy();
    expect(screen.getByTestId("mr-empty")).toBeTruthy();
  });

  it("revealed 顯示各維度平均長條圖", () => {
    mockState = {
      entries: [{
        entryId: "u1-1",
        userId: "u1",
        userName: "Alice",
        scores: { useful: 4, focused: 4, implement: 4, time: 4 },
        feedback: "好！",
      }],
      revealed: true,
    };
    render(<MeetingRating {...baseProps} />);
    expect(screen.getByTestId("mr-bar-useful")).toBeTruthy();
    expect(screen.getByTestId("mr-bar-time")).toBeTruthy();
    const card = screen.getByTestId("mr-card-u1-1");
    expect(card.textContent).toContain("好！");
  });
});
