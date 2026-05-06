import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PartyMenu } from "../PartyMenu";

let mockState: Record<string, unknown> = { items: [], revealed: false };
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
  mockState = { items: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("PartyMenu", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-title").textContent).toBe("派對菜單");
  });

  it("顯示自定義標題", () => {
    render(<PartyMenu {...defaultProps} config={{ title: "聚餐菜單" }} />);
    expect(screen.getByTestId("pmn-title").textContent).toBe("聚餐菜單");
  });

  it("顯示預設提示文字", () => {
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<PartyMenu {...defaultProps} config={{ prompt: "你想吃什麼？" }} />);
    expect(screen.getByTestId("pmn-prompt").textContent).toBe("你想吃什麼？");
  });

  it("顯示已點菜人數", () => {
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-form")).toBeTruthy();
  });

  it("顯示 Emoji 選擇格", () => {
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-emoji-grid")).toBeTruthy();
  });

  it("顯示料理名稱輸入框", () => {
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-dish-input")).toBeTruthy();
  });

  it("未填料理名稱時提交按鈕禁用", () => {
    render(<PartyMenu {...defaultProps} />);
    const btn = screen.getByTestId("pmn-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("料理名稱不足 3 字時仍禁用", () => {
    render(<PartyMenu {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pmn-dish-input"), { target: { value: "披" } });
    const btn = screen.getByTestId("pmn-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("料理名稱 3 字以上啟用提交按鈕", () => {
    render(<PartyMenu {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pmn-dish-input"), { target: { value: "披薩" } });
    const btn = screen.getByTestId("pmn-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("pmn-dish-input"), { target: { value: "義大利麵" } });
    const btn2 = screen.getByTestId("pmn-submit-btn") as HTMLButtonElement;
    expect(btn2.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 userId 和 dish", () => {
    render(<PartyMenu {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pmn-dish-input"), { target: { value: "起司披薩" } });
    fireEvent.click(screen.getByTestId("pmn-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      items: Array<{ userId: string; dish: string; emoji: string }>;
    };
    expect(newState.items[0].userId).toBe("u1");
    expect(newState.items[0].dish).toBe("起司披薩");
    expect(newState.items[0].emoji).toBeTruthy();
  });

  it("點選不同 emoji 後 submit 帶入正確 emoji", () => {
    render(<PartyMenu {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pmn-emoji-🍣"));
    fireEvent.change(screen.getByTestId("pmn-dish-input"), { target: { value: "新鮮鮭魚" } });
    fireEvent.click(screen.getByTestId("pmn-submit-btn"));
    const newState = mockUpdateState.mock.calls[0][0] as {
      items: Array<{ emoji: string }>;
    };
    expect(newState.items[0].emoji).toBe("🍣");
  });

  it("已提交後顯示我的料理卡", () => {
    mockState = {
      items: [{ entryId: "u1-1", userId: "u1", userName: "Alice", emoji: "🍕", dish: "起司披薩" }],
      revealed: false,
    };
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-my-item")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = {
      items: [{ entryId: "u1-1", userId: "u1", userName: "Alice", emoji: "🍕", dish: "起司披薩" }],
      revealed: false,
    };
    render(<PartyMenu {...defaultProps} />);
    expect(screen.queryByTestId("pmn-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<PartyMenu {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("pmn-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<PartyMenu {...defaultProps} />);
    expect(screen.queryByTestId("pmn-reveal-btn")).toBeNull();
  });

  it("揭曉後無料理顯示 pmn-empty", () => {
    mockState = { items: [], revealed: true };
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-empty")).toBeTruthy();
  });

  it("揭曉後顯示菜單牆", () => {
    mockState = {
      items: [{ entryId: "u1-1", userId: "u1", userName: "Alice", emoji: "🍕", dish: "起司披薩" }],
      revealed: true,
    };
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-result")).toBeTruthy();
  });

  it("菜單牆顯示各料理卡片", () => {
    mockState = {
      items: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", emoji: "🍕", dish: "起司披薩" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", emoji: "🍣", dish: "鮭魚壽司" },
      ],
      revealed: true,
    };
    render(<PartyMenu {...defaultProps} />);
    expect(screen.getByTestId("pmn-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("pmn-card-u2-1")).toBeTruthy();
  });
});
