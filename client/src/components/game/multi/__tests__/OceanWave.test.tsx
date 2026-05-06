import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OceanWave } from "../OceanWave";

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

describe("OceanWave", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<OceanWave {...defaultProps} />);
    expect(screen.getByTestId("ocw-title").textContent).toBe("海浪能量");
  });

  it("顯示自訂標題", () => {
    render(<OceanWave {...defaultProps} config={{ title: "我的海浪" }} />);
    expect(screen.getByTestId("ocw-title").textContent).toBe("我的海浪");
  });

  it("顯示預設 prompt", () => {
    render(<OceanWave {...defaultProps} />);
    expect(screen.getByTestId("ocw-prompt").textContent).toContain("海浪");
  });

  it("顯示自訂 prompt", () => {
    render(<OceanWave {...defaultProps} config={{ prompt: "你的能量如何？" }} />);
    expect(screen.getByTestId("ocw-prompt").textContent).toBe("你的能量如何？");
  });

  it("顯示已湧入浪數", () => {
    render(<OceanWave {...defaultProps} />);
    expect(screen.getByTestId("ocw-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<OceanWave {...defaultProps} />);
    expect(screen.getByTestId("ocw-form")).toBeTruthy();
  });

  it("顯示五種海浪類型選項", () => {
    render(<OceanWave {...defaultProps} />);
    expect(screen.getByTestId("ocw-wave-ripple")).toBeTruthy();
    expect(screen.getByTestId("ocw-wave-swell")).toBeTruthy();
    expect(screen.getByTestId("ocw-wave-surge")).toBeTruthy();
    expect(screen.getByTestId("ocw-wave-crash")).toBeTruthy();
    expect(screen.getByTestId("ocw-wave-calm")).toBeTruthy();
  });

  it("顯示感受輸入框", () => {
    render(<OceanWave {...defaultProps} />);
    expect(screen.getByTestId("ocw-feeling-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<OceanWave {...defaultProps} />);
    expect(screen.getByTestId("ocw-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<OceanWave {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ocw-feeling-input"), { target: { value: "短" } });
    expect(screen.getByTestId("ocw-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<OceanWave {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ocw-feeling-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("ocw-submit-btn")).not.toBeDisabled();
  });

  it("切換海浪類型選擇", () => {
    render(<OceanWave {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ocw-wave-surge"));
    expect(screen.getByTestId("ocw-wave-surge").className).toContain("blue");
  });

  it("提交呼叫 updateState", () => {
    render(<OceanWave {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ocw-feeling-input"), { target: { value: "我的能量像海浪" } });
    fireEvent.click(screen.getByTestId("ocw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", waveType: "ripple", feeling: "漣漪般的感覺" }], revealed: false };
    render(<OceanWave {...defaultProps} />);
    expect(screen.getByTestId("ocw-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", waveType: "ripple", feeling: "漣漪般的感覺" }], revealed: false };
    render(<OceanWave {...defaultProps} />);
    expect(screen.queryByTestId("ocw-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<OceanWave {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ocw-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<OceanWave {...defaultProps} />);
    expect(screen.queryByTestId("ocw-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<OceanWave {...defaultProps} />);
    expect(screen.getByTestId("ocw-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", waveType: "ripple", feeling: "我的海浪故事" }],
      revealed: true,
    };
    render(<OceanWave {...defaultProps} />);
    expect(screen.getByTestId("ocw-result")).toBeTruthy();
    expect(screen.getByTestId("ocw-card-e99")).toBeTruthy();
  });
});
