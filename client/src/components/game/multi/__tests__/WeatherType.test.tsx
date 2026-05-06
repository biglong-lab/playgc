import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeatherType } from "../WeatherType";

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

describe("WeatherType", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<WeatherType {...defaultProps} />);
    expect(screen.getByTestId("wth-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<WeatherType {...defaultProps} />);
    expect(screen.getByTestId("wth-title").textContent).toBe("我是哪種天氣");
    expect(screen.getByTestId("wth-prompt").textContent).toContain("天氣");
  });

  it("自訂 config 標題", () => {
    render(<WeatherType {...defaultProps} config={{ title: "你的天氣性格", prompt: "選一種天氣！" }} />);
    expect(screen.getByTestId("wth-title").textContent).toBe("你的天氣性格");
    expect(screen.getByTestId("wth-prompt").textContent).toBe("選一種天氣！");
  });

  it("顯示已選擇人數", () => {
    render(<WeatherType {...defaultProps} />);
    expect(screen.getByTestId("wth-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<WeatherType {...defaultProps} />);
    expect(screen.getByTestId("wth-form")).toBeTruthy();
    expect(screen.getByTestId("wth-reason-input")).toBeTruthy();
    expect(screen.getByTestId("wth-submit-btn")).toBeTruthy();
  });

  it("顯示所有 9 種天氣按鈕", () => {
    render(<WeatherType {...defaultProps} />);
    ["sunny","cloudy","rainy","stormy","snowy","foggy","rainbow","windy","aurora"].forEach((id) => {
      expect(screen.getByTestId(`wth-weather-${id}`)).toBeTruthy();
    });
  });

  it("未選天氣時提交按鈕 disabled", () => {
    render(<WeatherType {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wth-reason-input"), { target: { value: "樂觀開朗充滿活力" } });
    const btn = screen.getByTestId("wth-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選天氣但原因太短時 disabled", () => {
    render(<WeatherType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wth-weather-rainy"));
    fireEvent.change(screen.getByTestId("wth-reason-input"), { target: { value: "細膩" } });
    const btn = screen.getByTestId("wth-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選天氣且原因 ≥5 字時提交按鈕啟用", () => {
    render(<WeatherType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wth-weather-sunny"));
    fireEvent.change(screen.getByTestId("wth-reason-input"), { target: { value: "樂觀開朗充滿正能量" } });
    const btn = screen.getByTestId("wth-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<WeatherType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wth-weather-rainbow"));
    fireEvent.change(screen.getByTestId("wth-reason-input"), { target: { value: "多彩帶來希望與驚喜感" } });
    fireEvent.click(screen.getByTestId("wth-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", weather: "foggy", reason: "神秘難以捉摸引人好奇" }],
      revealed: false,
    };
    render(<WeatherType {...defaultProps} />);
    expect(screen.getByTestId("wth-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("wth-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<WeatherType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("wth-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<WeatherType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("wth-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<WeatherType {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("wth-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<WeatherType {...defaultProps} />);
    expect(screen.getByTestId("wth-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 wth-result 和天氣摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", weather: "aurora", reason: "夢幻稀有讓人難以忘懷" }],
      revealed: true,
    };
    render(<WeatherType {...defaultProps} />);
    expect(screen.getByTestId("wth-result")).toBeTruthy();
    expect(screen.getByTestId("wth-weather-summary")).toBeTruthy();
    expect(screen.getByTestId("wth-badge-aurora")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", weather: "stormy", reason: "爆發力強改變一切格局" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", weather: "snowy", reason: "純粹安靜讓人放慢腳步" },
      ],
      revealed: true,
    };
    render(<WeatherType {...defaultProps} />);
    expect(screen.getByTestId("wth-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("wth-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<WeatherType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("wth-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", weather: "cloudy", reason: "沉穩低調深思熟慮型" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", weather: "windy", reason: "自由奔放帶動改變感覺" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", weather: "sunny", reason: "樂觀開朗充滿正面活力" },
      ],
      revealed: false,
    };
    render(<WeatherType {...defaultProps} />);
    expect(screen.getByTestId("wth-count").textContent).toContain("3");
  });
});
