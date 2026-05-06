import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TidePool } from "../TidePool";

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

describe("TidePool", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<TidePool {...defaultProps} />);
    expect(screen.getByTestId("tdp-title").textContent).toBe("潮池");
  });

  it("顯示自訂標題", () => {
    render(<TidePool {...defaultProps} config={{ title: "海邊潮池" }} />);
    expect(screen.getByTestId("tdp-title").textContent).toBe("海邊潮池");
  });

  it("顯示預設 prompt", () => {
    render(<TidePool {...defaultProps} />);
    expect(screen.getByTestId("tdp-prompt").textContent).toContain("潮池");
  });

  it("顯示自訂 prompt", () => {
    render(<TidePool {...defaultProps} config={{ prompt: "你是哪種海洋生物？" }} />);
    expect(screen.getByTestId("tdp-prompt").textContent).toBe("你是哪種海洋生物？");
  });

  it("顯示已加入生物數", () => {
    render(<TidePool {...defaultProps} />);
    expect(screen.getByTestId("tdp-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<TidePool {...defaultProps} />);
    expect(screen.getByTestId("tdp-form")).toBeTruthy();
  });

  it("顯示五種生物選項", () => {
    render(<TidePool {...defaultProps} />);
    expect(screen.getByTestId("tdp-creature-starfish")).toBeTruthy();
    expect(screen.getByTestId("tdp-creature-crab")).toBeTruthy();
    expect(screen.getByTestId("tdp-creature-anemone")).toBeTruthy();
    expect(screen.getByTestId("tdp-creature-hermit_crab")).toBeTruthy();
    expect(screen.getByTestId("tdp-creature-fish")).toBeTruthy();
  });

  it("顯示反思輸入框", () => {
    render(<TidePool {...defaultProps} />);
    expect(screen.getByTestId("tdp-reflection-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<TidePool {...defaultProps} />);
    expect(screen.getByTestId("tdp-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<TidePool {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tdp-reflection-input"), { target: { value: "短" } });
    expect(screen.getByTestId("tdp-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<TidePool {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tdp-reflection-input"), { target: { value: "五個字以上的描述" } });
    expect(screen.getByTestId("tdp-submit-btn")).not.toBeDisabled();
  });

  it("切換生物選擇", () => {
    render(<TidePool {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tdp-creature-crab"));
    expect(screen.getByTestId("tdp-creature-crab").className).toContain("teal");
  });

  it("提交呼叫 updateState", () => {
    render(<TidePool {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tdp-reflection-input"), { target: { value: "我在團隊中靜靜觀察一切" } });
    fireEvent.click(screen.getByTestId("tdp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", creature: "starfish", reflection: "我是靜靜等待的觀察者角色" }], revealed: false };
    render(<TidePool {...defaultProps} />);
    expect(screen.getByTestId("tdp-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", creature: "starfish", reflection: "我是靜靜等待的觀察者角色" }], revealed: false };
    render(<TidePool {...defaultProps} />);
    expect(screen.queryByTestId("tdp-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<TidePool {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("tdp-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<TidePool {...defaultProps} />);
    expect(screen.queryByTestId("tdp-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<TidePool {...defaultProps} />);
    expect(screen.getByTestId("tdp-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", creature: "fish", reflection: "我的潮池故事" }],
      revealed: true,
    };
    render(<TidePool {...defaultProps} />);
    expect(screen.getByTestId("tdp-result")).toBeTruthy();
    expect(screen.getByTestId("tdp-card-e99")).toBeTruthy();
  });
});
