import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SnowGlobe } from "../SnowGlobe";

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

describe("SnowGlobe", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.getByTestId("snw-title").textContent).toBe("水晶雪球");
  });

  it("顯示自訂標題", () => {
    render(<SnowGlobe {...defaultProps} config={{ title: "冬日水晶球" }} />);
    expect(screen.getByTestId("snw-title").textContent).toBe("冬日水晶球");
  });

  it("顯示預設 prompt", () => {
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.getByTestId("snw-prompt").textContent).toContain("水晶");
  });

  it("顯示自訂 prompt", () => {
    render(<SnowGlobe {...defaultProps} config={{ prompt: "選擇你的雪景" }} />);
    expect(screen.getByTestId("snw-prompt").textContent).toBe("選擇你的雪景");
  });

  it("顯示已搖晃雪球數", () => {
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.getByTestId("snw-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.getByTestId("snw-form")).toBeTruthy();
  });

  it("顯示五種雪景選項", () => {
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.getByTestId("snw-scene-winter_forest")).toBeTruthy();
    expect(screen.getByTestId("snw-scene-northern_lights")).toBeTruthy();
    expect(screen.getByTestId("snw-scene-cozy_cabin")).toBeTruthy();
    expect(screen.getByTestId("snw-scene-snow_mountain")).toBeTruthy();
    expect(screen.getByTestId("snw-scene-frozen_lake")).toBeTruthy();
  });

  it("顯示故事輸入框", () => {
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.getByTestId("snw-story-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.getByTestId("snw-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<SnowGlobe {...defaultProps} />);
    fireEvent.change(screen.getByTestId("snw-story-input"), { target: { value: "短" } });
    expect(screen.getByTestId("snw-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<SnowGlobe {...defaultProps} />);
    fireEvent.change(screen.getByTestId("snw-story-input"), { target: { value: "五個字以上的故事" } });
    expect(screen.getByTestId("snw-submit-btn")).not.toBeDisabled();
  });

  it("切換雪景選擇", () => {
    render(<SnowGlobe {...defaultProps} />);
    fireEvent.click(screen.getByTestId("snw-scene-northern_lights"));
    expect(screen.getByTestId("snw-scene-northern_lights").className).toContain("blue");
  });

  it("提交呼叫 updateState", () => {
    render(<SnowGlobe {...defaultProps} />);
    fireEvent.change(screen.getByTestId("snw-story-input"), { target: { value: "冬日雪景讓我感到平靜" } });
    fireEvent.click(screen.getByTestId("snw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", snowScene: "cozy_cabin", story: "這讓我想起了家的溫暖感受" }], revealed: false };
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.getByTestId("snw-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", snowScene: "cozy_cabin", story: "這讓我想起了家的溫暖感受" }], revealed: false };
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.queryByTestId("snw-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<SnowGlobe {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("snw-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.queryByTestId("snw-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.getByTestId("snw-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", snowScene: "frozen_lake", story: "我的水晶球故事" }],
      revealed: true,
    };
    render(<SnowGlobe {...defaultProps} />);
    expect(screen.getByTestId("snw-result")).toBeTruthy();
    expect(screen.getByTestId("snw-card-e99")).toBeTruthy();
  });
});
