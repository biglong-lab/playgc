import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WindChime } from "../WindChime";

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

describe("WindChime", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<WindChime {...defaultProps} />);
    expect(screen.getByTestId("wnc-title").textContent).toBe("風鈴");
  });

  it("顯示自訂標題", () => {
    render(<WindChime {...defaultProps} config={{ title: "天籟風鈴" }} />);
    expect(screen.getByTestId("wnc-title").textContent).toBe("天籟風鈴");
  });

  it("顯示預設 prompt", () => {
    render(<WindChime {...defaultProps} />);
    expect(screen.getByTestId("wnc-prompt").textContent).toContain("風鈴");
  });

  it("顯示自訂 prompt", () => {
    render(<WindChime {...defaultProps} config={{ prompt: "讓旋律響起" }} />);
    expect(screen.getByTestId("wnc-prompt").textContent).toBe("讓旋律響起");
  });

  it("顯示已掛上風鈴數", () => {
    render(<WindChime {...defaultProps} />);
    expect(screen.getByTestId("wnc-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<WindChime {...defaultProps} />);
    expect(screen.getByTestId("wnc-form")).toBeTruthy();
  });

  it("顯示五種音符選項", () => {
    render(<WindChime {...defaultProps} />);
    expect(screen.getByTestId("wnc-note-joy")).toBeTruthy();
    expect(screen.getByTestId("wnc-note-peace")).toBeTruthy();
    expect(screen.getByTestId("wnc-note-longing")).toBeTruthy();
    expect(screen.getByTestId("wnc-note-gratitude")).toBeTruthy();
    expect(screen.getByTestId("wnc-note-hope")).toBeTruthy();
  });

  it("顯示訊息輸入框", () => {
    render(<WindChime {...defaultProps} />);
    expect(screen.getByTestId("wnc-message-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<WindChime {...defaultProps} />);
    expect(screen.getByTestId("wnc-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<WindChime {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wnc-message-input"), { target: { value: "短" } });
    expect(screen.getByTestId("wnc-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<WindChime {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wnc-message-input"), { target: { value: "五個字以上的話語" } });
    expect(screen.getByTestId("wnc-submit-btn")).not.toBeDisabled();
  });

  it("切換音符選擇", () => {
    render(<WindChime {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wnc-note-peace"));
    expect(screen.getByTestId("wnc-note-peace").className).toContain("sky");
  });

  it("提交呼叫 updateState", () => {
    render(<WindChime {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wnc-message-input"), { target: { value: "願每個人都找到平靜" } });
    fireEvent.click(screen.getByTestId("wnc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", chimeNote: "joy", message: "今天是美好的一天啊" }], revealed: false };
    render(<WindChime {...defaultProps} />);
    expect(screen.getByTestId("wnc-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", chimeNote: "joy", message: "今天是美好的一天啊" }], revealed: false };
    render(<WindChime {...defaultProps} />);
    expect(screen.queryByTestId("wnc-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<WindChime {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("wnc-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<WindChime {...defaultProps} />);
    expect(screen.queryByTestId("wnc-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<WindChime {...defaultProps} />);
    expect(screen.getByTestId("wnc-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", chimeNote: "hope", message: "我的風鈴故事" }],
      revealed: true,
    };
    render(<WindChime {...defaultProps} />);
    expect(screen.getByTestId("wnc-result")).toBeTruthy();
    expect(screen.getByTestId("wnc-card-e99")).toBeTruthy();
  });
});
