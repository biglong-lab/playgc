import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FireflyDance } from "../FireflyDance";

const mockUpdateState = vi.fn();
let mockState: Record<string, unknown> = { entries: [], revealed: false };

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: true,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockUpdateState.mockClear();
  mockState = { entries: [], revealed: false };
});

describe("FireflyDance", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<FireflyDance {...defaultProps} />);
    expect(screen.getByTestId("ffd-title").textContent).toBe("螢火蟲之舞");
  });

  it("顯示自訂標題", () => {
    render(<FireflyDance {...defaultProps} config={{ title: "螢光夜舞" }} />);
    expect(screen.getByTestId("ffd-title").textContent).toBe("螢光夜舞");
  });

  it("顯示預設 prompt", () => {
    render(<FireflyDance {...defaultProps} />);
    expect(screen.getByTestId("ffd-prompt").textContent).toContain("螢火蟲");
  });

  it("顯示自訂 prompt", () => {
    render(<FireflyDance {...defaultProps} config={{ prompt: "讓你的螢火蟲閃耀" }} />);
    expect(screen.getByTestId("ffd-prompt").textContent).toBe("讓你的螢火蟲閃耀");
  });

  it("顯示已閃耀光芒數", () => {
    render(<FireflyDance {...defaultProps} />);
    expect(screen.getByTestId("ffd-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<FireflyDance {...defaultProps} />);
    expect(screen.getByTestId("ffd-form")).toBeTruthy();
  });

  it("顯示五種舞姿選項", () => {
    render(<FireflyDance {...defaultProps} />);
    expect(screen.getByTestId("ffd-pattern-solo_dance")).toBeTruthy();
    expect(screen.getByTestId("ffd-pattern-group_dance")).toBeTruthy();
    expect(screen.getByTestId("ffd-pattern-spiral_dance")).toBeTruthy();
    expect(screen.getByTestId("ffd-pattern-flash_dance")).toBeTruthy();
    expect(screen.getByTestId("ffd-pattern-slow_dance")).toBeTruthy();
  });

  it("顯示螢光輸入框", () => {
    render(<FireflyDance {...defaultProps} />);
    expect(screen.getByTestId("ffd-glow-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<FireflyDance {...defaultProps} />);
    expect(screen.getByTestId("ffd-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<FireflyDance {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ffd-glow-input"), { target: { value: "短" } });
    expect(screen.getByTestId("ffd-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<FireflyDance {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ffd-glow-input"), { target: { value: "螢火蟲的光芒照亮了我的心" } });
    expect(screen.getByTestId("ffd-submit-btn")).not.toBeDisabled();
  });

  it("切換舞姿選擇", () => {
    render(<FireflyDance {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ffd-pattern-group_dance"));
    expect(screen.getByTestId("ffd-pattern-group_dance").className).toContain("yellow");
  });

  it("提交呼叫 updateState", () => {
    render(<FireflyDance {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ffd-glow-input"), { target: { value: "群舞的螢火蟲讓我感受到團隊力量" } });
    fireEvent.click(screen.getByTestId("ffd-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", lightPattern: "slow_dance", glow: "慢舞的螢火蟲讓夜晚更加寧靜" }], revealed: false };
    render(<FireflyDance {...defaultProps} />);
    expect(screen.getByTestId("ffd-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", lightPattern: "slow_dance", glow: "慢舞的螢火蟲讓夜晚更加寧靜" }], revealed: false };
    render(<FireflyDance {...defaultProps} />);
    expect(screen.queryByTestId("ffd-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<FireflyDance {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ffd-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<FireflyDance {...defaultProps} />);
    expect(screen.queryByTestId("ffd-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<FireflyDance {...defaultProps} />);
    expect(screen.getByTestId("ffd-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", lightPattern: "spiral_dance", glow: "螺旋舞動的螢火如夢如幻令我著迷" }],
      revealed: true,
    };
    render(<FireflyDance {...defaultProps} />);
    expect(screen.getByTestId("ffd-result")).toBeTruthy();
    expect(screen.getByTestId("ffd-card-e99")).toBeTruthy();
  });
});
