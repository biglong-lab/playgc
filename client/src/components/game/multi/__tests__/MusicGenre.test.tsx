import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MusicGenre } from "../MusicGenre";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("MusicGenre", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<MusicGenre {...defaultProps} />);
    expect(screen.getByTestId("mg2-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<MusicGenre {...defaultProps} />);
    expect(screen.getByTestId("mg2-title").textContent).toBe("我今天的音樂風格");
    expect(screen.getByTestId("mg2-prompt").textContent).toContain("音樂");
  });

  it("自訂 config 標題", () => {
    render(<MusicGenre {...defaultProps} config={{ title: "今日音樂人格", prompt: "選一個節奏！" }} />);
    expect(screen.getByTestId("mg2-title").textContent).toBe("今日音樂人格");
    expect(screen.getByTestId("mg2-prompt").textContent).toBe("選一個節奏！");
  });

  it("顯示已選擇人數", () => {
    render(<MusicGenre {...defaultProps} />);
    expect(screen.getByTestId("mg2-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<MusicGenre {...defaultProps} />);
    expect(screen.getByTestId("mg2-form")).toBeTruthy();
    expect(screen.getByTestId("mg2-reason-input")).toBeTruthy();
    expect(screen.getByTestId("mg2-submit-btn")).toBeTruthy();
  });

  it("顯示所有 9 種音樂風格按鈕", () => {
    render(<MusicGenre {...defaultProps} />);
    ["pop","rock","jazz","classical","hiphop","rnb","electronic","folk","lofi"].forEach((id) => {
      expect(screen.getByTestId(`mg2-genre-${id}`)).toBeTruthy();
    });
  });

  it("未選風格時提交按鈕 disabled", () => {
    render(<MusicGenre {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mg2-reason-input"), { target: { value: "輕鬆開朗廣受大家喜愛" } });
    const btn = screen.getByTestId("mg2-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選風格但原因太短時 disabled", () => {
    render(<MusicGenre {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mg2-genre-jazz"));
    fireEvent.change(screen.getByTestId("mg2-reason-input"), { target: { value: "沉穩" } });
    const btn = screen.getByTestId("mg2-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選風格且原因 ≥5 字時提交按鈕啟用", () => {
    render(<MusicGenre {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mg2-genre-lofi"));
    fireEvent.change(screen.getByTestId("mg2-reason-input"), { target: { value: "放鬆專注適合今天工作" } });
    const btn = screen.getByTestId("mg2-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<MusicGenre {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mg2-genre-rock"));
    fireEvent.change(screen.getByTestId("mg2-reason-input"), { target: { value: "今天熱血奔放充滿能量" } });
    fireEvent.click(screen.getByTestId("mg2-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", genre: "classical", reason: "細膩深刻追求完美卓越" }],
      revealed: false,
    };
    render(<MusicGenre {...defaultProps} />);
    expect(screen.getByTestId("mg2-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("mg2-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<MusicGenre {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("mg2-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<MusicGenre {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("mg2-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<MusicGenre {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("mg2-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MusicGenre {...defaultProps} />);
    expect(screen.getByTestId("mg2-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 mg2-result 和音樂摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", genre: "folk", reason: "真誠純粹貼近生活感受" }],
      revealed: true,
    };
    render(<MusicGenre {...defaultProps} />);
    expect(screen.getByTestId("mg2-result")).toBeTruthy();
    expect(screen.getByTestId("mg2-genre-summary")).toBeTruthy();
    expect(screen.getByTestId("mg2-badge-folk")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", genre: "hiphop", reason: "直接表達敢說真話不拐彎" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", genre: "electronic", reason: "前衛創新科技感十足" },
      ],
      revealed: true,
    };
    render(<MusicGenre {...defaultProps} />);
    expect(screen.getByTestId("mg2-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mg2-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<MusicGenre {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("mg2-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", genre: "pop", reason: "輕鬆開朗廣受大家歡迎" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", genre: "rnb", reason: "感性豐富情感特別細膩" },
      ],
      revealed: false,
    };
    render(<MusicGenre {...defaultProps} />);
    expect(screen.getByTestId("mg2-count").textContent).toContain("2");
  });
});
