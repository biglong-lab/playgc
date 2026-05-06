import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookRec } from "../BookRec";

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

describe("BookRec", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<BookRec {...defaultProps} />);
    expect(screen.getByTestId("br-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<BookRec {...defaultProps} />);
    expect(screen.getByTestId("br-title").textContent).toBe("好物推薦");
    expect(screen.getByTestId("br-prompt").textContent).toContain("推薦");
  });

  it("自訂 config 標題", () => {
    render(<BookRec {...defaultProps} config={{ title: "本週推薦", prompt: "推薦你最愛的一個" }} />);
    expect(screen.getByTestId("br-title").textContent).toBe("本週推薦");
    expect(screen.getByTestId("br-prompt").textContent).toBe("推薦你最愛的一個");
  });

  it("顯示已推薦數量", () => {
    render(<BookRec {...defaultProps} />);
    expect(screen.getByTestId("br-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<BookRec {...defaultProps} />);
    expect(screen.getByTestId("br-form")).toBeTruthy();
    expect(screen.getByTestId("br-title-input")).toBeTruthy();
    expect(screen.getByTestId("br-reason-input")).toBeTruthy();
    expect(screen.getByTestId("br-submit-btn")).toBeTruthy();
  });

  it("顯示所有媒體類型按鈕", () => {
    render(<BookRec {...defaultProps} />);
    ["book", "movie", "podcast", "documentary", "music", "game"].forEach((id) => {
      expect(screen.getByTestId(`br-type-${id}`)).toBeTruthy();
    });
  });

  it("未選類型時提交按鈕 disabled", () => {
    render(<BookRec {...defaultProps} />);
    const btn = screen.getByTestId("br-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選類型但理由太短時 disabled", () => {
    render(<BookRec {...defaultProps} />);
    fireEvent.click(screen.getByTestId("br-type-book"));
    fireEvent.change(screen.getByTestId("br-title-input"), { target: { value: "小王子" } });
    fireEvent.change(screen.getByTestId("br-reason-input"), { target: { value: "好看" } });
    const btn = screen.getByTestId("br-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("填完全部條件後提交按鈕啟用", () => {
    render(<BookRec {...defaultProps} />);
    fireEvent.click(screen.getByTestId("br-type-movie"));
    fireEvent.change(screen.getByTestId("br-title-input"), { target: { value: "星際效應" } });
    fireEvent.change(screen.getByTestId("br-reason-input"), { target: { value: "視覺效果非常震撼" } });
    const btn = screen.getByTestId("br-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<BookRec {...defaultProps} />);
    fireEvent.click(screen.getByTestId("br-type-podcast"));
    fireEvent.change(screen.getByTestId("br-title-input"), { target: { value: "超級馬力兄弟" } });
    fireEvent.change(screen.getByTestId("br-reason-input"), { target: { value: "每週必聽的好內容" } });
    fireEvent.click(screen.getByTestId("br-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", title: "沙丘", reason: "世界觀超完整", mediaType: "book" }],
      revealed: false,
    };
    render(<BookRec {...defaultProps} />);
    expect(screen.getByTestId("br-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("br-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<BookRec {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("br-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<BookRec {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("br-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<BookRec {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("br-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<BookRec {...defaultProps} />);
    expect(screen.getByTestId("br-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 br-result", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", title: "惡棍英雄", reason: "劇情緊湊非常好看", mediaType: "movie" }],
      revealed: true,
    };
    render(<BookRec {...defaultProps} />);
    expect(screen.getByTestId("br-result")).toBeTruthy();
    expect(screen.getByTestId("br-rec-wall")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", title: "刀鋒之戰", reason: "遊戲設計超有創意", mediaType: "game" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", title: "自由時代", reason: "音樂質感非常到位", mediaType: "music" },
      ],
      revealed: true,
    };
    render(<BookRec {...defaultProps} />);
    expect(screen.getByTestId("br-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("br-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<BookRec {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("br-reveal-btn")).toBeNull();
  });

  it("已推薦數量隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", title: "書A", reason: "很好看的一本書", mediaType: "book" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", title: "電影B", reason: "劇情很精彩推薦", mediaType: "movie" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", title: "遊戲C", reason: "玩法新穎值得一試", mediaType: "game" },
      ],
      revealed: false,
    };
    render(<BookRec {...defaultProps} />);
    expect(screen.getByTestId("br-count").textContent).toContain("3");
  });
});
