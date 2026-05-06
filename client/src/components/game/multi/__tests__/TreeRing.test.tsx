import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TreeRing } from "../TreeRing";

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

describe("TreeRing", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<TreeRing {...defaultProps} />);
    expect(screen.getByTestId("trr-title").textContent).toBe("年輪成長卡");
  });

  it("顯示自訂標題", () => {
    render(<TreeRing {...defaultProps} config={{ title: "我的年輪" }} />);
    expect(screen.getByTestId("trr-title").textContent).toBe("我的年輪");
  });

  it("顯示預設 prompt", () => {
    render(<TreeRing {...defaultProps} />);
    expect(screen.getByTestId("trr-prompt").textContent).toContain("年輪");
  });

  it("顯示自訂 prompt", () => {
    render(<TreeRing {...defaultProps} config={{ prompt: "你的成長是什麼？" }} />);
    expect(screen.getByTestId("trr-prompt").textContent).toBe("你的成長是什麼？");
  });

  it("顯示已記錄人數", () => {
    render(<TreeRing {...defaultProps} />);
    expect(screen.getByTestId("trr-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<TreeRing {...defaultProps} />);
    expect(screen.getByTestId("trr-form")).toBeTruthy();
  });

  it("顯示五個年輪類型選項", () => {
    render(<TreeRing {...defaultProps} />);
    expect(screen.getByTestId("trr-ring-resilience")).toBeTruthy();
    expect(screen.getByTestId("trr-ring-expansion")).toBeTruthy();
    expect(screen.getByTestId("trr-ring-depth")).toBeTruthy();
    expect(screen.getByTestId("trr-ring-healing")).toBeTruthy();
    expect(screen.getByTestId("trr-ring-adaptation")).toBeTruthy();
  });

  it("顯示反思輸入框", () => {
    render(<TreeRing {...defaultProps} />);
    expect(screen.getByTestId("trr-reflection-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<TreeRing {...defaultProps} />);
    expect(screen.getByTestId("trr-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<TreeRing {...defaultProps} />);
    fireEvent.change(screen.getByTestId("trr-reflection-input"), { target: { value: "短" } });
    expect(screen.getByTestId("trr-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<TreeRing {...defaultProps} />);
    fireEvent.change(screen.getByTestId("trr-reflection-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("trr-submit-btn")).not.toBeDisabled();
  });

  it("切換年輪類型選擇", () => {
    render(<TreeRing {...defaultProps} />);
    fireEvent.click(screen.getByTestId("trr-ring-expansion"));
    expect(screen.getByTestId("trr-ring-expansion").className).toContain("green");
  });

  it("提交呼叫 updateState", () => {
    render(<TreeRing {...defaultProps} />);
    fireEvent.change(screen.getByTestId("trr-reflection-input"), { target: { value: "這是我的成長故事" } });
    fireEvent.click(screen.getByTestId("trr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", ringType: "resilience", reflection: "成長故事" }], revealed: false };
    render(<TreeRing {...defaultProps} />);
    expect(screen.getByTestId("trr-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", ringType: "resilience", reflection: "成長故事" }], revealed: false };
    render(<TreeRing {...defaultProps} />);
    expect(screen.queryByTestId("trr-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<TreeRing {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("trr-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<TreeRing {...defaultProps} />);
    expect(screen.queryByTestId("trr-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<TreeRing {...defaultProps} />);
    expect(screen.getByTestId("trr-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", ringType: "resilience", reflection: "我的年輪故事" }],
      revealed: true,
    };
    render(<TreeRing {...defaultProps} />);
    expect(screen.getByTestId("trr-result")).toBeTruthy();
    expect(screen.getByTestId("trr-card-e99")).toBeTruthy();
  });
});
