import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPersonality } from "../ColorPersonality";

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

describe("ColorPersonality", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ColorPersonality {...defaultProps} />);
    expect(screen.getByTestId("cp-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<ColorPersonality {...defaultProps} />);
    expect(screen.getByTestId("cp-title").textContent).toBe("我是哪種顏色");
    expect(screen.getByTestId("cp-prompt").textContent).toContain("顏色");
  });

  it("自訂 config 標題", () => {
    render(<ColorPersonality {...defaultProps} config={{ title: "你的顏色人格", prompt: "選一個顏色！" }} />);
    expect(screen.getByTestId("cp-title").textContent).toBe("你的顏色人格");
    expect(screen.getByTestId("cp-prompt").textContent).toBe("選一個顏色！");
  });

  it("顯示已選擇人數", () => {
    render(<ColorPersonality {...defaultProps} />);
    expect(screen.getByTestId("cp-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<ColorPersonality {...defaultProps} />);
    expect(screen.getByTestId("cp-form")).toBeTruthy();
    expect(screen.getByTestId("cp-reason-input")).toBeTruthy();
    expect(screen.getByTestId("cp-submit-btn")).toBeTruthy();
  });

  it("顯示所有 8 種顏色按鈕", () => {
    render(<ColorPersonality {...defaultProps} />);
    ["red","orange","yellow","green","blue","purple","pink","white"].forEach((id) => {
      expect(screen.getByTestId(`cp-color-${id}`)).toBeTruthy();
    });
  });

  it("未選顏色時提交按鈕 disabled", () => {
    render(<ColorPersonality {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cp-reason-input"), { target: { value: "今天充滿熱情活力旺盛" } });
    const btn = screen.getByTestId("cp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選顏色但原因太短時 disabled", () => {
    render(<ColorPersonality {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cp-color-blue"));
    fireEvent.change(screen.getByTestId("cp-reason-input"), { target: { value: "沉穩" } });
    const btn = screen.getByTestId("cp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選顏色且原因 ≥5 字時提交按鈕啟用", () => {
    render(<ColorPersonality {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cp-color-purple"));
    fireEvent.change(screen.getByTestId("cp-reason-input"), { target: { value: "直覺強烈富有創意" } });
    const btn = screen.getByTestId("cp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<ColorPersonality {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cp-color-green"));
    fireEvent.change(screen.getByTestId("cp-reason-input"), { target: { value: "今天很想成長和諧" } });
    fireEvent.click(screen.getByTestId("cp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", color: "red", reason: "今天充滿熱情和行動力" }],
      revealed: false,
    };
    render(<ColorPersonality {...defaultProps} />);
    expect(screen.getByTestId("cp-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("cp-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<ColorPersonality {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("cp-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<ColorPersonality {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("cp-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<ColorPersonality {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("cp-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<ColorPersonality {...defaultProps} />);
    expect(screen.getByTestId("cp-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 cp-result 和顏色摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", color: "yellow", reason: "今天陽光開朗超樂觀" }],
      revealed: true,
    };
    render(<ColorPersonality {...defaultProps} />);
    expect(screen.getByTestId("cp-result")).toBeTruthy();
    expect(screen.getByTestId("cp-color-summary")).toBeTruthy();
    expect(screen.getByTestId("cp-badge-yellow")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", color: "pink", reason: "今天溫柔關懷很貼心" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", color: "white", reason: "今天清晰純粹追求完美" },
      ],
      revealed: true,
    };
    render(<ColorPersonality {...defaultProps} />);
    expect(screen.getByTestId("cp-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("cp-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<ColorPersonality {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("cp-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", color: "orange", reason: "充滿活力創意無限" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", color: "blue", reason: "沉穩理性值得信賴" },
      ],
      revealed: false,
    };
    render(<ColorPersonality {...defaultProps} />);
    expect(screen.getByTestId("cp-count").textContent).toContain("2");
  });
});
