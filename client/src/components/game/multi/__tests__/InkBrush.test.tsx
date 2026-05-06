import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InkBrush } from "../InkBrush";

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

describe("InkBrush", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<InkBrush {...defaultProps} />);
    expect(screen.getByTestId("ikb-title").textContent).toBe("水墨揮毫");
  });

  it("顯示自訂標題", () => {
    render(<InkBrush {...defaultProps} config={{ title: "墨跡心情" }} />);
    expect(screen.getByTestId("ikb-title").textContent).toBe("墨跡心情");
  });

  it("顯示預設 prompt", () => {
    render(<InkBrush {...defaultProps} />);
    expect(screen.getByTestId("ikb-prompt").textContent).toContain("水墨");
  });

  it("顯示自訂 prompt", () => {
    render(<InkBrush {...defaultProps} config={{ prompt: "揮毫寫下你的心情" }} />);
    expect(screen.getByTestId("ikb-prompt").textContent).toBe("揮毫寫下你的心情");
  });

  it("顯示已揮毫數", () => {
    render(<InkBrush {...defaultProps} />);
    expect(screen.getByTestId("ikb-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<InkBrush {...defaultProps} />);
    expect(screen.getByTestId("ikb-form")).toBeTruthy();
  });

  it("顯示五種筆法選項", () => {
    render(<InkBrush {...defaultProps} />);
    expect(screen.getByTestId("ikb-style-bold_stroke")).toBeTruthy();
    expect(screen.getByTestId("ikb-style-light_wash")).toBeTruthy();
    expect(screen.getByTestId("ikb-style-fine_line")).toBeTruthy();
    expect(screen.getByTestId("ikb-style-splatter")).toBeTruthy();
    expect(screen.getByTestId("ikb-style-calligraphy")).toBeTruthy();
  });

  it("顯示心情輸入框", () => {
    render(<InkBrush {...defaultProps} />);
    expect(screen.getByTestId("ikb-expression-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<InkBrush {...defaultProps} />);
    expect(screen.getByTestId("ikb-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<InkBrush {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ikb-expression-input"), { target: { value: "短" } });
    expect(screen.getByTestId("ikb-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<InkBrush {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ikb-expression-input"), { target: { value: "揮毫寫下我的心情感悟" } });
    expect(screen.getByTestId("ikb-submit-btn")).not.toBeDisabled();
  });

  it("切換筆法選擇", () => {
    render(<InkBrush {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ikb-style-light_wash"));
    expect(screen.getByTestId("ikb-style-light_wash").className).toContain("slate");
  });

  it("提交呼叫 updateState", () => {
    render(<InkBrush {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ikb-expression-input"), { target: { value: "濃墨重彩是我的風格與態度" } });
    fireEvent.click(screen.getByTestId("ikb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", brushStyle: "calligraphy", expression: "書法之美在於心正筆直" }], revealed: false };
    render(<InkBrush {...defaultProps} />);
    expect(screen.getByTestId("ikb-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", brushStyle: "calligraphy", expression: "書法之美在於心正筆直" }], revealed: false };
    render(<InkBrush {...defaultProps} />);
    expect(screen.queryByTestId("ikb-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<InkBrush {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ikb-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<InkBrush {...defaultProps} />);
    expect(screen.queryByTestId("ikb-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<InkBrush {...defaultProps} />);
    expect(screen.getByTestId("ikb-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", brushStyle: "splatter", expression: "潑墨揮灑才是我的自由之道" }],
      revealed: true,
    };
    render(<InkBrush {...defaultProps} />);
    expect(screen.getByTestId("ikb-result")).toBeTruthy();
    expect(screen.getByTestId("ikb-card-e99")).toBeTruthy();
  });
});
