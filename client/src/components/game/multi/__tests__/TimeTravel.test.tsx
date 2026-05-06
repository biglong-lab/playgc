import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeTravel } from "../TimeTravel";

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

describe("TimeTravel", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<TimeTravel {...defaultProps} />);
    expect(screen.getByTestId("ttv-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<TimeTravel {...defaultProps} />);
    expect(screen.getByTestId("ttv-title").textContent).toBe("時光機");
  });

  it("顯示自定義標題", () => {
    render(<TimeTravel {...defaultProps} config={{ title: "穿越時空" }} />);
    expect(screen.getByTestId("ttv-title").textContent).toBe("穿越時空");
  });

  it("顯示提示文字", () => {
    render(<TimeTravel {...defaultProps} />);
    expect(screen.getByTestId("ttv-prompt")).toBeTruthy();
  });

  it("顯示已選擇人數", () => {
    render(<TimeTravel {...defaultProps} />);
    expect(screen.getByTestId("ttv-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<TimeTravel {...defaultProps} />);
    expect(screen.getByTestId("ttv-form")).toBeTruthy();
  });

  it("顯示 5 個時代選項", () => {
    render(<TimeTravel {...defaultProps} />);
    expect(screen.getByTestId("ttv-period-grid")).toBeTruthy();
    expect(screen.getByTestId("ttv-period-prehistoric")).toBeTruthy();
    expect(screen.getByTestId("ttv-period-ancient")).toBeTruthy();
    expect(screen.getByTestId("ttv-period-industrial")).toBeTruthy();
    expect(screen.getByTestId("ttv-period-modern")).toBeTruthy();
    expect(screen.getByTestId("ttv-period-future")).toBeTruthy();
  });

  it("顯示原因輸入框", () => {
    render(<TimeTravel {...defaultProps} />);
    expect(screen.getByTestId("ttv-reason-input")).toBeTruthy();
  });

  it("未填原因時提交按鈕禁用", () => {
    render(<TimeTravel {...defaultProps} />);
    expect((screen.getByTestId("ttv-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<TimeTravel {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ttv-reason-input"), { target: { value: "很棒" } });
    expect((screen.getByTestId("ttv-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<TimeTravel {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ttv-reason-input"), { target: { value: "想親眼見到恐龍" } });
    expect((screen.getByTestId("ttv-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換時代選項", () => {
    render(<TimeTravel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ttv-period-ancient"));
    expect(screen.getByTestId("ttv-period-ancient").className).toContain("indigo-100");
  });

  it("提交後呼叫 updateState 含 period 和 reason", () => {
    render(<TimeTravel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ttv-period-prehistoric"));
    fireEvent.change(screen.getByTestId("ttv-reason-input"), { target: { value: "從小就對史前生物著迷" } });
    fireEvent.click(screen.getByTestId("ttv-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; period: string; reason: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].period).toBe("prehistoric");
    expect(s.entries[0].reason).toBe("從小就對史前生物著迷");
  });

  it("已提交後顯示我的選擇", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", period: "future", reason: "想看看 100 年後的世界長什麼樣" }], revealed: false };
    render(<TimeTravel {...defaultProps} />);
    expect(screen.getByTestId("ttv-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", period: "future", reason: "想看看 100 年後的世界長什麼樣" }], revealed: false };
    render(<TimeTravel {...defaultProps} />);
    expect(screen.queryByTestId("ttv-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<TimeTravel {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ttv-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<TimeTravel {...defaultProps} />);
    expect(screen.queryByTestId("ttv-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 ttv-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<TimeTravel {...defaultProps} />);
    expect(screen.getByTestId("ttv-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有目的地", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", period: "industrial", reason: "想見識蒸汽機發明的年代" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", period: "ancient", reason: "想親自探訪古埃及文明" },
      ],
      revealed: true,
    };
    render(<TimeTravel {...defaultProps} />);
    expect(screen.getByTestId("ttv-result")).toBeTruthy();
    expect(screen.getByTestId("ttv-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ttv-card-u2-1")).toBeTruthy();
  });
});
