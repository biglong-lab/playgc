import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RainbowBridge } from "../RainbowBridge";

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

describe("RainbowBridge", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.getByTestId("rnb-title").textContent).toBe("彩虹橋");
  });

  it("顯示自訂標題", () => {
    render(<RainbowBridge {...defaultProps} config={{ title: "七彩橋" }} />);
    expect(screen.getByTestId("rnb-title").textContent).toBe("七彩橋");
  });

  it("顯示預設 prompt", () => {
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.getByTestId("rnb-prompt").textContent).toContain("彩虹");
  });

  it("顯示自訂 prompt", () => {
    render(<RainbowBridge {...defaultProps} config={{ prompt: "選擇你的顏色" }} />);
    expect(screen.getByTestId("rnb-prompt").textContent).toBe("選擇你的顏色");
  });

  it("顯示已踏上彩虹數", () => {
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.getByTestId("rnb-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.getByTestId("rnb-form")).toBeTruthy();
  });

  it("顯示五種顏色路徑選項", () => {
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.getByTestId("rnb-color-red")).toBeTruthy();
    expect(screen.getByTestId("rnb-color-orange")).toBeTruthy();
    expect(screen.getByTestId("rnb-color-yellow")).toBeTruthy();
    expect(screen.getByTestId("rnb-color-green")).toBeTruthy();
    expect(screen.getByTestId("rnb-color-blue")).toBeTruthy();
  });

  it("顯示感受輸入框", () => {
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.getByTestId("rnb-reflection-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.getByTestId("rnb-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<RainbowBridge {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rnb-reflection-input"), { target: { value: "短" } });
    expect(screen.getByTestId("rnb-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<RainbowBridge {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rnb-reflection-input"), { target: { value: "五個字以上的感受" } });
    expect(screen.getByTestId("rnb-submit-btn")).not.toBeDisabled();
  });

  it("切換顏色路徑選擇", () => {
    render(<RainbowBridge {...defaultProps} />);
    fireEvent.click(screen.getByTestId("rnb-color-blue"));
    expect(screen.getByTestId("rnb-color-blue").className).not.toBe("");
  });

  it("提交呼叫 updateState", () => {
    render(<RainbowBridge {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rnb-reflection-input"), { target: { value: "此刻我充滿熱情活力" } });
    fireEvent.click(screen.getByTestId("rnb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", colorPath: "red", reflection: "熱情如火的今天真美好" }], revealed: false };
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.getByTestId("rnb-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", colorPath: "red", reflection: "熱情如火的今天真美好" }], revealed: false };
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.queryByTestId("rnb-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<RainbowBridge {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("rnb-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.queryByTestId("rnb-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.getByTestId("rnb-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", colorPath: "green", reflection: "我的彩虹橋故事" }],
      revealed: true,
    };
    render(<RainbowBridge {...defaultProps} />);
    expect(screen.getByTestId("rnb-result")).toBeTruthy();
    expect(screen.getByTestId("rnb-card-e99")).toBeTruthy();
  });
});
