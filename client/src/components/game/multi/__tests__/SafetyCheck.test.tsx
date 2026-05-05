import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SafetyCheck } from "../SafetyCheck";

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

describe("SafetyCheck", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<SafetyCheck {...defaultProps} />);
    expect(screen.getByTestId("sc-loading")).toBeDefined();
  });

  test("顯示預設標題", () => {
    render(<SafetyCheck {...defaultProps} />);
    expect(screen.getByTestId("sc-title").textContent).toBe("心理安全感");
  });

  test("顯示自訂 title", () => {
    render(<SafetyCheck {...defaultProps} config={{ title: "Team Safety" }} />);
    expect(screen.getByTestId("sc-title").textContent).toBe("Team Safety");
  });

  test("顯示已完成人數", () => {
    render(<SafetyCheck {...defaultProps} />);
    expect(screen.getByTestId("sc-count").textContent).toContain("0");
  });

  test("預設 4 個維度各有 5 個按鈕", () => {
    render(<SafetyCheck {...defaultProps} />);
    const dims = ["speak_up", "feedback", "try_new", "trust"];
    dims.forEach((d) => {
      [1, 2, 3, 4, 5].forEach((v) => {
        expect(screen.getByTestId(`sc-score-${d}-${v}`)).toBeDefined();
      });
    });
  });

  test("未全選時提交鈕禁用", () => {
    render(<SafetyCheck {...defaultProps} />);
    const btn = screen.getByTestId("sc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("全選後可提交", () => {
    render(<SafetyCheck {...defaultProps} />);
    ["speak_up", "feedback", "try_new", "trust"].forEach((d) => {
      fireEvent.click(screen.getByTestId(`sc-score-${d}-3`));
    });
    const btn = screen.getByTestId("sc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶正確 scores", () => {
    render(<SafetyCheck {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sc-score-speak_up-4"));
    fireEvent.click(screen.getByTestId("sc-score-feedback-3"));
    fireEvent.click(screen.getByTestId("sc-score-try_new-5"));
    fireEvent.click(screen.getByTestId("sc-score-trust-4"));
    fireEvent.click(screen.getByTestId("sc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ scores: Record<string, number> }>;
    };
    expect(called.entries[0].scores.speak_up).toBe(4);
    expect(called.entries[0].scores.feedback).toBe(3);
    expect(called.entries[0].scores.try_new).toBe(5);
    expect(called.entries[0].scores.trust).toBe(4);
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [
        {
          entryId: "e1",
          userId: "u1",
          userName: "小明",
          scores: { speak_up: 4, feedback: 3, try_new: 5, trust: 4 },
        },
      ],
      revealed: false,
    };
    render(<SafetyCheck {...defaultProps} />);
    expect(screen.getByTestId("sc-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<SafetyCheck {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("sc-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<SafetyCheck {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("sc-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<SafetyCheck {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("sc-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示 4 個維度 bar", () => {
    mockState = {
      entries: [
        {
          entryId: "e1",
          userId: "u2",
          userName: "小華",
          scores: { speak_up: 4, feedback: 3, try_new: 5, trust: 4 },
        },
      ],
      revealed: true,
    };
    render(<SafetyCheck {...defaultProps} />);
    expect(screen.getByTestId("sc-result")).toBeDefined();
    ["speak_up", "feedback", "try_new", "trust"].forEach((d) => {
      expect(screen.getByTestId(`sc-bar-${d}`)).toBeDefined();
    });
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<SafetyCheck {...defaultProps} />);
    expect(screen.getByTestId("sc-empty")).toBeDefined();
  });
});
