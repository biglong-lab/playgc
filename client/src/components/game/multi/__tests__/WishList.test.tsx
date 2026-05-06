import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WishList } from "../WishList";

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

describe("WishList", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<WishList {...defaultProps} />);
    expect(screen.getByTestId("wl-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<WishList {...defaultProps} />);
    expect(screen.getByTestId("wl-title").textContent).toBe("願望清單");
    expect(screen.getByTestId("wl-prompt").textContent).toContain("願望");
  });

  it("自訂 config 標題", () => {
    render(<WishList {...defaultProps} config={{ title: "新年願望", prompt: "今年最想實現什麼？" }} />);
    expect(screen.getByTestId("wl-title").textContent).toBe("新年願望");
    expect(screen.getByTestId("wl-prompt").textContent).toBe("今年最想實現什麼？");
  });

  it("顯示已許願人數", () => {
    render(<WishList {...defaultProps} />);
    expect(screen.getByTestId("wl-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<WishList {...defaultProps} />);
    expect(screen.getByTestId("wl-form")).toBeTruthy();
    expect(screen.getByTestId("wl-wish-input")).toBeTruthy();
    expect(screen.getByTestId("wl-submit-btn")).toBeTruthy();
  });

  it("顯示所有 6 個願望類別按鈕", () => {
    render(<WishList {...defaultProps} />);
    ["career", "travel", "skill", "health", "relationship", "creativity"].forEach((id) => {
      expect(screen.getByTestId(`wl-cat-${id}`)).toBeTruthy();
    });
  });

  it("未選類別時提交按鈕 disabled", () => {
    render(<WishList {...defaultProps} />);
    const btn = screen.getByTestId("wl-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選類別但願望太短時 disabled", () => {
    render(<WishList {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wl-cat-career"));
    fireEvent.change(screen.getByTestId("wl-wish-input"), { target: { value: "升職" } });
    const btn = screen.getByTestId("wl-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選類別且願望 ≥5 字時提交按鈕啟用", () => {
    render(<WishList {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wl-cat-travel"));
    fireEvent.change(screen.getByTestId("wl-wish-input"), { target: { value: "去冰島看極光" } });
    const btn = screen.getByTestId("wl-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<WishList {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wl-cat-skill"));
    fireEvent.change(screen.getByTestId("wl-wish-input"), { target: { value: "學會彈鋼琴並演奏" } });
    fireEvent.click(screen.getByTestId("wl-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", wish: "環遊全世界一次", category: "travel" }],
      revealed: false,
    };
    render(<WishList {...defaultProps} />);
    expect(screen.getByTestId("wl-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("wl-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<WishList {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("wl-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<WishList {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("wl-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<WishList {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("wl-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<WishList {...defaultProps} />);
    expect(screen.getByTestId("wl-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 wl-result", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", wish: "創作一部完整的動畫", category: "creativity" }],
      revealed: true,
    };
    render(<WishList {...defaultProps} />);
    expect(screen.getByTestId("wl-result")).toBeTruthy();
    expect(screen.getByTestId("wl-wish-wall")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", wish: "建立自己的事業王國", category: "career" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", wish: "每天保持運動健康生活", category: "health" },
      ],
      revealed: true,
    };
    render(<WishList {...defaultProps} />);
    expect(screen.getByTestId("wl-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("wl-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<WishList {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("wl-reveal-btn")).toBeNull();
  });

  it("已許願人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", wish: "到世界各地旅行探索", category: "travel" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", wish: "學會五種程式語言", category: "skill" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", wish: "建立深厚的友誼網絡", category: "relationship" },
      ],
      revealed: false,
    };
    render(<WishList {...defaultProps} />);
    expect(screen.getByTestId("wl-count").textContent).toContain("3");
  });
});
