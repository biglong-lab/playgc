import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChildhoodGame } from "../ChildhoodGame";

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

describe("ChildhoodGame", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ChildhoodGame {...defaultProps} />);
    expect(screen.getByTestId("cg-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<ChildhoodGame {...defaultProps} />);
    expect(screen.getByTestId("cg-title").textContent).toBe("童年遊戲記憶");
    expect(screen.getByTestId("cg-prompt").textContent).toContain("遊戲");
  });

  it("自訂 config 標題", () => {
    render(<ChildhoodGame {...defaultProps} config={{ title: "遊戲回憶錄", prompt: "你的童年遊戲是？" }} />);
    expect(screen.getByTestId("cg-title").textContent).toBe("遊戲回憶錄");
    expect(screen.getByTestId("cg-prompt").textContent).toBe("你的童年遊戲是？");
  });

  it("顯示已分享人數", () => {
    render(<ChildhoodGame {...defaultProps} />);
    expect(screen.getByTestId("cg-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<ChildhoodGame {...defaultProps} />);
    expect(screen.getByTestId("cg-form")).toBeTruthy();
    expect(screen.getByTestId("cg-game-input")).toBeTruthy();
    expect(screen.getByTestId("cg-memory-input")).toBeTruthy();
    expect(screen.getByTestId("cg-submit-btn")).toBeTruthy();
  });

  it("顯示所有 5 個年代按鈕", () => {
    render(<ChildhoodGame {...defaultProps} />);
    ["80s", "90s", "00s", "10s", "recent"].forEach((id) => {
      expect(screen.getByTestId(`cg-era-${id}`)).toBeTruthy();
    });
  });

  it("未選年代時提交按鈕 disabled", () => {
    render(<ChildhoodGame {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cg-game-input"), { target: { value: "大富翁" } });
    fireEvent.change(screen.getByTestId("cg-memory-input"), { target: { value: "每個週末都在玩" } });
    const btn = screen.getByTestId("cg-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("遊戲名稱太短時 disabled", () => {
    render(<ChildhoodGame {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cg-game-input"), { target: { value: "A" } });
    fireEvent.click(screen.getByTestId("cg-era-90s"));
    fireEvent.change(screen.getByTestId("cg-memory-input"), { target: { value: "每個週末都在玩" } });
    const btn = screen.getByTestId("cg-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("記憶太短時 disabled", () => {
    render(<ChildhoodGame {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cg-game-input"), { target: { value: "超級瑪利歐" } });
    fireEvent.click(screen.getByTestId("cg-era-90s"));
    fireEvent.change(screen.getByTestId("cg-memory-input"), { target: { value: "好玩" } });
    const btn = screen.getByTestId("cg-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("填寫完整後提交按鈕啟用", () => {
    render(<ChildhoodGame {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cg-game-input"), { target: { value: "超級瑪利歐" } });
    fireEvent.click(screen.getByTestId("cg-era-90s"));
    fireEvent.change(screen.getByTestId("cg-memory-input"), { target: { value: "每個週末都在玩" } });
    const btn = screen.getByTestId("cg-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<ChildhoodGame {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cg-game-input"), { target: { value: "大富翁" } });
    fireEvent.click(screen.getByTestId("cg-era-80s"));
    fireEvent.change(screen.getByTestId("cg-memory-input"), { target: { value: "家族聚會必玩" } });
    fireEvent.click(screen.getByTestId("cg-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", gameName: "大富翁", era: "80s", memory: "家族聚會必玩" }],
      revealed: false,
    };
    render(<ChildhoodGame {...defaultProps} />);
    expect(screen.getByTestId("cg-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("cg-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<ChildhoodGame {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("cg-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<ChildhoodGame {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("cg-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<ChildhoodGame {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("cg-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<ChildhoodGame {...defaultProps} />);
    expect(screen.getByTestId("cg-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 cg-result 和遊戲牆", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", gameName: "俄羅斯方塊", era: "90s", memory: "放學後就一直玩" }],
      revealed: true,
    };
    render(<ChildhoodGame {...defaultProps} />);
    expect(screen.getByTestId("cg-result")).toBeTruthy();
    expect(screen.getByTestId("cg-game-wall")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", gameName: "大富翁", era: "80s", memory: "家族聚會必玩" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", gameName: "超級瑪利歐", era: "90s", memory: "每天放學後玩" },
      ],
      revealed: true,
    };
    render(<ChildhoodGame {...defaultProps} />);
    expect(screen.getByTestId("cg-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("cg-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<ChildhoodGame {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("cg-reveal-btn")).toBeNull();
  });

  it("已分享人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", gameName: "大富翁", era: "80s", memory: "家族聚會必玩" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", gameName: "俄羅斯方塊", era: "90s", memory: "每天玩到忘記吃飯" },
      ],
      revealed: false,
    };
    render(<ChildhoodGame {...defaultProps} />);
    expect(screen.getByTestId("cg-count").textContent).toContain("2");
  });
});
