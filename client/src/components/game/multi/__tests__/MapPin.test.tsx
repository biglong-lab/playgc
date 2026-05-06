import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MapPin } from "../MapPin";

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

describe("MapPin", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<MapPin {...defaultProps} />);
    expect(screen.getByTestId("mpn-title").textContent).toBe("地圖釘");
  });

  it("顯示自訂標題", () => {
    render(<MapPin {...defaultProps} config={{ title: "我的旅程地圖" }} />);
    expect(screen.getByTestId("mpn-title").textContent).toBe("我的旅程地圖");
  });

  it("顯示預設 prompt", () => {
    render(<MapPin {...defaultProps} />);
    expect(screen.getByTestId("mpn-prompt").textContent).toContain("旅程");
  });

  it("顯示自訂 prompt", () => {
    render(<MapPin {...defaultProps} config={{ prompt: "你在哪裡？" }} />);
    expect(screen.getByTestId("mpn-prompt").textContent).toBe("你在哪裡？");
  });

  it("顯示已標記位置數", () => {
    render(<MapPin {...defaultProps} />);
    expect(screen.getByTestId("mpn-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<MapPin {...defaultProps} />);
    expect(screen.getByTestId("mpn-form")).toBeTruthy();
  });

  it("顯示五種位置類型選項", () => {
    render(<MapPin {...defaultProps} />);
    expect(screen.getByTestId("mpn-pin-start")).toBeTruthy();
    expect(screen.getByTestId("mpn-pin-destination")).toBeTruthy();
    expect(screen.getByTestId("mpn-pin-rest")).toBeTruthy();
    expect(screen.getByTestId("mpn-pin-surprise")).toBeTruthy();
    expect(screen.getByTestId("mpn-pin-detour")).toBeTruthy();
  });

  it("顯示位置輸入框", () => {
    render(<MapPin {...defaultProps} />);
    expect(screen.getByTestId("mpn-location-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<MapPin {...defaultProps} />);
    expect(screen.getByTestId("mpn-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<MapPin {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mpn-location-input"), { target: { value: "短" } });
    expect(screen.getByTestId("mpn-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<MapPin {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mpn-location-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("mpn-submit-btn")).not.toBeDisabled();
  });

  it("切換位置類型選擇", () => {
    render(<MapPin {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mpn-pin-destination"));
    expect(screen.getByTestId("mpn-pin-destination").className).toContain("teal");
  });

  it("提交呼叫 updateState", () => {
    render(<MapPin {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mpn-location-input"), { target: { value: "我現在在旅程的中途" } });
    fireEvent.click(screen.getByTestId("mpn-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", pinType: "start", location: "在旅程的起點" }], revealed: false };
    render(<MapPin {...defaultProps} />);
    expect(screen.getByTestId("mpn-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", pinType: "start", location: "在旅程的起點" }], revealed: false };
    render(<MapPin {...defaultProps} />);
    expect(screen.queryByTestId("mpn-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<MapPin {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("mpn-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<MapPin {...defaultProps} />);
    expect(screen.queryByTestId("mpn-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<MapPin {...defaultProps} />);
    expect(screen.getByTestId("mpn-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", pinType: "start", location: "我的地圖故事" }],
      revealed: true,
    };
    render(<MapPin {...defaultProps} />);
    expect(screen.getByTestId("mpn-result")).toBeTruthy();
    expect(screen.getByTestId("mpn-card-e99")).toBeTruthy();
  });
});
