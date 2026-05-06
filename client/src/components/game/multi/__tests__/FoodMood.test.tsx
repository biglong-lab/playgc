import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FoodMood } from "../FoodMood";

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

describe("FoodMood", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<FoodMood {...defaultProps} />);
    expect(screen.getByTestId("fm-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<FoodMood {...defaultProps} />);
    expect(screen.getByTestId("fm-title").textContent).toBe("今天我是哪道料理");
    expect(screen.getByTestId("fm-prompt").textContent).toContain("料理");
  });

  it("自訂 config 標題", () => {
    render(<FoodMood {...defaultProps} config={{ title: "今日料理大賽", prompt: "你是哪道菜？" }} />);
    expect(screen.getByTestId("fm-title").textContent).toBe("今日料理大賽");
    expect(screen.getByTestId("fm-prompt").textContent).toBe("你是哪道菜？");
  });

  it("顯示已選擇人數", () => {
    render(<FoodMood {...defaultProps} />);
    expect(screen.getByTestId("fm-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<FoodMood {...defaultProps} />);
    expect(screen.getByTestId("fm-form")).toBeTruthy();
    expect(screen.getByTestId("fm-reason-input")).toBeTruthy();
    expect(screen.getByTestId("fm-submit-btn")).toBeTruthy();
  });

  it("顯示所有 10 種料理按鈕", () => {
    render(<FoodMood {...defaultProps} />);
    ["ramen","pizza","salad","cake","coffee","bento","icecream","hotpot","bread","spicy"].forEach((id) => {
      expect(screen.getByTestId(`fm-food-${id}`)).toBeTruthy();
    });
  });

  it("未選料理時提交按鈕 disabled", () => {
    render(<FoodMood {...defaultProps} />);
    fireEvent.change(screen.getByTestId("fm-reason-input"), { target: { value: "今天需要溫暖的感覺" } });
    const btn = screen.getByTestId("fm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選料理但原因太短時 disabled", () => {
    render(<FoodMood {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fm-food-ramen"));
    fireEvent.change(screen.getByTestId("fm-reason-input"), { target: { value: "溫暖" } });
    const btn = screen.getByTestId("fm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選料理且原因 ≥5 字時提交按鈕啟用", () => {
    render(<FoodMood {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fm-food-pizza"));
    fireEvent.change(screen.getByTestId("fm-reason-input"), { target: { value: "今天想跟大家分享好東西" } });
    const btn = screen.getByTestId("fm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<FoodMood {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fm-food-hotpot"));
    fireEvent.change(screen.getByTestId("fm-reason-input"), { target: { value: "今天熱情沸騰想揪大家" } });
    fireEvent.click(screen.getByTestId("fm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", food: "salad", reason: "今天很想清爽輕盈" }],
      revealed: false,
    };
    render(<FoodMood {...defaultProps} />);
    expect(screen.getByTestId("fm-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("fm-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<FoodMood {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("fm-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<FoodMood {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("fm-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<FoodMood {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("fm-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<FoodMood {...defaultProps} />);
    expect(screen.getByTestId("fm-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 fm-result 和料理摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", food: "coffee", reason: "今天需要提神專注工作" }],
      revealed: true,
    };
    render(<FoodMood {...defaultProps} />);
    expect(screen.getByTestId("fm-result")).toBeTruthy();
    expect(screen.getByTestId("fm-food-summary")).toBeTruthy();
    expect(screen.getByTestId("fm-badge-coffee")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", food: "cake", reason: "今天心情甜甜的超開心" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", food: "spicy", reason: "今天充滿衝勁要衝業績" },
      ],
      revealed: true,
    };
    render(<FoodMood {...defaultProps} />);
    expect(screen.getByTestId("fm-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("fm-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<FoodMood {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("fm-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", food: "bread", reason: "今天踏實可靠穩穩前行" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", food: "icecream", reason: "今天放鬆獎勵一下自己" },
      ],
      revealed: false,
    };
    render(<FoodMood {...defaultProps} />);
    expect(screen.getByTestId("fm-count").textContent).toContain("2");
  });
});
