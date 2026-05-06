import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityMemo } from "../ActivityMemo";

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

describe("ActivityMemo", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.getByTestId("amm-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.getByTestId("amm-title").textContent).toBe("活動備忘錄");
  });

  it("顯示自定義標題", () => {
    render(<ActivityMemo {...defaultProps} config={{ title: "今日學習記錄" }} />);
    expect(screen.getByTestId("amm-title").textContent).toBe("今日學習記錄");
  });

  it("顯示已完成數量", () => {
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.getByTestId("amm-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.getByTestId("amm-form")).toBeTruthy();
  });

  it("顯示關鍵詞輸入框", () => {
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.getByTestId("amm-keyword-input")).toBeTruthy();
  });

  it("顯示行動計劃輸入框", () => {
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.getByTestId("amm-action-input")).toBeTruthy();
  });

  it("未填寫時提交按鈕禁用", () => {
    render(<ActivityMemo {...defaultProps} />);
    const btn = screen.getByTestId("amm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填關鍵詞時提交按鈕禁用", () => {
    render(<ActivityMemo {...defaultProps} />);
    fireEvent.change(screen.getByTestId("amm-keyword-input"), { target: { value: "溝通" } });
    const btn = screen.getByTestId("amm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("填寫兩欄後啟用提交按鈕", () => {
    render(<ActivityMemo {...defaultProps} />);
    fireEvent.change(screen.getByTestId("amm-keyword-input"), { target: { value: "信任" } });
    fireEvent.change(screen.getByTestId("amm-action-input"), { target: { value: "每天打一通電話" } });
    const btn = screen.getByTestId("amm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 且包含 keyword 與 action", () => {
    render(<ActivityMemo {...defaultProps} />);
    fireEvent.change(screen.getByTestId("amm-keyword-input"), { target: { value: "合作" } });
    fireEvent.change(screen.getByTestId("amm-action-input"), { target: { value: "每週開一次隊伍會議" } });
    fireEvent.click(screen.getByTestId("amm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ keyword: string; action: string; userId: string }>;
    };
    expect(newState.entries[0].keyword).toBe("合作");
    expect(newState.entries[0].action).toBe("每週開一次隊伍會議");
    expect(newState.entries[0].userId).toBe("u1");
  });

  it("已提交後顯示我的備忘錄", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", keyword: "靈感", action: "睡前寫3件好事" }],
      revealed: false,
    };
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.getByTestId("amm-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏輸入表單", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", keyword: "靈感", action: "睡前寫3件好事" }],
      revealed: false,
    };
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.queryByTestId("amm-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<ActivityMemo {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("amm-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.queryByTestId("amm-reveal-btn")).toBeNull();
  });

  it("揭曉後無備忘錄顯示 amm-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.getByTestId("amm-empty")).toBeTruthy();
  });

  it("揭曉後有備忘錄顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", keyword: "勇氣", action: "主動分享一個想法" }],
      revealed: true,
    };
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.getByTestId("amm-result")).toBeTruthy();
  });

  it("結果區顯示備忘錄卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", keyword: "勇氣", action: "主動發言" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", keyword: "耐心", action: "先聽再說" },
      ],
      revealed: true,
    };
    render(<ActivityMemo {...defaultProps} />);
    expect(screen.getByTestId("amm-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("amm-card-u2-1")).toBeTruthy();
  });

  it("自定義提問文字", () => {
    render(
      <ActivityMemo
        {...defaultProps}
        config={{ keywordPrompt: "今天學到什麼？", actionPrompt: "回去要做什麼？" }}
      />,
    );
    expect(screen.getByText("今天學到什麼？")).toBeTruthy();
    expect(screen.getByText("回去要做什麼？")).toBeTruthy();
  });
});
