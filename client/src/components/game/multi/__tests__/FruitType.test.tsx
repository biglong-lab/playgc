import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FruitType } from "../FruitType";

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

describe("FruitType", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-loading")).toBeTruthy();
  });

  it("顯示標題", () => {
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-title").textContent).toBe("我是哪種水果");
  });

  it("顯示自定義標題", () => {
    render(<FruitType {...defaultProps} config={{ title: "水果派對" }} />);
    expect(screen.getByTestId("frt-title").textContent).toBe("水果派對");
  });

  it("顯示提示文字", () => {
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<FruitType {...defaultProps} config={{ prompt: "你最像哪種水果？" }} />);
    expect(screen.getByTestId("frt-prompt").textContent).toBe("你最像哪種水果？");
  });

  it("顯示已選擇人數", () => {
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-count").textContent).toContain("0");
  });

  it("顯示選擇表單", () => {
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-form")).toBeTruthy();
  });

  it("顯示蘋果選項", () => {
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-fruit-apple")).toBeTruthy();
  });

  it("顯示藍莓選項", () => {
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-fruit-blueberry")).toBeTruthy();
  });

  it("送出按鈕預設禁用", () => {
    render(<FruitType {...defaultProps} />);
    const btn = screen.getByTestId("frt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選擇水果並輸入理由後啟用送出", () => {
    render(<FruitType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("frt-fruit-mango"));
    fireEvent.change(screen.getByTestId("frt-reason-input"), { target: { value: "熱情甜蜜充滿魅力" } });
    const btn = screen.getByTestId("frt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("理由不足5字時禁用送出", () => {
    render(<FruitType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("frt-fruit-lemon"));
    fireEvent.change(screen.getByTestId("frt-reason-input"), { target: { value: "酸" } });
    const btn = screen.getByTestId("frt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("送出後呼叫 updateState", () => {
    render(<FruitType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("frt-fruit-watermelon"));
    fireEvent.change(screen.getByTestId("frt-reason-input"), { target: { value: "豪爽大方活力十足" } });
    fireEvent.click(screen.getByTestId("frt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已有作答時顯示我的作答區", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", fruit: "grape", reason: "細膩豐富層次感強" }], revealed: false };
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-my-entry")).toBeTruthy();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<FruitType {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("frt-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<FruitType {...defaultProps} />);
    expect(screen.queryByTestId("frt-reveal-btn")).toBeNull();
  });

  it("揭曉後無作答顯示 frt-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-empty")).toBeTruthy();
  });

  it("揭曉後有作答顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-2", userId: "u1", userName: "Alice", fruit: "peach", reason: "溫柔甜美圓潤飽滿" }],
      revealed: true,
    };
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-result")).toBeTruthy();
  });

  it("結果區顯示水果 badge", () => {
    mockState = {
      entries: [{ entryId: "u1-3", userId: "u1", userName: "Alice", fruit: "strawberry", reason: "嬌豔可愛令人喜愛" }],
      revealed: true,
    };
    render(<FruitType {...defaultProps} />);
    expect(screen.getByTestId("frt-badge-strawberry")).toBeTruthy();
  });
});
