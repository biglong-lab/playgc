import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorVibe } from "../ColorVibe";

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

describe("ColorVibe", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ColorVibe {...baseProps} />);
    expect(screen.getByTestId("cv-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<ColorVibe {...baseProps} config={{ title: "今日色彩" }} />);
    expect(screen.getByTestId("cv-title").textContent).toContain("今日色彩");
  });

  it("顯示預設標題", () => {
    render(<ColorVibe {...baseProps} />);
    expect(screen.getByTestId("cv-title").textContent).toContain("顏色心情");
  });

  it("顯示提示語", () => {
    render(<ColorVibe {...baseProps} />);
    expect(screen.getByTestId("cv-prompt")).toBeTruthy();
  });

  it("顯示已選擇數量", () => {
    render(<ColorVibe {...baseProps} />);
    expect(screen.getByTestId("cv-count").textContent).toContain("0");
  });

  it("顯示 8 個顏色選項", () => {
    render(<ColorVibe {...baseProps} />);
    expect(screen.getByTestId("cv-form")).toBeTruthy();
    expect(screen.getByTestId("cv-color-red")).toBeTruthy();
    expect(screen.getByTestId("cv-color-orange")).toBeTruthy();
    expect(screen.getByTestId("cv-color-yellow")).toBeTruthy();
    expect(screen.getByTestId("cv-color-green")).toBeTruthy();
    expect(screen.getByTestId("cv-color-blue")).toBeTruthy();
    expect(screen.getByTestId("cv-color-purple")).toBeTruthy();
    expect(screen.getByTestId("cv-color-pink")).toBeTruthy();
    expect(screen.getByTestId("cv-color-gray")).toBeTruthy();
  });

  it("未選顏色時 disabled", () => {
    render(<ColorVibe {...baseProps} />);
    expect((screen.getByTestId("cv-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("選擇顏色後可提交", () => {
    render(<ColorVibe {...baseProps} />);
    fireEvent.click(screen.getByTestId("cv-color-blue"));
    expect((screen.getByTestId("cv-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<ColorVibe {...baseProps} />);
    fireEvent.click(screen.getByTestId("cv-color-purple"));
    fireEvent.click(screen.getByTestId("cv-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as { entries: { colorId: string }[] };
    expect(call.entries[0].colorId).toBe("purple");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", colorId: "green" }],
      revealed: false,
    };
    render(<ColorVibe {...baseProps} />);
    expect(screen.getByTestId("cv-my-entry")).toBeTruthy();
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<ColorVibe {...baseProps} />);
    expect(screen.queryByTestId("cv-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<ColorVibe {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("cv-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<ColorVibe {...baseProps} />);
    expect(screen.getByTestId("cv-empty")).toBeTruthy();
  });

  it("revealed 顯示顏色泡泡與成員清單", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", colorId: "blue" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", colorId: "blue" },
        { entryId: "u3-1", userId: "u3", userName: "Carol", colorId: "green" },
      ],
      revealed: true,
    };
    render(<ColorVibe {...baseProps} />);
    expect(screen.getByTestId("cv-result")).toBeTruthy();
    expect(screen.getByTestId("cv-palette")).toBeTruthy();
    expect(screen.getByTestId("cv-bubble-blue")).toBeTruthy();
    expect(screen.getByTestId("cv-bubble-green")).toBeTruthy();
    expect(screen.getByTestId("cv-member-list")).toBeTruthy();
    expect(screen.getByTestId("cv-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("cv-card-u3-1")).toBeTruthy();
  });
});
