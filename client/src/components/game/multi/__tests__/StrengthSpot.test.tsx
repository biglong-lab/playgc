import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrengthSpot } from "../StrengthSpot";

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

describe("StrengthSpot", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<StrengthSpot {...defaultProps} />);
    expect(screen.getByTestId("ss-loading")).toBeDefined();
  });

  test("顯示預設標題與提示", () => {
    render(<StrengthSpot {...defaultProps} />);
    expect(screen.getByTestId("ss-title").textContent).toBe("優勢聚焦");
    expect(screen.getByTestId("ss-prompt").textContent).toContain("優勢");
  });

  test("顯示自訂 config", () => {
    render(<StrengthSpot {...defaultProps} config={{ title: "Team Strengths" }} />);
    expect(screen.getByTestId("ss-title").textContent).toBe("Team Strengths");
  });

  test("顯示已分享人數", () => {
    render(<StrengthSpot {...defaultProps} />);
    expect(screen.getByTestId("ss-count").textContent).toContain("0");
  });

  test("空輸入時提交鈕禁用", () => {
    render(<StrengthSpot {...defaultProps} />);
    const btn = screen.getByTestId("ss-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("輸入後提交鈕啟用", () => {
    render(<StrengthSpot {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ss-strength-input"), { target: { value: "創意發想" } });
    const btn = screen.getByTestId("ss-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶正確 strength", () => {
    render(<StrengthSpot {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ss-strength-input"), { target: { value: "邏輯分析" } });
    fireEvent.change(screen.getByTestId("ss-desc-input"), { target: { value: "我擅長拆解問題" } });
    fireEvent.click(screen.getByTestId("ss-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as { entries: Array<{ strength: string; description: string }> };
    expect(called.entries[0].strength).toBe("邏輯分析");
    expect(called.entries[0].description).toBe("我擅長拆解問題");
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", strength: "溝通", description: "" }],
      revealed: false,
    };
    render(<StrengthSpot {...defaultProps} />);
    expect(screen.getByTestId("ss-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<StrengthSpot {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ss-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<StrengthSpot {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("ss-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<StrengthSpot {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("ss-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "小華", strength: "創意", description: "我愛腦力激盪" }],
      revealed: true,
    };
    render(<StrengthSpot {...defaultProps} />);
    expect(screen.getByTestId("ss-result")).toBeDefined();
    expect(screen.getByTestId("ss-card-e1")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<StrengthSpot {...defaultProps} />);
    expect(screen.getByTestId("ss-empty")).toBeDefined();
  });
});
