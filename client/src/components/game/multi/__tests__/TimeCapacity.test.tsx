import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeCapacity } from "../TimeCapacity";

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

describe("TimeCapacity", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TimeCapacity {...defaultProps} />);
    expect(screen.getByTestId("tc-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<TimeCapacity {...defaultProps} />);
    expect(screen.getByTestId("tc-title").textContent).toBe("時間分配");
    expect(screen.getByTestId("tc-prompt").textContent).toContain("168 小時");
  });

  it("自訂 config 標題", () => {
    render(<TimeCapacity {...defaultProps} config={{ title: "理想一週", prompt: "你的時間去哪了？" }} />);
    expect(screen.getByTestId("tc-title").textContent).toBe("理想一週");
    expect(screen.getByTestId("tc-prompt").textContent).toBe("你的時間去哪了？");
  });

  it("顯示已分享人數", () => {
    render(<TimeCapacity {...defaultProps} />);
    expect(screen.getByTestId("tc-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<TimeCapacity {...defaultProps} />);
    expect(screen.getByTestId("tc-form")).toBeTruthy();
    expect(screen.getByTestId("tc-total")).toBeTruthy();
    expect(screen.getByTestId("tc-submit-btn")).toBeTruthy();
  });

  it("顯示所有 6 個領域輸入", () => {
    render(<TimeCapacity {...defaultProps} />);
    ["work", "family", "health", "social", "learning", "rest"].forEach((id) => {
      expect(screen.getByTestId(`tc-domain-${id}`)).toBeTruthy();
      expect(screen.getByTestId(`tc-input-${id}`)).toBeTruthy();
    });
  });

  it("預設總時數等於 168 時提交按鈕啟用", () => {
    render(<TimeCapacity {...defaultProps} />);
    const btn = screen.getByTestId("tc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("修改數值使總時數不等於 168 時 disabled", () => {
    render(<TimeCapacity {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tc-input-work"), { target: { value: "50" } });
    const btn = screen.getByTestId("tc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<TimeCapacity {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        allocation: { work: 40, family: 30, health: 14, social: 14, learning: 14, rest: 56 },
      }],
      revealed: false,
    };
    render(<TimeCapacity {...defaultProps} />);
    expect(screen.getByTestId("tc-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("tc-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<TimeCapacity {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("tc-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<TimeCapacity {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("tc-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<TimeCapacity {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("tc-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<TimeCapacity {...defaultProps} />);
    expect(screen.getByTestId("tc-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 tc-result", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        allocation: { work: 40, family: 30, health: 14, social: 14, learning: 14, rest: 56 },
      }],
      revealed: true,
    };
    render(<TimeCapacity {...defaultProps} />);
    expect(screen.getByTestId("tc-result")).toBeTruthy();
    expect(screen.getByTestId("tc-avg-chart")).toBeTruthy();
  });

  it("揭曉後顯示每個領域的平均值", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        allocation: { work: 40, family: 30, health: 14, social: 14, learning: 14, rest: 56 },
      }],
      revealed: true,
    };
    render(<TimeCapacity {...defaultProps} />);
    ["work", "family", "health", "social", "learning", "rest"].forEach((id) => {
      expect(screen.getByTestId(`tc-avg-${id}`)).toBeTruthy();
    });
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        {
          entryId: "u1-1", userId: "u1", userName: "Alice",
          allocation: { work: 50, family: 20, health: 14, social: 14, learning: 14, rest: 56 },
        },
        {
          entryId: "u2-1", userId: "u2", userName: "Bob",
          allocation: { work: 40, family: 30, health: 14, social: 14, learning: 14, rest: 56 },
        },
      ],
      revealed: true,
    };
    render(<TimeCapacity {...defaultProps} />);
    expect(screen.getByTestId("tc-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tc-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<TimeCapacity {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("tc-reveal-btn")).toBeNull();
  });

  it("顯示進度條 bar 元素", () => {
    render(<TimeCapacity {...defaultProps} />);
    ["work", "family", "health", "social", "learning", "rest"].forEach((id) => {
      expect(screen.getByTestId(`tc-bar-${id}`)).toBeTruthy();
    });
  });
});
