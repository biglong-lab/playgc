import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DecisionStyle } from "../DecisionStyle";

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

describe("DecisionStyle", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<DecisionStyle {...baseProps} />);
    expect(screen.getByTestId("ds-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<DecisionStyle {...baseProps} config={{ title: "我的決策方式" }} />);
    expect(screen.getByTestId("ds-title").textContent).toContain("我的決策方式");
  });

  it("顯示預設標題", () => {
    render(<DecisionStyle {...baseProps} />);
    expect(screen.getByTestId("ds-title").textContent).toContain("決策風格");
  });

  it("顯示提示語", () => {
    render(<DecisionStyle {...baseProps} />);
    expect(screen.getByTestId("ds-prompt")).toBeTruthy();
  });

  it("顯示已選擇數量", () => {
    render(<DecisionStyle {...baseProps} />);
    expect(screen.getByTestId("ds-count").textContent).toContain("0");
  });

  it("顯示 5 個決策風格選項", () => {
    render(<DecisionStyle {...baseProps} />);
    expect(screen.getByTestId("ds-form")).toBeTruthy();
    expect(screen.getByTestId("ds-style-data")).toBeTruthy();
    expect(screen.getByTestId("ds-style-intuition")).toBeTruthy();
    expect(screen.getByTestId("ds-style-consensus")).toBeTruthy();
    expect(screen.getByTestId("ds-style-authority")).toBeTruthy();
    expect(screen.getByTestId("ds-style-experiment")).toBeTruthy();
  });

  it("點選後呼叫 updateState（數據導向）", () => {
    render(<DecisionStyle {...baseProps} />);
    fireEvent.click(screen.getByTestId("ds-style-data"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { style: string }[];
    };
    expect(call.entries[0].style).toBe("data");
  });

  it("點選後呼叫 updateState（實驗導向）", () => {
    render(<DecisionStyle {...baseProps} />);
    fireEvent.click(screen.getByTestId("ds-style-experiment"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { style: string }[];
    };
    expect(call.entries[0].style).toBe("experiment");
  });

  it("已選擇顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        style: "consensus",
      }],
      revealed: false,
    };
    render(<DecisionStyle {...baseProps} />);
    expect(screen.getByTestId("ds-my-entry").textContent).toContain("共識導向");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<DecisionStyle {...baseProps} />);
    expect(screen.queryByTestId("ds-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<DecisionStyle {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ds-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<DecisionStyle {...baseProps} />);
    expect(screen.getByTestId("ds-empty")).toBeTruthy();
  });

  it("revealed 顯示各風格比例條", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", style: "data" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", style: "intuition" },
        { entryId: "u3-1", userId: "u3", userName: "Carol", style: "data" },
      ],
      revealed: true,
    };
    render(<DecisionStyle {...baseProps} />);
    expect(screen.getByTestId("ds-result")).toBeTruthy();
    expect(screen.getByTestId("ds-bar-data")).toBeTruthy();
    expect(screen.getByTestId("ds-bar-intuition")).toBeTruthy();
  });

  it("revealed 顯示成員清單", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", style: "consensus" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", style: "authority" },
      ],
      revealed: true,
    };
    render(<DecisionStyle {...baseProps} />);
    expect(screen.getByTestId("ds-member-list")).toBeTruthy();
    expect(screen.getByTestId("ds-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ds-card-u2-1")).toBeTruthy();
  });
});
