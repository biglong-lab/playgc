import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TodayWin } from "../TodayWin";

let mockState: Record<string, unknown> = { wins: [], revealed: false };
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
  mockState = { wins: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("TodayWin", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<TodayWin {...defaultProps} />);
    expect(screen.getByTestId("tdw-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<TodayWin {...defaultProps} />);
    expect(screen.getByTestId("tdw-title").textContent).toBe("今日小勝利");
  });

  it("顯示自定義標題", () => {
    render(<TodayWin {...defaultProps} config={{ title: "今日成就" }} />);
    expect(screen.getByTestId("tdw-title").textContent).toBe("今日成就");
  });

  it("顯示提示文字", () => {
    render(<TodayWin {...defaultProps} />);
    expect(screen.getByTestId("tdw-prompt")).toBeTruthy();
  });

  it("顯示已分享人數", () => {
    render(<TodayWin {...defaultProps} />);
    expect(screen.getByTestId("tdw-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<TodayWin {...defaultProps} />);
    expect(screen.getByTestId("tdw-form")).toBeTruthy();
  });

  it("顯示分類選項", () => {
    render(<TodayWin {...defaultProps} />);
    expect(screen.getByTestId("tdw-category-grid")).toBeTruthy();
    expect(screen.getByTestId("tdw-cat-personal")).toBeTruthy();
    expect(screen.getByTestId("tdw-cat-team")).toBeTruthy();
    expect(screen.getByTestId("tdw-cat-insight")).toBeTruthy();
  });

  it("顯示勝利描述輸入框", () => {
    render(<TodayWin {...defaultProps} />);
    expect(screen.getByTestId("tdw-win-input")).toBeTruthy();
  });

  it("未填描述時提交按鈕禁用", () => {
    render(<TodayWin {...defaultProps} />);
    expect((screen.getByTestId("tdw-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<TodayWin {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tdw-win-input"), { target: { value: "好" } });
    expect((screen.getByTestId("tdw-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<TodayWin {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tdw-win-input"), { target: { value: "成功帶領討論了一個小時" } });
    expect((screen.getByTestId("tdw-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換分類", () => {
    render(<TodayWin {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tdw-cat-team"));
    expect(screen.getByTestId("tdw-cat-team").className).toContain("blue-100");
  });

  it("提交後呼叫 updateState 含 category 和 win", () => {
    render(<TodayWin {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tdw-cat-insight"));
    fireEvent.change(screen.getByTestId("tdw-win-input"), { target: { value: "發現了新的解決方法" } });
    fireEvent.click(screen.getByTestId("tdw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { wins: Array<{ userId: string; category: string; win: string }> };
    expect(s.wins[0].userId).toBe("u1");
    expect(s.wins[0].category).toBe("insight");
    expect(s.wins[0].win).toBe("發現了新的解決方法");
  });

  it("已提交後顯示我的勝利", () => {
    mockState = { wins: [{ entryId: "u1-1", userId: "u1", userName: "Alice", category: "personal", win: "勇敢提問" }], revealed: false };
    render(<TodayWin {...defaultProps} />);
    expect(screen.getByTestId("tdw-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { wins: [{ entryId: "u1-1", userId: "u1", userName: "Alice", category: "personal", win: "勇敢提問" }], revealed: false };
    render(<TodayWin {...defaultProps} />);
    expect(screen.queryByTestId("tdw-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<TodayWin {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("tdw-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<TodayWin {...defaultProps} />);
    expect(screen.queryByTestId("tdw-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 tdw-empty", () => {
    mockState = { wins: [], revealed: true };
    render(<TodayWin {...defaultProps} />);
    expect(screen.getByTestId("tdw-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊勝利牆", () => {
    mockState = {
      wins: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", category: "personal", win: "首次帶領討論" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", category: "team", win: "大家一起完成挑戰" },
      ],
      revealed: true,
    };
    render(<TodayWin {...defaultProps} />);
    expect(screen.getByTestId("tdw-result")).toBeTruthy();
    expect(screen.getByTestId("tdw-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tdw-card-u2-1")).toBeTruthy();
  });
});
