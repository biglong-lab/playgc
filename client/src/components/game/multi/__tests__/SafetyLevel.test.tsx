import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SafetyLevel } from "../SafetyLevel";

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

describe("SafetyLevel", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.getByTestId("sfl-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.getByTestId("sfl-title").textContent).toBe("安全感指數");
  });

  it("顯示自定義標題", () => {
    render(<SafetyLevel {...defaultProps} config={{ title: "舒適度評分" }} />);
    expect(screen.getByTestId("sfl-title").textContent).toBe("舒適度評分");
  });

  it("顯示問題文字", () => {
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.getByTestId("sfl-question")).toBeTruthy();
  });

  it("顯示自定義問題", () => {
    render(<SafetyLevel {...defaultProps} config={{ question: "你現在感覺如何？" }} />);
    expect(screen.getByTestId("sfl-question").textContent).toBe("你現在感覺如何？");
  });

  it("顯示已回應人數", () => {
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.getByTestId("sfl-count").textContent).toContain("0");
  });

  it("顯示評分表單", () => {
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.getByTestId("sfl-form")).toBeTruthy();
  });

  it("顯示 1-5 評分按鈕", () => {
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.getByTestId("sfl-btn-1")).toBeTruthy();
    expect(screen.getByTestId("sfl-btn-3")).toBeTruthy();
    expect(screen.getByTestId("sfl-btn-5")).toBeTruthy();
  });

  it("未選擇時提交按鈕禁用", () => {
    render(<SafetyLevel {...defaultProps} />);
    expect((screen.getByTestId("sfl-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("選擇等級後啟用提交", () => {
    render(<SafetyLevel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sfl-btn-4"));
    expect((screen.getByTestId("sfl-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("選擇後顯示等級標籤", () => {
    render(<SafetyLevel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sfl-btn-5"));
    expect(screen.getByTestId("sfl-level-label").textContent).toContain("非常安全");
  });

  it("提交後呼叫 updateState 含 level", () => {
    render(<SafetyLevel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sfl-btn-4"));
    fireEvent.click(screen.getByTestId("sfl-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; level: number }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].level).toBe(4);
  });

  it("已提交後顯示我的評分", () => {
    mockState = { entries: [{ userId: "u1", userName: "Alice", level: 5, note: "" }], revealed: false };
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.getByTestId("sfl-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ userId: "u1", userName: "Alice", level: 5, note: "" }], revealed: false };
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.queryByTestId("sfl-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<SafetyLevel {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("sfl-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.queryByTestId("sfl-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 sfl-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.getByTestId("sfl-empty")).toBeTruthy();
  });

  it("揭曉後顯示平均分和長條圖", () => {
    mockState = {
      entries: [
        { userId: "u1", userName: "Alice", level: 5, note: "" },
        { userId: "u2", userName: "Bob", level: 4, note: "" },
        { userId: "u3", userName: "Carol", level: 4, note: "" },
      ],
      revealed: true,
    };
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.getByTestId("sfl-result")).toBeTruthy();
    expect(screen.getByTestId("sfl-avg").textContent).toContain("4.3");
  });

  it("揭曉後各等級顯示長條", () => {
    mockState = { entries: [{ userId: "u1", userName: "Alice", level: 3, note: "" }], revealed: true };
    render(<SafetyLevel {...defaultProps} />);
    expect(screen.getByTestId("sfl-bar-3")).toBeTruthy();
    expect(screen.getByTestId("sfl-bar-5")).toBeTruthy();
  });
});
