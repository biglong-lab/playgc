import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeartBeat } from "../HeartBeat";

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

describe("HeartBeat", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<HeartBeat {...defaultProps} />);
    expect(screen.getByTestId("hbt-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<HeartBeat {...defaultProps} />);
    expect(screen.getByTestId("hbt-title").textContent).toBe("心跳頻率");
  });

  it("顯示自定義標題", () => {
    render(<HeartBeat {...defaultProps} config={{ title: "今日能量" }} />);
    expect(screen.getByTestId("hbt-title").textContent).toBe("今日能量");
  });

  it("顯示提示文字", () => {
    render(<HeartBeat {...defaultProps} />);
    expect(screen.getByTestId("hbt-prompt")).toBeTruthy();
  });

  it("顯示已完成人數", () => {
    render(<HeartBeat {...defaultProps} />);
    expect(screen.getByTestId("hbt-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<HeartBeat {...defaultProps} />);
    expect(screen.getByTestId("hbt-form")).toBeTruthy();
  });

  it("顯示五個心跳速度選項", () => {
    render(<HeartBeat {...defaultProps} />);
    expect(screen.getByTestId("hbt-speed-grid")).toBeTruthy();
    expect(screen.getByTestId("hbt-speed-racing")).toBeTruthy();
    expect(screen.getByTestId("hbt-speed-steady")).toBeTruthy();
    expect(screen.getByTestId("hbt-speed-gentle")).toBeTruthy();
    expect(screen.getByTestId("hbt-speed-slow")).toBeTruthy();
    expect(screen.getByTestId("hbt-speed-skipping")).toBeTruthy();
  });

  it("顯示原因輸入框", () => {
    render(<HeartBeat {...defaultProps} />);
    expect(screen.getByTestId("hbt-reason-input")).toBeTruthy();
  });

  it("未填原因時提交按鈕禁用", () => {
    render(<HeartBeat {...defaultProps} />);
    expect((screen.getByTestId("hbt-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 3 字時仍禁用", () => {
    render(<HeartBeat {...defaultProps} />);
    fireEvent.change(screen.getByTestId("hbt-reason-input"), { target: { value: "好" } });
    expect((screen.getByTestId("hbt-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("3 字以上啟用提交按鈕", () => {
    render(<HeartBeat {...defaultProps} />);
    fireEvent.change(screen.getByTestId("hbt-reason-input"), { target: { value: "今天很充實" } });
    expect((screen.getByTestId("hbt-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換心跳速度後樣式改變", () => {
    render(<HeartBeat {...defaultProps} />);
    fireEvent.click(screen.getByTestId("hbt-speed-racing"));
    expect(screen.getByTestId("hbt-speed-racing").className).toContain("rose-100");
  });

  it("提交後呼叫 updateState 含 speed 和 reason", () => {
    render(<HeartBeat {...defaultProps} />);
    fireEvent.click(screen.getByTestId("hbt-speed-gentle"));
    fireEvent.change(screen.getByTestId("hbt-reason-input"), { target: { value: "今天感覺很輕鬆" } });
    fireEvent.click(screen.getByTestId("hbt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; speed: string; reason: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].speed).toBe("gentle");
    expect(s.entries[0].reason).toBe("今天感覺很輕鬆");
  });

  it("已提交後顯示我的心跳", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", speed: "racing", reason: "充滿活力" }], revealed: false };
    render(<HeartBeat {...defaultProps} />);
    expect(screen.getByTestId("hbt-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", speed: "racing", reason: "充滿活力" }], revealed: false };
    render(<HeartBeat {...defaultProps} />);
    expect(screen.queryByTestId("hbt-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<HeartBeat {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("hbt-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<HeartBeat {...defaultProps} />);
    expect(screen.queryByTestId("hbt-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 hbt-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<HeartBeat {...defaultProps} />);
    expect(screen.getByTestId("hbt-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊心跳牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", speed: "racing", reason: "超有活力" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", speed: "slow", reason: "正在沉澱" },
      ],
      revealed: true,
    };
    render(<HeartBeat {...defaultProps} />);
    expect(screen.getByTestId("hbt-result")).toBeTruthy();
    expect(screen.getByTestId("hbt-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("hbt-card-u2-1")).toBeTruthy();
  });
});
