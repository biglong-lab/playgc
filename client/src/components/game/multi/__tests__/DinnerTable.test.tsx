import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DinnerTable } from "../DinnerTable";

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

describe("DinnerTable", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<DinnerTable {...defaultProps} />);
    expect(screen.getByTestId("dnt-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<DinnerTable {...defaultProps} />);
    expect(screen.getByTestId("dnt-title").textContent).toBe("餐桌話題");
  });

  it("顯示自定義標題", () => {
    render(<DinnerTable {...defaultProps} config={{ title: "飯局閒聊" }} />);
    expect(screen.getByTestId("dnt-title").textContent).toBe("飯局閒聊");
  });

  it("顯示提示文字", () => {
    render(<DinnerTable {...defaultProps} />);
    expect(screen.getByTestId("dnt-prompt")).toBeTruthy();
  });

  it("顯示已分享人數", () => {
    render(<DinnerTable {...defaultProps} />);
    expect(screen.getByTestId("dnt-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<DinnerTable {...defaultProps} />);
    expect(screen.getByTestId("dnt-form")).toBeTruthy();
  });

  it("顯示 5 個話題選項", () => {
    render(<DinnerTable {...defaultProps} />);
    expect(screen.getByTestId("dnt-topic-grid")).toBeTruthy();
    expect(screen.getByTestId("dnt-topic-travel")).toBeTruthy();
    expect(screen.getByTestId("dnt-topic-childhood")).toBeTruthy();
    expect(screen.getByTestId("dnt-topic-dream")).toBeTruthy();
    expect(screen.getByTestId("dnt-topic-food")).toBeTruthy();
    expect(screen.getByTestId("dnt-topic-funny")).toBeTruthy();
  });

  it("顯示故事輸入框", () => {
    render(<DinnerTable {...defaultProps} />);
    expect(screen.getByTestId("dnt-story-input")).toBeTruthy();
  });

  it("未填故事時提交按鈕禁用", () => {
    render(<DinnerTable {...defaultProps} />);
    expect((screen.getByTestId("dnt-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<DinnerTable {...defaultProps} />);
    fireEvent.change(screen.getByTestId("dnt-story-input"), { target: { value: "好吃" } });
    expect((screen.getByTestId("dnt-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<DinnerTable {...defaultProps} />);
    fireEvent.change(screen.getByTestId("dnt-story-input"), { target: { value: "我最愛吃台南牛肉湯" } });
    expect((screen.getByTestId("dnt-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換話題選項", () => {
    render(<DinnerTable {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dnt-topic-funny"));
    expect(screen.getByTestId("dnt-topic-funny").className).toContain("orange-100");
  });

  it("提交後呼叫 updateState 含 topic 和 story", () => {
    render(<DinnerTable {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dnt-topic-childhood"));
    fireEvent.change(screen.getByTestId("dnt-story-input"), { target: { value: "小時候最愛跟鄰居玩躲貓貓到天黑" } });
    fireEvent.click(screen.getByTestId("dnt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; topic: string; story: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].topic).toBe("childhood");
    expect(s.entries[0].story).toBe("小時候最愛跟鄰居玩躲貓貓到天黑");
  });

  it("已提交後顯示我的故事", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", topic: "dream", story: "夢想是環遊世界每個角落" }], revealed: false };
    render(<DinnerTable {...defaultProps} />);
    expect(screen.getByTestId("dnt-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", topic: "dream", story: "夢想是環遊世界每個角落" }], revealed: false };
    render(<DinnerTable {...defaultProps} />);
    expect(screen.queryByTestId("dnt-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<DinnerTable {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("dnt-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<DinnerTable {...defaultProps} />);
    expect(screen.queryByTestId("dnt-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 dnt-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<DinnerTable {...defaultProps} />);
    expect(screen.getByTestId("dnt-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有故事", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", topic: "travel", story: "去北海道看到漫天大雪震撼到說不出話" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", topic: "food", story: "媽媽做的紅燒肉是世界第一名" },
      ],
      revealed: true,
    };
    render(<DinnerTable {...defaultProps} />);
    expect(screen.getByTestId("dnt-result")).toBeTruthy();
    expect(screen.getByTestId("dnt-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("dnt-card-u2-1")).toBeTruthy();
  });
});
