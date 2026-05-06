import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SportVibes } from "../SportVibes";

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

describe("SportVibes", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<SportVibes {...defaultProps} />);
    expect(screen.getByTestId("sv-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<SportVibes {...defaultProps} />);
    expect(screen.getByTestId("sv-title").textContent).toBe("我今天的運動感");
    expect(screen.getByTestId("sv-prompt").textContent).toContain("運動");
  });

  it("自訂 config 標題", () => {
    render(<SportVibes {...defaultProps} config={{ title: "你的運動人格", prompt: "選一個運動！" }} />);
    expect(screen.getByTestId("sv-title").textContent).toBe("你的運動人格");
    expect(screen.getByTestId("sv-prompt").textContent).toBe("選一個運動！");
  });

  it("顯示已選擇人數", () => {
    render(<SportVibes {...defaultProps} />);
    expect(screen.getByTestId("sv-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<SportVibes {...defaultProps} />);
    expect(screen.getByTestId("sv-form")).toBeTruthy();
    expect(screen.getByTestId("sv-reason-input")).toBeTruthy();
    expect(screen.getByTestId("sv-submit-btn")).toBeTruthy();
  });

  it("顯示所有 9 種運動按鈕", () => {
    render(<SportVibes {...defaultProps} />);
    ["running","yoga","gym","swimming","hiking","cycling","dance","teamsport","martialarts"].forEach((id) => {
      expect(screen.getByTestId(`sv-sport-${id}`)).toBeTruthy();
    });
  });

  it("未選運動時提交按鈕 disabled", () => {
    render(<SportVibes {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sv-reason-input"), { target: { value: "清醒自律享受孤獨" } });
    const btn = screen.getByTestId("sv-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選運動但原因太短時 disabled", () => {
    render(<SportVibes {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sv-sport-yoga"));
    fireEvent.change(screen.getByTestId("sv-reason-input"), { target: { value: "平靜" } });
    const btn = screen.getByTestId("sv-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選運動且原因 ≥5 字時提交按鈕啟用", () => {
    render(<SportVibes {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sv-sport-dance"));
    fireEvent.change(screen.getByTestId("sv-reason-input"), { target: { value: "熱情表達創意律動感" } });
    const btn = screen.getByTestId("sv-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<SportVibes {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sv-sport-running"));
    fireEvent.change(screen.getByTestId("sv-reason-input"), { target: { value: "今天清醒自律享受孤獨" } });
    fireEvent.click(screen.getByTestId("sv-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", sport: "swimming", reason: "流暢沉浸清涼自在感" }],
      revealed: false,
    };
    render(<SportVibes {...defaultProps} />);
    expect(screen.getByTestId("sv-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("sv-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<SportVibes {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("sv-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<SportVibes {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("sv-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<SportVibes {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("sv-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<SportVibes {...defaultProps} />);
    expect(screen.getByTestId("sv-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 sv-result 和運動摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", sport: "hiking", reason: "喜歡挑戰欣賞遠景景色" }],
      revealed: true,
    };
    render(<SportVibes {...defaultProps} />);
    expect(screen.getByTestId("sv-result")).toBeTruthy();
    expect(screen.getByTestId("sv-sport-summary")).toBeTruthy();
    expect(screen.getByTestId("sv-badge-hiking")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", sport: "gym", reason: "自律有計劃逐步突破極限" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", sport: "teamsport", reason: "重視團隊合作互動配合" },
      ],
      revealed: true,
    };
    render(<SportVibes {...defaultProps} />);
    expect(screen.getByTestId("sv-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("sv-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<SportVibes {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("sv-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", sport: "cycling", reason: "自由移動享受過程感受" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", sport: "martialarts", reason: "專注紀律磨練意志力" },
      ],
      revealed: false,
    };
    render(<SportVibes {...defaultProps} />);
    expect(screen.getByTestId("sv-count").textContent).toContain("2");
  });
});
