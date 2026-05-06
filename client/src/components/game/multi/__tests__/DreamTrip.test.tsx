import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DreamTrip } from "../DreamTrip";

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

describe("DreamTrip", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<DreamTrip {...defaultProps} />);
    expect(screen.getByTestId("dt-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<DreamTrip {...defaultProps} />);
    expect(screen.getByTestId("dt-title").textContent).toBe("夢想旅行");
    expect(screen.getByTestId("dt-prompt").textContent).toContain("夢想旅遊目的地");
  });

  it("自訂 config 標題", () => {
    render(<DreamTrip {...defaultProps} config={{ title: "旅行清單", prompt: "你最想去哪？" }} />);
    expect(screen.getByTestId("dt-title").textContent).toBe("旅行清單");
    expect(screen.getByTestId("dt-prompt").textContent).toBe("你最想去哪？");
  });

  it("顯示已分享人數", () => {
    render(<DreamTrip {...defaultProps} />);
    expect(screen.getByTestId("dt-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<DreamTrip {...defaultProps} />);
    expect(screen.getByTestId("dt-form")).toBeTruthy();
    expect(screen.getByTestId("dt-destination-input")).toBeTruthy();
    expect(screen.getByTestId("dt-submit-btn")).toBeTruthy();
  });

  it("顯示所有目的地類型按鈕", () => {
    render(<DreamTrip {...defaultProps} />);
    ["beach", "mountain", "city", "nature", "culture", "food"].forEach((id) => {
      expect(screen.getByTestId(`dt-type-${id}`)).toBeTruthy();
    });
  });

  it("未選類型時提交按鈕 disabled", () => {
    render(<DreamTrip {...defaultProps} />);
    const btn = screen.getByTestId("dt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選類型但目的地太短時 disabled", () => {
    render(<DreamTrip {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dt-type-beach"));
    fireEvent.change(screen.getByTestId("dt-destination-input"), { target: { value: "京" } });
    const btn = screen.getByTestId("dt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選類型且目的地 ≥2 字時提交按鈕啟用", () => {
    render(<DreamTrip {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dt-type-mountain"));
    fireEvent.change(screen.getByTestId("dt-destination-input"), { target: { value: "冰島" } });
    const btn = screen.getByTestId("dt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<DreamTrip {...defaultProps} />);
    fireEvent.click(screen.getByTestId("dt-type-city"));
    fireEvent.change(screen.getByTestId("dt-destination-input"), { target: { value: "東京" } });
    fireEvent.click(screen.getByTestId("dt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", destination: "巴黎", destType: "city" }],
      revealed: false,
    };
    render(<DreamTrip {...defaultProps} />);
    expect(screen.getByTestId("dt-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("dt-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<DreamTrip {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("dt-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<DreamTrip {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("dt-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<DreamTrip {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("dt-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<DreamTrip {...defaultProps} />);
    expect(screen.getByTestId("dt-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 dt-result", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", destination: "京都", destType: "culture" }],
      revealed: true,
    };
    render(<DreamTrip {...defaultProps} />);
    expect(screen.getByTestId("dt-result")).toBeTruthy();
    expect(screen.getByTestId("dt-trip-wall")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", destination: "北歐", destType: "nature" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", destination: "沖繩", destType: "beach" },
      ],
      revealed: true,
    };
    render(<DreamTrip {...defaultProps} />);
    expect(screen.getByTestId("dt-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("dt-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<DreamTrip {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("dt-reveal-btn")).toBeNull();
  });

  it("已分享人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", destination: "首爾", destType: "city" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", destination: "富士山", destType: "mountain" },
      ],
      revealed: false,
    };
    render(<DreamTrip {...defaultProps} />);
    expect(screen.getByTestId("dt-count").textContent).toContain("2");
  });
});
