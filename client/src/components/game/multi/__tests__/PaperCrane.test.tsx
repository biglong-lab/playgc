import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaperCrane } from "../PaperCrane";

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

describe("PaperCrane", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<PaperCrane {...defaultProps} />);
    expect(screen.getByTestId("prc-title").textContent).toBe("千羽鶴心願");
  });

  it("顯示自訂標題", () => {
    render(<PaperCrane {...defaultProps} config={{ title: "紙鶴願望" }} />);
    expect(screen.getByTestId("prc-title").textContent).toBe("紙鶴願望");
  });

  it("顯示預設 prompt", () => {
    render(<PaperCrane {...defaultProps} />);
    expect(screen.getByTestId("prc-prompt").textContent).toContain("紙鶴");
  });

  it("顯示自訂 prompt", () => {
    render(<PaperCrane {...defaultProps} config={{ prompt: "摺一隻千年之鶴" }} />);
    expect(screen.getByTestId("prc-prompt").textContent).toBe("摺一隻千年之鶴");
  });

  it("顯示已折紙鶴數", () => {
    render(<PaperCrane {...defaultProps} />);
    expect(screen.getByTestId("prc-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<PaperCrane {...defaultProps} />);
    expect(screen.getByTestId("prc-form")).toBeTruthy();
  });

  it("顯示五種紙鶴類型選項", () => {
    render(<PaperCrane {...defaultProps} />);
    expect(screen.getByTestId("prc-crane-thousand_cranes")).toBeTruthy();
    expect(screen.getByTestId("prc-crane-peace_crane")).toBeTruthy();
    expect(screen.getByTestId("prc-crane-love_crane")).toBeTruthy();
    expect(screen.getByTestId("prc-crane-wish_crane")).toBeTruthy();
    expect(screen.getByTestId("prc-crane-gratitude_crane")).toBeTruthy();
  });

  it("顯示心願輸入框", () => {
    render(<PaperCrane {...defaultProps} />);
    expect(screen.getByTestId("prc-wish-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<PaperCrane {...defaultProps} />);
    expect(screen.getByTestId("prc-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<PaperCrane {...defaultProps} />);
    fireEvent.change(screen.getByTestId("prc-wish-input"), { target: { value: "短" } });
    expect(screen.getByTestId("prc-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<PaperCrane {...defaultProps} />);
    fireEvent.change(screen.getByTestId("prc-wish-input"), { target: { value: "我的願望是世界和平" } });
    expect(screen.getByTestId("prc-submit-btn")).not.toBeDisabled();
  });

  it("切換紙鶴類型選擇", () => {
    render(<PaperCrane {...defaultProps} />);
    fireEvent.click(screen.getByTestId("prc-crane-love_crane"));
    expect(screen.getByTestId("prc-crane-love_crane").className).toContain("emerald");
  });

  it("提交呼叫 updateState", () => {
    render(<PaperCrane {...defaultProps} />);
    fireEvent.change(screen.getByTestId("prc-wish-input"), { target: { value: "千隻紙鶴代表我的心願" } });
    fireEvent.click(screen.getByTestId("prc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", craneType: "peace_crane", wish: "願世界充滿和平與愛" }], revealed: false };
    render(<PaperCrane {...defaultProps} />);
    expect(screen.getByTestId("prc-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", craneType: "peace_crane", wish: "願世界充滿和平與愛" }], revealed: false };
    render(<PaperCrane {...defaultProps} />);
    expect(screen.queryByTestId("prc-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<PaperCrane {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("prc-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<PaperCrane {...defaultProps} />);
    expect(screen.queryByTestId("prc-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<PaperCrane {...defaultProps} />);
    expect(screen.getByTestId("prc-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", craneType: "wish_crane", wish: "這隻鶴承載著我所有的願望" }],
      revealed: true,
    };
    render(<PaperCrane {...defaultProps} />);
    expect(screen.getByTestId("prc-result")).toBeTruthy();
    expect(screen.getByTestId("prc-card-e99")).toBeTruthy();
  });
});
