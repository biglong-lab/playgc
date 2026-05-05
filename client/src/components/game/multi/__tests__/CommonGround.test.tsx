import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommonGround } from "../CommonGround";

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

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

describe("CommonGround", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<CommonGround {...defaultProps} />);
    expect(screen.getByTestId("cg-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<CommonGround {...defaultProps} />);
    expect(screen.getByTestId("cg-title").textContent).toContain("共同點地圖");
    expect(screen.getByTestId("cg-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <CommonGround {...defaultProps} config={{ title: "共鳴牆", prompt: "我們有什麼共同？" }} />,
    );
    expect(screen.getByTestId("cg-title").textContent).toContain("共鳴牆");
    expect(screen.getByTestId("cg-prompt").textContent).toContain("我們有什麼共同？");
  });

  it("顯示提交數量", () => {
    render(<CommonGround {...defaultProps} />);
    expect(screen.getByTestId("cg-count").textContent).toContain("0");
  });

  it("顯示輸入欄", () => {
    render(<CommonGround {...defaultProps} />);
    expect(screen.getByTestId("cg-input")).toBeTruthy();
    expect(screen.getByTestId("cg-submit-btn")).toBeTruthy();
  });

  it("輸入欄為空時提交鈕禁用", () => {
    render(<CommonGround {...defaultProps} />);
    expect((screen.getByTestId("cg-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("填寫後提交鈕啟用", () => {
    render(<CommonGround {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cg-input"), { target: { value: "我們都喜歡學習新事物" } });
    expect((screen.getByTestId("cg-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("填寫後點擊提交", () => {
    render(<CommonGround {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cg-input"), { target: { value: "我們都喜歡學習" } });
    fireEvent.click(screen.getByTestId("cg-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].commonality).toBe("我們都喜歡學習");
  });

  it("已提交顯示我的共同點", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", commonality: "喜歡學習" }],
      revealed: false,
    };
    render(<CommonGround {...defaultProps} />);
    expect(screen.getByTestId("cg-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("cg-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<CommonGround {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("cg-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<CommonGround {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("cg-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<CommonGround {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("cg-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示共同點卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", commonality: "喜歡學習" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", commonality: "熱愛旅行" },
      ],
      revealed: true,
    };
    render(<CommonGround {...defaultProps} />);
    expect(screen.getByTestId("cg-result")).toBeTruthy();
    expect(screen.getByTestId("cg-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("cg-card-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<CommonGround {...defaultProps} />);
    expect(screen.getByTestId("cg-empty")).toBeTruthy();
  });
});
