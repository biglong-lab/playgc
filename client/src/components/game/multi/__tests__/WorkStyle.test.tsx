import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkStyle } from "../WorkStyle";

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

describe("WorkStyle", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<WorkStyle {...defaultProps} />);
    expect(screen.getByTestId("ws-loading")).toBeDefined();
  });

  test("顯示預設標題與提示", () => {
    render(<WorkStyle {...defaultProps} />);
    expect(screen.getByTestId("ws-title").textContent).toBe("工作風格");
    expect(screen.getByTestId("ws-prompt").textContent).toContain("滑桿");
  });

  test("顯示自訂 config", () => {
    render(<WorkStyle {...defaultProps} config={{ title: "Work Preference" }} />);
    expect(screen.getByTestId("ws-title").textContent).toBe("Work Preference");
  });

  test("顯示已回答人數", () => {
    render(<WorkStyle {...defaultProps} />);
    expect(screen.getByTestId("ws-count").textContent).toContain("0");
  });

  test("顯示兩個滑桿", () => {
    render(<WorkStyle {...defaultProps} />);
    expect(screen.getByTestId("ws-collab-slider")).toBeDefined();
    expect(screen.getByTestId("ws-structure-slider")).toBeDefined();
  });

  test("提交鈕始終啟用", () => {
    render(<WorkStyle {...defaultProps} />);
    const btn = screen.getByTestId("ws-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("顯示即時 quadrant 預覽", () => {
    render(<WorkStyle {...defaultProps} />);
    expect(screen.getByTestId("ws-preview-quadrant")).toBeDefined();
  });

  test("提交呼叫 updateState 帶 collab + structure", () => {
    render(<WorkStyle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ws-collab-slider"), { target: { value: "80" } });
    fireEvent.change(screen.getByTestId("ws-structure-slider"), { target: { value: "20" } });
    fireEvent.click(screen.getByTestId("ws-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as { entries: Array<{ collab: number; structure: number }> };
    expect(called.entries[0].collab).toBe(80);
    expect(called.entries[0].structure).toBe(20);
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", collab: 70, structure: 60 }],
      revealed: false,
    };
    render(<WorkStyle {...defaultProps} />);
    expect(screen.getByTestId("ws-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<WorkStyle {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ws-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<WorkStyle {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("ws-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<WorkStyle {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("ws-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示平均長條圖與人員卡片", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "小華", collab: 80, structure: 30 }],
      revealed: true,
    };
    render(<WorkStyle {...defaultProps} />);
    expect(screen.getByTestId("ws-result")).toBeDefined();
    expect(screen.getByTestId("ws-avg-collab-bar")).toBeDefined();
    expect(screen.getByTestId("ws-avg-structure-bar")).toBeDefined();
    expect(screen.getByTestId("ws-card-e1")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<WorkStyle {...defaultProps} />);
    expect(screen.getByTestId("ws-empty")).toBeDefined();
  });
});
