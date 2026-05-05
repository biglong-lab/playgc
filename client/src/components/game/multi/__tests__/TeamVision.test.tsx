import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamVision } from "../TeamVision";

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

describe("TeamVision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TeamVision {...defaultProps} />);
    expect(screen.getByTestId("tv-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<TeamVision {...defaultProps} />);
    expect(screen.getByTestId("tv-title").textContent).toContain("團隊願景牆");
    expect(screen.getByTestId("tv-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(<TeamVision {...defaultProps} config={{ title: "願景共創", prompt: "你的關鍵詞是？" }} />);
    expect(screen.getByTestId("tv-title").textContent).toContain("願景共創");
    expect(screen.getByTestId("tv-prompt").textContent).toContain("你的關鍵詞是？");
  });

  it("顯示提交數量", () => {
    render(<TeamVision {...defaultProps} />);
    expect(screen.getByTestId("tv-count").textContent).toContain("0");
  });

  it("顯示輸入欄", () => {
    render(<TeamVision {...defaultProps} />);
    expect(screen.getByTestId("tv-input")).toBeTruthy();
    expect(screen.getByTestId("tv-submit-btn")).toBeTruthy();
  });

  it("輸入欄空時提交鈕禁用", () => {
    render(<TeamVision {...defaultProps} />);
    expect((screen.getByTestId("tv-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("填寫後提交鈕啟用", () => {
    render(<TeamVision {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tv-input"), { target: { value: "創新" } });
    expect((screen.getByTestId("tv-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交呼叫 updateState 帶正確 word", () => {
    render(<TeamVision {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tv-input"), { target: { value: "卓越" } });
    fireEvent.click(screen.getByTestId("tv-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].word).toBe("卓越");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", word: "創新" }],
      revealed: false,
    };
    render(<TeamVision {...defaultProps} />);
    expect(screen.getByTestId("tv-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("tv-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<TeamVision {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("tv-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<TeamVision {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("tv-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<TeamVision {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("tv-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示詞語牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", word: "創新" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", word: "協作" },
      ],
      revealed: true,
    };
    render(<TeamVision {...defaultProps} />);
    expect(screen.getByTestId("tv-result")).toBeTruthy();
    expect(screen.getByTestId("tv-word-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tv-word-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<TeamVision {...defaultProps} />);
    expect(screen.getByTestId("tv-empty")).toBeTruthy();
  });
});
