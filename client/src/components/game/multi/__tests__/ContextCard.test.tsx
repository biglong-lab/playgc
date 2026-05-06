import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextCard } from "../ContextCard";

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

describe("ContextCard", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<ContextCard {...defaultProps} />);
    expect(screen.getByTestId("cxt-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<ContextCard {...defaultProps} />);
    expect(screen.getByTestId("cxt-title").textContent).toBe("會前脈絡卡");
  });

  it("顯示自定義標題", () => {
    render(<ContextCard {...defaultProps} config={{ title: "今日狀態確認" }} />);
    expect(screen.getByTestId("cxt-title").textContent).toBe("今日狀態確認");
  });

  it("顯示提示文字", () => {
    render(<ContextCard {...defaultProps} />);
    expect(screen.getByTestId("cxt-prompt")).toBeTruthy();
  });

  it("顯示已完成人數", () => {
    render(<ContextCard {...defaultProps} />);
    expect(screen.getByTestId("cxt-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<ContextCard {...defaultProps} />);
    expect(screen.getByTestId("cxt-form")).toBeTruthy();
  });

  it("顯示三個燈號選項", () => {
    render(<ContextCard {...defaultProps} />);
    expect(screen.getByTestId("cxt-signal-grid")).toBeTruthy();
    expect(screen.getByTestId("cxt-signal-green")).toBeTruthy();
    expect(screen.getByTestId("cxt-signal-yellow")).toBeTruthy();
    expect(screen.getByTestId("cxt-signal-red")).toBeTruthy();
  });

  it("顯示脈絡輸入框", () => {
    render(<ContextCard {...defaultProps} />);
    expect(screen.getByTestId("cxt-context-input")).toBeTruthy();
  });

  it("未填脈絡時提交按鈕禁用", () => {
    render(<ContextCard {...defaultProps} />);
    expect((screen.getByTestId("cxt-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<ContextCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cxt-context-input"), { target: { value: "還好" } });
    expect((screen.getByTestId("cxt-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<ContextCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cxt-context-input"), { target: { value: "剛剛開完一個長會議" } });
    expect((screen.getByTestId("cxt-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換信號燈號", () => {
    render(<ContextCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cxt-signal-red"));
    expect(screen.getByTestId("cxt-signal-red").className).toContain("red-100");
  });

  it("提交後呼叫 updateState 含 signal 和 context", () => {
    render(<ContextCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cxt-signal-yellow"));
    fireEvent.change(screen.getByTestId("cxt-context-input"), { target: { value: "早上有些事情讓我有點分心" } });
    fireEvent.click(screen.getByTestId("cxt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; signal: string; context: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].signal).toBe("yellow");
    expect(s.entries[0].context).toBe("早上有些事情讓我有點分心");
  });

  it("已提交後顯示我的脈絡卡", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", signal: "green", context: "今天狀態很好準備好了" }], revealed: false };
    render(<ContextCard {...defaultProps} />);
    expect(screen.getByTestId("cxt-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", signal: "green", context: "今天狀態很好準備好了" }], revealed: false };
    render(<ContextCard {...defaultProps} />);
    expect(screen.queryByTestId("cxt-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<ContextCard {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("cxt-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<ContextCard {...defaultProps} />);
    expect(screen.queryByTestId("cxt-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 cxt-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<ContextCard {...defaultProps} />);
    expect(screen.getByTestId("cxt-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊脈絡牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", signal: "green", context: "準備好了很興奮" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", signal: "yellow", context: "有點累但想參與" },
      ],
      revealed: true,
    };
    render(<ContextCard {...defaultProps} />);
    expect(screen.getByTestId("cxt-result")).toBeTruthy();
    expect(screen.getByTestId("cxt-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("cxt-card-u2-1")).toBeTruthy();
  });
});
