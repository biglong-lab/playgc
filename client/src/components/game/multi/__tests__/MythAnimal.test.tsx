import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MythAnimal } from "../MythAnimal";

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

describe("MythAnimal", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<MythAnimal {...defaultProps} />);
    expect(screen.getByTestId("mya-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<MythAnimal {...defaultProps} />);
    expect(screen.getByTestId("mya-title").textContent).toBe("我是哪種神話神獸");
    expect(screen.getByTestId("mya-prompt").textContent).toContain("神獸");
  });

  it("自訂 config 標題", () => {
    render(<MythAnimal {...defaultProps} config={{ title: "你的神話神獸", prompt: "選一種神獸！" }} />);
    expect(screen.getByTestId("mya-title").textContent).toBe("你的神話神獸");
    expect(screen.getByTestId("mya-prompt").textContent).toBe("選一種神獸！");
  });

  it("顯示已選擇人數", () => {
    render(<MythAnimal {...defaultProps} />);
    expect(screen.getByTestId("mya-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<MythAnimal {...defaultProps} />);
    expect(screen.getByTestId("mya-form")).toBeTruthy();
    expect(screen.getByTestId("mya-reason-input")).toBeTruthy();
    expect(screen.getByTestId("mya-submit-btn")).toBeTruthy();
  });

  it("顯示所有 9 種神獸按鈕", () => {
    render(<MythAnimal {...defaultProps} />);
    ["dragon","phoenix","unicorn","kirin","griffin","mermaid","nine_tail","pegasus","thunderbird"].forEach((id) => {
      expect(screen.getByTestId(`mya-animal-${id}`)).toBeTruthy();
    });
  });

  it("未選神獸時提交按鈕 disabled", () => {
    render(<MythAnimal {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mya-reason-input"), { target: { value: "霸氣威嚴統御四方" } });
    const btn = screen.getByTestId("mya-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選神獸但原因太短時 disabled", () => {
    render(<MythAnimal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mya-animal-dragon"));
    fireEvent.change(screen.getByTestId("mya-reason-input"), { target: { value: "霸氣" } });
    const btn = screen.getByTestId("mya-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選神獸且原因 ≥5 字時提交按鈕啟用", () => {
    render(<MythAnimal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mya-animal-phoenix"));
    fireEvent.change(screen.getByTestId("mya-reason-input"), { target: { value: "涅槃重生越挫越勇強" } });
    const btn = screen.getByTestId("mya-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<MythAnimal {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mya-animal-unicorn"));
    fireEvent.change(screen.getByTestId("mya-reason-input"), { target: { value: "純粹夢幻追求理想目標" } });
    fireEvent.click(screen.getByTestId("mya-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", animal: "kirin", reason: "吉祥仁慈德行高尚品格" }],
      revealed: false,
    };
    render(<MythAnimal {...defaultProps} />);
    expect(screen.getByTestId("mya-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("mya-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<MythAnimal {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("mya-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<MythAnimal {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("mya-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<MythAnimal {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("mya-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MythAnimal {...defaultProps} />);
    expect(screen.getByTestId("mya-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 mya-result 和神獸摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", animal: "nine_tail", reason: "聰明多變神出鬼沒難追蹤" }],
      revealed: true,
    };
    render(<MythAnimal {...defaultProps} />);
    expect(screen.getByTestId("mya-result")).toBeTruthy();
    expect(screen.getByTestId("mya-animal-summary")).toBeTruthy();
    expect(screen.getByTestId("mya-badge-nine_tail")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", animal: "griffin", reason: "勇猛正義守護邊疆不退縮" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", animal: "pegasus", reason: "自由翱翔突破所有限制感" },
      ],
      revealed: true,
    };
    render(<MythAnimal {...defaultProps} />);
    expect(screen.getByTestId("mya-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mya-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<MythAnimal {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("mya-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", animal: "mermaid", reason: "神秘自由跨越所有邊界" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", animal: "thunderbird", reason: "力量迅猛傳遞重要訊息" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", animal: "dragon", reason: "霸氣威嚴統御四方天地" },
      ],
      revealed: false,
    };
    render(<MythAnimal {...defaultProps} />);
    expect(screen.getByTestId("mya-count").textContent).toContain("3");
  });
});
