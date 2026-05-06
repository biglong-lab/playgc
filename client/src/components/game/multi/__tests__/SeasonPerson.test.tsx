import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeasonPerson } from "../SeasonPerson";

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

describe("SeasonPerson", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<SeasonPerson {...defaultProps} />);
    expect(screen.getByTestId("sp-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<SeasonPerson {...defaultProps} />);
    expect(screen.getByTestId("sp-title").textContent).toBe("我是哪個季節的人");
    expect(screen.getByTestId("sp-prompt").textContent).toContain("季節");
  });

  it("自訂 config 標題", () => {
    render(<SeasonPerson {...defaultProps} config={{ title: "四季人格", prompt: "你是哪個季節？" }} />);
    expect(screen.getByTestId("sp-title").textContent).toBe("四季人格");
    expect(screen.getByTestId("sp-prompt").textContent).toBe("你是哪個季節？");
  });

  it("顯示已選擇人數", () => {
    render(<SeasonPerson {...defaultProps} />);
    expect(screen.getByTestId("sp-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<SeasonPerson {...defaultProps} />);
    expect(screen.getByTestId("sp-form")).toBeTruthy();
    expect(screen.getByTestId("sp-reason-input")).toBeTruthy();
    expect(screen.getByTestId("sp-submit-btn")).toBeTruthy();
  });

  it("顯示所有 4 個季節按鈕", () => {
    render(<SeasonPerson {...defaultProps} />);
    ["spring","summer","autumn","winter"].forEach((id) => {
      expect(screen.getByTestId(`sp-season-${id}`)).toBeTruthy();
    });
  });

  it("未選季節時提交按鈕 disabled", () => {
    render(<SeasonPerson {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sp-reason-input"), { target: { value: "因為充滿希望想要成長" } });
    const btn = screen.getByTestId("sp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選季節但原因太短時 disabled", () => {
    render(<SeasonPerson {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sp-season-spring"));
    fireEvent.change(screen.getByTestId("sp-reason-input"), { target: { value: "新芽" } });
    const btn = screen.getByTestId("sp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選季節且原因 ≥5 字時提交按鈕啟用", () => {
    render(<SeasonPerson {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sp-season-autumn"));
    fireEvent.change(screen.getByTestId("sp-reason-input"), { target: { value: "喜歡深思熟慮豐收的感覺" } });
    const btn = screen.getByTestId("sp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<SeasonPerson {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sp-season-winter"));
    fireEvent.change(screen.getByTestId("sp-reason-input"), { target: { value: "喜歡寧靜專注的感覺" } });
    fireEvent.click(screen.getByTestId("sp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", season: "summer", reason: "熱情活力充沛直接說出來" }],
      revealed: false,
    };
    render(<SeasonPerson {...defaultProps} />);
    expect(screen.getByTestId("sp-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("sp-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<SeasonPerson {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("sp-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<SeasonPerson {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("sp-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<SeasonPerson {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("sp-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<SeasonPerson {...defaultProps} />);
    expect(screen.getByTestId("sp-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 sp-result 和季節摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", season: "spring", reason: "總是充滿希望開始新事物" }],
      revealed: true,
    };
    render(<SeasonPerson {...defaultProps} />);
    expect(screen.getByTestId("sp-result")).toBeTruthy();
    expect(screen.getByTestId("sp-season-summary")).toBeTruthy();
    expect(screen.getByTestId("sp-badge-spring")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", season: "summer", reason: "充滿熱情說到做到" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", season: "winter", reason: "寧靜內斂思考清晰" },
      ],
      revealed: true,
    };
    render(<SeasonPerson {...defaultProps} />);
    expect(screen.getByTestId("sp-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("sp-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<SeasonPerson {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("sp-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", season: "autumn", reason: "沉穩豐收享受成果" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", season: "spring", reason: "充滿希望新的開始" },
      ],
      revealed: false,
    };
    render(<SeasonPerson {...defaultProps} />);
    expect(screen.getByTestId("sp-count").textContent).toContain("2");
  });
});
