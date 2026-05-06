import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LampLight } from "../LampLight";

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

describe("LampLight", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<LampLight {...defaultProps} />);
    expect(screen.getByTestId("lmp-title").textContent).toBe("心燈");
  });

  it("顯示自訂標題", () => {
    render(<LampLight {...defaultProps} config={{ title: "我的燈" }} />);
    expect(screen.getByTestId("lmp-title").textContent).toBe("我的燈");
  });

  it("顯示預設 prompt", () => {
    render(<LampLight {...defaultProps} />);
    expect(screen.getByTestId("lmp-prompt").textContent).toContain("光");
  });

  it("顯示自訂 prompt", () => {
    render(<LampLight {...defaultProps} config={{ prompt: "你的光是什麼？" }} />);
    expect(screen.getByTestId("lmp-prompt").textContent).toBe("你的光是什麼？");
  });

  it("顯示已點亮燈數", () => {
    render(<LampLight {...defaultProps} />);
    expect(screen.getByTestId("lmp-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<LampLight {...defaultProps} />);
    expect(screen.getByTestId("lmp-form")).toBeTruthy();
  });

  it("顯示五種光線類型選項", () => {
    render(<LampLight {...defaultProps} />);
    expect(screen.getByTestId("lmp-light-warm")).toBeTruthy();
    expect(screen.getByTestId("lmp-light-cool")).toBeTruthy();
    expect(screen.getByTestId("lmp-light-flicker")).toBeTruthy();
    expect(screen.getByTestId("lmp-light-soft")).toBeTruthy();
    expect(screen.getByTestId("lmp-light-bright")).toBeTruthy();
  });

  it("顯示訊息輸入框", () => {
    render(<LampLight {...defaultProps} />);
    expect(screen.getByTestId("lmp-message-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<LampLight {...defaultProps} />);
    expect(screen.getByTestId("lmp-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<LampLight {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lmp-message-input"), { target: { value: "短" } });
    expect(screen.getByTestId("lmp-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<LampLight {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lmp-message-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("lmp-submit-btn")).not.toBeDisabled();
  });

  it("切換光線類型選擇", () => {
    render(<LampLight {...defaultProps} />);
    fireEvent.click(screen.getByTestId("lmp-light-cool"));
    expect(screen.getByTestId("lmp-light-cool").className).toContain("yellow");
  });

  it("提交呼叫 updateState", () => {
    render(<LampLight {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lmp-message-input"), { target: { value: "我的心燈是暖光" } });
    fireEvent.click(screen.getByTestId("lmp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", lightType: "warm", message: "溫暖的光芒" }], revealed: false };
    render(<LampLight {...defaultProps} />);
    expect(screen.getByTestId("lmp-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", lightType: "warm", message: "溫暖的光芒" }], revealed: false };
    render(<LampLight {...defaultProps} />);
    expect(screen.queryByTestId("lmp-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<LampLight {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("lmp-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<LampLight {...defaultProps} />);
    expect(screen.queryByTestId("lmp-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<LampLight {...defaultProps} />);
    expect(screen.getByTestId("lmp-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", lightType: "warm", message: "我的心燈故事" }],
      revealed: true,
    };
    render(<LampLight {...defaultProps} />);
    expect(screen.getByTestId("lmp-result")).toBeTruthy();
    expect(screen.getByTestId("lmp-card-e99")).toBeTruthy();
  });
});
