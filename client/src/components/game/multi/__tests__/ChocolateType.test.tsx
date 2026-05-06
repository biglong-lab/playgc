import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChocolateType } from "../ChocolateType";

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

describe("ChocolateType", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-loading")).toBeTruthy();
  });

  it("顯示標題", () => {
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-title").textContent).toBe("我是哪種巧克力");
  });

  it("顯示自定義標題", () => {
    render(<ChocolateType {...defaultProps} config={{ title: "巧克力派對" }} />);
    expect(screen.getByTestId("chc-title").textContent).toBe("巧克力派對");
  });

  it("顯示提示文字", () => {
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<ChocolateType {...defaultProps} config={{ prompt: "你最像哪種巧克力？" }} />);
    expect(screen.getByTestId("chc-prompt").textContent).toBe("你最像哪種巧克力？");
  });

  it("顯示已選擇人數", () => {
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-count").textContent).toContain("0");
  });

  it("顯示選擇表單", () => {
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-form")).toBeTruthy();
  });

  it("顯示黑巧克力選項", () => {
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-chocolate-dark")).toBeTruthy();
  });

  it("顯示松露巧克力選項", () => {
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-chocolate-truffle")).toBeTruthy();
  });

  it("送出按鈕預設禁用", () => {
    render(<ChocolateType {...defaultProps} />);
    const btn = screen.getByTestId("chc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選擇巧克力並輸入理由後啟用送出", () => {
    render(<ChocolateType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("chc-chocolate-matcha"));
    fireEvent.change(screen.getByTestId("chc-reason-input"), { target: { value: "清新獨特東方風情" } });
    const btn = screen.getByTestId("chc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("理由不足5字時禁用送出", () => {
    render(<ChocolateType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("chc-chocolate-milk"));
    fireEvent.change(screen.getByTestId("chc-reason-input"), { target: { value: "甜" } });
    const btn = screen.getByTestId("chc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("送出後呼叫 updateState", () => {
    render(<ChocolateType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("chc-chocolate-caramel"));
    fireEvent.change(screen.getByTestId("chc-reason-input"), { target: { value: "甜蜜複雜越品越香" } });
    fireEvent.click(screen.getByTestId("chc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已有作答時顯示我的作答區", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", chocolate: "raspberry", reason: "酸甜衝突個性鮮明" }], revealed: false };
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-my-entry")).toBeTruthy();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<ChocolateType {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("chc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<ChocolateType {...defaultProps} />);
    expect(screen.queryByTestId("chc-reveal-btn")).toBeNull();
  });

  it("揭曉後無作答顯示 chc-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-empty")).toBeTruthy();
  });

  it("揭曉後有作答顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-2", userId: "u1", userName: "Alice", chocolate: "white", reason: "純粹柔和溫暖包容" }],
      revealed: true,
    };
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-result")).toBeTruthy();
  });

  it("結果區顯示巧克力 badge", () => {
    mockState = {
      entries: [{ entryId: "u1-3", userId: "u1", userName: "Alice", chocolate: "hazelnut", reason: "紮實濃郁口感豐富" }],
      revealed: true,
    };
    render(<ChocolateType {...defaultProps} />);
    expect(screen.getByTestId("chc-badge-hazelnut")).toBeTruthy();
  });
});
