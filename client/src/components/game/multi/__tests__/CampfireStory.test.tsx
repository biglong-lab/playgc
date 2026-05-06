import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampfireStory } from "../CampfireStory";

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

describe("CampfireStory", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<CampfireStory {...defaultProps} />);
    expect(screen.getByTestId("cfs-title").textContent).toBe("營火故事");
  });

  it("顯示自訂標題", () => {
    render(<CampfireStory {...defaultProps} config={{ title: "篝火夜話" }} />);
    expect(screen.getByTestId("cfs-title").textContent).toBe("篝火夜話");
  });

  it("顯示預設 prompt", () => {
    render(<CampfireStory {...defaultProps} />);
    expect(screen.getByTestId("cfs-prompt").textContent).toContain("故事");
  });

  it("顯示自訂 prompt", () => {
    render(<CampfireStory {...defaultProps} config={{ prompt: "分享你的故事" }} />);
    expect(screen.getByTestId("cfs-prompt").textContent).toBe("分享你的故事");
  });

  it("顯示已分享故事數", () => {
    render(<CampfireStory {...defaultProps} />);
    expect(screen.getByTestId("cfs-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<CampfireStory {...defaultProps} />);
    expect(screen.getByTestId("cfs-form")).toBeTruthy();
  });

  it("顯示五種故事類型選項", () => {
    render(<CampfireStory {...defaultProps} />);
    expect(screen.getByTestId("cfs-type-adventure")).toBeTruthy();
    expect(screen.getByTestId("cfs-type-mystery")).toBeTruthy();
    expect(screen.getByTestId("cfs-type-lesson")).toBeTruthy();
    expect(screen.getByTestId("cfs-type-memory")).toBeTruthy();
    expect(screen.getByTestId("cfs-type-dream")).toBeTruthy();
  });

  it("顯示故事輸入框", () => {
    render(<CampfireStory {...defaultProps} />);
    expect(screen.getByTestId("cfs-story-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<CampfireStory {...defaultProps} />);
    expect(screen.getByTestId("cfs-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<CampfireStory {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cfs-story-input"), { target: { value: "短" } });
    expect(screen.getByTestId("cfs-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<CampfireStory {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cfs-story-input"), { target: { value: "五個字以上的故事" } });
    expect(screen.getByTestId("cfs-submit-btn")).not.toBeDisabled();
  });

  it("切換故事類型選擇", () => {
    render(<CampfireStory {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cfs-type-mystery"));
    expect(screen.getByTestId("cfs-type-mystery").className).toContain("orange");
  });

  it("提交呼叫 updateState", () => {
    render(<CampfireStory {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cfs-story-input"), { target: { value: "那次冒險讓我學到了很多" } });
    fireEvent.click(screen.getByTestId("cfs-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", storyType: "adventure", story: "那次爬山的冒險記憶深刻" }], revealed: false };
    render(<CampfireStory {...defaultProps} />);
    expect(screen.getByTestId("cfs-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", storyType: "adventure", story: "那次爬山的冒險記憶深刻" }], revealed: false };
    render(<CampfireStory {...defaultProps} />);
    expect(screen.queryByTestId("cfs-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<CampfireStory {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("cfs-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<CampfireStory {...defaultProps} />);
    expect(screen.queryByTestId("cfs-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<CampfireStory {...defaultProps} />);
    expect(screen.getByTestId("cfs-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", storyType: "dream", story: "我的營火故事" }],
      revealed: true,
    };
    render(<CampfireStory {...defaultProps} />);
    expect(screen.getByTestId("cfs-result")).toBeTruthy();
    expect(screen.getByTestId("cfs-card-e99")).toBeTruthy();
  });
});
