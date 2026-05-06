import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TreasureChest } from "../TreasureChest";

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

describe("TreasureChest", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<TreasureChest {...defaultProps} />);
    expect(screen.getByTestId("trc-title").textContent).toBe("寶箱");
  });

  it("顯示自訂標題", () => {
    render(<TreasureChest {...defaultProps} config={{ title: "神秘寶箱" }} />);
    expect(screen.getByTestId("trc-title").textContent).toBe("神秘寶箱");
  });

  it("顯示預設 prompt", () => {
    render(<TreasureChest {...defaultProps} />);
    expect(screen.getByTestId("trc-prompt").textContent).toContain("寶箱");
  });

  it("顯示自訂 prompt", () => {
    render(<TreasureChest {...defaultProps} config={{ prompt: "你有什麼珍寶？" }} />);
    expect(screen.getByTestId("trc-prompt").textContent).toBe("你有什麼珍寶？");
  });

  it("顯示已開啟寶箱數", () => {
    render(<TreasureChest {...defaultProps} />);
    expect(screen.getByTestId("trc-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<TreasureChest {...defaultProps} />);
    expect(screen.getByTestId("trc-form")).toBeTruthy();
  });

  it("顯示五種珍寶類型選項", () => {
    render(<TreasureChest {...defaultProps} />);
    expect(screen.getByTestId("trc-treasure-gold")).toBeTruthy();
    expect(screen.getByTestId("trc-treasure-gem")).toBeTruthy();
    expect(screen.getByTestId("trc-treasure-scroll")).toBeTruthy();
    expect(screen.getByTestId("trc-treasure-artifact")).toBeTruthy();
    expect(screen.getByTestId("trc-treasure-map")).toBeTruthy();
  });

  it("顯示價值輸入框", () => {
    render(<TreasureChest {...defaultProps} />);
    expect(screen.getByTestId("trc-value-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<TreasureChest {...defaultProps} />);
    expect(screen.getByTestId("trc-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<TreasureChest {...defaultProps} />);
    fireEvent.change(screen.getByTestId("trc-value-input"), { target: { value: "短" } });
    expect(screen.getByTestId("trc-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<TreasureChest {...defaultProps} />);
    fireEvent.change(screen.getByTestId("trc-value-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("trc-submit-btn")).not.toBeDisabled();
  });

  it("切換珍寶類型選擇", () => {
    render(<TreasureChest {...defaultProps} />);
    fireEvent.click(screen.getByTestId("trc-treasure-gem"));
    expect(screen.getByTestId("trc-treasure-gem").className).toContain("amber");
  });

  it("提交呼叫 updateState", () => {
    render(<TreasureChest {...defaultProps} />);
    fireEvent.change(screen.getByTestId("trc-value-input"), { target: { value: "這是我最珍貴的寶物" } });
    fireEvent.click(screen.getByTestId("trc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", treasureType: "gold", value: "珍貴的金幣寶藏" }], revealed: false };
    render(<TreasureChest {...defaultProps} />);
    expect(screen.getByTestId("trc-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", treasureType: "gold", value: "珍貴的金幣寶藏" }], revealed: false };
    render(<TreasureChest {...defaultProps} />);
    expect(screen.queryByTestId("trc-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<TreasureChest {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("trc-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<TreasureChest {...defaultProps} />);
    expect(screen.queryByTestId("trc-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<TreasureChest {...defaultProps} />);
    expect(screen.getByTestId("trc-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", treasureType: "gold", value: "我的寶箱故事" }],
      revealed: true,
    };
    render(<TreasureChest {...defaultProps} />);
    expect(screen.getByTestId("trc-result")).toBeTruthy();
    expect(screen.getByTestId("trc-card-e99")).toBeTruthy();
  });
});
