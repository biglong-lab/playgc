import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConflictStyle } from "../ConflictStyle";

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

describe("ConflictStyle", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ConflictStyle {...baseProps} />);
    expect(screen.getByTestId("cs-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<ConflictStyle {...baseProps} config={{ title: "應對風格" }} />);
    expect(screen.getByTestId("cs-title").textContent).toContain("應對風格");
  });

  it("顯示預設標題", () => {
    render(<ConflictStyle {...baseProps} />);
    expect(screen.getByTestId("cs-title").textContent).toContain("衝突風格");
  });

  it("顯示提示語", () => {
    render(<ConflictStyle {...baseProps} />);
    expect(screen.getByTestId("cs-prompt")).toBeTruthy();
  });

  it("顯示已選擇數量", () => {
    render(<ConflictStyle {...baseProps} />);
    expect(screen.getByTestId("cs-count").textContent).toContain("0");
  });

  it("顯示 5 個風格選項", () => {
    render(<ConflictStyle {...baseProps} />);
    expect(screen.getByTestId("cs-form")).toBeTruthy();
    expect(screen.getByTestId("cs-style-competing")).toBeTruthy();
    expect(screen.getByTestId("cs-style-collaborating")).toBeTruthy();
    expect(screen.getByTestId("cs-style-compromising")).toBeTruthy();
    expect(screen.getByTestId("cs-style-avoiding")).toBeTruthy();
    expect(screen.getByTestId("cs-style-accommodating")).toBeTruthy();
  });

  it("點選風格後呼叫 updateState（合作型）", () => {
    render(<ConflictStyle {...baseProps} />);
    fireEvent.click(screen.getByTestId("cs-style-collaborating"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { style: string }[];
    };
    expect(call.entries[0].style).toBe("collaborating");
  });

  it("點選風格後呼叫 updateState（迴避型）", () => {
    render(<ConflictStyle {...baseProps} />);
    fireEvent.click(screen.getByTestId("cs-style-avoiding"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { style: string }[];
    };
    expect(call.entries[0].style).toBe("avoiding");
  });

  it("已選擇顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        style: "collaborating", reason: "",
      }],
      revealed: false,
    };
    render(<ConflictStyle {...baseProps} />);
    expect(screen.getByTestId("cs-my-entry").textContent).toContain("合作型");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<ConflictStyle {...baseProps} />);
    expect(screen.queryByTestId("cs-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<ConflictStyle {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("cs-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<ConflictStyle {...baseProps} />);
    expect(screen.getByTestId("cs-empty")).toBeTruthy();
  });

  it("revealed 顯示各風格比例條", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", style: "collaborating", reason: "" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", style: "compromising", reason: "" },
        { entryId: "u3-1", userId: "u3", userName: "Carol", style: "collaborating", reason: "" },
      ],
      revealed: true,
    };
    render(<ConflictStyle {...baseProps} />);
    expect(screen.getByTestId("cs-result")).toBeTruthy();
    expect(screen.getByTestId("cs-bar-collaborating")).toBeTruthy();
    expect(screen.getByTestId("cs-bar-compromising")).toBeTruthy();
  });

  it("revealed 顯示成員清單", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", style: "competing", reason: "" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", style: "accommodating", reason: "" },
      ],
      revealed: true,
    };
    render(<ConflictStyle {...baseProps} />);
    expect(screen.getByTestId("cs-member-list")).toBeTruthy();
    expect(screen.getByTestId("cs-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("cs-card-u2-1")).toBeTruthy();
  });
});
