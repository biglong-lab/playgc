import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TravelStyle } from "../TravelStyle";

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

describe("TravelStyle", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TravelStyle {...defaultProps} />);
    expect(screen.getByTestId("ts-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<TravelStyle {...defaultProps} />);
    expect(screen.getByTestId("ts-title").textContent).toBe("我的旅行風格");
    expect(screen.getByTestId("ts-prompt").textContent).toContain("旅行");
  });

  it("自訂 config 標題", () => {
    render(<TravelStyle {...defaultProps} config={{ title: "旅行者類型", prompt: "你怎麼旅行？" }} />);
    expect(screen.getByTestId("ts-title").textContent).toBe("旅行者類型");
    expect(screen.getByTestId("ts-prompt").textContent).toBe("你怎麼旅行？");
  });

  it("顯示已分享人數", () => {
    render(<TravelStyle {...defaultProps} />);
    expect(screen.getByTestId("ts-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<TravelStyle {...defaultProps} />);
    expect(screen.getByTestId("ts-form")).toBeTruthy();
    expect(screen.getByTestId("ts-dream-input")).toBeTruthy();
    expect(screen.getByTestId("ts-submit-btn")).toBeTruthy();
  });

  it("顯示所有 8 種旅行風格按鈕", () => {
    render(<TravelStyle {...defaultProps} />);
    ["backpacker","luxury","adventure","cultural","foodie","relax","photo","local"].forEach((id) => {
      expect(screen.getByTestId(`ts-style-${id}`)).toBeTruthy();
    });
  });

  it("未選風格時提交按鈕 disabled", () => {
    render(<TravelStyle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ts-dream-input"), { target: { value: "想去日本感受古都文化" } });
    const btn = screen.getByTestId("ts-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選風格但夢想太短時 disabled", () => {
    render(<TravelStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ts-style-foodie"));
    fireEvent.change(screen.getByTestId("ts-dream-input"), { target: { value: "日本" } });
    const btn = screen.getByTestId("ts-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選風格且夢想 ≥5 字時提交按鈕啟用", () => {
    render(<TravelStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ts-style-backpacker"));
    fireEvent.change(screen.getByTestId("ts-dream-input"), { target: { value: "想用一年環遊世界" } });
    const btn = screen.getByTestId("ts-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<TravelStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ts-style-cultural"));
    fireEvent.change(screen.getByTestId("ts-dream-input"), { target: { value: "想深度了解埃及古文明" } });
    fireEvent.click(screen.getByTestId("ts-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", style: "photo", dream: "想去冰島拍攝極光" }],
      revealed: false,
    };
    render(<TravelStyle {...defaultProps} />);
    expect(screen.getByTestId("ts-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("ts-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<TravelStyle {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("ts-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<TravelStyle {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ts-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<TravelStyle {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("ts-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<TravelStyle {...defaultProps} />);
    expect(screen.getByTestId("ts-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 ts-result 和風格摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", style: "relax", dream: "想去馬爾地夫完全放空" }],
      revealed: true,
    };
    render(<TravelStyle {...defaultProps} />);
    expect(screen.getByTestId("ts-result")).toBeTruthy();
    expect(screen.getByTestId("ts-style-summary")).toBeTruthy();
    expect(screen.getByTestId("ts-badge-relax")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", style: "adventure", dream: "想去喜馬拉雅山健行" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", style: "luxury", dream: "想住超豪華飯店享受" },
      ],
      revealed: true,
    };
    render(<TravelStyle {...defaultProps} />);
    expect(screen.getByTestId("ts-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ts-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<TravelStyle {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("ts-reveal-btn")).toBeNull();
  });

  it("已分享人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", style: "local", dream: "想住在當地人家體驗生活" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", style: "foodie", dream: "想去義大利吃遍各地美食" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", style: "photo", dream: "想去秘魯拍馬丘比丘日出" },
      ],
      revealed: false,
    };
    render(<TravelStyle {...defaultProps} />);
    expect(screen.getByTestId("ts-count").textContent).toContain("3");
  });
});
