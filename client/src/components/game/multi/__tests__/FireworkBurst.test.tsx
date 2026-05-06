import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FireworkBurst } from "../FireworkBurst";

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

describe("FireworkBurst", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.getByTestId("fwb-title").textContent).toBe("煙火爆發");
  });

  it("顯示自訂標題", () => {
    render(<FireworkBurst {...defaultProps} config={{ title: "我的煙火秀" }} />);
    expect(screen.getByTestId("fwb-title").textContent).toBe("我的煙火秀");
  });

  it("顯示預設 prompt", () => {
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.getByTestId("fwb-prompt").textContent).toContain("煙火");
  });

  it("顯示自訂 prompt", () => {
    render(<FireworkBurst {...defaultProps} config={{ prompt: "你想施放什麼？" }} />);
    expect(screen.getByTestId("fwb-prompt").textContent).toBe("你想施放什麼？");
  });

  it("顯示已施放煙火數", () => {
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.getByTestId("fwb-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.getByTestId("fwb-form")).toBeTruthy();
  });

  it("顯示五種煙火類型選項", () => {
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.getByTestId("fwb-burst-sparkle")).toBeTruthy();
    expect(screen.getByTestId("fwb-burst-meteor")).toBeTruthy();
    expect(screen.getByTestId("fwb-burst-bloom")).toBeTruthy();
    expect(screen.getByTestId("fwb-burst-rainbow")).toBeTruthy();
    expect(screen.getByTestId("fwb-burst-grand")).toBeTruthy();
  });

  it("顯示慶祝輸入框", () => {
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.getByTestId("fwb-celebration-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.getByTestId("fwb-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<FireworkBurst {...defaultProps} />);
    fireEvent.change(screen.getByTestId("fwb-celebration-input"), { target: { value: "短" } });
    expect(screen.getByTestId("fwb-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<FireworkBurst {...defaultProps} />);
    fireEvent.change(screen.getByTestId("fwb-celebration-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("fwb-submit-btn")).not.toBeDisabled();
  });

  it("切換煙火類型選擇", () => {
    render(<FireworkBurst {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fwb-burst-bloom"));
    expect(screen.getByTestId("fwb-burst-bloom").className).toContain("rose");
  });

  it("提交呼叫 updateState", () => {
    render(<FireworkBurst {...defaultProps} />);
    fireEvent.change(screen.getByTestId("fwb-celebration-input"), { target: { value: "慶祝今天完成目標" } });
    fireEvent.click(screen.getByTestId("fwb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", burstType: "sparkle", celebration: "慶祝小成就" }], revealed: false };
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.getByTestId("fwb-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", burstType: "sparkle", celebration: "慶祝小成就" }], revealed: false };
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.queryByTestId("fwb-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<FireworkBurst {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("fwb-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.queryByTestId("fwb-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.getByTestId("fwb-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", burstType: "sparkle", celebration: "我的煙火故事" }],
      revealed: true,
    };
    render(<FireworkBurst {...defaultProps} />);
    expect(screen.getByTestId("fwb-result")).toBeTruthy();
    expect(screen.getByTestId("fwb-card-e99")).toBeTruthy();
  });
});
