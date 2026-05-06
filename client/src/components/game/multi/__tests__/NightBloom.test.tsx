import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NightBloom } from "../NightBloom";

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

describe("NightBloom", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<NightBloom {...defaultProps} />);
    expect(screen.getByTestId("ntb-title").textContent).toBe("夜間盛開");
  });

  it("顯示自訂標題", () => {
    render(<NightBloom {...defaultProps} config={{ title: "月夜之花" }} />);
    expect(screen.getByTestId("ntb-title").textContent).toBe("月夜之花");
  });

  it("顯示預設 prompt", () => {
    render(<NightBloom {...defaultProps} />);
    expect(screen.getByTestId("ntb-prompt").textContent).toContain("夜晚");
  });

  it("顯示自訂 prompt", () => {
    render(<NightBloom {...defaultProps} config={{ prompt: "夜裡的花最真實" }} />);
    expect(screen.getByTestId("ntb-prompt").textContent).toBe("夜裡的花最真實");
  });

  it("顯示已盛開夜花數", () => {
    render(<NightBloom {...defaultProps} />);
    expect(screen.getByTestId("ntb-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<NightBloom {...defaultProps} />);
    expect(screen.getByTestId("ntb-form")).toBeTruthy();
  });

  it("顯示五種夜花類型選項", () => {
    render(<NightBloom {...defaultProps} />);
    expect(screen.getByTestId("ntb-bloom-moonflower")).toBeTruthy();
    expect(screen.getByTestId("ntb-bloom-night_jasmine")).toBeTruthy();
    expect(screen.getByTestId("ntb-bloom-evening_primrose")).toBeTruthy();
    expect(screen.getByTestId("ntb-bloom-night_orchid")).toBeTruthy();
    expect(screen.getByTestId("ntb-bloom-queen_of_night")).toBeTruthy();
  });

  it("顯示夜間訊息輸入框", () => {
    render(<NightBloom {...defaultProps} />);
    expect(screen.getByTestId("ntb-message-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<NightBloom {...defaultProps} />);
    expect(screen.getByTestId("ntb-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<NightBloom {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ntb-message-input"), { target: { value: "短" } });
    expect(screen.getByTestId("ntb-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<NightBloom {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ntb-message-input"), { target: { value: "曇花一現是最美麗的瞬間" } });
    expect(screen.getByTestId("ntb-submit-btn")).not.toBeDisabled();
  });

  it("切換夜花類型選擇", () => {
    render(<NightBloom {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ntb-bloom-moonflower"));
    expect(screen.getByTestId("ntb-bloom-moonflower").className).toContain("indigo");
  });

  it("提交呼叫 updateState", () => {
    render(<NightBloom {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ntb-message-input"), { target: { value: "月光花陪我度過了最孤單的夜晚" } });
    fireEvent.click(screen.getByTestId("ntb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", bloomType: "night_jasmine", nightMessage: "夜茉莉的香氣讓夜晚充滿回憶" }], revealed: false };
    render(<NightBloom {...defaultProps} />);
    expect(screen.getByTestId("ntb-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", bloomType: "night_jasmine", nightMessage: "夜茉莉的香氣讓夜晚充滿回憶" }], revealed: false };
    render(<NightBloom {...defaultProps} />);
    expect(screen.queryByTestId("ntb-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<NightBloom {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ntb-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<NightBloom {...defaultProps} />);
    expect(screen.queryByTestId("ntb-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<NightBloom {...defaultProps} />);
    expect(screen.getByTestId("ntb-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", bloomType: "queen_of_night", nightMessage: "曇花一現提醒我珍惜每個當下" }],
      revealed: true,
    };
    render(<NightBloom {...defaultProps} />);
    expect(screen.getByTestId("ntb-result")).toBeTruthy();
    expect(screen.getByTestId("ntb-card-e99")).toBeTruthy();
  });
});
