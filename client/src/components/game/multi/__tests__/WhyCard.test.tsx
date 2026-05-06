import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WhyCard } from "../WhyCard";

let mockState: Record<string, unknown> = { cards: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: mockIsLoaded }),
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

describe("WhyCard", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<WhyCard {...defaultProps} />);
    expect(screen.getByTestId("why-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<WhyCard {...defaultProps} />);
    expect(screen.getByTestId("why-title").textContent).toBe("我的為什麼");
  });

  it("顯示自定義標題", () => {
    render(<WhyCard {...defaultProps} config={{ title: "你的初心" }} />);
    expect(screen.getByTestId("why-title").textContent).toBe("你的初心");
  });

  it("顯示提示文字", () => {
    render(<WhyCard {...defaultProps} />);
    expect(screen.getByTestId("why-prompt")).toBeTruthy();
  });

  it("顯示自定義提示", () => {
    render(<WhyCard {...defaultProps} config={{ prompt: "你的核心動力是什麼？" }} />);
    expect(screen.getByTestId("why-prompt").textContent).toBe("你的核心動力是什麼？");
  });

  it("顯示已分享人數", () => {
    render(<WhyCard {...defaultProps} />);
    expect(screen.getByTestId("why-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<WhyCard {...defaultProps} />);
    expect(screen.getByTestId("why-form")).toBeTruthy();
  });

  it("顯示文字輸入框", () => {
    render(<WhyCard {...defaultProps} />);
    expect(screen.getByTestId("why-input")).toBeTruthy();
  });

  it("未填時提交按鈕禁用", () => {
    render(<WhyCard {...defaultProps} />);
    expect((screen.getByTestId("why-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<WhyCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("why-input"), { target: { value: "想學" } });
    expect((screen.getByTestId("why-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<WhyCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("why-input"), { target: { value: "我想讓團隊更有凝聚力" } });
    expect((screen.getByTestId("why-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 why", () => {
    render(<WhyCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("why-input"), { target: { value: "我相信每個人都有潛力可以發揮" } });
    fireEvent.click(screen.getByTestId("why-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { cards: Array<{ userId: string; why: string }> };
    expect(s.cards[0].userId).toBe("u1");
    expect(s.cards[0].why).toBe("我相信每個人都有潛力可以發揮");
  });

  it("已提交後顯示我的 Why 卡", () => {
    mockState = { cards: [{ entryId: "u1-1", userId: "u1", userName: "Alice", why: "我想創造改變" }], revealed: false };
    render(<WhyCard {...defaultProps} />);
    expect(screen.getByTestId("why-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { cards: [{ entryId: "u1-1", userId: "u1", userName: "Alice", why: "我想創造改變" }], revealed: false };
    render(<WhyCard {...defaultProps} />);
    expect(screen.queryByTestId("why-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<WhyCard {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("why-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<WhyCard {...defaultProps} />);
    expect(screen.queryByTestId("why-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 why-empty", () => {
    mockState = { cards: [], revealed: true };
    render(<WhyCard {...defaultProps} />);
    expect(screen.getByTestId("why-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊 Why 牆", () => {
    mockState = {
      cards: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", why: "為了讓更多人感受到學習的快樂" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", why: "因為我相信合作可以創造奇蹟" },
      ],
      revealed: true,
    };
    render(<WhyCard {...defaultProps} />);
    expect(screen.getByTestId("why-result")).toBeTruthy();
    expect(screen.getByTestId("why-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("why-card-u2-1")).toBeTruthy();
  });
});
