import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StarCatcher } from "../StarCatcher";

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

describe("StarCatcher", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<StarCatcher {...defaultProps} />);
    expect(screen.getByTestId("stc-title").textContent).toBe("捕星人");
  });

  it("顯示自訂標題", () => {
    render(<StarCatcher {...defaultProps} config={{ title: "星光捕手" }} />);
    expect(screen.getByTestId("stc-title").textContent).toBe("星光捕手");
  });

  it("顯示預設 prompt", () => {
    render(<StarCatcher {...defaultProps} />);
    expect(screen.getByTestId("stc-prompt").textContent).toContain("星");
  });

  it("顯示自訂 prompt", () => {
    render(<StarCatcher {...defaultProps} config={{ prompt: "捕捉你的星" }} />);
    expect(screen.getByTestId("stc-prompt").textContent).toBe("捕捉你的星");
  });

  it("顯示已捕捉星數", () => {
    render(<StarCatcher {...defaultProps} />);
    expect(screen.getByTestId("stc-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<StarCatcher {...defaultProps} />);
    expect(screen.getByTestId("stc-form")).toBeTruthy();
  });

  it("顯示五種星星類型選項", () => {
    render(<StarCatcher {...defaultProps} />);
    expect(screen.getByTestId("stc-star-shooting_star")).toBeTruthy();
    expect(screen.getByTestId("stc-star-fixed_star")).toBeTruthy();
    expect(screen.getByTestId("stc-star-morning_star")).toBeTruthy();
    expect(screen.getByTestId("stc-star-evening_star")).toBeTruthy();
    expect(screen.getByTestId("stc-star-guiding_star")).toBeTruthy();
  });

  it("顯示願望輸入框", () => {
    render(<StarCatcher {...defaultProps} />);
    expect(screen.getByTestId("stc-wish-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<StarCatcher {...defaultProps} />);
    expect(screen.getByTestId("stc-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<StarCatcher {...defaultProps} />);
    fireEvent.change(screen.getByTestId("stc-wish-input"), { target: { value: "短" } });
    expect(screen.getByTestId("stc-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<StarCatcher {...defaultProps} />);
    fireEvent.change(screen.getByTestId("stc-wish-input"), { target: { value: "五個字以上的願望" } });
    expect(screen.getByTestId("stc-submit-btn")).not.toBeDisabled();
  });

  it("切換星星類型選擇", () => {
    render(<StarCatcher {...defaultProps} />);
    fireEvent.click(screen.getByTestId("stc-star-morning_star"));
    expect(screen.getByTestId("stc-star-morning_star").className).toContain("violet");
  });

  it("提交呼叫 updateState", () => {
    render(<StarCatcher {...defaultProps} />);
    fireEvent.change(screen.getByTestId("stc-wish-input"), { target: { value: "那顆流星代表我的夢想" } });
    fireEvent.click(screen.getByTestId("stc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", starType: "fixed_star", wish: "我的信念永遠不會改變" }], revealed: false };
    render(<StarCatcher {...defaultProps} />);
    expect(screen.getByTestId("stc-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", starType: "fixed_star", wish: "我的信念永遠不會改變" }], revealed: false };
    render(<StarCatcher {...defaultProps} />);
    expect(screen.queryByTestId("stc-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<StarCatcher {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("stc-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<StarCatcher {...defaultProps} />);
    expect(screen.queryByTestId("stc-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<StarCatcher {...defaultProps} />);
    expect(screen.getByTestId("stc-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", starType: "guiding_star", wish: "我的捕星故事" }],
      revealed: true,
    };
    render(<StarCatcher {...defaultProps} />);
    expect(screen.getByTestId("stc-result")).toBeTruthy();
    expect(screen.getByTestId("stc-card-e99")).toBeTruthy();
  });
});
