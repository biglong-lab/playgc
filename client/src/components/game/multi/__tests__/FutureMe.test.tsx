import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FutureMe } from "../FutureMe";

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

describe("FutureMe", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<FutureMe {...defaultProps} />);
    expect(screen.getByTestId("fm-loading")).toBeDefined();
  });

  test("顯示預設標題與提示", () => {
    render(<FutureMe {...defaultProps} />);
    expect(screen.getByTestId("fm-title").textContent).toBe("給未來的我");
    expect(screen.getByTestId("fm-prompt").textContent).toContain("寫一段話");
  });

  test("顯示自訂 config", () => {
    render(<FutureMe {...defaultProps} config={{ title: "My Future", prompt: "Custom prompt" }} />);
    expect(screen.getByTestId("fm-title").textContent).toBe("My Future");
  });

  test("顯示已寫信人數", () => {
    render(<FutureMe {...defaultProps} />);
    expect(screen.getByTestId("fm-count").textContent).toContain("0");
  });

  test("顯示時間軸選項", () => {
    render(<FutureMe {...defaultProps} />);
    const horizons = screen.getByTestId("fm-horizons");
    expect(horizons).toBeDefined();
  });

  test("未選時間+未輸入時提交鈕禁用", () => {
    render(<FutureMe {...defaultProps} />);
    const btn = screen.getByTestId("fm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("選時間+輸入後提交鈕啟用", () => {
    render(<FutureMe {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fm-horizon-1 年後"));
    fireEvent.change(screen.getByTestId("fm-textarea"), { target: { value: "你好，未來的我！加油！" } });
    const btn = screen.getByTestId("fm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 並加入 entry", () => {
    render(<FutureMe {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fm-horizon-1 年後"));
    fireEvent.change(screen.getByTestId("fm-textarea"), { target: { value: "你好，未來的我！加油！" } });
    fireEvent.click(screen.getByTestId("fm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as { entries: Array<{ horizon: string; message: string }> };
    expect(called.entries[0].horizon).toBe("1 年後");
    expect(called.entries[0].message).toBe("你好，未來的我！加油！");
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", horizon: "3 年後", message: "Keep going!" }],
      revealed: false,
    };
    render(<FutureMe {...defaultProps} />);
    expect(screen.getByTestId("fm-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<FutureMe {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("fm-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<FutureMe {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("fm-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<FutureMe {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("fm-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "小華", horizon: "5 年後", message: "Dream big!" }],
      revealed: true,
    };
    render(<FutureMe {...defaultProps} />);
    expect(screen.getByTestId("fm-result")).toBeDefined();
    expect(screen.getByTestId("fm-card-e1")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<FutureMe {...defaultProps} />);
    expect(screen.getByTestId("fm-empty")).toBeDefined();
  });
});
