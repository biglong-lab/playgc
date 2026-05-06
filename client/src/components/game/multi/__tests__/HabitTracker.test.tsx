import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HabitTracker } from "../HabitTracker";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
const mockUpdateState = vi.fn();

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "Alice", email: "alice@test.com" },
  }),
}));

const baseProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("HabitTracker", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<HabitTracker {...baseProps} />);
    expect(screen.getByTestId("ht-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<HabitTracker {...baseProps} config={{ title: "我的習慣牆" }} />);
    expect(screen.getByTestId("ht-title").textContent).toContain("我的習慣牆");
  });

  it("顯示預設標題", () => {
    render(<HabitTracker {...baseProps} />);
    expect(screen.getByTestId("ht-title").textContent).toContain("習慣追蹤");
  });

  it("顯示已分享人數", () => {
    render(<HabitTracker {...baseProps} />);
    expect(screen.getByTestId("ht-count").textContent).toContain("0");
  });

  it("顯示提示文字", () => {
    render(<HabitTracker {...baseProps} />);
    expect(screen.getByTestId("ht-prompt")).toBeTruthy();
  });

  it("未提交前顯示表單", () => {
    render(<HabitTracker {...baseProps} />);
    expect(screen.getByTestId("ht-form")).toBeTruthy();
    expect(screen.getByTestId("ht-habit-input")).toBeTruthy();
  });

  it("習慣少於 3 字時提交按鈕 disabled", () => {
    render(<HabitTracker {...baseProps} />);
    const btn = screen.getByTestId("ht-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("習慣達 3 字後可提交", () => {
    render(<HabitTracker {...baseProps} />);
    fireEvent.change(screen.getByTestId("ht-habit-input"), { target: { value: "每天閱讀" } });
    const btn = screen.getByTestId("ht-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("點擊類別按鈕切換選擇", () => {
    render(<HabitTracker {...baseProps} />);
    const learnBtn = screen.getByTestId("ht-cat-學習");
    fireEvent.click(learnBtn);
    expect(learnBtn.className).toContain("border-green-500");
  });

  it("提交後呼叫 updateState", () => {
    render(<HabitTracker {...baseProps} />);
    fireEvent.click(screen.getByTestId("ht-cat-健康"));
    fireEvent.change(screen.getByTestId("ht-habit-input"), { target: { value: "每天運動30分鐘" } });
    fireEvent.change(screen.getByTestId("ht-why-input"), { target: { value: "改善體力" } });
    fireEvent.click(screen.getByTestId("ht-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as { entries: { habit: string; category: string }[] };
    expect(call.entries[0].habit).toBe("每天運動30分鐘");
    expect(call.entries[0].category).toBe("健康");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", habit: "每天冥想", category: "健康", why: "" }],
      revealed: false,
    };
    render(<HabitTracker {...baseProps} />);
    expect(screen.getByTestId("ht-my-entry")).toBeTruthy();
    expect(screen.getByTestId("ht-my-entry").textContent).toContain("每天冥想");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<HabitTracker {...baseProps} />);
    expect(screen.queryByTestId("ht-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<HabitTracker {...baseProps} isTeamLead />);
    expect(screen.getByTestId("ht-reveal-btn")).toBeTruthy();
  });

  it("點揭示按鈕 updateState revealed=true", () => {
    render(<HabitTracker {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ht-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<HabitTracker {...baseProps} />);
    expect(screen.getByTestId("ht-result")).toBeTruthy();
    expect(screen.getByTestId("ht-empty")).toBeTruthy();
  });

  it("revealed 顯示卡片與類別統計", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", habit: "每天閱讀", category: "學習", why: "提升知識" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", habit: "每天跑步", category: "健康", why: "" },
      ],
      revealed: true,
    };
    render(<HabitTracker {...baseProps} />);
    expect(screen.getByTestId("ht-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ht-card-u2-1")).toBeTruthy();
    expect(screen.getByTestId("ht-cat-stats")).toBeTruthy();
  });
});
