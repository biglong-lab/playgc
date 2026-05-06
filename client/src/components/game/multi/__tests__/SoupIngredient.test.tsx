import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SoupIngredient } from "../SoupIngredient";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: mockIsLoaded }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("SoupIngredient", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.getByTestId("sip-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.getByTestId("sip-title").textContent).toBe("湯底配方");
  });

  it("顯示自定義標題", () => {
    render(<SoupIngredient {...defaultProps} config={{ title: "團隊食材" }} />);
    expect(screen.getByTestId("sip-title").textContent).toBe("團隊食材");
  });

  it("顯示提示文字", () => {
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.getByTestId("sip-prompt")).toBeTruthy();
  });

  it("顯示已加料人數", () => {
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.getByTestId("sip-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.getByTestId("sip-form")).toBeTruthy();
  });

  it("顯示 5 個食材選項", () => {
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.getByTestId("sip-ingredient-grid")).toBeTruthy();
    expect(screen.getByTestId("sip-ingredient-salt")).toBeTruthy();
    expect(screen.getByTestId("sip-ingredient-sugar")).toBeTruthy();
    expect(screen.getByTestId("sip-ingredient-chili")).toBeTruthy();
    expect(screen.getByTestId("sip-ingredient-ginger")).toBeTruthy();
    expect(screen.getByTestId("sip-ingredient-garlic")).toBeTruthy();
  });

  it("顯示描述輸入框", () => {
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.getByTestId("sip-description-input")).toBeTruthy();
  });

  it("未填描述時提交按鈕禁用", () => {
    render(<SoupIngredient {...defaultProps} />);
    expect((screen.getByTestId("sip-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<SoupIngredient {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sip-description-input"), { target: { value: "穩定" } });
    expect((screen.getByTestId("sip-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<SoupIngredient {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sip-description-input"), { target: { value: "我讓大家在壓力中保持穩定" } });
    expect((screen.getByTestId("sip-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換食材選項", () => {
    render(<SoupIngredient {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sip-ingredient-chili"));
    expect(screen.getByTestId("sip-ingredient-chili").className).toContain("orange-100");
  });

  it("提交後呼叫 updateState 含 ingredient 和 description", () => {
    render(<SoupIngredient {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sip-ingredient-sugar"));
    fireEvent.change(screen.getByTestId("sip-description-input"), { target: { value: "用幽默讓大家保持好心情笑聲不斷" } });
    fireEvent.click(screen.getByTestId("sip-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; ingredient: string; description: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].ingredient).toBe("sugar");
    expect(s.entries[0].description).toBe("用幽默讓大家保持好心情笑聲不斷");
  });

  it("已提交後顯示我的食材", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", ingredient: "ginger", description: "在低潮時為大家注入活力和能量" }], revealed: false };
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.getByTestId("sip-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", ingredient: "ginger", description: "在低潮時為大家注入活力和能量" }], revealed: false };
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.queryByTestId("sip-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<SoupIngredient {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("sip-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.queryByTestId("sip-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 sip-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.getByTestId("sip-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有食材", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", ingredient: "garlic", description: "把大家緊緊凝聚在一起" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", ingredient: "chili", description: "帶來打破框架的創意想法" },
      ],
      revealed: true,
    };
    render(<SoupIngredient {...defaultProps} />);
    expect(screen.getByTestId("sip-result")).toBeTruthy();
    expect(screen.getByTestId("sip-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("sip-card-u2-1")).toBeTruthy();
  });
});
