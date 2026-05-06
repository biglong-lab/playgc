import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CityType } from "../CityType";

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

describe("CityType", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<CityType {...defaultProps} />);
    expect(screen.getByTestId("cty-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<CityType {...defaultProps} />);
    expect(screen.getByTestId("cty-title").textContent).toBe("我是哪種城市");
    expect(screen.getByTestId("cty-prompt").textContent).toContain("城市");
  });

  it("自訂 config 標題", () => {
    render(<CityType {...defaultProps} config={{ title: "你的城市人格", prompt: "選一座城市！" }} />);
    expect(screen.getByTestId("cty-title").textContent).toBe("你的城市人格");
    expect(screen.getByTestId("cty-prompt").textContent).toBe("選一座城市！");
  });

  it("顯示已選擇人數", () => {
    render(<CityType {...defaultProps} />);
    expect(screen.getByTestId("cty-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<CityType {...defaultProps} />);
    expect(screen.getByTestId("cty-form")).toBeTruthy();
    expect(screen.getByTestId("cty-reason-input")).toBeTruthy();
    expect(screen.getByTestId("cty-submit-btn")).toBeTruthy();
  });

  it("顯示所有 10 種城市按鈕", () => {
    render(<CityType {...defaultProps} />);
    ["tokyo","paris","nyc","bali","london","singapore","barcelona","kyoto","iceland","sydney"].forEach((id) => {
      expect(screen.getByTestId(`cty-city-${id}`)).toBeTruthy();
    });
  });

  it("未選城市時提交按鈕 disabled", () => {
    render(<CityType {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cty-reason-input"), { target: { value: "精緻有序效率超高" } });
    const btn = screen.getByTestId("cty-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選城市但原因太短時 disabled", () => {
    render(<CityType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cty-city-paris"));
    fireEvent.change(screen.getByTestId("cty-reason-input"), { target: { value: "浪漫" } });
    const btn = screen.getByTestId("cty-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選城市且原因 ≥5 字時提交按鈕啟用", () => {
    render(<CityType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cty-city-kyoto"));
    fireEvent.change(screen.getByTestId("cty-reason-input"), { target: { value: "傳統細膩靜心修行生活" } });
    const btn = screen.getByTestId("cty-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<CityType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cty-city-tokyo"));
    fireEvent.change(screen.getByTestId("cty-reason-input"), { target: { value: "精緻有序效率超高標準" } });
    fireEvent.click(screen.getByTestId("cty-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", city: "bali", reason: "放鬆靈性與自然共存" }],
      revealed: false,
    };
    render(<CityType {...defaultProps} />);
    expect(screen.getByTestId("cty-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("cty-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<CityType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("cty-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<CityType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("cty-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<CityType {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("cty-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<CityType {...defaultProps} />);
    expect(screen.getByTestId("cty-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 cty-result 和城市摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", city: "nyc", reason: "快節奏直接敢拼搏向上" }],
      revealed: true,
    };
    render(<CityType {...defaultProps} />);
    expect(screen.getByTestId("cty-result")).toBeTruthy();
    expect(screen.getByTestId("cty-city-summary")).toBeTruthy();
    expect(screen.getByTestId("cty-badge-nyc")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", city: "singapore", reason: "務實國際高標準追求" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", city: "iceland", reason: "獨特神秘愛探索未知" },
      ],
      revealed: true,
    };
    render(<CityType {...defaultProps} />);
    expect(screen.getByTestId("cty-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("cty-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<CityType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("cty-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", city: "london", reason: "紳士沉穩歷史底蘊豐富" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", city: "barcelona", reason: "熱情創意愛享樂生活" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", city: "sydney", reason: "陽光開朗熱愛戶外運動" },
      ],
      revealed: false,
    };
    render(<CityType {...defaultProps} />);
    expect(screen.getByTestId("cty-count").textContent).toContain("3");
  });
});
