import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrengthMap } from "../StrengthMap";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
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
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("StrengthMap", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<StrengthMap {...defaultProps} />);
    expect(screen.getByTestId("sm-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<StrengthMap {...defaultProps} />);
    expect(screen.getByTestId("sm-title").textContent).toBe("強項地圖");
    expect(screen.getByTestId("sm-prompt").textContent).toContain("強項");
  });

  it("自訂 config 標題", () => {
    render(<StrengthMap {...defaultProps} config={{ title: "團隊強項", prompt: "你最擅長什麼？" }} />);
    expect(screen.getByTestId("sm-title").textContent).toBe("團隊強項");
    expect(screen.getByTestId("sm-prompt").textContent).toBe("你最擅長什麼？");
  });

  it("顯示已分享人數", () => {
    render(<StrengthMap {...defaultProps} />);
    expect(screen.getByTestId("sm-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<StrengthMap {...defaultProps} />);
    expect(screen.getByTestId("sm-form")).toBeTruthy();
    expect(screen.getByTestId("sm-example-input")).toBeTruthy();
    expect(screen.getByTestId("sm-submit-btn")).toBeTruthy();
  });

  it("顯示所有 8 個強項按鈕", () => {
    render(<StrengthMap {...defaultProps} />);
    ["leader", "creative", "analytic", "empathy", "execute", "connect", "learn", "communicate"].forEach((id) => {
      expect(screen.getByTestId(`sm-strength-${id}`)).toBeTruthy();
    });
  });

  it("未選強項時提交按鈕 disabled", () => {
    render(<StrengthMap {...defaultProps} />);
    const btn = screen.getByTestId("sm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選強項但故事太短時 disabled", () => {
    render(<StrengthMap {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sm-strength-leader"));
    fireEvent.change(screen.getByTestId("sm-example-input"), { target: { value: "帶隊" } });
    const btn = screen.getByTestId("sm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選強項且故事 ≥5 字時提交按鈕啟用", () => {
    render(<StrengthMap {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sm-strength-creative"));
    fireEvent.change(screen.getByTestId("sm-example-input"), { target: { value: "設計了一個全新的產品" } });
    const btn = screen.getByTestId("sm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<StrengthMap {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sm-strength-analytic"));
    fireEvent.change(screen.getByTestId("sm-example-input"), { target: { value: "用數據分析找出問題根因" } });
    fireEvent.click(screen.getByTestId("sm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", strength: "empathy", example: "幫同事解決了情緒困境" }],
      revealed: false,
    };
    render(<StrengthMap {...defaultProps} />);
    expect(screen.getByTestId("sm-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("sm-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<StrengthMap {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("sm-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<StrengthMap {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("sm-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<StrengthMap {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("sm-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<StrengthMap {...defaultProps} />);
    expect(screen.getByTestId("sm-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 sm-result 與強項摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", strength: "execute", example: "三個月內完成了整個系統重構" }],
      revealed: true,
    };
    render(<StrengthMap {...defaultProps} />);
    expect(screen.getByTestId("sm-result")).toBeTruthy();
    expect(screen.getByTestId("sm-strength-summary")).toBeTruthy();
    expect(screen.getByTestId("sm-badge-execute")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", strength: "connect", example: "建立了跨部門合作橋樑" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", strength: "learn", example: "兩週內自學完成了新框架" },
      ],
      revealed: true,
    };
    render(<StrengthMap {...defaultProps} />);
    expect(screen.getByTestId("sm-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("sm-card-u2-1")).toBeTruthy();
  });

  it("強項摘要顯示有人選的強項", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", strength: "communicate", example: "讓客戶滿意地接受了提案" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", strength: "communicate", example: "清楚解釋複雜技術讓大家理解" },
      ],
      revealed: true,
    };
    render(<StrengthMap {...defaultProps} />);
    expect(screen.getByTestId("sm-badge-communicate")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<StrengthMap {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("sm-reveal-btn")).toBeNull();
  });

  it("已分享人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", strength: "leader", example: "帶領團隊達成季度目標" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", strength: "analytic", example: "用數據優化了業務流程" },
      ],
      revealed: false,
    };
    render(<StrengthMap {...defaultProps} />);
    expect(screen.getByTestId("sm-count").textContent).toContain("2");
  });
});
