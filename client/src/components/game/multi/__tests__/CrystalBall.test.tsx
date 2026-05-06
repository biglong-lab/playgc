import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CrystalBall } from "../CrystalBall";

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

describe("CrystalBall", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<CrystalBall {...defaultProps} />);
    expect(screen.getByTestId("cbl-title").textContent).toBe("水晶球預言");
  });

  it("顯示自訂標題", () => {
    render(<CrystalBall {...defaultProps} config={{ title: "神秘預言" }} />);
    expect(screen.getByTestId("cbl-title").textContent).toBe("神秘預言");
  });

  it("顯示預設 prompt", () => {
    render(<CrystalBall {...defaultProps} />);
    expect(screen.getByTestId("cbl-prompt").textContent).toContain("水晶球");
  });

  it("顯示自訂 prompt", () => {
    render(<CrystalBall {...defaultProps} config={{ prompt: "你的預言是什麼？" }} />);
    expect(screen.getByTestId("cbl-prompt").textContent).toBe("你的預言是什麼？");
  });

  it("顯示已預言人數", () => {
    render(<CrystalBall {...defaultProps} />);
    expect(screen.getByTestId("cbl-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<CrystalBall {...defaultProps} />);
    expect(screen.getByTestId("cbl-form")).toBeTruthy();
  });

  it("顯示五種預言類型選項", () => {
    render(<CrystalBall {...defaultProps} />);
    expect(screen.getByTestId("cbl-vision-fortune")).toBeTruthy();
    expect(screen.getByTestId("cbl-vision-caution")).toBeTruthy();
    expect(screen.getByTestId("cbl-vision-opportunity")).toBeTruthy();
    expect(screen.getByTestId("cbl-vision-challenge")).toBeTruthy();
    expect(screen.getByTestId("cbl-vision-turning")).toBeTruthy();
  });

  it("顯示預言輸入框", () => {
    render(<CrystalBall {...defaultProps} />);
    expect(screen.getByTestId("cbl-prediction-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<CrystalBall {...defaultProps} />);
    expect(screen.getByTestId("cbl-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<CrystalBall {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cbl-prediction-input"), { target: { value: "短" } });
    expect(screen.getByTestId("cbl-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<CrystalBall {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cbl-prediction-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("cbl-submit-btn")).not.toBeDisabled();
  });

  it("切換預言類型選擇", () => {
    render(<CrystalBall {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cbl-vision-opportunity"));
    expect(screen.getByTestId("cbl-vision-opportunity").className).toContain("purple");
  });

  it("提交呼叫 updateState", () => {
    render(<CrystalBall {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cbl-prediction-input"), { target: { value: "未來充滿無限可能" } });
    fireEvent.click(screen.getByTestId("cbl-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", visionType: "fortune", prediction: "大吉大利的預言" }], revealed: false };
    render(<CrystalBall {...defaultProps} />);
    expect(screen.getByTestId("cbl-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", visionType: "fortune", prediction: "大吉大利的預言" }], revealed: false };
    render(<CrystalBall {...defaultProps} />);
    expect(screen.queryByTestId("cbl-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<CrystalBall {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("cbl-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<CrystalBall {...defaultProps} />);
    expect(screen.queryByTestId("cbl-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<CrystalBall {...defaultProps} />);
    expect(screen.getByTestId("cbl-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", visionType: "fortune", prediction: "我的水晶球故事" }],
      revealed: true,
    };
    render(<CrystalBall {...defaultProps} />);
    expect(screen.getByTestId("cbl-result")).toBeTruthy();
    expect(screen.getByTestId("cbl-card-e99")).toBeTruthy();
  });
});
