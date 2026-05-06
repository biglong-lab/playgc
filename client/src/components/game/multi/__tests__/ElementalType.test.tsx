import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ElementalType } from "../ElementalType";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("ElementalType", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ElementalType {...defaultProps} />);
    expect(screen.getByTestId("et-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<ElementalType {...defaultProps} />);
    expect(screen.getByTestId("et-title").textContent).toBe("我是哪種元素");
    expect(screen.getByTestId("et-prompt").textContent).toContain("元素");
  });

  it("自訂 config 標題", () => {
    render(<ElementalType {...defaultProps} config={{ title: "你的元素屬性", prompt: "選一個元素！" }} />);
    expect(screen.getByTestId("et-title").textContent).toBe("你的元素屬性");
    expect(screen.getByTestId("et-prompt").textContent).toBe("選一個元素！");
  });

  it("顯示已選擇人數", () => {
    render(<ElementalType {...defaultProps} />);
    expect(screen.getByTestId("et-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<ElementalType {...defaultProps} />);
    expect(screen.getByTestId("et-form")).toBeTruthy();
    expect(screen.getByTestId("et-reason-input")).toBeTruthy();
    expect(screen.getByTestId("et-submit-btn")).toBeTruthy();
  });

  it("顯示所有 8 種元素按鈕", () => {
    render(<ElementalType {...defaultProps} />);
    ["fire","water","earth","wind","lightning","ice","light","shadow"].forEach((id) => {
      expect(screen.getByTestId(`et-element-${id}`)).toBeTruthy();
    });
  });

  it("未選元素時提交按鈕 disabled", () => {
    render(<ElementalType {...defaultProps} />);
    fireEvent.change(screen.getByTestId("et-reason-input"), { target: { value: "熱情衝勁點燃一切" } });
    const btn = screen.getByTestId("et-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選元素但原因太短時 disabled", () => {
    render(<ElementalType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("et-element-water"));
    fireEvent.change(screen.getByTestId("et-reason-input"), { target: { value: "柔韌" } });
    const btn = screen.getByTestId("et-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選元素且原因 ≥5 字時提交按鈕啟用", () => {
    render(<ElementalType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("et-element-light"));
    fireEvent.change(screen.getByTestId("et-reason-input"), { target: { value: "正向溫暖照亮他人路" } });
    const btn = screen.getByTestId("et-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<ElementalType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("et-element-fire"));
    fireEvent.change(screen.getByTestId("et-reason-input"), { target: { value: "今天熱情衝勁爆發力強" } });
    fireEvent.click(screen.getByTestId("et-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", element: "ice", reason: "冷靜清晰精煉純粹" }],
      revealed: false,
    };
    render(<ElementalType {...defaultProps} />);
    expect(screen.getByTestId("et-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("et-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<ElementalType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("et-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<ElementalType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("et-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<ElementalType {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("et-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<ElementalType {...defaultProps} />);
    expect(screen.getByTestId("et-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 et-result 和元素摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", element: "shadow", reason: "神秘深邃洞察人心秘密" }],
      revealed: true,
    };
    render(<ElementalType {...defaultProps} />);
    expect(screen.getByTestId("et-result")).toBeTruthy();
    expect(screen.getByTestId("et-element-summary")).toBeTruthy();
    expect(screen.getByTestId("et-badge-shadow")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", element: "earth", reason: "穩重踏實承載一切責任" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", element: "lightning", reason: "爆發力強瞬間改變局面" },
      ],
      revealed: true,
    };
    render(<ElementalType {...defaultProps} />);
    expect(screen.getByTestId("et-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("et-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<ElementalType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("et-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", element: "wind", reason: "自由流動帶來改變思維" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", element: "water", reason: "柔韌靈活滋養萬物生命" },
      ],
      revealed: false,
    };
    render(<ElementalType {...defaultProps} />);
    expect(screen.getByTestId("et-count").textContent).toContain("2");
  });
});
