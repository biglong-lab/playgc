import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FourLs } from "../FourLs";

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

describe("FourLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<FourLs {...defaultProps} />);
    expect(screen.getByTestId("fl-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<FourLs {...defaultProps} />);
    expect(screen.getByTestId("fl-title").textContent).toContain("四 L 覆盤");
    expect(screen.getByTestId("fl-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(<FourLs {...defaultProps} config={{ title: "4L 回顧", prompt: "請反思" }} />);
    expect(screen.getByTestId("fl-title").textContent).toContain("4L 回顧");
    expect(screen.getByTestId("fl-prompt").textContent).toContain("請反思");
  });

  it("顯示提交數量", () => {
    render(<FourLs {...defaultProps} />);
    expect(screen.getByTestId("fl-count").textContent).toContain("0");
  });

  it("顯示四個輸入欄", () => {
    render(<FourLs {...defaultProps} />);
    expect(screen.getByTestId("fl-liked-input")).toBeTruthy();
    expect(screen.getByTestId("fl-learned-input")).toBeTruthy();
    expect(screen.getByTestId("fl-lacked-input")).toBeTruthy();
    expect(screen.getByTestId("fl-longed-input")).toBeTruthy();
    expect(screen.getByTestId("fl-submit-btn")).toBeTruthy();
  });

  it("四欄皆空時提交鈕禁用", () => {
    render(<FourLs {...defaultProps} />);
    expect((screen.getByTestId("fl-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("只填一欄也可提交（OR 邏輯）", () => {
    render(<FourLs {...defaultProps} />);
    fireEvent.change(screen.getByTestId("fl-liked-input"), { target: { value: "團隊氣氛好" } });
    expect((screen.getByTestId("fl-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("填寫後提交", () => {
    render(<FourLs {...defaultProps} />);
    fireEvent.change(screen.getByTestId("fl-liked-input"), { target: { value: "協作良好" } });
    fireEvent.change(screen.getByTestId("fl-learned-input"), { target: { value: "學到新技術" } });
    fireEvent.click(screen.getByTestId("fl-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].liked).toBe("協作良好");
    expect(arg.entries[0].learned).toBe("學到新技術");
  });

  it("已提交顯示我的覆盤", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", liked: "好", learned: "技術", lacked: "", longed: "" }],
      revealed: false,
    };
    render(<FourLs {...defaultProps} />);
    expect(screen.getByTestId("fl-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("fl-liked-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<FourLs {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("fl-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<FourLs {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("fl-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<FourLs {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("fl-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示四欄", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", liked: "好", learned: "技術", lacked: "時間", longed: "更多資源" },
      ],
      revealed: true,
    };
    render(<FourLs {...defaultProps} />);
    expect(screen.getByTestId("fl-result")).toBeTruthy();
    expect(screen.getByTestId("fl-col-liked")).toBeTruthy();
    expect(screen.getByTestId("fl-col-learned")).toBeTruthy();
    expect(screen.getByTestId("fl-col-lacked")).toBeTruthy();
    expect(screen.getByTestId("fl-col-longed")).toBeTruthy();
  });

  it("revealed=true 顯示各欄 item", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", liked: "好", learned: "技術", lacked: "時間", longed: "資源" },
      ],
      revealed: true,
    };
    render(<FourLs {...defaultProps} />);
    expect(screen.getByTestId("fl-item-u1-1-liked")).toBeTruthy();
    expect(screen.getByTestId("fl-item-u1-1-learned")).toBeTruthy();
  });
});
