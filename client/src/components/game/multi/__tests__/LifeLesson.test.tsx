import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LifeLesson } from "../LifeLesson";

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

describe("LifeLesson", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<LifeLesson {...defaultProps} />);
    expect(screen.getByTestId("ll-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<LifeLesson {...defaultProps} />);
    expect(screen.getByTestId("ll-title").textContent).toBe("人生一堂課");
    expect(screen.getByTestId("ll-prompt").textContent).toContain("人生功課");
  });

  it("自訂 config 標題", () => {
    render(<LifeLesson {...defaultProps} config={{ title: "智慧結晶", prompt: "說說你最深刻的體悟" }} />);
    expect(screen.getByTestId("ll-title").textContent).toBe("智慧結晶");
    expect(screen.getByTestId("ll-prompt").textContent).toBe("說說你最深刻的體悟");
  });

  it("顯示已分享人數", () => {
    render(<LifeLesson {...defaultProps} />);
    expect(screen.getByTestId("ll-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<LifeLesson {...defaultProps} />);
    expect(screen.getByTestId("ll-form")).toBeTruthy();
    expect(screen.getByTestId("ll-lesson-input")).toBeTruthy();
    expect(screen.getByTestId("ll-submit-btn")).toBeTruthy();
  });

  it("顯示所有 6 個領域按鈕", () => {
    render(<LifeLesson {...defaultProps} />);
    ["work", "people", "money", "health", "family", "growth"].forEach((id) => {
      expect(screen.getByTestId(`ll-domain-${id}`)).toBeTruthy();
    });
  });

  it("顯示所有年齡段按鈕", () => {
    render(<LifeLesson {...defaultProps} />);
    ["teen", "20s", "30s", "recent"].forEach((id) => {
      expect(screen.getByTestId(`ll-age-${id}`)).toBeTruthy();
    });
  });

  it("未選領域或年齡時提交按鈕 disabled", () => {
    render(<LifeLesson {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ll-lesson-input"), { target: { value: "要努力工作才能成功" } });
    const btn = screen.getByTestId("ll-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("功課太短時 disabled", () => {
    render(<LifeLesson {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ll-domain-work"));
    fireEvent.click(screen.getByTestId("ll-age-20s"));
    fireEvent.change(screen.getByTestId("ll-lesson-input"), { target: { value: "努力工作" } });
    const btn = screen.getByTestId("ll-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("所有條件滿足時提交按鈕啟用", () => {
    render(<LifeLesson {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ll-domain-people"));
    fireEvent.click(screen.getByTestId("ll-age-30s"));
    fireEvent.change(screen.getByTestId("ll-lesson-input"), { target: { value: "真正的朋友在你最難的時候才會出現" } });
    const btn = screen.getByTestId("ll-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<LifeLesson {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ll-domain-money"));
    fireEvent.click(screen.getByTestId("ll-age-recent"));
    fireEvent.change(screen.getByTestId("ll-lesson-input"), { target: { value: "花錢之前先問自己真的需要嗎" } });
    fireEvent.click(screen.getByTestId("ll-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", lesson: "健康比什麼都重要先照顧好自己", domain: "health", age: "30s" }],
      revealed: false,
    };
    render(<LifeLesson {...defaultProps} />);
    expect(screen.getByTestId("ll-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("ll-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<LifeLesson {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("ll-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<LifeLesson {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ll-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<LifeLesson {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("ll-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<LifeLesson {...defaultProps} />);
    expect(screen.getByTestId("ll-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 ll-result", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", lesson: "家人永遠是最重要的後盾", domain: "family", age: "recent" }],
      revealed: true,
    };
    render(<LifeLesson {...defaultProps} />);
    expect(screen.getByTestId("ll-result")).toBeTruthy();
    expect(screen.getByTestId("ll-lesson-wall")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", lesson: "成長需要不斷地走出舒適圈", domain: "growth", age: "20s" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", lesson: "職場上說到要做到最重要", domain: "work", age: "30s" },
      ],
      revealed: true,
    };
    render(<LifeLesson {...defaultProps} />);
    expect(screen.getByTestId("ll-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ll-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<LifeLesson {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("ll-reveal-btn")).toBeNull();
  });

  it("已分享人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", lesson: "凡事先從自身找原因", domain: "growth", age: "recent" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", lesson: "維持人際關係需要主動付出", domain: "people", age: "30s" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", lesson: "存錢比賺錢更需要自律", domain: "money", age: "20s" },
      ],
      revealed: false,
    };
    render(<LifeLesson {...defaultProps} />);
    expect(screen.getByTestId("ll-count").textContent).toContain("3");
  });
});
