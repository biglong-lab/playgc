import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReflectionCard } from "../ReflectionCard";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((next) => { mockState = next; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "小明", email: "user@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("ReflectionCard", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<ReflectionCard {...defaultProps} />);
    expect(screen.getByTestId("rc-loading")).toBeDefined();
  });

  test("顯示預設標題", () => {
    render(<ReflectionCard {...defaultProps} />);
    expect(screen.getByTestId("rc-title").textContent).toBe("回顧反思");
  });

  test("顯示自訂 config", () => {
    render(<ReflectionCard {...defaultProps} config={{ title: "Team Retrospective" }} />);
    expect(screen.getByTestId("rc-title").textContent).toBe("Team Retrospective");
  });

  test("顯示三個標籤", () => {
    render(<ReflectionCard {...defaultProps} />);
    expect(screen.getByTestId("rc-worked-label")).toBeDefined();
    expect(screen.getByTestId("rc-improve-label")).toBeDefined();
    expect(screen.getByTestId("rc-action-label")).toBeDefined();
  });

  test("顯示已回顧人數", () => {
    render(<ReflectionCard {...defaultProps} />);
    expect(screen.getByTestId("rc-count").textContent).toContain("0");
  });

  test("三欄都空時提交鈕禁用", () => {
    render(<ReflectionCard {...defaultProps} />);
    const btn = screen.getByTestId("rc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("填一欄即可提交", () => {
    render(<ReflectionCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rc-worked-input"), { target: { value: "溝通順暢" } });
    const btn = screen.getByTestId("rc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶三欄內容", () => {
    render(<ReflectionCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rc-worked-input"), { target: { value: "效率高" } });
    fireEvent.change(screen.getByTestId("rc-improve-input"), { target: { value: "時間管理" } });
    fireEvent.change(screen.getByTestId("rc-action-input"), { target: { value: "每日站會" } });
    fireEvent.click(screen.getByTestId("rc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ worked: string; improve: string; action: string }>;
    };
    expect(called.entries[0].worked).toBe("效率高");
    expect(called.entries[0].improve).toBe("時間管理");
    expect(called.entries[0].action).toBe("每日站會");
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", worked: "好", improve: "更好", action: "最好" }],
      revealed: false,
    };
    render(<ReflectionCard {...defaultProps} />);
    expect(screen.getByTestId("rc-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<ReflectionCard {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("rc-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<ReflectionCard {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("rc-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<ReflectionCard {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("rc-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "小華", worked: "A", improve: "B", action: "C" }],
      revealed: true,
    };
    render(<ReflectionCard {...defaultProps} />);
    expect(screen.getByTestId("rc-result")).toBeDefined();
    expect(screen.getByTestId("rc-card-e1")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<ReflectionCard {...defaultProps} />);
    expect(screen.getByTestId("rc-empty")).toBeDefined();
  });
});
