import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PizzaType } from "../PizzaType";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
let mockIsLoaded = true;
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
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("PizzaType", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-loading")).toBeTruthy();
  });

  it("顯示標題", () => {
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-title").textContent).toBe("我是哪種披薩");
  });

  it("顯示自定義標題", () => {
    render(<PizzaType {...defaultProps} config={{ title: "披薩派對" }} />);
    expect(screen.getByTestId("pza-title").textContent).toBe("披薩派對");
  });

  it("顯示提示文字", () => {
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<PizzaType {...defaultProps} config={{ prompt: "你最像哪種披薩？" }} />);
    expect(screen.getByTestId("pza-prompt").textContent).toBe("你最像哪種披薩？");
  });

  it("顯示已選擇人數", () => {
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-count").textContent).toContain("0");
  });

  it("顯示選擇表單", () => {
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-form")).toBeTruthy();
  });

  it("顯示瑪格麗特選項", () => {
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-pizza-margherita")).toBeTruthy();
  });

  it("顯示卡爾佐內選項", () => {
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-pizza-calzone")).toBeTruthy();
  });

  it("送出按鈕預設禁用", () => {
    render(<PizzaType {...defaultProps} />);
    const btn = screen.getByTestId("pza-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選擇披薩並輸入理由後啟用送出", () => {
    render(<PizzaType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pza-pizza-truffle"));
    fireEvent.change(screen.getByTestId("pza-reason-input"), { target: { value: "奢華細膩不凡品味" } });
    const btn = screen.getByTestId("pza-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("理由不足5字時禁用送出", () => {
    render(<PizzaType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pza-pizza-hawaii"));
    fireEvent.change(screen.getByTestId("pza-reason-input"), { target: { value: "甜" } });
    const btn = screen.getByTestId("pza-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("送出後呼叫 updateState", () => {
    render(<PizzaType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pza-pizza-four_cheese"));
    fireEvent.change(screen.getByTestId("pza-reason-input"), { target: { value: "濃郁複雜越陷越深" } });
    fireEvent.click(screen.getByTestId("pza-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已有作答時顯示我的作答區", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", pizza: "seafood", reason: "鮮美豐盛層次豐富" }], revealed: false };
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-my-entry")).toBeTruthy();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<PizzaType {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("pza-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<PizzaType {...defaultProps} />);
    expect(screen.queryByTestId("pza-reveal-btn")).toBeNull();
  });

  it("揭曉後無作答顯示 pza-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-empty")).toBeTruthy();
  });

  it("揭曉後有作答顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-2", userId: "u1", userName: "Alice", pizza: "bbq_chicken", reason: "煙燻香甜讓人著迷" }],
      revealed: true,
    };
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-result")).toBeTruthy();
  });

  it("結果區顯示披薩 badge", () => {
    mockState = {
      entries: [{ entryId: "u1-3", userId: "u1", userName: "Alice", pizza: "pepperoni", reason: "熱辣強烈個性鮮明" }],
      revealed: true,
    };
    render(<PizzaType {...defaultProps} />);
    expect(screen.getByTestId("pza-badge-pepperoni")).toBeTruthy();
  });
});
