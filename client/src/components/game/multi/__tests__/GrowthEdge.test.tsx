import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GrowthEdge } from "../GrowthEdge";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((next) => { mockState = next; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "小明", email: "user@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("GrowthEdge", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<GrowthEdge {...defaultProps} />);
    expect(screen.getByTestId("ge-loading")).toBeDefined();
  });

  test("顯示預設標題與提示", () => {
    render(<GrowthEdge {...defaultProps} />);
    expect(screen.getByTestId("ge-title").textContent).toBe("成長邊界");
    expect(screen.getByTestId("ge-prompt").textContent).toContain("成長的領域");
  });

  test("顯示自訂 config", () => {
    render(<GrowthEdge {...defaultProps} config={{ title: "Growth Zone" }} />);
    expect(screen.getByTestId("ge-title").textContent).toBe("Growth Zone");
  });

  test("顯示已分享人數", () => {
    render(<GrowthEdge {...defaultProps} />);
    expect(screen.getByTestId("ge-count").textContent).toContain("0");
  });

  test("兩個輸入框都空時提交鈕禁用", () => {
    render(<GrowthEdge {...defaultProps} />);
    const btn = screen.getByTestId("ge-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("只填一欄時提交鈕禁用", () => {
    render(<GrowthEdge {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ge-area-input"), { target: { value: "溝通" } });
    const btn = screen.getByTestId("ge-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("兩欄都填後提交鈕啟用", () => {
    render(<GrowthEdge {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ge-area-input"), { target: { value: "溝通" } });
    fireEvent.change(screen.getByTestId("ge-action-input"), { target: { value: "每週讀書" } });
    const btn = screen.getByTestId("ge-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶正確 area + action", () => {
    render(<GrowthEdge {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ge-area-input"), { target: { value: "溝通" } });
    fireEvent.change(screen.getByTestId("ge-action-input"), { target: { value: "每週讀書" } });
    fireEvent.click(screen.getByTestId("ge-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as { entries: Array<{ area: string; action: string }> };
    expect(called.entries[0].area).toBe("溝通");
    expect(called.entries[0].action).toBe("每週讀書");
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", area: "時間管理", action: "番茄鐘" }],
      revealed: false,
    };
    render(<GrowthEdge {...defaultProps} />);
    expect(screen.getByTestId("ge-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<GrowthEdge {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ge-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<GrowthEdge {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("ge-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<GrowthEdge {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("ge-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "小華", area: "創意", action: "每天素描" }],
      revealed: true,
    };
    render(<GrowthEdge {...defaultProps} />);
    expect(screen.getByTestId("ge-result")).toBeDefined();
    expect(screen.getByTestId("ge-card-e1")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<GrowthEdge {...defaultProps} />);
    expect(screen.getByTestId("ge-empty")).toBeDefined();
  });
});
