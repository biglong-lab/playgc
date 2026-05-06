import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnchorPoint } from "../AnchorPoint";

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

describe("AnchorPoint", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.getByTestId("anp-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.getByTestId("anp-title").textContent).toBe("我的錨點");
  });

  it("顯示自定義標題", () => {
    render(<AnchorPoint {...defaultProps} config={{ title: "核心支柱" }} />);
    expect(screen.getByTestId("anp-title").textContent).toBe("核心支柱");
  });

  it("顯示預設提示", () => {
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.getByTestId("anp-prompt")).toBeTruthy();
  });

  it("顯示自定義提示", () => {
    render(<AnchorPoint {...defaultProps} config={{ prompt: "你最重要的價值觀是什麼？" }} />);
    expect(screen.getByTestId("anp-prompt").textContent).toBe("你最重要的價值觀是什麼？");
  });

  it("顯示已分享人數", () => {
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.getByTestId("anp-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.getByTestId("anp-form")).toBeTruthy();
  });

  it("顯示文字輸入框", () => {
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.getByTestId("anp-anchor-input")).toBeTruthy();
  });

  it("未填寫時提交按鈕禁用", () => {
    render(<AnchorPoint {...defaultProps} />);
    const btn = screen.getByTestId("anp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("少於 4 字時仍禁用", () => {
    render(<AnchorPoint {...defaultProps} />);
    fireEvent.change(screen.getByTestId("anp-anchor-input"), { target: { value: "誠" } });
    const btn = screen.getByTestId("anp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("4 字以上啟用提交按鈕", () => {
    render(<AnchorPoint {...defaultProps} />);
    fireEvent.change(screen.getByTestId("anp-anchor-input"), { target: { value: "誠信待人" } });
    const btn = screen.getByTestId("anp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 userId 和 anchor", () => {
    render(<AnchorPoint {...defaultProps} />);
    fireEvent.change(screen.getByTestId("anp-anchor-input"), { target: { value: "保持好奇心" } });
    fireEvent.click(screen.getByTestId("anp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ userId: string; anchor: string }>;
    };
    expect(newState.entries[0].userId).toBe("u1");
    expect(newState.entries[0].anchor).toBe("保持好奇心");
  });

  it("已提交後顯示我的錨點", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", anchor: "誠信待人" }],
      revealed: false,
    };
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.getByTestId("anp-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", anchor: "誠信待人" }],
      revealed: false,
    };
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.queryByTestId("anp-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<AnchorPoint {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("anp-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.queryByTestId("anp-reveal-btn")).toBeNull();
  });

  it("揭曉後無錨點顯示 anp-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.getByTestId("anp-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊錨點", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", anchor: "誠信" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", anchor: "勇敢面對" },
      ],
      revealed: true,
    };
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.getByTestId("anp-result")).toBeTruthy();
  });

  it("揭曉後顯示各錨點卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", anchor: "誠信" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", anchor: "勇敢面對" },
      ],
      revealed: true,
    };
    render(<AnchorPoint {...defaultProps} />);
    expect(screen.getByTestId("anp-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("anp-card-u2-1")).toBeTruthy();
  });
});
