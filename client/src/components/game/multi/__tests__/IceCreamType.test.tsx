import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IceCreamType } from "../IceCreamType";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
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
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("IceCreamType", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-loading")).toBeTruthy();
  });

  it("顯示標題", () => {
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-title").textContent).toBe("我是哪種冰淇淋");
  });

  it("顯示自定義標題", () => {
    render(<IceCreamType {...defaultProps} config={{ title: "冰淇淋派對" }} />);
    expect(screen.getByTestId("ice-title").textContent).toBe("冰淇淋派對");
  });

  it("顯示提示文字", () => {
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<IceCreamType {...defaultProps} config={{ prompt: "你最像哪種冰淇淋？" }} />);
    expect(screen.getByTestId("ice-prompt").textContent).toBe("你最像哪種冰淇淋？");
  });

  it("顯示已選擇人數", () => {
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-count").textContent).toContain("0");
  });

  it("顯示選擇表單", () => {
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-form")).toBeTruthy();
  });

  it("顯示香草選項", () => {
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-icecream-vanilla")).toBeTruthy();
  });

  it("顯示檸檬雪酪選項", () => {
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-icecream-lemon_sorbet")).toBeTruthy();
  });

  it("送出按鈕預設禁用", () => {
    render(<IceCreamType {...defaultProps} />);
    const btn = screen.getByTestId("ice-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選擇冰淇淋並輸入理由後啟用送出", () => {
    render(<IceCreamType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ice-icecream-matcha"));
    fireEvent.change(screen.getByTestId("ice-reason-input"), { target: { value: "清雅獨特回甘無窮" } });
    const btn = screen.getByTestId("ice-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("理由不足5字時禁用送出", () => {
    render(<IceCreamType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ice-icecream-mango"));
    fireEvent.change(screen.getByTestId("ice-reason-input"), { target: { value: "甜" } });
    const btn = screen.getByTestId("ice-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("送出後呼叫 updateState", () => {
    render(<IceCreamType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ice-icecream-mint_choc"));
    fireEvent.change(screen.getByTestId("ice-reason-input"), { target: { value: "清爽刺激出乎意料" } });
    fireEvent.click(screen.getByTestId("ice-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已有作答時顯示我的作答區", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", iceCream: "blueberry", reason: "低調甜酸健康滿滿" }], revealed: false };
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-my-entry")).toBeTruthy();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<IceCreamType {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ice-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<IceCreamType {...defaultProps} />);
    expect(screen.queryByTestId("ice-reveal-btn")).toBeNull();
  });

  it("揭曉後無作答顯示 ice-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-empty")).toBeTruthy();
  });

  it("揭曉後有作答顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-2", userId: "u1", userName: "Alice", iceCream: "cookies_cream", reason: "層次豐富讓人驚喜" }],
      revealed: true,
    };
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-result")).toBeTruthy();
  });

  it("結果區顯示冰淇淋 badge", () => {
    mockState = {
      entries: [{ entryId: "u1-3", userId: "u1", userName: "Alice", iceCream: "chocolate", reason: "濃郁深沉讓人著迷" }],
      revealed: true,
    };
    render(<IceCreamType {...defaultProps} />);
    expect(screen.getByTestId("ice-badge-chocolate")).toBeTruthy();
  });
});
