import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DrumCircle } from "../DrumCircle";

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

describe("DrumCircle", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<DrumCircle {...defaultProps} />);
    expect(screen.getByTestId("drc-title").textContent).toBe("鼓圈節奏");
  });

  it("顯示自訂標題", () => {
    render(<DrumCircle {...defaultProps} config={{ title: "團隊鼓聲" }} />);
    expect(screen.getByTestId("drc-title").textContent).toBe("團隊鼓聲");
  });

  it("顯示預設 prompt", () => {
    render(<DrumCircle {...defaultProps} />);
    expect(screen.getByTestId("drc-prompt").textContent).toContain("鼓圈");
  });

  it("顯示自訂 prompt", () => {
    render(<DrumCircle {...defaultProps} config={{ prompt: "敲出你的節奏" }} />);
    expect(screen.getByTestId("drc-prompt").textContent).toBe("敲出你的節奏");
  });

  it("顯示已加入人數", () => {
    render(<DrumCircle {...defaultProps} />);
    expect(screen.getByTestId("drc-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<DrumCircle {...defaultProps} />);
    expect(screen.getByTestId("drc-form")).toBeTruthy();
  });

  it("顯示五種節奏類型選項", () => {
    render(<DrumCircle {...defaultProps} />);
    expect(screen.getByTestId("drc-rhythm-steady")).toBeTruthy();
    expect(screen.getByTestId("drc-rhythm-upbeat")).toBeTruthy();
    expect(screen.getByTestId("drc-rhythm-gentle")).toBeTruthy();
    expect(screen.getByTestId("drc-rhythm-powerful")).toBeTruthy();
    expect(screen.getByTestId("drc-rhythm-joyful")).toBeTruthy();
  });

  it("顯示心聲輸入框", () => {
    render(<DrumCircle {...defaultProps} />);
    expect(screen.getByTestId("drc-beat-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<DrumCircle {...defaultProps} />);
    expect(screen.getByTestId("drc-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<DrumCircle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("drc-beat-input"), { target: { value: "短" } });
    expect(screen.getByTestId("drc-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<DrumCircle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("drc-beat-input"), { target: { value: "五個字以上的心聲" } });
    expect(screen.getByTestId("drc-submit-btn")).not.toBeDisabled();
  });

  it("切換節奏類型選擇", () => {
    render(<DrumCircle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("drc-rhythm-powerful"));
    expect(screen.getByTestId("drc-rhythm-powerful").className).toContain("red");
  });

  it("提交呼叫 updateState", () => {
    render(<DrumCircle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("drc-beat-input"), { target: { value: "今天我充滿活力向前衝" } });
    fireEvent.click(screen.getByTestId("drc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", rhythmType: "steady", beat: "穩健前進是我的信念" }], revealed: false };
    render(<DrumCircle {...defaultProps} />);
    expect(screen.getByTestId("drc-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", rhythmType: "steady", beat: "穩健前進是我的信念" }], revealed: false };
    render(<DrumCircle {...defaultProps} />);
    expect(screen.queryByTestId("drc-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<DrumCircle {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("drc-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<DrumCircle {...defaultProps} />);
    expect(screen.queryByTestId("drc-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<DrumCircle {...defaultProps} />);
    expect(screen.getByTestId("drc-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", rhythmType: "joyful", beat: "我的鼓圈故事" }],
      revealed: true,
    };
    render(<DrumCircle {...defaultProps} />);
    expect(screen.getByTestId("drc-result")).toBeTruthy();
    expect(screen.getByTestId("drc-card-e99")).toBeTruthy();
  });
});
