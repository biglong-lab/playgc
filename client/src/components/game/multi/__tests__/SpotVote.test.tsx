import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpotVote } from "../SpotVote";

let mockState: Record<string, unknown> = { votes: [], revealed: false };
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
  mockState = { votes: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("SpotVote", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-title").textContent).toBe("我最想去的景點");
  });

  it("顯示自定義標題", () => {
    render(<SpotVote {...defaultProps} config={{ title: "最想去的地方" }} />);
    expect(screen.getByTestId("spv-title").textContent).toBe("最想去的地方");
  });

  it("顯示提示文字", () => {
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<SpotVote {...defaultProps} config={{ prompt: "你最想帶隊友去哪裡？" }} />);
    expect(screen.getByTestId("spv-prompt").textContent).toBe("你最想帶隊友去哪裡？");
  });

  it("顯示已投票人數", () => {
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-count").textContent).toContain("0");
  });

  it("顯示投票表單", () => {
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-form")).toBeTruthy();
  });

  it("顯示海灘選項", () => {
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-spot-beach")).toBeTruthy();
  });

  it("顯示山林選項", () => {
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-spot-mountain")).toBeTruthy();
  });

  it("投票按鈕預設禁用", () => {
    render(<SpotVote {...defaultProps} />);
    const btn = screen.getByTestId("spv-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選擇景點後啟用投票按鈕", () => {
    render(<SpotVote {...defaultProps} />);
    fireEvent.click(screen.getByTestId("spv-spot-city"));
    const btn = screen.getByTestId("spv-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("選擇景點後套用選中樣式", () => {
    render(<SpotVote {...defaultProps} />);
    fireEvent.click(screen.getByTestId("spv-spot-hot_spring"));
    expect(screen.getByTestId("spv-spot-hot_spring").className).toContain("border-blue-500");
  });

  it("投票後呼叫 updateState", () => {
    render(<SpotVote {...defaultProps} />);
    fireEvent.click(screen.getByTestId("spv-spot-temple"));
    fireEvent.click(screen.getByTestId("spv-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { votes: Array<{ spotId: string }> };
    expect(newState.votes[0].spotId).toBe("temple");
  });

  it("已有投票時顯示我的投票區", () => {
    mockState = { votes: [{ userId: "u1", userName: "Alice", spotId: "market" }], revealed: false };
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-my-vote")).toBeTruthy();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<SpotVote {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("spv-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<SpotVote {...defaultProps} />);
    expect(screen.queryByTestId("spv-reveal-btn")).toBeNull();
  });

  it("揭曉後無投票顯示 spv-empty", () => {
    mockState = { votes: [], revealed: true };
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-empty")).toBeTruthy();
  });

  it("揭曉後有投票顯示結果區", () => {
    mockState = {
      votes: [{ userId: "u1", userName: "Alice", spotId: "beach" }],
      revealed: true,
    };
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-result")).toBeTruthy();
  });

  it("結果區顯示景點 bar", () => {
    mockState = {
      votes: [{ userId: "u1", userName: "Alice", spotId: "beach" }],
      revealed: true,
    };
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-bar-beach")).toBeTruthy();
  });

  it("結果區顯示最受歡迎景點", () => {
    mockState = {
      votes: [
        { userId: "u1", userName: "Alice", spotId: "mountain" },
        { userId: "u2", userName: "Bob", spotId: "mountain" },
      ],
      revealed: true,
    };
    render(<SpotVote {...defaultProps} />);
    expect(screen.getByTestId("spv-winner")).toBeTruthy();
    expect(screen.getByTestId("spv-winner").textContent).toContain("2 票");
  });
});
