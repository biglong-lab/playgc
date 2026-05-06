import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResilienceCard } from "../ResilienceCard";

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

describe("ResilienceCard", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.getByTestId("rsc-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.getByTestId("rsc-title").textContent).toBe("韌性策略");
  });

  it("顯示自定義標題", () => {
    render(<ResilienceCard {...defaultProps} config={{ title: "我的反彈力" }} />);
    expect(screen.getByTestId("rsc-title").textContent).toBe("我的反彈力");
  });

  it("顯示提示文字", () => {
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.getByTestId("rsc-prompt")).toBeTruthy();
  });

  it("顯示已分享人數", () => {
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.getByTestId("rsc-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.getByTestId("rsc-form")).toBeTruthy();
  });

  it("顯示策略選項", () => {
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.getByTestId("rsc-strategy-grid")).toBeTruthy();
    expect(screen.getByTestId("rsc-strategy-reframe")).toBeTruthy();
    expect(screen.getByTestId("rsc-strategy-connect")).toBeTruthy();
    expect(screen.getByTestId("rsc-strategy-pause")).toBeTruthy();
    expect(screen.getByTestId("rsc-strategy-action")).toBeTruthy();
    expect(screen.getByTestId("rsc-strategy-reflect")).toBeTruthy();
  });

  it("顯示描述輸入框", () => {
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.getByTestId("rsc-description-input")).toBeTruthy();
  });

  it("未填描述時提交按鈕禁用", () => {
    render(<ResilienceCard {...defaultProps} />);
    expect((screen.getByTestId("rsc-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<ResilienceCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rsc-description-input"), { target: { value: "好" } });
    expect((screen.getByTestId("rsc-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<ResilienceCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rsc-description-input"), { target: { value: "深呼吸後重新出發" } });
    expect((screen.getByTestId("rsc-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換韌性策略", () => {
    render(<ResilienceCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("rsc-strategy-pause"));
    expect(screen.getByTestId("rsc-strategy-pause").className).toContain("indigo-200");
  });

  it("提交後呼叫 updateState 含 strategy 和 description", () => {
    render(<ResilienceCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("rsc-strategy-connect"));
    fireEvent.change(screen.getByTestId("rsc-description-input"), { target: { value: "找朋友傾訴後感覺好多了" } });
    fireEvent.click(screen.getByTestId("rsc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { cards: Array<{ userId: string; strategy: string; description: string }> };
    expect(s.cards[0].userId).toBe("u1");
    expect(s.cards[0].strategy).toBe("connect");
    expect(s.cards[0].description).toBe("找朋友傾訴後感覺好多了");
  });

  it("已提交後顯示我的策略", () => {
    mockState = { cards: [{ entryId: "u1-1", userId: "u1", userName: "Alice", strategy: "reframe", description: "把挫折視為機會" }], revealed: false };
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.getByTestId("rsc-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { cards: [{ entryId: "u1-1", userId: "u1", userName: "Alice", strategy: "reframe", description: "把挫折視為機會" }], revealed: false };
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.queryByTestId("rsc-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<ResilienceCard {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("rsc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.queryByTestId("rsc-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 rsc-empty", () => {
    mockState = { cards: [], revealed: true };
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.getByTestId("rsc-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊策略牆", () => {
    mockState = {
      cards: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", strategy: "action", description: "立刻採取小步驟" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", strategy: "reflect", description: "寫日記找到學習點" },
      ],
      revealed: true,
    };
    render(<ResilienceCard {...defaultProps} />);
    expect(screen.getByTestId("rsc-result")).toBeTruthy();
    expect(screen.getByTestId("rsc-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("rsc-card-u2-1")).toBeTruthy();
  });
});
