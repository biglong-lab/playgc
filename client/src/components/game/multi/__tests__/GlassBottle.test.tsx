import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GlassBottle } from "../GlassBottle";

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

describe("GlassBottle", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<GlassBottle {...defaultProps} />);
    expect(screen.getByTestId("glb-title").textContent).toBe("玻璃瓶漂流信");
  });

  it("顯示自訂標題", () => {
    render(<GlassBottle {...defaultProps} config={{ title: "海的信" }} />);
    expect(screen.getByTestId("glb-title").textContent).toBe("海的信");
  });

  it("顯示預設 prompt", () => {
    render(<GlassBottle {...defaultProps} />);
    expect(screen.getByTestId("glb-prompt").textContent).toContain("漂流");
  });

  it("顯示自訂 prompt", () => {
    render(<GlassBottle {...defaultProps} config={{ prompt: "你有什麼想說的？" }} />);
    expect(screen.getByTestId("glb-prompt").textContent).toBe("你有什麼想說的？");
  });

  it("顯示已放出漂流瓶數", () => {
    render(<GlassBottle {...defaultProps} />);
    expect(screen.getByTestId("glb-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<GlassBottle {...defaultProps} />);
    expect(screen.getByTestId("glb-form")).toBeTruthy();
  });

  it("顯示五種訊息類型選項", () => {
    render(<GlassBottle {...defaultProps} />);
    expect(screen.getByTestId("glb-type-hope")).toBeTruthy();
    expect(screen.getByTestId("glb-type-gratitude")).toBeTruthy();
    expect(screen.getByTestId("glb-type-apology")).toBeTruthy();
    expect(screen.getByTestId("glb-type-promise")).toBeTruthy();
    expect(screen.getByTestId("glb-type-secret")).toBeTruthy();
  });

  it("顯示信件輸入框", () => {
    render(<GlassBottle {...defaultProps} />);
    expect(screen.getByTestId("glb-letter-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<GlassBottle {...defaultProps} />);
    expect(screen.getByTestId("glb-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<GlassBottle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("glb-letter-input"), { target: { value: "短" } });
    expect(screen.getByTestId("glb-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<GlassBottle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("glb-letter-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("glb-submit-btn")).not.toBeDisabled();
  });

  it("切換訊息類型選擇", () => {
    render(<GlassBottle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("glb-type-gratitude"));
    expect(screen.getByTestId("glb-type-gratitude").className).toContain("cyan");
  });

  it("提交呼叫 updateState", () => {
    render(<GlassBottle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("glb-letter-input"), { target: { value: "放入漂流瓶的希望" } });
    fireEvent.click(screen.getByTestId("glb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", messageType: "hope", letter: "希望大海把這封信帶走" }], revealed: false };
    render(<GlassBottle {...defaultProps} />);
    expect(screen.getByTestId("glb-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", messageType: "hope", letter: "希望大海把這封信帶走" }], revealed: false };
    render(<GlassBottle {...defaultProps} />);
    expect(screen.queryByTestId("glb-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<GlassBottle {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("glb-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<GlassBottle {...defaultProps} />);
    expect(screen.queryByTestId("glb-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<GlassBottle {...defaultProps} />);
    expect(screen.getByTestId("glb-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", messageType: "hope", letter: "我的漂流瓶故事" }],
      revealed: true,
    };
    render(<GlassBottle {...defaultProps} />);
    expect(screen.getByTestId("glb-result")).toBeTruthy();
    expect(screen.getByTestId("glb-card-e99")).toBeTruthy();
  });
});
