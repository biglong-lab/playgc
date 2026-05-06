import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SakuraPetal } from "../SakuraPetal";

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

describe("SakuraPetal", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.getByTestId("skp-title").textContent).toBe("櫻花瓣");
  });

  it("顯示自訂標題", () => {
    render(<SakuraPetal {...defaultProps} config={{ title: "花瓣詩" }} />);
    expect(screen.getByTestId("skp-title").textContent).toBe("花瓣詩");
  });

  it("顯示預設 prompt", () => {
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.getByTestId("skp-prompt").textContent).toContain("花瓣");
  });

  it("顯示自訂 prompt", () => {
    render(<SakuraPetal {...defaultProps} config={{ prompt: "花開花落皆是詩" }} />);
    expect(screen.getByTestId("skp-prompt").textContent).toBe("花開花落皆是詩");
  });

  it("顯示已飄落花瓣數", () => {
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.getByTestId("skp-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.getByTestId("skp-form")).toBeTruthy();
  });

  it("顯示五種花瓣意義選項", () => {
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.getByTestId("skp-meaning-transience")).toBeTruthy();
    expect(screen.getByTestId("skp-meaning-beauty")).toBeTruthy();
    expect(screen.getByTestId("skp-meaning-renewal")).toBeTruthy();
    expect(screen.getByTestId("skp-meaning-joy")).toBeTruthy();
    expect(screen.getByTestId("skp-meaning-farewell")).toBeTruthy();
  });

  it("顯示感受輸入框", () => {
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.getByTestId("skp-feeling-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.getByTestId("skp-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<SakuraPetal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("skp-feeling-input"), { target: { value: "短" } });
    expect(screen.getByTestId("skp-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<SakuraPetal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("skp-feeling-input"), { target: { value: "心情如花瓣般輕盈" } });
    expect(screen.getByTestId("skp-submit-btn")).not.toBeDisabled();
  });

  it("切換花瓣意義選擇", () => {
    render(<SakuraPetal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("skp-meaning-joy"));
    expect(screen.getByTestId("skp-meaning-joy").className).toContain("pink");
  });

  it("提交呼叫 updateState", () => {
    render(<SakuraPetal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("skp-feeling-input"), { target: { value: "那片花瓣讓我想起了春天" } });
    fireEvent.click(screen.getByTestId("skp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", petalMeaning: "beauty", feeling: "美麗的花瓣令人心動" }], revealed: false };
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.getByTestId("skp-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", petalMeaning: "beauty", feeling: "美麗的花瓣令人心動" }], revealed: false };
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.queryByTestId("skp-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<SakuraPetal {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("skp-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.queryByTestId("skp-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.getByTestId("skp-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", petalMeaning: "farewell", feeling: "花落的那刻是美麗的告別" }],
      revealed: true,
    };
    render(<SakuraPetal {...defaultProps} />);
    expect(screen.getByTestId("skp-result")).toBeTruthy();
    expect(screen.getByTestId("skp-card-e99")).toBeTruthy();
  });
});
