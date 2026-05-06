import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnimalSpirit } from "../AnimalSpirit";

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

describe("AnimalSpirit", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<AnimalSpirit {...defaultProps} />);
    expect(screen.getByTestId("as-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<AnimalSpirit {...defaultProps} />);
    expect(screen.getByTestId("as-title").textContent).toBe("精神動物");
    expect(screen.getByTestId("as-prompt").textContent).toContain("動物");
  });

  it("自訂 config 標題", () => {
    render(<AnimalSpirit {...defaultProps} config={{ title: "動物圖騰", prompt: "你是什麼動物？" }} />);
    expect(screen.getByTestId("as-title").textContent).toBe("動物圖騰");
    expect(screen.getByTestId("as-prompt").textContent).toBe("你是什麼動物？");
  });

  it("顯示已選擇人數", () => {
    render(<AnimalSpirit {...defaultProps} />);
    expect(screen.getByTestId("as-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<AnimalSpirit {...defaultProps} />);
    expect(screen.getByTestId("as-form")).toBeTruthy();
    expect(screen.getByTestId("as-reason-input")).toBeTruthy();
    expect(screen.getByTestId("as-submit-btn")).toBeTruthy();
  });

  it("顯示所有 12 隻動物按鈕", () => {
    render(<AnimalSpirit {...defaultProps} />);
    ["lion","owl","dolphin","eagle","bear","fox","wolf","turtle","butterfly","panda","tiger","cat"].forEach((id) => {
      expect(screen.getByTestId(`as-animal-${id}`)).toBeTruthy();
    });
  });

  it("未選動物時提交按鈕 disabled", () => {
    render(<AnimalSpirit {...defaultProps} />);
    fireEvent.change(screen.getByTestId("as-reason-input"), { target: { value: "我今天很勇猛" } });
    const btn = screen.getByTestId("as-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選動物但原因太短時 disabled", () => {
    render(<AnimalSpirit {...defaultProps} />);
    fireEvent.click(screen.getByTestId("as-animal-owl"));
    fireEvent.change(screen.getByTestId("as-reason-input"), { target: { value: "聰明" } });
    const btn = screen.getByTestId("as-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選動物且原因 ≥5 字時提交按鈕啟用", () => {
    render(<AnimalSpirit {...defaultProps} />);
    fireEvent.click(screen.getByTestId("as-animal-dolphin"));
    fireEvent.change(screen.getByTestId("as-reason-input"), { target: { value: "今天心情很輕快" } });
    const btn = screen.getByTestId("as-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<AnimalSpirit {...defaultProps} />);
    fireEvent.click(screen.getByTestId("as-animal-eagle"));
    fireEvent.change(screen.getByTestId("as-reason-input"), { target: { value: "今天眼光特別犀利" } });
    fireEvent.click(screen.getByTestId("as-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", animal: "bear", reason: "今天很穩重不想動" }],
      revealed: false,
    };
    render(<AnimalSpirit {...defaultProps} />);
    expect(screen.getByTestId("as-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("as-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<AnimalSpirit {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("as-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<AnimalSpirit {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("as-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<AnimalSpirit {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("as-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<AnimalSpirit {...defaultProps} />);
    expect(screen.getByTestId("as-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 as-result 和動物摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", animal: "fox", reason: "今天特別機靈" }],
      revealed: true,
    };
    render(<AnimalSpirit {...defaultProps} />);
    expect(screen.getByTestId("as-result")).toBeTruthy();
    expect(screen.getByTestId("as-animal-summary")).toBeTruthy();
    expect(screen.getByTestId("as-badge-fox")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", animal: "wolf", reason: "今天需要團隊合作" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", animal: "turtle", reason: "慢慢來才是對的" },
      ],
      revealed: true,
    };
    render(<AnimalSpirit {...defaultProps} />);
    expect(screen.getByTestId("as-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("as-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<AnimalSpirit {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("as-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", animal: "butterfly", reason: "今天感覺很輕盈" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", animal: "panda", reason: "想耍廢一整天" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", animal: "tiger", reason: "衝勁十足滿滿能量" },
      ],
      revealed: false,
    };
    render(<AnimalSpirit {...defaultProps} />);
    expect(screen.getByTestId("as-count").textContent).toContain("3");
  });
});
