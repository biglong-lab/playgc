import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DreamJob } from "../DreamJob";

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

describe("DreamJob", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<DreamJob {...defaultProps} />);
    expect(screen.getByTestId("dj-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<DreamJob {...defaultProps} />);
    expect(screen.getByTestId("dj-title").textContent).toBe("童年夢想職業");
    expect(screen.getByTestId("dj-prompt").textContent).toContain("夢想");
  });

  it("自訂 config 標題", () => {
    render(<DreamJob {...defaultProps} config={{ title: "小時候的夢", prompt: "你想當什麼？" }} />);
    expect(screen.getByTestId("dj-title").textContent).toBe("小時候的夢");
    expect(screen.getByTestId("dj-prompt").textContent).toBe("你想當什麼？");
  });

  it("顯示已分享人數", () => {
    render(<DreamJob {...defaultProps} />);
    expect(screen.getByTestId("dj-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<DreamJob {...defaultProps} />);
    expect(screen.getByTestId("dj-form")).toBeTruthy();
    expect(screen.getByTestId("dj-story-input")).toBeTruthy();
    expect(screen.getByTestId("dj-submit-btn")).toBeTruthy();
  });

  it("顯示所有 12 種職業按鈕", () => {
    render(<DreamJob {...defaultProps} />);
    ["astronaut","artist","doctor","athlete","chef","teacher","scientist","firefighter","pilot","musician","detective","adventurer"].forEach((id) => {
      expect(screen.getByTestId(`dj-job-${id}`)).toBeTruthy();
    });
  });

  it("顯示所有 4 個年齡段按鈕", () => {
    render(<DreamJob {...defaultProps} />);
    ["preschool","elementary","junior","high"].forEach((id) => {
      expect(screen.getByTestId(`dj-age-${id}`)).toBeTruthy();
    });
  });

  it("未選職業時提交按鈕 disabled", () => {
    render(<DreamJob {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dj-age-elementary"));
    fireEvent.change(screen.getByTestId("dj-story-input"), { target: { value: "因為覺得很帥氣" } });
    const btn = screen.getByTestId("dj-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("未選年齡段時提交按鈕 disabled", () => {
    render(<DreamJob {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dj-job-astronaut"));
    fireEvent.change(screen.getByTestId("dj-story-input"), { target: { value: "因為覺得很帥氣想上太空" } });
    const btn = screen.getByTestId("dj-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("故事太短時 disabled", () => {
    render(<DreamJob {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dj-job-chef"));
    fireEvent.click(screen.getByTestId("dj-age-junior"));
    fireEvent.change(screen.getByTestId("dj-story-input"), { target: { value: "好玩" } });
    const btn = screen.getByTestId("dj-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("全部填寫後提交按鈕啟用", () => {
    render(<DreamJob {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dj-job-musician"));
    fireEvent.click(screen.getByTestId("dj-age-elementary"));
    fireEvent.change(screen.getByTestId("dj-story-input"), { target: { value: "覺得音樂家很浪漫會彈吉他" } });
    const btn = screen.getByTestId("dj-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<DreamJob {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dj-job-pilot"));
    fireEvent.click(screen.getByTestId("dj-age-preschool"));
    fireEvent.change(screen.getByTestId("dj-story-input"), { target: { value: "那時覺得飛行員超酷超帥" } });
    fireEvent.click(screen.getByTestId("dj-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", job: "doctor", age: "elementary", story: "想幫助生病的人好起來" }],
      revealed: false,
    };
    render(<DreamJob {...defaultProps} />);
    expect(screen.getByTestId("dj-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("dj-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<DreamJob {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("dj-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<DreamJob {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("dj-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<DreamJob {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("dj-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<DreamJob {...defaultProps} />);
    expect(screen.getByTestId("dj-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 dj-result 和職業摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", job: "scientist", age: "junior", story: "想發現很多新東西改變世界" }],
      revealed: true,
    };
    render(<DreamJob {...defaultProps} />);
    expect(screen.getByTestId("dj-result")).toBeTruthy();
    expect(screen.getByTestId("dj-job-summary")).toBeTruthy();
    expect(screen.getByTestId("dj-badge-scientist")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", job: "firefighter", age: "preschool", story: "因為消防車超帥每天等在路邊" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", job: "athlete", age: "elementary", story: "每天練跑步想上奧運" },
      ],
      revealed: true,
    };
    render(<DreamJob {...defaultProps} />);
    expect(screen.getByTestId("dj-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("dj-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<DreamJob {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("dj-reveal-btn")).toBeNull();
  });

  it("已分享人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", job: "adventurer", age: "elementary", story: "想環遊世界探索未知地方" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", job: "detective", age: "junior", story: "喜歡推理故事每天都在找線索" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", job: "artist", age: "preschool", story: "每天畫圖覺得可以開畫展" },
      ],
      revealed: false,
    };
    render(<DreamJob {...defaultProps} />);
    expect(screen.getByTestId("dj-count").textContent).toContain("3");
  });
});
