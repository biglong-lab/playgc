import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LanternFloat } from "../LanternFloat";

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

describe("LanternFloat", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<LanternFloat {...defaultProps} />);
    expect(screen.getByTestId("ltf-title").textContent).toBe("天燈祈願");
  });

  it("顯示自訂標題", () => {
    render(<LanternFloat {...defaultProps} config={{ title: "放天燈" }} />);
    expect(screen.getByTestId("ltf-title").textContent).toBe("放天燈");
  });

  it("顯示預設 prompt", () => {
    render(<LanternFloat {...defaultProps} />);
    expect(screen.getByTestId("ltf-prompt").textContent).toContain("天燈");
  });

  it("顯示自訂 prompt", () => {
    render(<LanternFloat {...defaultProps} config={{ prompt: "讓天燈帶走你的祈禱" }} />);
    expect(screen.getByTestId("ltf-prompt").textContent).toBe("讓天燈帶走你的祈禱");
  });

  it("顯示已放飛天燈數", () => {
    render(<LanternFloat {...defaultProps} />);
    expect(screen.getByTestId("ltf-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<LanternFloat {...defaultProps} />);
    expect(screen.getByTestId("ltf-form")).toBeTruthy();
  });

  it("顯示五種天燈類型選項", () => {
    render(<LanternFloat {...defaultProps} />);
    expect(screen.getByTestId("ltf-lantern-hope_lantern")).toBeTruthy();
    expect(screen.getByTestId("ltf-lantern-memory_lantern")).toBeTruthy();
    expect(screen.getByTestId("ltf-lantern-love_lantern")).toBeTruthy();
    expect(screen.getByTestId("ltf-lantern-dream_lantern")).toBeTruthy();
    expect(screen.getByTestId("ltf-lantern-prayer_lantern")).toBeTruthy();
  });

  it("顯示祈願輸入框", () => {
    render(<LanternFloat {...defaultProps} />);
    expect(screen.getByTestId("ltf-prayer-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<LanternFloat {...defaultProps} />);
    expect(screen.getByTestId("ltf-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<LanternFloat {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ltf-prayer-input"), { target: { value: "短" } });
    expect(screen.getByTestId("ltf-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<LanternFloat {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ltf-prayer-input"), { target: { value: "天燈帶走我的心願飛向遠方" } });
    expect(screen.getByTestId("ltf-submit-btn")).not.toBeDisabled();
  });

  it("切換天燈類型選擇", () => {
    render(<LanternFloat {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ltf-lantern-dream_lantern"));
    expect(screen.getByTestId("ltf-lantern-dream_lantern").className).toContain("amber");
  });

  it("提交呼叫 updateState", () => {
    render(<LanternFloat {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ltf-prayer-input"), { target: { value: "這盞天燈承載著我的夢想" } });
    fireEvent.click(screen.getByTestId("ltf-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", lanternType: "hope_lantern", prayer: "願天燈帶走一切煩惱" }], revealed: false };
    render(<LanternFloat {...defaultProps} />);
    expect(screen.getByTestId("ltf-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", lanternType: "hope_lantern", prayer: "願天燈帶走一切煩惱" }], revealed: false };
    render(<LanternFloat {...defaultProps} />);
    expect(screen.queryByTestId("ltf-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<LanternFloat {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ltf-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<LanternFloat {...defaultProps} />);
    expect(screen.queryByTestId("ltf-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<LanternFloat {...defaultProps} />);
    expect(screen.getByTestId("ltf-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", lanternType: "prayer_lantern", prayer: "夜空中那盞燈是我對你的思念" }],
      revealed: true,
    };
    render(<LanternFloat {...defaultProps} />);
    expect(screen.getByTestId("ltf-result")).toBeTruthy();
    expect(screen.getByTestId("ltf-card-e99")).toBeTruthy();
  });
});
