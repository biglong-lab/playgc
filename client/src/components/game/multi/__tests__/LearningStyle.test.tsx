import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LearningStyle } from "../LearningStyle";

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

const baseProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("LearningStyle", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<LearningStyle {...baseProps} />);
    expect(screen.getByTestId("ls-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<LearningStyle {...baseProps} config={{ title: "我的學習偏好" }} />);
    expect(screen.getByTestId("ls-title").textContent).toContain("我的學習偏好");
  });

  it("顯示預設標題", () => {
    render(<LearningStyle {...baseProps} />);
    expect(screen.getByTestId("ls-title").textContent).toContain("學習風格");
  });

  it("顯示提示語", () => {
    render(<LearningStyle {...baseProps} />);
    expect(screen.getByTestId("ls-prompt")).toBeTruthy();
  });

  it("顯示已選擇數量", () => {
    render(<LearningStyle {...baseProps} />);
    expect(screen.getByTestId("ls-count").textContent).toContain("0");
  });

  it("顯示 4 個學習風格選項", () => {
    render(<LearningStyle {...baseProps} />);
    expect(screen.getByTestId("ls-form")).toBeTruthy();
    expect(screen.getByTestId("ls-style-visual")).toBeTruthy();
    expect(screen.getByTestId("ls-style-auditory")).toBeTruthy();
    expect(screen.getByTestId("ls-style-reading")).toBeTruthy();
    expect(screen.getByTestId("ls-style-kinesthetic")).toBeTruthy();
  });

  it("點選後呼叫 updateState（視覺型）", () => {
    render(<LearningStyle {...baseProps} />);
    fireEvent.click(screen.getByTestId("ls-style-visual"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { style: string }[];
    };
    expect(call.entries[0].style).toBe("visual");
  });

  it("點選後呼叫 updateState（動覺型）", () => {
    render(<LearningStyle {...baseProps} />);
    fireEvent.click(screen.getByTestId("ls-style-kinesthetic"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { style: string }[];
    };
    expect(call.entries[0].style).toBe("kinesthetic");
  });

  it("已選擇顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        style: "reading",
      }],
      revealed: false,
    };
    render(<LearningStyle {...baseProps} />);
    expect(screen.getByTestId("ls-my-entry").textContent).toContain("閱讀型");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<LearningStyle {...baseProps} />);
    expect(screen.queryByTestId("ls-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<LearningStyle {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ls-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<LearningStyle {...baseProps} />);
    expect(screen.getByTestId("ls-empty")).toBeTruthy();
  });

  it("revealed 顯示各風格比例條", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", style: "visual" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", style: "kinesthetic" },
        { entryId: "u3-1", userId: "u3", userName: "Carol", style: "visual" },
      ],
      revealed: true,
    };
    render(<LearningStyle {...baseProps} />);
    expect(screen.getByTestId("ls-result")).toBeTruthy();
    expect(screen.getByTestId("ls-bar-visual")).toBeTruthy();
    expect(screen.getByTestId("ls-bar-kinesthetic")).toBeTruthy();
  });

  it("revealed 顯示成員清單", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", style: "auditory" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", style: "reading" },
      ],
      revealed: true,
    };
    render(<LearningStyle {...baseProps} />);
    expect(screen.getByTestId("ls-member-list")).toBeTruthy();
    expect(screen.getByTestId("ls-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ls-card-u2-1")).toBeTruthy();
  });
});
