import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HighLowCard } from "../HighLowCard";

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

describe("HighLowCard", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<HighLowCard {...defaultProps} />);
    expect(screen.getByTestId("hlc-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<HighLowCard {...defaultProps} />);
    expect(screen.getByTestId("hlc-title").textContent).toBe("今日高低起伏");
  });

  it("顯示自定義標題", () => {
    render(<HighLowCard {...defaultProps} config={{ title: "本週心情高低" }} />);
    expect(screen.getByTestId("hlc-title").textContent).toBe("本週心情高低");
  });

  it("顯示已收到卡片數", () => {
    render(<HighLowCard {...defaultProps} />);
    expect(screen.getByTestId("hlc-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<HighLowCard {...defaultProps} />);
    expect(screen.getByTestId("hlc-form")).toBeTruthy();
  });

  it("顯示高點輸入框", () => {
    render(<HighLowCard {...defaultProps} />);
    expect(screen.getByTestId("hlc-high-input")).toBeTruthy();
  });

  it("顯示低點輸入框", () => {
    render(<HighLowCard {...defaultProps} />);
    expect(screen.getByTestId("hlc-low-input")).toBeTruthy();
  });

  it("未填寫時提交按鈕禁用", () => {
    render(<HighLowCard {...defaultProps} />);
    const btn = screen.getByTestId("hlc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填高點時提交按鈕禁用", () => {
    render(<HighLowCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("hlc-high-input"), { target: { value: "完成一個大項目" } });
    const btn = screen.getByTestId("hlc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("兩欄都填後啟用提交按鈕", () => {
    render(<HighLowCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("hlc-high-input"), { target: { value: "完成重要提案" } });
    fireEvent.change(screen.getByTestId("hlc-low-input"), { target: { value: "會議超時了" } });
    const btn = screen.getByTestId("hlc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 high 和 low", () => {
    render(<HighLowCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("hlc-high-input"), { target: { value: "學到新技能" } });
    fireEvent.change(screen.getByTestId("hlc-low-input"), { target: { value: "睡眠不足" } });
    fireEvent.click(screen.getByTestId("hlc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ high: string; low: string; userId: string }>;
    };
    expect(newState.entries[0].high).toBe("學到新技能");
    expect(newState.entries[0].low).toBe("睡眠不足");
    expect(newState.entries[0].userId).toBe("u1");
  });

  it("已提交後顯示我的卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", high: "好消息", low: "壞消息" }],
      revealed: false,
    };
    render(<HighLowCard {...defaultProps} />);
    expect(screen.getByTestId("hlc-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", high: "好消息", low: "壞消息" }],
      revealed: false,
    };
    render(<HighLowCard {...defaultProps} />);
    expect(screen.queryByTestId("hlc-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<HighLowCard {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("hlc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<HighLowCard {...defaultProps} />);
    expect(screen.queryByTestId("hlc-reveal-btn")).toBeNull();
  });

  it("揭曉後無卡片顯示 hlc-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<HighLowCard {...defaultProps} />);
    expect(screen.getByTestId("hlc-empty")).toBeTruthy();
  });

  it("揭曉後有卡片顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", high: "勝利", low: "失敗" }],
      revealed: true,
    };
    render(<HighLowCard {...defaultProps} />);
    expect(screen.getByTestId("hlc-result")).toBeTruthy();
  });

  it("結果區顯示各人卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", high: "高1", low: "低1" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", high: "高2", low: "低2" },
      ],
      revealed: true,
    };
    render(<HighLowCard {...defaultProps} />);
    expect(screen.getByTestId("hlc-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("hlc-card-u2-1")).toBeTruthy();
  });

  it("自定義提問文字", () => {
    render(
      <HighLowCard
        {...defaultProps}
        config={{ highPrompt: "本週最精彩的時刻？", lowPrompt: "本週最難熬的時刻？" }}
      />,
    );
    expect(screen.getByText("本週最精彩的時刻？")).toBeTruthy();
    expect(screen.getByText("本週最難熬的時刻？")).toBeTruthy();
  });
});
