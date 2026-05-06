import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WisteriaVine } from "../WisteriaVine";

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

describe("WisteriaVine", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.getByTestId("wst-title").textContent).toBe("紫藤情緣");
  });

  it("顯示自訂標題", () => {
    render(<WisteriaVine {...defaultProps} config={{ title: "藤蔓之愛" }} />);
    expect(screen.getByTestId("wst-title").textContent).toBe("藤蔓之愛");
  });

  it("顯示預設 prompt", () => {
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.getByTestId("wst-prompt").textContent).toContain("紫藤");
  });

  it("顯示自訂 prompt", () => {
    render(<WisteriaVine {...defaultProps} config={{ prompt: "選一段紫藤情緣" }} />);
    expect(screen.getByTestId("wst-prompt").textContent).toBe("選一段紫藤情緣");
  });

  it("顯示已編織情緣數", () => {
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.getByTestId("wst-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.getByTestId("wst-form")).toBeTruthy();
  });

  it("顯示五種紫藤類型選項", () => {
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.getByTestId("wst-vine-purple_wisteria")).toBeTruthy();
    expect(screen.getByTestId("wst-vine-white_wisteria")).toBeTruthy();
    expect(screen.getByTestId("wst-vine-pink_wisteria")).toBeTruthy();
    expect(screen.getByTestId("wst-vine-climbing_wisteria")).toBeTruthy();
    expect(screen.getByTestId("wst-vine-weeping_wisteria")).toBeTruthy();
  });

  it("顯示情緣輸入框", () => {
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.getByTestId("wst-connection-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.getByTestId("wst-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<WisteriaVine {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wst-connection-input"), { target: { value: "短" } });
    expect(screen.getByTestId("wst-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<WisteriaVine {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wst-connection-input"), { target: { value: "紫藤花開讓我想起了最美的相遇" } });
    expect(screen.getByTestId("wst-submit-btn")).not.toBeDisabled();
  });

  it("切換紫藤類型選擇", () => {
    render(<WisteriaVine {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wst-vine-white_wisteria"));
    expect(screen.getByTestId("wst-vine-white_wisteria").className).toContain("purple");
  });

  it("提交呼叫 updateState", () => {
    render(<WisteriaVine {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wst-connection-input"), { target: { value: "攀藤象徵我永不放棄的精神" } });
    fireEvent.click(screen.getByTestId("wst-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", vineType: "weeping_wisteria", connection: "垂藤讓我感受到思念的溫柔" }], revealed: false };
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.getByTestId("wst-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", vineType: "weeping_wisteria", connection: "垂藤讓我感受到思念的溫柔" }], revealed: false };
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.queryByTestId("wst-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<WisteriaVine {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("wst-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.queryByTestId("wst-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.getByTestId("wst-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", vineType: "purple_wisteria", connection: "紫藤花串是我最浪漫的情懷" }],
      revealed: true,
    };
    render(<WisteriaVine {...defaultProps} />);
    expect(screen.getByTestId("wst-result")).toBeTruthy();
    expect(screen.getByTestId("wst-card-e99")).toBeTruthy();
  });
});
