import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeroJourney } from "../HeroJourney";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
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
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("HeroJourney", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<HeroJourney {...defaultProps} />);
    expect(screen.getByTestId("hjr-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<HeroJourney {...defaultProps} />);
    expect(screen.getByTestId("hjr-title").textContent).toBe("英雄旅程卡");
  });

  it("顯示自定義標題", () => {
    render(<HeroJourney {...defaultProps} config={{ title: "我的旅程" }} />);
    expect(screen.getByTestId("hjr-title").textContent).toBe("我的旅程");
  });

  it("顯示提示文字", () => {
    render(<HeroJourney {...defaultProps} />);
    expect(screen.getByTestId("hjr-prompt")).toBeTruthy();
  });

  it("顯示已分享人數", () => {
    render(<HeroJourney {...defaultProps} />);
    expect(screen.getByTestId("hjr-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<HeroJourney {...defaultProps} />);
    expect(screen.getByTestId("hjr-form")).toBeTruthy();
  });

  it("顯示 6 個旅程階段", () => {
    render(<HeroJourney {...defaultProps} />);
    expect(screen.getByTestId("hjr-stage-grid")).toBeTruthy();
    expect(screen.getByTestId("hjr-stage-ordinary")).toBeTruthy();
    expect(screen.getByTestId("hjr-stage-call")).toBeTruthy();
    expect(screen.getByTestId("hjr-stage-refusal")).toBeTruthy();
    expect(screen.getByTestId("hjr-stage-departure")).toBeTruthy();
    expect(screen.getByTestId("hjr-stage-challenge")).toBeTruthy();
    expect(screen.getByTestId("hjr-stage-return")).toBeTruthy();
  });

  it("顯示感想輸入框", () => {
    render(<HeroJourney {...defaultProps} />);
    expect(screen.getByTestId("hjr-reflection-input")).toBeTruthy();
  });

  it("未填感想時提交按鈕禁用", () => {
    render(<HeroJourney {...defaultProps} />);
    expect((screen.getByTestId("hjr-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<HeroJourney {...defaultProps} />);
    fireEvent.change(screen.getByTestId("hjr-reflection-input"), { target: { value: "感覺" } });
    expect((screen.getByTestId("hjr-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<HeroJourney {...defaultProps} />);
    fireEvent.change(screen.getByTestId("hjr-reflection-input"), { target: { value: "感覺正在成長中" } });
    expect((screen.getByTestId("hjr-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換旅程階段", () => {
    render(<HeroJourney {...defaultProps} />);
    fireEvent.click(screen.getByTestId("hjr-stage-return"));
    expect(screen.getByTestId("hjr-stage-return").className).toContain("purple-100");
  });

  it("提交後呼叫 updateState 含 stage 和 reflection", () => {
    render(<HeroJourney {...defaultProps} />);
    fireEvent.click(screen.getByTestId("hjr-stage-departure"));
    fireEvent.change(screen.getByTestId("hjr-reflection-input"), { target: { value: "我決定勇敢踏出第一步" } });
    fireEvent.click(screen.getByTestId("hjr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; stage: string; reflection: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].stage).toBe("departure");
    expect(s.entries[0].reflection).toBe("我決定勇敢踏出第一步");
  });

  it("已提交後顯示我的旅程", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", stage: "challenge", reflection: "正在面對最大的挑戰" }], revealed: false };
    render(<HeroJourney {...defaultProps} />);
    expect(screen.getByTestId("hjr-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", stage: "challenge", reflection: "正在面對最大的挑戰" }], revealed: false };
    render(<HeroJourney {...defaultProps} />);
    expect(screen.queryByTestId("hjr-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<HeroJourney {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("hjr-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<HeroJourney {...defaultProps} />);
    expect(screen.queryByTestId("hjr-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 hjr-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<HeroJourney {...defaultProps} />);
    expect(screen.getByTestId("hjr-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有旅程", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", stage: "return", reflection: "帶著滿滿收穫回來了" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", stage: "call", reflection: "感受到改變的訊號了" },
      ],
      revealed: true,
    };
    render(<HeroJourney {...defaultProps} />);
    expect(screen.getByTestId("hjr-result")).toBeTruthy();
    expect(screen.getByTestId("hjr-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("hjr-card-u2-1")).toBeTruthy();
  });
});
