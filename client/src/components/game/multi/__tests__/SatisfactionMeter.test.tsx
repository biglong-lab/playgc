import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SatisfactionMeter } from "../SatisfactionMeter";

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

describe("SatisfactionMeter", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<SatisfactionMeter {...defaultProps} />);
    expect(screen.getByTestId("sm-loading")).toBeDefined();
  });

  test("顯示預設標題", () => {
    render(<SatisfactionMeter {...defaultProps} />);
    expect(screen.getByTestId("sm-title").textContent).toBe("滿意度量表");
  });

  test("顯示自訂標題", () => {
    render(<SatisfactionMeter {...defaultProps} config={{ title: "NPS 調查" }} />);
    expect(screen.getByTestId("sm-title").textContent).toBe("NPS 調查");
  });

  test("顯示 0-10 共 11 個評分按鈕", () => {
    render(<SatisfactionMeter {...defaultProps} />);
    expect(screen.getByTestId("sm-scale")).toBeDefined();
    for (let i = 0; i <= 10; i++) {
      expect(screen.getByTestId(`sm-score-${i}`)).toBeDefined();
    }
  });

  test("顯示已評分人數", () => {
    render(<SatisfactionMeter {...defaultProps} />);
    expect(screen.getByTestId("sm-count").textContent).toContain("0");
  });

  test("未選分時提交鈕禁用", () => {
    render(<SatisfactionMeter {...defaultProps} />);
    const btn = screen.getByTestId("sm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("點選分數後可提交", () => {
    render(<SatisfactionMeter {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sm-score-8"));
    const btn = screen.getByTestId("sm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶正確 score", () => {
    render(<SatisfactionMeter {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sm-score-9"));
    fireEvent.change(screen.getByTestId("sm-comment-input"), { target: { value: "很棒！" } });
    fireEvent.click(screen.getByTestId("sm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ score: number; comment: string }>;
    };
    expect(called.entries[0].score).toBe(9);
    expect(called.entries[0].comment).toBe("很棒！");
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", score: 9, comment: "" }],
      revealed: false,
    };
    render(<SatisfactionMeter {...defaultProps} />);
    expect(screen.getByTestId("sm-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<SatisfactionMeter {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("sm-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<SatisfactionMeter {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("sm-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<SatisfactionMeter {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("sm-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示 NPS 與三類別", () => {
    mockState = {
      entries: [
        { entryId: "e1", userId: "u2", userName: "A", score: 9, comment: "好" },
        { entryId: "e2", userId: "u3", userName: "B", score: 7, comment: "" },
        { entryId: "e3", userId: "u4", userName: "C", score: 3, comment: "" },
      ],
      revealed: true,
    };
    render(<SatisfactionMeter {...defaultProps} />);
    expect(screen.getByTestId("sm-result")).toBeDefined();
    expect(screen.getByTestId("sm-nps")).toBeDefined();
    expect(screen.getByTestId("sm-cat-promoter")).toBeDefined();
    expect(screen.getByTestId("sm-cat-passive")).toBeDefined();
    expect(screen.getByTestId("sm-cat-detractor")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<SatisfactionMeter {...defaultProps} />);
    expect(screen.getByTestId("sm-empty")).toBeDefined();
  });
});
