import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DiscoveryCard } from "../DiscoveryCard";

let mockState: Record<string, unknown> = { cards: [], revealed: false };
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
  mockState = { cards: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("DiscoveryCard", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-title").textContent).toBe("活動發現卡");
  });

  it("顯示自定義標題", () => {
    render(<DiscoveryCard {...defaultProps} config={{ title: "今日大發現" }} />);
    expect(screen.getByTestId("dsc-title").textContent).toBe("今日大發現");
  });

  it("顯示提示文字", () => {
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-prompt")).toBeTruthy();
  });

  it("顯示已收到卡片數", () => {
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-form")).toBeTruthy();
  });

  it("顯示文字輸入框", () => {
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-input")).toBeTruthy();
  });

  it("少於5字時提交按鈕禁用", () => {
    render(<DiscoveryCard {...defaultProps} />);
    const btn = screen.getByTestId("dsc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("5字以上後啟用提交按鈕", () => {
    render(<DiscoveryCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("dsc-input"), {
      target: { value: "我發現自己喜歡合作" },
    });
    const btn = screen.getByTestId("dsc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確內容", () => {
    render(<DiscoveryCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("dsc-input"), {
      target: { value: "原來我很擅長傾聽別人" },
    });
    fireEvent.click(screen.getByTestId("dsc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      cards: Array<{ discovery: string; userId: string; userName: string }>;
    };
    expect(newState.cards[0].discovery).toBe("原來我很擅長傾聽別人");
    expect(newState.cards[0].userId).toBe("u1");
    expect(newState.cards[0].userName).toBe("Alice");
  });

  it("已提交後顯示我的發現卡", () => {
    mockState = {
      cards: [{ entryId: "u1-1", userId: "u1", userName: "Alice", discovery: "我發現溝通很重要" }],
      revealed: false,
    };
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-my-card")).toBeTruthy();
  });

  it("已提交後隱藏輸入表單", () => {
    mockState = {
      cards: [{ entryId: "u1-1", userId: "u1", userName: "Alice", discovery: "我發現溝通很重要" }],
      revealed: false,
    };
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.queryByTestId("dsc-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<DiscoveryCard {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("dsc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.queryByTestId("dsc-reveal-btn")).toBeNull();
  });

  it("揭曉後無卡片顯示 dsc-empty", () => {
    mockState = { cards: [], revealed: true };
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-empty")).toBeTruthy();
  });

  it("揭曉後有卡片顯示結果區", () => {
    mockState = {
      cards: [{ entryId: "u1-1", userId: "u1", userName: "Alice", discovery: "發現團隊力量很大" }],
      revealed: true,
    };
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-result")).toBeTruthy();
  });

  it("結果區顯示結果標題", () => {
    mockState = {
      cards: [{ entryId: "u1-1", userId: "u1", userName: "Alice", discovery: "發現团隊力量很大" }],
      revealed: true,
    };
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-result-title")).toBeTruthy();
  });

  it("結果區顯示各卡片", () => {
    mockState = {
      cards: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", discovery: "喜歡合作" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", discovery: "傾聽能力很棒" },
      ],
      revealed: true,
    };
    render(<DiscoveryCard {...defaultProps} />);
    expect(screen.getByTestId("dsc-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("dsc-card-u2-1")).toBeTruthy();
  });

  it("自定義提示文字", () => {
    render(
      <DiscoveryCard {...defaultProps} config={{ prompt: "今天你發現了什麼新事物？" }} />,
    );
    expect(screen.getByTestId("dsc-prompt").textContent).toBe("今天你發現了什麼新事物？");
  });
});
