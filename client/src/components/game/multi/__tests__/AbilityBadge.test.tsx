import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AbilityBadge } from "../AbilityBadge";

let mockState: Record<string, unknown> = { badges: [], revealed: false };
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
  mockState = { badges: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("AbilityBadge", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.getByTestId("abg-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.getByTestId("abg-title").textContent).toBe("能力徽章");
  });

  it("顯示自定義標題", () => {
    render(<AbilityBadge {...defaultProps} config={{ title: "今日能力" }} />);
    expect(screen.getByTestId("abg-title").textContent).toBe("今日能力");
  });

  it("顯示提示文字", () => {
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.getByTestId("abg-prompt")).toBeTruthy();
  });

  it("顯示已獲徽章人數", () => {
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.getByTestId("abg-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.getByTestId("abg-form")).toBeTruthy();
  });

  it("顯示徽章選項格", () => {
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.getByTestId("abg-badge-grid")).toBeTruthy();
    expect(screen.getByTestId("abg-badge-creativity")).toBeTruthy();
    expect(screen.getByTestId("abg-badge-courage")).toBeTruthy();
    expect(screen.getByTestId("abg-badge-collaboration")).toBeTruthy();
    expect(screen.getByTestId("abg-badge-communication")).toBeTruthy();
    expect(screen.getByTestId("abg-badge-persistence")).toBeTruthy();
  });

  it("顯示說明輸入框", () => {
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.getByTestId("abg-evidence-input")).toBeTruthy();
  });

  it("未填說明時提交按鈕禁用", () => {
    render(<AbilityBadge {...defaultProps} />);
    expect((screen.getByTestId("abg-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 3 字時仍禁用", () => {
    render(<AbilityBadge {...defaultProps} />);
    fireEvent.change(screen.getByTestId("abg-evidence-input"), { target: { value: "好" } });
    expect((screen.getByTestId("abg-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("3 字以上啟用提交按鈕", () => {
    render(<AbilityBadge {...defaultProps} />);
    fireEvent.change(screen.getByTestId("abg-evidence-input"), { target: { value: "主動帶領討論" } });
    expect((screen.getByTestId("abg-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換徽章類型", () => {
    render(<AbilityBadge {...defaultProps} />);
    fireEvent.click(screen.getByTestId("abg-badge-persistence"));
    expect(screen.getByTestId("abg-badge-persistence").className).toContain("indigo-200");
  });

  it("提交後呼叫 updateState 含 badgeType 和 evidence", () => {
    render(<AbilityBadge {...defaultProps} />);
    fireEvent.click(screen.getByTestId("abg-badge-courage"));
    fireEvent.change(screen.getByTestId("abg-evidence-input"), { target: { value: "勇敢發言分享意見" } });
    fireEvent.click(screen.getByTestId("abg-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { badges: Array<{ userId: string; badgeType: string; evidence: string }> };
    expect(s.badges[0].userId).toBe("u1");
    expect(s.badges[0].badgeType).toBe("courage");
    expect(s.badges[0].evidence).toBe("勇敢發言分享意見");
  });

  it("已提交後顯示我的徽章", () => {
    mockState = { badges: [{ entryId: "u1-1", userId: "u1", userName: "Alice", badgeType: "creativity", evidence: "提出創意解決方案" }], revealed: false };
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.getByTestId("abg-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { badges: [{ entryId: "u1-1", userId: "u1", userName: "Alice", badgeType: "creativity", evidence: "提出創意解決方案" }], revealed: false };
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.queryByTestId("abg-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<AbilityBadge {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("abg-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.queryByTestId("abg-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 abg-empty", () => {
    mockState = { badges: [], revealed: true };
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.getByTestId("abg-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊徽章牆", () => {
    mockState = {
      badges: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", badgeType: "creativity", evidence: "設計新方案" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", badgeType: "collaboration", evidence: "幫助隊友" },
      ],
      revealed: true,
    };
    render(<AbilityBadge {...defaultProps} />);
    expect(screen.getByTestId("abg-result")).toBeTruthy();
    expect(screen.getByTestId("abg-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("abg-card-u2-1")).toBeTruthy();
  });
});
