import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MicroCommit } from "../MicroCommit";

let mockState: Record<string, unknown> = { commits: [], revealed: false };
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
  mockState = { commits: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("MicroCommit", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<MicroCommit {...defaultProps} />);
    expect(screen.getByTestId("mco-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<MicroCommit {...defaultProps} />);
    expect(screen.getByTestId("mco-title").textContent).toBe("微型承諾");
  });

  it("顯示自定義標題", () => {
    render(<MicroCommit {...defaultProps} config={{ title: "今日行動" }} />);
    expect(screen.getByTestId("mco-title").textContent).toBe("今日行動");
  });

  it("顯示提示文字", () => {
    render(<MicroCommit {...defaultProps} />);
    expect(screen.getByTestId("mco-prompt")).toBeTruthy();
  });

  it("顯示自定義提示", () => {
    render(<MicroCommit {...defaultProps} config={{ prompt: "你今天要做什麼？" }} />);
    expect(screen.getByTestId("mco-prompt").textContent).toBe("你今天要做什麼？");
  });

  it("顯示已承諾人數", () => {
    render(<MicroCommit {...defaultProps} />);
    expect(screen.getByTestId("mco-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<MicroCommit {...defaultProps} />);
    expect(screen.getByTestId("mco-form")).toBeTruthy();
  });

  it("顯示輸入框", () => {
    render(<MicroCommit {...defaultProps} />);
    expect(screen.getByTestId("mco-commit-input")).toBeTruthy();
  });

  it("未填寫時提交按鈕禁用", () => {
    render(<MicroCommit {...defaultProps} />);
    expect((screen.getByTestId("mco-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 3 字時仍禁用", () => {
    render(<MicroCommit {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mco-commit-input"), { target: { value: "跑" } });
    expect((screen.getByTestId("mco-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("3 字以上啟用提交按鈕", () => {
    render(<MicroCommit {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mco-commit-input"), { target: { value: "每天運動" } });
    expect((screen.getByTestId("mco-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 commitment", () => {
    render(<MicroCommit {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mco-commit-input"), { target: { value: "明天聯繫一位夥伴" } });
    fireEvent.click(screen.getByTestId("mco-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { commits: Array<{ userId: string; commitment: string }> };
    expect(s.commits[0].userId).toBe("u1");
    expect(s.commits[0].commitment).toBe("明天聯繫一位夥伴");
  });

  it("已提交後顯示我的承諾", () => {
    mockState = { commits: [{ entryId: "u1-1", userId: "u1", userName: "Alice", commitment: "每天讀書" }], revealed: false };
    render(<MicroCommit {...defaultProps} />);
    expect(screen.getByTestId("mco-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { commits: [{ entryId: "u1-1", userId: "u1", userName: "Alice", commitment: "每天讀書" }], revealed: false };
    render(<MicroCommit {...defaultProps} />);
    expect(screen.queryByTestId("mco-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<MicroCommit {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("mco-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<MicroCommit {...defaultProps} />);
    expect(screen.queryByTestId("mco-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 mco-empty", () => {
    mockState = { commits: [], revealed: true };
    render(<MicroCommit {...defaultProps} />);
    expect(screen.getByTestId("mco-empty")).toBeTruthy();
  });

  it("揭曉後顯示承諾牆", () => {
    mockState = {
      commits: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", commitment: "每天讀書" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", commitment: "定期運動" },
      ],
      revealed: true,
    };
    render(<MicroCommit {...defaultProps} />);
    expect(screen.getByTestId("mco-result")).toBeTruthy();
    expect(screen.getByTestId("mco-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mco-card-u2-1")).toBeTruthy();
  });
});
