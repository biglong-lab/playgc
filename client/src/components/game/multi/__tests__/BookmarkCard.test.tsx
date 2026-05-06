import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookmarkCard } from "../BookmarkCard";

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

describe("BookmarkCard", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTestId("bmk-title").textContent).toBe("人生書籤卡");
  });

  it("顯示自訂標題", () => {
    render(<BookmarkCard {...defaultProps} config={{ title: "我的書籤" }} />);
    expect(screen.getByTestId("bmk-title").textContent).toBe("我的書籤");
  });

  it("顯示預設 prompt", () => {
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTestId("bmk-prompt").textContent).toContain("人生");
  });

  it("顯示自訂 prompt", () => {
    render(<BookmarkCard {...defaultProps} config={{ prompt: "你在哪一頁？" }} />);
    expect(screen.getByTestId("bmk-prompt").textContent).toBe("你在哪一頁？");
  });

  it("顯示已夾入書籤數", () => {
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTestId("bmk-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTestId("bmk-form")).toBeTruthy();
  });

  it("顯示五個章節類型選項", () => {
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTestId("bmk-chapter-new_chapter")).toBeTruthy();
    expect(screen.getByTestId("bmk-chapter-climax")).toBeTruthy();
    expect(screen.getByTestId("bmk-chapter-plot_twist")).toBeTruthy();
    expect(screen.getByTestId("bmk-chapter-epilogue")).toBeTruthy();
    expect(screen.getByTestId("bmk-chapter-blank_page")).toBeTruthy();
  });

  it("顯示反思輸入框", () => {
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTestId("bmk-reflection-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTestId("bmk-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<BookmarkCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("bmk-reflection-input"), { target: { value: "短" } });
    expect(screen.getByTestId("bmk-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<BookmarkCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("bmk-reflection-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("bmk-submit-btn")).not.toBeDisabled();
  });

  it("切換章節類型選擇", () => {
    render(<BookmarkCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bmk-chapter-climax"));
    expect(screen.getByTestId("bmk-chapter-climax").className).toContain("amber");
  });

  it("提交呼叫 updateState", () => {
    render(<BookmarkCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("bmk-reflection-input"), { target: { value: "這是我的書籤故事" } });
    fireEvent.click(screen.getByTestId("bmk-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", chapter: "new_chapter", reflection: "書籤故事" }], revealed: false };
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTestId("bmk-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", chapter: "new_chapter", reflection: "書籤故事" }], revealed: false };
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.queryByTestId("bmk-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<BookmarkCard {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("bmk-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.queryByTestId("bmk-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTestId("bmk-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", chapter: "new_chapter", reflection: "我的書籤故事" }],
      revealed: true,
    };
    render(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTestId("bmk-result")).toBeTruthy();
    expect(screen.getByTestId("bmk-card-e99")).toBeTruthy();
  });
});
