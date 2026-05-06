import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MagicWand } from "../MagicWand";

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

describe("MagicWand", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<MagicWand {...defaultProps} />);
    expect(screen.getByTestId("mgw-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<MagicWand {...defaultProps} />);
    expect(screen.getByTestId("mgw-title").textContent).toBe("魔法棒許願");
  });

  it("顯示自定義標題", () => {
    render(<MagicWand {...defaultProps} config={{ title: "神奇許願" }} />);
    expect(screen.getByTestId("mgw-title").textContent).toBe("神奇許願");
  });

  it("顯示提示文字", () => {
    render(<MagicWand {...defaultProps} />);
    expect(screen.getByTestId("mgw-prompt")).toBeTruthy();
  });

  it("顯示已許願人數", () => {
    render(<MagicWand {...defaultProps} />);
    expect(screen.getByTestId("mgw-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<MagicWand {...defaultProps} />);
    expect(screen.getByTestId("mgw-form")).toBeTruthy();
  });

  it("顯示 5 個許願領域", () => {
    render(<MagicWand {...defaultProps} />);
    expect(screen.getByTestId("mgw-domain-grid")).toBeTruthy();
    expect(screen.getByTestId("mgw-domain-team")).toBeTruthy();
    expect(screen.getByTestId("mgw-domain-process")).toBeTruthy();
    expect(screen.getByTestId("mgw-domain-culture")).toBeTruthy();
    expect(screen.getByTestId("mgw-domain-tools")).toBeTruthy();
    expect(screen.getByTestId("mgw-domain-other")).toBeTruthy();
  });

  it("顯示願望輸入框", () => {
    render(<MagicWand {...defaultProps} />);
    expect(screen.getByTestId("mgw-wish-input")).toBeTruthy();
  });

  it("未填願望時提交按鈕禁用", () => {
    render(<MagicWand {...defaultProps} />);
    expect((screen.getByTestId("mgw-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<MagicWand {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mgw-wish-input"), { target: { value: "變好" } });
    expect((screen.getByTestId("mgw-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<MagicWand {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mgw-wish-input"), { target: { value: "讓團隊更有默契" } });
    expect((screen.getByTestId("mgw-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換許願領域", () => {
    render(<MagicWand {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mgw-domain-culture"));
    expect(screen.getByTestId("mgw-domain-culture").className).toContain("yellow-100");
  });

  it("提交後呼叫 updateState 含 domain 和 wish", () => {
    render(<MagicWand {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mgw-domain-process"));
    fireEvent.change(screen.getByTestId("mgw-wish-input"), { target: { value: "讓會議更有效率省時間" } });
    fireEvent.click(screen.getByTestId("mgw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; domain: string; wish: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].domain).toBe("process");
    expect(s.entries[0].wish).toBe("讓會議更有效率省時間");
  });

  it("已提交後顯示我的願望", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", domain: "team", wish: "希望大家更有凝聚力" }], revealed: false };
    render(<MagicWand {...defaultProps} />);
    expect(screen.getByTestId("mgw-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", domain: "team", wish: "希望大家更有凝聚力" }], revealed: false };
    render(<MagicWand {...defaultProps} />);
    expect(screen.queryByTestId("mgw-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<MagicWand {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("mgw-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<MagicWand {...defaultProps} />);
    expect(screen.queryByTestId("mgw-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 mgw-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MagicWand {...defaultProps} />);
    expect(screen.getByTestId("mgw-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有願望", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", domain: "culture", wish: "建立更開放的回饋文化" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", domain: "tools", wish: "引進更好的協作工具" },
      ],
      revealed: true,
    };
    render(<MagicWand {...defaultProps} />);
    expect(screen.getByTestId("mgw-result")).toBeTruthy();
    expect(screen.getByTestId("mgw-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mgw-card-u2-1")).toBeTruthy();
  });
});
