import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WishingWell } from "../WishingWell";

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

describe("WishingWell", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<WishingWell {...defaultProps} />);
    expect(screen.getByTestId("wsw-title").textContent).toBe("許願井");
  });

  it("顯示自訂標題", () => {
    render(<WishingWell {...defaultProps} config={{ title: "心願水井" }} />);
    expect(screen.getByTestId("wsw-title").textContent).toBe("心願水井");
  });

  it("顯示預設 prompt", () => {
    render(<WishingWell {...defaultProps} />);
    expect(screen.getByTestId("wsw-prompt").textContent).toContain("硬幣");
  });

  it("顯示自訂 prompt", () => {
    render(<WishingWell {...defaultProps} config={{ prompt: "許下你的願望吧" }} />);
    expect(screen.getByTestId("wsw-prompt").textContent).toBe("許下你的願望吧");
  });

  it("顯示已投下硬幣數", () => {
    render(<WishingWell {...defaultProps} />);
    expect(screen.getByTestId("wsw-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<WishingWell {...defaultProps} />);
    expect(screen.getByTestId("wsw-form")).toBeTruthy();
  });

  it("顯示五種願望類型選項", () => {
    render(<WishingWell {...defaultProps} />);
    expect(screen.getByTestId("wsw-type-peace")).toBeTruthy();
    expect(screen.getByTestId("wsw-type-love")).toBeTruthy();
    expect(screen.getByTestId("wsw-type-career")).toBeTruthy();
    expect(screen.getByTestId("wsw-type-health")).toBeTruthy();
    expect(screen.getByTestId("wsw-type-wisdom")).toBeTruthy();
  });

  it("顯示願望輸入框", () => {
    render(<WishingWell {...defaultProps} />);
    expect(screen.getByTestId("wsw-wish-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<WishingWell {...defaultProps} />);
    expect(screen.getByTestId("wsw-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<WishingWell {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wsw-wish-input"), { target: { value: "短" } });
    expect(screen.getByTestId("wsw-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<WishingWell {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wsw-wish-input"), { target: { value: "五個字以上的願望" } });
    expect(screen.getByTestId("wsw-submit-btn")).not.toBeDisabled();
  });

  it("切換願望類型選擇", () => {
    render(<WishingWell {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wsw-type-love"));
    expect(screen.getByTestId("wsw-type-love").className).toContain("purple");
  });

  it("提交呼叫 updateState", () => {
    render(<WishingWell {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wsw-wish-input"), { target: { value: "願家人平安健康" } });
    fireEvent.click(screen.getByTestId("wsw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", wishType: "peace", wish: "願一切安好順利" }], revealed: false };
    render(<WishingWell {...defaultProps} />);
    expect(screen.getByTestId("wsw-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", wishType: "peace", wish: "願一切安好順利" }], revealed: false };
    render(<WishingWell {...defaultProps} />);
    expect(screen.queryByTestId("wsw-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<WishingWell {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("wsw-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<WishingWell {...defaultProps} />);
    expect(screen.queryByTestId("wsw-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<WishingWell {...defaultProps} />);
    expect(screen.getByTestId("wsw-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", wishType: "peace", wish: "我的許願井故事" }],
      revealed: true,
    };
    render(<WishingWell {...defaultProps} />);
    expect(screen.getByTestId("wsw-result")).toBeTruthy();
    expect(screen.getByTestId("wsw-card-e99")).toBeTruthy();
  });
});
