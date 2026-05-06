import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoodWeather } from "../MoodWeather";

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

describe("MoodWeather", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<MoodWeather {...defaultProps} />);
    expect(screen.getByTestId("mw-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<MoodWeather {...defaultProps} />);
    expect(screen.getByTestId("mw-title").textContent).toBe("今日心情天氣");
    expect(screen.getByTestId("mw-prompt").textContent).toContain("天氣");
  });

  it("自訂 config 標題", () => {
    render(<MoodWeather {...defaultProps} config={{ title: "今天天氣如何？", prompt: "選一個天氣！" }} />);
    expect(screen.getByTestId("mw-title").textContent).toBe("今天天氣如何？");
    expect(screen.getByTestId("mw-prompt").textContent).toBe("選一個天氣！");
  });

  it("顯示已回報人數", () => {
    render(<MoodWeather {...defaultProps} />);
    expect(screen.getByTestId("mw-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<MoodWeather {...defaultProps} />);
    expect(screen.getByTestId("mw-form")).toBeTruthy();
    expect(screen.getByTestId("mw-reason-input")).toBeTruthy();
    expect(screen.getByTestId("mw-submit-btn")).toBeTruthy();
  });

  it("顯示所有 10 種天氣按鈕", () => {
    render(<MoodWeather {...defaultProps} />);
    ["sunny","partly_cloudy","cloudy","drizzle","rain","thunder","rainbow","wind","snow","fog"].forEach((id) => {
      expect(screen.getByTestId(`mw-weather-${id}`)).toBeTruthy();
    });
  });

  it("未選天氣時提交按鈕 disabled", () => {
    render(<MoodWeather {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mw-reason-input"), { target: { value: "今天很開心活力滿滿" } });
    const btn = screen.getByTestId("mw-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選天氣但原因太短時 disabled", () => {
    render(<MoodWeather {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mw-weather-sunny"));
    fireEvent.change(screen.getByTestId("mw-reason-input"), { target: { value: "好" } });
    const btn = screen.getByTestId("mw-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選天氣且原因 ≥5 字時提交按鈕啟用", () => {
    render(<MoodWeather {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mw-weather-rainbow"));
    fireEvent.change(screen.getByTestId("mw-reason-input"), { target: { value: "挺過低潮重新出發" } });
    const btn = screen.getByTestId("mw-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<MoodWeather {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mw-weather-cloudy"));
    fireEvent.change(screen.getByTestId("mw-reason-input"), { target: { value: "今天思緒很沉澱" } });
    fireEvent.click(screen.getByTestId("mw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", weather: "sunny", reason: "今天活力滿滿超開心" }],
      revealed: false,
    };
    render(<MoodWeather {...defaultProps} />);
    expect(screen.getByTestId("mw-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("mw-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<MoodWeather {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("mw-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<MoodWeather {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("mw-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<MoodWeather {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("mw-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MoodWeather {...defaultProps} />);
    expect(screen.getByTestId("mw-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 mw-result 和天氣摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", weather: "thunder", reason: "今天情緒能量很強烈" }],
      revealed: true,
    };
    render(<MoodWeather {...defaultProps} />);
    expect(screen.getByTestId("mw-result")).toBeTruthy();
    expect(screen.getByTestId("mw-weather-summary")).toBeTruthy();
    expect(screen.getByTestId("mw-badge-thunder")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", weather: "sunny", reason: "今天超開心活力充沛" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", weather: "fog", reason: "方向有點不清楚" },
      ],
      revealed: true,
    };
    render(<MoodWeather {...defaultProps} />);
    expect(screen.getByTestId("mw-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mw-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<MoodWeather {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("mw-reveal-btn")).toBeNull();
  });

  it("已回報人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", weather: "rain", reason: "需要靜靜充個電" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", weather: "sunny", reason: "今天好開心好開心" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", weather: "wind", reason: "步伐很快變化很多" },
      ],
      revealed: false,
    };
    render(<MoodWeather {...defaultProps} />);
    expect(screen.getByTestId("mw-count").textContent).toContain("3");
  });
});
