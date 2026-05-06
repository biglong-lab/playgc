import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoffeeOrder } from "../CoffeeOrder";

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

describe("CoffeeOrder", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<CoffeeOrder {...defaultProps} />);
    expect(screen.getByTestId("cof-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<CoffeeOrder {...defaultProps} />);
    expect(screen.getByTestId("cof-title").textContent).toBe("我今天的飲料訂單");
    expect(screen.getByTestId("cof-prompt").textContent).toContain("飲料");
  });

  it("自訂 config 標題", () => {
    render(<CoffeeOrder {...defaultProps} config={{ title: "今日飲品人格", prompt: "你今天想喝什麼？" }} />);
    expect(screen.getByTestId("cof-title").textContent).toBe("今日飲品人格");
    expect(screen.getByTestId("cof-prompt").textContent).toBe("你今天想喝什麼？");
  });

  it("顯示已選擇人數", () => {
    render(<CoffeeOrder {...defaultProps} />);
    expect(screen.getByTestId("cof-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<CoffeeOrder {...defaultProps} />);
    expect(screen.getByTestId("cof-form")).toBeTruthy();
    expect(screen.getByTestId("cof-reason-input")).toBeTruthy();
    expect(screen.getByTestId("cof-submit-btn")).toBeTruthy();
  });

  it("顯示所有 9 種飲料按鈕", () => {
    render(<CoffeeOrder {...defaultProps} />);
    ["americano","latte","cappuccino","espresso","matcha","boba","juice","water","hotchocolate"].forEach((id) => {
      expect(screen.getByTestId(`cof-drink-${id}`)).toBeTruthy();
    });
  });

  it("未選飲料時提交按鈕 disabled", () => {
    render(<CoffeeOrder {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cof-reason-input"), { target: { value: "直接純粹不拐彎抹角" } });
    const btn = screen.getByTestId("cof-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選飲料但原因太短時 disabled", () => {
    render(<CoffeeOrder {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cof-drink-matcha"));
    fireEvent.change(screen.getByTestId("cof-reason-input"), { target: { value: "清雅" } });
    const btn = screen.getByTestId("cof-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選飲料且原因 ≥5 字時提交按鈕啟用", () => {
    render(<CoffeeOrder {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cof-drink-boba"));
    fireEvent.change(screen.getByTestId("cof-reason-input"), { target: { value: "多元混搭活潑有趣好玩" } });
    const btn = screen.getByTestId("cof-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<CoffeeOrder {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cof-drink-latte"));
    fireEvent.change(screen.getByTestId("cof-reason-input"), { target: { value: "溫和順口兼顧各方需求" } });
    fireEvent.click(screen.getByTestId("cof-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", drink: "espresso", reason: "精準高效爆發力十足" }],
      revealed: false,
    };
    render(<CoffeeOrder {...defaultProps} />);
    expect(screen.getByTestId("cof-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("cof-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<CoffeeOrder {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("cof-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<CoffeeOrder {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("cof-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<CoffeeOrder {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("cof-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<CoffeeOrder {...defaultProps} />);
    expect(screen.getByTestId("cof-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 cof-result 和飲料摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", drink: "water", reason: "純粹自在不需要任何裝飾" }],
      revealed: true,
    };
    render(<CoffeeOrder {...defaultProps} />);
    expect(screen.getByTestId("cof-result")).toBeTruthy();
    expect(screen.getByTestId("cof-drink-summary")).toBeTruthy();
    expect(screen.getByTestId("cof-badge-water")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", drink: "americano", reason: "直接純粹不拐彎抹角說話" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", drink: "hotchocolate", reason: "溫暖療癒今天需要甜甜" },
      ],
      revealed: true,
    };
    render(<CoffeeOrder {...defaultProps} />);
    expect(screen.getByTestId("cof-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("cof-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<CoffeeOrder {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("cof-reveal-btn")).toBeNull();
  });

  it("已點單人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", drink: "cappuccino", reason: "細膩層次有點小講究品味" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", drink: "juice", reason: "清新活力自然健康每天" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", drink: "matcha", reason: "沉穩清雅自有風格氣質" },
      ],
      revealed: false,
    };
    render(<CoffeeOrder {...defaultProps} />);
    expect(screen.getByTestId("cof-count").textContent).toContain("3");
  });
});
