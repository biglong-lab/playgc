import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BambooScroll } from "../BambooScroll";

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

describe("BambooScroll", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<BambooScroll {...defaultProps} />);
    expect(screen.getByTestId("bbs-title").textContent).toBe("竹簡");
  });

  it("顯示自訂標題", () => {
    render(<BambooScroll {...defaultProps} config={{ title: "古老竹簡" }} />);
    expect(screen.getByTestId("bbs-title").textContent).toBe("古老竹簡");
  });

  it("顯示預設 prompt", () => {
    render(<BambooScroll {...defaultProps} />);
    expect(screen.getByTestId("bbs-prompt").textContent).toContain("竹簡");
  });

  it("顯示自訂 prompt", () => {
    render(<BambooScroll {...defaultProps} config={{ prompt: "刻下你的智慧" }} />);
    expect(screen.getByTestId("bbs-prompt").textContent).toBe("刻下你的智慧");
  });

  it("顯示已刻下竹簡數", () => {
    render(<BambooScroll {...defaultProps} />);
    expect(screen.getByTestId("bbs-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<BambooScroll {...defaultProps} />);
    expect(screen.getByTestId("bbs-form")).toBeTruthy();
  });

  it("顯示五種竹簡類型選項", () => {
    render(<BambooScroll {...defaultProps} />);
    expect(screen.getByTestId("bbs-type-wisdom")).toBeTruthy();
    expect(screen.getByTestId("bbs-type-story")).toBeTruthy();
    expect(screen.getByTestId("bbs-type-oath")).toBeTruthy();
    expect(screen.getByTestId("bbs-type-prophecy")).toBeTruthy();
    expect(screen.getByTestId("bbs-type-blessing")).toBeTruthy();
  });

  it("顯示銘文輸入框", () => {
    render(<BambooScroll {...defaultProps} />);
    expect(screen.getByTestId("bbs-inscription-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<BambooScroll {...defaultProps} />);
    expect(screen.getByTestId("bbs-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<BambooScroll {...defaultProps} />);
    fireEvent.change(screen.getByTestId("bbs-inscription-input"), { target: { value: "短" } });
    expect(screen.getByTestId("bbs-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<BambooScroll {...defaultProps} />);
    fireEvent.change(screen.getByTestId("bbs-inscription-input"), { target: { value: "五個字以上的銘文" } });
    expect(screen.getByTestId("bbs-submit-btn")).not.toBeDisabled();
  });

  it("切換竹簡類型選擇", () => {
    render(<BambooScroll {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bbs-type-blessing"));
    expect(screen.getByTestId("bbs-type-blessing").className).toContain("amber");
  });

  it("提交呼叫 updateState", () => {
    render(<BambooScroll {...defaultProps} />);
    fireEvent.change(screen.getByTestId("bbs-inscription-input"), { target: { value: "順其自然方得始終" } });
    fireEvent.click(screen.getByTestId("bbs-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", scrollType: "wisdom", inscription: "天下無難事只怕有心人" }], revealed: false };
    render(<BambooScroll {...defaultProps} />);
    expect(screen.getByTestId("bbs-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", scrollType: "wisdom", inscription: "天下無難事只怕有心人" }], revealed: false };
    render(<BambooScroll {...defaultProps} />);
    expect(screen.queryByTestId("bbs-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<BambooScroll {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("bbs-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<BambooScroll {...defaultProps} />);
    expect(screen.queryByTestId("bbs-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<BambooScroll {...defaultProps} />);
    expect(screen.getByTestId("bbs-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", scrollType: "blessing", inscription: "我的竹簡故事" }],
      revealed: true,
    };
    render(<BambooScroll {...defaultProps} />);
    expect(screen.getByTestId("bbs-result")).toBeTruthy();
    expect(screen.getByTestId("bbs-card-e99")).toBeTruthy();
  });
});
