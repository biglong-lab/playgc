import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScaleCheck } from "../ScaleCheck";

let mockState: Record<string, unknown> = { ratings: [], revealed: false };
let mockIsLoaded = true;
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
  mockState = { ratings: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("ScaleCheck", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-title").textContent).toBe("量表評分");
  });

  it("顯示自定義標題", () => {
    render(<ScaleCheck {...defaultProps} config={{ title: "活動滿意度" }} />);
    expect(screen.getByTestId("slc-title").textContent).toBe("活動滿意度");
  });

  it("顯示預設問題", () => {
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-question").textContent).toContain("滿意程度");
  });

  it("顯示自定義問題", () => {
    render(<ScaleCheck {...defaultProps} config={{ question: "這次活動值得推薦嗎？" }} />);
    expect(screen.getByTestId("slc-question").textContent).toBe("這次活動值得推薦嗎？");
  });

  it("顯示已評分人數", () => {
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-count").textContent).toContain("0");
  });

  it("顯示評分量表", () => {
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-scale")).toBeTruthy();
  });

  it("顯示 5 個評分按鈕", () => {
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-score-1")).toBeTruthy();
    expect(screen.getByTestId("slc-score-3")).toBeTruthy();
    expect(screen.getByTestId("slc-score-5")).toBeTruthy();
  });

  it("顯示最小值標籤", () => {
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-min-label")).toBeTruthy();
  });

  it("顯示最大值標籤", () => {
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-max-label")).toBeTruthy();
  });

  it("自定義標籤文字", () => {
    render(<ScaleCheck {...defaultProps} config={{ minLabel: "很不滿意", maxLabel: "非常滿意" }} />);
    expect(screen.getByTestId("slc-min-label").textContent).toBe("很不滿意");
    expect(screen.getByTestId("slc-max-label").textContent).toBe("非常滿意");
  });

  it("點選分數後呼叫 updateState", () => {
    render(<ScaleCheck {...defaultProps} />);
    fireEvent.click(screen.getByTestId("slc-score-4"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      ratings: Array<{ userId: string; score: number }>;
    };
    expect(newState.ratings[0].userId).toBe("u1");
    expect(newState.ratings[0].score).toBe(4);
  });

  it("已評分後顯示我的評分", () => {
    mockState = {
      ratings: [{ userId: "u1", userName: "Alice", score: 5 }],
      revealed: false,
    };
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-my-rating")).toBeTruthy();
    expect(screen.getByTestId("slc-my-rating").textContent).toContain("5");
  });

  it("已評分後隱藏量表", () => {
    mockState = {
      ratings: [{ userId: "u1", userName: "Alice", score: 3 }],
      revealed: false,
    };
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.queryByTestId("slc-scale")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<ScaleCheck {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("slc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.queryByTestId("slc-reveal-btn")).toBeNull();
  });

  it("揭曉後無評分顯示 slc-empty", () => {
    mockState = { ratings: [], revealed: true };
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-empty")).toBeTruthy();
  });

  it("揭曉後顯示平均分和分布", () => {
    mockState = {
      ratings: [
        { userId: "u1", userName: "Alice", score: 5 },
        { userId: "u2", userName: "Bob", score: 4 },
        { userId: "u3", userName: "Carol", score: 5 },
      ],
      revealed: true,
    };
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-result")).toBeTruthy();
    expect(screen.getByTestId("slc-avg").textContent).toContain("4.7");
  });

  it("揭曉後顯示各分數長條", () => {
    mockState = {
      ratings: [{ userId: "u1", userName: "Alice", score: 3 }],
      revealed: true,
    };
    render(<ScaleCheck {...defaultProps} />);
    expect(screen.getByTestId("slc-bar-3")).toBeTruthy();
  });
});
