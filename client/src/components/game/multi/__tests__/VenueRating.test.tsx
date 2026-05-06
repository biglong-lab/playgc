import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VenueRating } from "../VenueRating";

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

describe("VenueRating", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<VenueRating {...defaultProps} />);
    expect(screen.getByTestId("vrt-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<VenueRating {...defaultProps} />);
    expect(screen.getByTestId("vrt-title").textContent).toBe("場域評分");
  });

  it("顯示自定義標題", () => {
    render(<VenueRating {...defaultProps} config={{ title: "場地滿意度" }} />);
    expect(screen.getByTestId("vrt-title").textContent).toBe("場地滿意度");
  });

  it("顯示場域名稱", () => {
    render(<VenueRating {...defaultProps} config={{ venueName: "賈村廣場" }} />);
    expect(screen.getByTestId("vrt-venue-name").textContent).toBe("賈村廣場");
  });

  it("沒有 venueName 時不顯示場域名稱", () => {
    render(<VenueRating {...defaultProps} />);
    expect(screen.queryByTestId("vrt-venue-name")).toBeNull();
  });

  it("顯示已評分人數", () => {
    render(<VenueRating {...defaultProps} />);
    expect(screen.getByTestId("vrt-count").textContent).toContain("0");
  });

  it("顯示評分表單", () => {
    render(<VenueRating {...defaultProps} />);
    expect(screen.getByTestId("vrt-form")).toBeTruthy();
  });

  it("顯示四個維度評分區塊", () => {
    render(<VenueRating {...defaultProps} />);
    expect(screen.getByTestId("vrt-dim-ambience")).toBeTruthy();
    expect(screen.getByTestId("vrt-dim-service")).toBeTruthy();
    expect(screen.getByTestId("vrt-dim-character")).toBeTruthy();
    expect(screen.getByTestId("vrt-dim-overall")).toBeTruthy();
  });

  it("每個維度有 5 顆星按鈕", () => {
    render(<VenueRating {...defaultProps} />);
    expect(screen.getByTestId("vrt-star-ambience-1")).toBeTruthy();
    expect(screen.getByTestId("vrt-star-ambience-5")).toBeTruthy();
    expect(screen.getByTestId("vrt-star-service-3")).toBeTruthy();
    expect(screen.getByTestId("vrt-star-overall-5")).toBeTruthy();
  });

  it("未全部評分時提交按鈕禁用", () => {
    render(<VenueRating {...defaultProps} />);
    const btn = screen.getByTestId("vrt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只評一個維度時仍禁用", () => {
    render(<VenueRating {...defaultProps} />);
    fireEvent.click(screen.getByTestId("vrt-star-ambience-4"));
    const btn = screen.getByTestId("vrt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("四個維度都評分後啟用提交按鈕", () => {
    render(<VenueRating {...defaultProps} />);
    fireEvent.click(screen.getByTestId("vrt-star-ambience-4"));
    fireEvent.click(screen.getByTestId("vrt-star-service-5"));
    fireEvent.click(screen.getByTestId("vrt-star-character-3"));
    fireEvent.click(screen.getByTestId("vrt-star-overall-4"));
    const btn = screen.getByTestId("vrt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含四維度分數", () => {
    render(<VenueRating {...defaultProps} />);
    fireEvent.click(screen.getByTestId("vrt-star-ambience-4"));
    fireEvent.click(screen.getByTestId("vrt-star-service-5"));
    fireEvent.click(screen.getByTestId("vrt-star-character-3"));
    fireEvent.click(screen.getByTestId("vrt-star-overall-4"));
    fireEvent.click(screen.getByTestId("vrt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      ratings: Array<{ userId: string; scores: { ambience: number; service: number; character: number; overall: number } }>;
    };
    expect(newState.ratings[0].userId).toBe("u1");
    expect(newState.ratings[0].scores.ambience).toBe(4);
    expect(newState.ratings[0].scores.service).toBe(5);
    expect(newState.ratings[0].scores.character).toBe(3);
    expect(newState.ratings[0].scores.overall).toBe(4);
  });

  it("已評分後顯示我的評分卡", () => {
    mockState = {
      ratings: [{ userId: "u1", userName: "Alice", scores: { ambience: 4, service: 5, character: 3, overall: 4 } }],
      revealed: false,
    };
    render(<VenueRating {...defaultProps} />);
    expect(screen.getByTestId("vrt-my-rating")).toBeTruthy();
  });

  it("已評分後隱藏表單", () => {
    mockState = {
      ratings: [{ userId: "u1", userName: "Alice", scores: { ambience: 4, service: 5, character: 3, overall: 4 } }],
      revealed: false,
    };
    render(<VenueRating {...defaultProps} />);
    expect(screen.queryByTestId("vrt-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<VenueRating {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("vrt-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<VenueRating {...defaultProps} />);
    expect(screen.queryByTestId("vrt-reveal-btn")).toBeNull();
  });

  it("揭曉後無評分顯示 vrt-empty", () => {
    mockState = { ratings: [], revealed: true };
    render(<VenueRating {...defaultProps} />);
    expect(screen.getByTestId("vrt-empty")).toBeTruthy();
  });

  it("揭曉後顯示各維度平均長條", () => {
    mockState = {
      ratings: [
        { userId: "u1", userName: "Alice", scores: { ambience: 4, service: 5, character: 3, overall: 4 } },
        { userId: "u2", userName: "Bob", scores: { ambience: 5, service: 4, character: 4, overall: 5 } },
      ],
      revealed: true,
    };
    render(<VenueRating {...defaultProps} />);
    expect(screen.getByTestId("vrt-result")).toBeTruthy();
    expect(screen.getByTestId("vrt-avg-ambience")).toBeTruthy();
    expect(screen.getByTestId("vrt-avg-service")).toBeTruthy();
    expect(screen.getByTestId("vrt-avg-character")).toBeTruthy();
    expect(screen.getByTestId("vrt-avg-overall")).toBeTruthy();
  });

  it("平均分顯示正確", () => {
    mockState = {
      ratings: [
        { userId: "u1", userName: "Alice", scores: { ambience: 4, service: 5, character: 3, overall: 4 } },
        { userId: "u2", userName: "Bob", scores: { ambience: 4, service: 5, character: 3, overall: 4 } },
      ],
      revealed: true,
    };
    render(<VenueRating {...defaultProps} />);
    expect(screen.getByTestId("vrt-avg-ambience").textContent).toContain("4.0");
  });
});
