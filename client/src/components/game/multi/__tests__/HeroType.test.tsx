import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeroType } from "../HeroType";

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

describe("HeroType", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<HeroType {...defaultProps} />);
    expect(screen.getByTestId("ht-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<HeroType {...defaultProps} />);
    expect(screen.getByTestId("ht-title").textContent).toBe("我的英雄職業");
    expect(screen.getByTestId("ht-prompt").textContent).toContain("職業");
  });

  it("自訂 config 標題", () => {
    render(<HeroType {...defaultProps} config={{ title: "冒險者職業", prompt: "你是哪種英雄？" }} />);
    expect(screen.getByTestId("ht-title").textContent).toBe("冒險者職業");
    expect(screen.getByTestId("ht-prompt").textContent).toBe("你是哪種英雄？");
  });

  it("顯示已選擇人數", () => {
    render(<HeroType {...defaultProps} />);
    expect(screen.getByTestId("ht-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<HeroType {...defaultProps} />);
    expect(screen.getByTestId("ht-form")).toBeTruthy();
    expect(screen.getByTestId("ht-reason-input")).toBeTruthy();
    expect(screen.getByTestId("ht-submit-btn")).toBeTruthy();
  });

  it("顯示所有 8 種英雄職業按鈕", () => {
    render(<HeroType {...defaultProps} />);
    ["warrior","mage","healer","ranger","rogue","paladin","bard","druid"].forEach((id) => {
      expect(screen.getByTestId(`ht-hero-${id}`)).toBeTruthy();
    });
  });

  it("未選職業時提交按鈕 disabled", () => {
    render(<HeroType {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ht-reason-input"), { target: { value: "今天勇猛衝鋒什麼都不怕" } });
    const btn = screen.getByTestId("ht-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選職業但原因太短時 disabled", () => {
    render(<HeroType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ht-hero-mage"));
    fireEvent.change(screen.getByTestId("ht-reason-input"), { target: { value: "聰明" } });
    const btn = screen.getByTestId("ht-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選職業且原因 ≥5 字時提交按鈕啟用", () => {
    render(<HeroType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ht-hero-healer"));
    fireEvent.change(screen.getByTestId("ht-reason-input"), { target: { value: "喜歡支援夥伴守護大家" } });
    const btn = screen.getByTestId("ht-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<HeroType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ht-hero-bard"));
    fireEvent.change(screen.getByTestId("ht-reason-input"), { target: { value: "今天特別想鼓舞大家" } });
    fireEvent.click(screen.getByTestId("ht-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", hero: "paladin", reason: "今天很想守護正義和信念" }],
      revealed: false,
    };
    render(<HeroType {...defaultProps} />);
    expect(screen.getByTestId("ht-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("ht-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<HeroType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("ht-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<HeroType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ht-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<HeroType {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("ht-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<HeroType {...defaultProps} />);
    expect(screen.getByTestId("ht-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 ht-result 和職業摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", hero: "rogue", reason: "神出鬼沒出其不意最像我" }],
      revealed: true,
    };
    render(<HeroType {...defaultProps} />);
    expect(screen.getByTestId("ht-result")).toBeTruthy();
    expect(screen.getByTestId("ht-hero-summary")).toBeTruthy();
    expect(screen.getByTestId("ht-badge-rogue")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", hero: "druid", reason: "順應自然洞察本質" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", hero: "warrior", reason: "勇猛衝鋒不怕挑戰" },
      ],
      revealed: true,
    };
    render(<HeroType {...defaultProps} />);
    expect(screen.getByTestId("ht-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ht-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<HeroType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("ht-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", hero: "ranger", reason: "靈活機動遠端掌控一切" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", hero: "mage", reason: "智謀策略洞悉全局" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", hero: "healer", reason: "守護夥伴支援後援" },
      ],
      revealed: false,
    };
    render(<HeroType {...defaultProps} />);
    expect(screen.getByTestId("ht-count").textContent).toContain("3");
  });
});
