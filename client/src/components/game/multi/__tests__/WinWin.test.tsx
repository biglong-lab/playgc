import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WinWin } from "../WinWin";

let mockIsLoaded = true;
const mockUpdateState = vi.fn();
let mockState = { entries: [], revealed: false };

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

const defaultProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
};

describe("WinWin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<WinWin {...defaultProps} />);
    expect(screen.getByTestId("ww-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<WinWin {...defaultProps} />);
    expect(screen.getByTestId("ww-title").textContent).toContain("雙贏回顧");
    expect(screen.getByTestId("ww-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <WinWin
        {...defaultProps}
        config={{ title: "收穫清單", prompt: "今天你贏了什麼？", teamWinLabel: "團隊贏", myWinLabel: "個人贏" }}
      />,
    );
    expect(screen.getByTestId("ww-title").textContent).toContain("收穫清單");
    expect(screen.getByTestId("ww-prompt").textContent).toContain("今天你贏了什麼？");
  });

  it("顯示提交數量", () => {
    render(<WinWin {...defaultProps} />);
    expect(screen.getByTestId("ww-count").textContent).toContain("0");
  });

  it("顯示兩個輸入欄", () => {
    render(<WinWin {...defaultProps} />);
    expect(screen.getByTestId("ww-team-win-input")).toBeTruthy();
    expect(screen.getByTestId("ww-my-win-input")).toBeTruthy();
    expect(screen.getByTestId("ww-submit-btn")).toBeTruthy();
  });

  it("兩欄皆空時提交鈕禁用", () => {
    render(<WinWin {...defaultProps} />);
    const btn = screen.getByTestId("ww-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填 teamWin 可提交", () => {
    render(<WinWin {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ww-team-win-input"), { target: { value: "完成 MVP" } });
    const btn = screen.getByTestId("ww-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState", () => {
    render(<WinWin {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ww-team-win-input"), { target: { value: "完成目標" } });
    fireEvent.change(screen.getByTestId("ww-my-win-input"), { target: { value: "技能提升" } });
    fireEvent.click(screen.getByTestId("ww-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].teamWin).toBe("完成目標");
    expect(arg.entries[0].myWin).toBe("技能提升");
  });

  it("已提交顯示我的回應", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", teamWin: "合作共贏", myWin: "信心增加" }],
      revealed: false,
    };
    render(<WinWin {...defaultProps} />);
    expect(screen.getByTestId("ww-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("ww-team-win-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<WinWin {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ww-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<WinWin {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ww-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<WinWin {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ww-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示兩個欄位分區", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", teamWin: "合作效率", myWin: "簡報技巧" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", teamWin: "達成共識", myWin: "" },
      ],
      revealed: true,
    };
    render(<WinWin {...defaultProps} />);
    expect(screen.getByTestId("ww-result")).toBeTruthy();
    expect(screen.getByTestId("ww-col-team")).toBeTruthy();
    expect(screen.getByTestId("ww-col-my")).toBeTruthy();
  });
});
