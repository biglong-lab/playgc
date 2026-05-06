import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoonPhase } from "../MoonPhase";

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

describe("MoonPhase", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<MoonPhase {...defaultProps} />);
    expect(screen.getByTestId("mnp-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<MoonPhase {...defaultProps} />);
    expect(screen.getByTestId("mnp-title").textContent).toBe("月相心情");
  });

  it("顯示自定義標題", () => {
    render(<MoonPhase {...defaultProps} config={{ title: "今日能量" }} />);
    expect(screen.getByTestId("mnp-title").textContent).toBe("今日能量");
  });

  it("顯示提示文字", () => {
    render(<MoonPhase {...defaultProps} />);
    expect(screen.getByTestId("mnp-prompt")).toBeTruthy();
  });

  it("顯示自定義提示", () => {
    render(<MoonPhase {...defaultProps} config={{ prompt: "哪個月相是你？" }} />);
    expect(screen.getByTestId("mnp-prompt").textContent).toBe("哪個月相是你？");
  });

  it("顯示已分享人數", () => {
    render(<MoonPhase {...defaultProps} />);
    expect(screen.getByTestId("mnp-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<MoonPhase {...defaultProps} />);
    expect(screen.getByTestId("mnp-form")).toBeTruthy();
  });

  it("顯示月相選擇格", () => {
    render(<MoonPhase {...defaultProps} />);
    expect(screen.getByTestId("mnp-phase-grid")).toBeTruthy();
    expect(screen.getByTestId("mnp-phase-new")).toBeTruthy();
    expect(screen.getByTestId("mnp-phase-waxing")).toBeTruthy();
    expect(screen.getByTestId("mnp-phase-full")).toBeTruthy();
    expect(screen.getByTestId("mnp-phase-waning")).toBeTruthy();
    expect(screen.getByTestId("mnp-phase-dark")).toBeTruthy();
  });

  it("顯示原因輸入框", () => {
    render(<MoonPhase {...defaultProps} />);
    expect(screen.getByTestId("mnp-reason-input")).toBeTruthy();
  });

  it("未填原因時提交按鈕禁用", () => {
    render(<MoonPhase {...defaultProps} />);
    expect((screen.getByTestId("mnp-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 3 字時仍禁用", () => {
    render(<MoonPhase {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mnp-reason-input"), { target: { value: "好" } });
    expect((screen.getByTestId("mnp-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("3 字以上啟用提交按鈕", () => {
    render(<MoonPhase {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mnp-reason-input"), { target: { value: "今天充滿能量" } });
    expect((screen.getByTestId("mnp-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換月相", () => {
    render(<MoonPhase {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mnp-phase-new"));
    expect(screen.getByTestId("mnp-phase-new").className).toContain("slate-100");
  });

  it("提交後呼叫 updateState 含 phase 和 reason", () => {
    render(<MoonPhase {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mnp-phase-waxing"));
    fireEvent.change(screen.getByTestId("mnp-reason-input"), { target: { value: "正在成長學習中" } });
    fireEvent.click(screen.getByTestId("mnp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; phase: string; reason: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].phase).toBe("waxing");
    expect(s.entries[0].reason).toBe("正在成長學習中");
  });

  it("已提交後顯示我的月相", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", phase: "full", reason: "今天超有活力" }], revealed: false };
    render(<MoonPhase {...defaultProps} />);
    expect(screen.getByTestId("mnp-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", phase: "full", reason: "今天超有活力" }], revealed: false };
    render(<MoonPhase {...defaultProps} />);
    expect(screen.queryByTestId("mnp-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<MoonPhase {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("mnp-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<MoonPhase {...defaultProps} />);
    expect(screen.queryByTestId("mnp-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 mnp-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MoonPhase {...defaultProps} />);
    expect(screen.getByTestId("mnp-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊月相牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", phase: "full", reason: "能量滿滿" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", phase: "waning", reason: "正在沉澱" },
      ],
      revealed: true,
    };
    render(<MoonPhase {...defaultProps} />);
    expect(screen.getByTestId("mnp-result")).toBeTruthy();
    expect(screen.getByTestId("mnp-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mnp-card-u2-1")).toBeTruthy();
  });
});
