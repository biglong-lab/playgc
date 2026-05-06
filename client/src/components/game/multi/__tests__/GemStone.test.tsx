import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GemStone } from "../GemStone";

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

describe("GemStone", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<GemStone {...defaultProps} />);
    expect(screen.getByTestId("gs-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<GemStone {...defaultProps} />);
    expect(screen.getByTestId("gs-title").textContent).toBe("我是哪種寶石");
    expect(screen.getByTestId("gs-prompt").textContent).toContain("寶石");
  });

  it("自訂 config 標題", () => {
    render(<GemStone {...defaultProps} config={{ title: "你的寶石性格", prompt: "選一種寶石！" }} />);
    expect(screen.getByTestId("gs-title").textContent).toBe("你的寶石性格");
    expect(screen.getByTestId("gs-prompt").textContent).toBe("選一種寶石！");
  });

  it("顯示已選擇人數", () => {
    render(<GemStone {...defaultProps} />);
    expect(screen.getByTestId("gs-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<GemStone {...defaultProps} />);
    expect(screen.getByTestId("gs-form")).toBeTruthy();
    expect(screen.getByTestId("gs-reason-input")).toBeTruthy();
    expect(screen.getByTestId("gs-submit-btn")).toBeTruthy();
  });

  it("顯示所有 9 種寶石按鈕", () => {
    render(<GemStone {...defaultProps} />);
    ["diamond","ruby","emerald","sapphire","amethyst","topaz","opal","pearl","obsidian"].forEach((id) => {
      expect(screen.getByTestId(`gs-gem-${id}`)).toBeTruthy();
    });
  });

  it("未選寶石時提交按鈕 disabled", () => {
    render(<GemStone {...defaultProps} />);
    fireEvent.change(screen.getByTestId("gs-reason-input"), { target: { value: "光芒萬丈堅不可摧" } });
    const btn = screen.getByTestId("gs-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選寶石但原因太短時 disabled", () => {
    render(<GemStone {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gs-gem-sapphire"));
    fireEvent.change(screen.getByTestId("gs-reason-input"), { target: { value: "深邃" } });
    const btn = screen.getByTestId("gs-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選寶石且原因 ≥5 字時提交按鈕啟用", () => {
    render(<GemStone {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gs-gem-diamond"));
    fireEvent.change(screen.getByTestId("gs-reason-input"), { target: { value: "光芒萬丈堅不可摧" } });
    const btn = screen.getByTestId("gs-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<GemStone {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gs-gem-ruby"));
    fireEvent.change(screen.getByTestId("gs-reason-input"), { target: { value: "熱情奔放充滿生命力" } });
    fireEvent.click(screen.getByTestId("gs-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", gem: "emerald", reason: "沉穩優雅療癒人心力量" }],
      revealed: false,
    };
    render(<GemStone {...defaultProps} />);
    expect(screen.getByTestId("gs-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("gs-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<GemStone {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("gs-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<GemStone {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("gs-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<GemStone {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("gs-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<GemStone {...defaultProps} />);
    expect(screen.getByTestId("gs-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 gs-result 和寶石摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", gem: "amethyst", reason: "神秘直覺精神豐富有深度" }],
      revealed: true,
    };
    render(<GemStone {...defaultProps} />);
    expect(screen.getByTestId("gs-result")).toBeTruthy();
    expect(screen.getByTestId("gs-gem-summary")).toBeTruthy();
    expect(screen.getByTestId("gs-badge-amethyst")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", gem: "pearl", reason: "溫潤純粹歷經磨練成就" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", gem: "obsidian", reason: "保護自我防禦力量超強" },
      ],
      revealed: true,
    };
    render(<GemStone {...defaultProps} />);
    expect(screen.getByTestId("gs-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("gs-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<GemStone {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("gs-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", gem: "topaz", reason: "陽光開朗帶來歡笑給大家" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", gem: "opal", reason: "多彩多變難以捉摸個性" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", gem: "diamond", reason: "剛強堅毅光芒萬丈超厲害" },
      ],
      revealed: false,
    };
    render(<GemStone {...defaultProps} />);
    expect(screen.getByTestId("gs-count").textContent).toContain("3");
  });
});
