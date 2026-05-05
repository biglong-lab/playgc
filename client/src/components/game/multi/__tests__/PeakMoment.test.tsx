import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeakMoment } from "../PeakMoment";

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

describe("PeakMoment", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<PeakMoment {...defaultProps} />);
    expect(screen.getByTestId("pm-loading")).toBeDefined();
  });

  test("顯示預設標題", () => {
    render(<PeakMoment {...defaultProps} />);
    expect(screen.getByTestId("pm-title").textContent).toBe("最高光時刻");
  });

  test("顯示預設 prompt", () => {
    render(<PeakMoment {...defaultProps} />);
    expect(screen.getByTestId("pm-prompt").textContent).toContain("高光時刻");
  });

  test("顯示自訂 config", () => {
    render(<PeakMoment {...defaultProps} config={{ title: "Peak Highlights" }} />);
    expect(screen.getByTestId("pm-title").textContent).toBe("Peak Highlights");
  });

  test("顯示已分享人數", () => {
    render(<PeakMoment {...defaultProps} />);
    expect(screen.getByTestId("pm-count").textContent).toContain("0");
  });

  test("moment 空時提交鈕禁用", () => {
    render(<PeakMoment {...defaultProps} />);
    const btn = screen.getByTestId("pm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("填入 moment 可提交", () => {
    render(<PeakMoment {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pm-moment-input"), { target: { value: "全隊過關瞬間" } });
    const btn = screen.getByTestId("pm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶 moment 與 feeling", () => {
    render(<PeakMoment {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pm-moment-input"), { target: { value: "衝過終點線" } });
    fireEvent.change(screen.getByTestId("pm-feeling-input"), { target: { value: "興奮" } });
    fireEvent.click(screen.getByTestId("pm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ moment: string; feeling: string }>;
    };
    expect(called.entries[0].moment).toBe("衝過終點線");
    expect(called.entries[0].feeling).toBe("興奮");
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", moment: "大家一起", feeling: "感動" }],
      revealed: false,
    };
    render(<PeakMoment {...defaultProps} />);
    expect(screen.getByTestId("pm-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<PeakMoment {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("pm-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<PeakMoment {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("pm-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<PeakMoment {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("pm-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "小華", moment: "A", feeling: "B" }],
      revealed: true,
    };
    render(<PeakMoment {...defaultProps} />);
    expect(screen.getByTestId("pm-result")).toBeDefined();
    expect(screen.getByTestId("pm-card-e1")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<PeakMoment {...defaultProps} />);
    expect(screen.getByTestId("pm-empty")).toBeDefined();
  });
});
