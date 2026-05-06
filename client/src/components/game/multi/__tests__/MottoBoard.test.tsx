import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MottoBoard } from "../MottoBoard";

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

describe("MottoBoard", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<MottoBoard {...defaultProps} />);
    expect(screen.getByTestId("mb-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<MottoBoard {...defaultProps} />);
    expect(screen.getByTestId("mb-title").textContent).toBe("人生座右銘");
    expect(screen.getByTestId("mb-prompt").textContent).toContain("座右銘");
  });

  it("自訂 config 標題", () => {
    render(<MottoBoard {...defaultProps} config={{ title: "團隊信條", prompt: "你的核心價值是什麼？" }} />);
    expect(screen.getByTestId("mb-title").textContent).toBe("團隊信條");
    expect(screen.getByTestId("mb-prompt").textContent).toBe("你的核心價值是什麼？");
  });

  it("顯示已分享人數", () => {
    render(<MottoBoard {...defaultProps} />);
    expect(screen.getByTestId("mb-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<MottoBoard {...defaultProps} />);
    expect(screen.getByTestId("mb-form")).toBeTruthy();
    expect(screen.getByTestId("mb-motto-input")).toBeTruthy();
    expect(screen.getByTestId("mb-submit-btn")).toBeTruthy();
  });

  it("顯示所有人生態度按鈕", () => {
    render(<MottoBoard {...defaultProps} />);
    ["positive", "grateful", "learning", "creative", "resilient", "balanced"].forEach((id) => {
      expect(screen.getByTestId(`mb-attitude-${id}`)).toBeTruthy();
    });
  });

  it("未選態度時提交按鈕 disabled", () => {
    render(<MottoBoard {...defaultProps} />);
    const btn = screen.getByTestId("mb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選態度但座右銘太短時 disabled", () => {
    render(<MottoBoard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mb-attitude-positive"));
    fireEvent.change(screen.getByTestId("mb-motto-input"), { target: { value: "加油" } });
    const btn = screen.getByTestId("mb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選態度且座右銘 ≥5 字時提交按鈕啟用", () => {
    render(<MottoBoard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mb-attitude-learning"));
    fireEvent.change(screen.getByTestId("mb-motto-input"), { target: { value: "學習是一輩子的事" } });
    const btn = screen.getByTestId("mb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<MottoBoard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mb-attitude-resilient"));
    fireEvent.change(screen.getByTestId("mb-motto-input"), { target: { value: "跌倒就再站起來" } });
    fireEvent.click(screen.getByTestId("mb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", motto: "行動勝於空談", attitude: "positive" }],
      revealed: false,
    };
    render(<MottoBoard {...defaultProps} />);
    expect(screen.getByTestId("mb-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("mb-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<MottoBoard {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("mb-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<MottoBoard {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("mb-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<MottoBoard {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("mb-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MottoBoard {...defaultProps} />);
    expect(screen.getByTestId("mb-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 mb-result", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", motto: "活到老學到老", attitude: "learning" }],
      revealed: true,
    };
    render(<MottoBoard {...defaultProps} />);
    expect(screen.getByTestId("mb-result")).toBeTruthy();
    expect(screen.getByTestId("mb-motto-wall")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", motto: "感謝每一天的到來", attitude: "grateful" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", motto: "保持平衡才能走更遠", attitude: "balanced" },
      ],
      revealed: true,
    };
    render(<MottoBoard {...defaultProps} />);
    expect(screen.getByTestId("mb-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mb-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<MottoBoard {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("mb-reveal-btn")).toBeNull();
  });

  it("已分享人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", motto: "積極就是力量所在", attitude: "positive" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", motto: "創意讓平凡變非凡", attitude: "creative" },
      ],
      revealed: false,
    };
    render(<MottoBoard {...defaultProps} />);
    expect(screen.getByTestId("mb-count").textContent).toContain("2");
  });
});
