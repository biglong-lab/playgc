import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ValuesCard } from "../ValuesCard";

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

describe("ValuesCard", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<ValuesCard {...defaultProps} />);
    expect(screen.getByTestId("vc-loading")).toBeDefined();
  });

  test("顯示預設標題與提示", () => {
    render(<ValuesCard {...defaultProps} />);
    expect(screen.getByTestId("vc-title").textContent).toBe("價值觀卡");
    expect(screen.getByTestId("vc-prompt").textContent).toContain("核心價值觀");
  });

  test("顯示自訂 config", () => {
    render(<ValuesCard {...defaultProps} config={{ title: "Custom Values" }} />);
    expect(screen.getByTestId("vc-title").textContent).toBe("Custom Values");
  });

  test("顯示已選擇人數", () => {
    render(<ValuesCard {...defaultProps} />);
    expect(screen.getByTestId("vc-count").textContent).toContain("0");
  });

  test("顯示價值觀格線", () => {
    render(<ValuesCard {...defaultProps} />);
    expect(screen.getByTestId("vc-grid")).toBeDefined();
  });

  test("無選擇時提交鈕禁用", () => {
    render(<ValuesCard {...defaultProps} />);
    const btn = screen.getByTestId("vc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("選擇一個值後提交鈕啟用", () => {
    render(<ValuesCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("vc-value-誠信"));
    const btn = screen.getByTestId("vc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("選滿上限後其他按鈕禁用", () => {
    render(<ValuesCard {...defaultProps} config={{ maxSelect: 2 }} />);
    fireEvent.click(screen.getByTestId("vc-value-誠信"));
    fireEvent.click(screen.getByTestId("vc-value-創新"));
    const btn3 = screen.getByTestId("vc-value-合作") as HTMLButtonElement;
    expect(btn3.disabled).toBe(true);
  });

  test("提交呼叫 updateState 帶正確 selectedValues", () => {
    render(<ValuesCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("vc-value-誠信"));
    fireEvent.click(screen.getByTestId("vc-value-創新"));
    fireEvent.click(screen.getByTestId("vc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as { entries: Array<{ selectedValues: string[] }> };
    expect(called.entries[0].selectedValues).toContain("誠信");
    expect(called.entries[0].selectedValues).toContain("創新");
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", selectedValues: ["誠信", "創新"] }],
      revealed: false,
    };
    render(<ValuesCard {...defaultProps} />);
    expect(screen.getByTestId("vc-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<ValuesCard {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("vc-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<ValuesCard {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("vc-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<ValuesCard {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("vc-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "小華", selectedValues: ["合作", "誠信"] }],
      revealed: true,
    };
    render(<ValuesCard {...defaultProps} />);
    expect(screen.getByTestId("vc-result")).toBeDefined();
    expect(screen.getByTestId("vc-bar-誠信")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<ValuesCard {...defaultProps} />);
    expect(screen.getByTestId("vc-empty")).toBeDefined();
  });
});
