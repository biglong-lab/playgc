import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VolcanoReport } from "../VolcanoReport";

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

describe("VolcanoReport", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.getByTestId("vlc-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.getByTestId("vlc-title").textContent).toBe("火山報告");
  });

  it("顯示自定義標題", () => {
    render(<VolcanoReport {...defaultProps} config={{ title: "能量儀表板" }} />);
    expect(screen.getByTestId("vlc-title").textContent).toBe("能量儀表板");
  });

  it("顯示提示文字", () => {
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.getByTestId("vlc-prompt")).toBeTruthy();
  });

  it("顯示已回報人數", () => {
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.getByTestId("vlc-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.getByTestId("vlc-form")).toBeTruthy();
  });

  it("顯示 5 個能量狀態", () => {
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.getByTestId("vlc-state-grid")).toBeTruthy();
    expect(screen.getByTestId("vlc-state-dormant")).toBeTruthy();
    expect(screen.getByTestId("vlc-state-warming")).toBeTruthy();
    expect(screen.getByTestId("vlc-state-active")).toBeTruthy();
    expect(screen.getByTestId("vlc-state-erupting")).toBeTruthy();
    expect(screen.getByTestId("vlc-state-cooling")).toBeTruthy();
  });

  it("顯示訊息輸入框", () => {
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.getByTestId("vlc-message-input")).toBeTruthy();
  });

  it("未填訊息時提交按鈕禁用", () => {
    render(<VolcanoReport {...defaultProps} />);
    expect((screen.getByTestId("vlc-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<VolcanoReport {...defaultProps} />);
    fireEvent.change(screen.getByTestId("vlc-message-input"), { target: { value: "還好" } });
    expect((screen.getByTestId("vlc-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<VolcanoReport {...defaultProps} />);
    fireEvent.change(screen.getByTestId("vlc-message-input"), { target: { value: "今天能量很滿可以衝" } });
    expect((screen.getByTestId("vlc-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換能量狀態", () => {
    render(<VolcanoReport {...defaultProps} />);
    fireEvent.click(screen.getByTestId("vlc-state-erupting"));
    expect(screen.getByTestId("vlc-state-erupting").className).toContain("red-100");
  });

  it("提交後呼叫 updateState 含 state 和 message", () => {
    render(<VolcanoReport {...defaultProps} />);
    fireEvent.click(screen.getByTestId("vlc-state-warming"));
    fireEvent.change(screen.getByTestId("vlc-message-input"), { target: { value: "剛睡醒慢慢熱起來中" } });
    fireEvent.click(screen.getByTestId("vlc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; state: string; message: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].state).toBe("warming");
    expect(s.entries[0].message).toBe("剛睡醒慢慢熱起來中");
  });

  it("已提交後顯示我的報告", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", state: "active", message: "今天狀態很好準備好了" }], revealed: false };
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.getByTestId("vlc-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", state: "active", message: "今天狀態很好準備好了" }], revealed: false };
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.queryByTestId("vlc-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<VolcanoReport {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("vlc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.queryByTestId("vlc-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 vlc-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.getByTestId("vlc-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有能量報告", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", state: "erupting", message: "超級有動力今天要征服一切" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", state: "cooling", message: "昨天加班了需要補充能量" },
      ],
      revealed: true,
    };
    render(<VolcanoReport {...defaultProps} />);
    expect(screen.getByTestId("vlc-result")).toBeTruthy();
    expect(screen.getByTestId("vlc-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("vlc-card-u2-1")).toBeTruthy();
  });
});
