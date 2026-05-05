import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThoughtBubble } from "../ThoughtBubble";

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

describe("ThoughtBubble", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ThoughtBubble {...defaultProps} />);
    expect(screen.getByTestId("tb-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<ThoughtBubble {...defaultProps} />);
    expect(screen.getByTestId("tb-title").textContent).toContain("思緒泡泡");
    expect(screen.getByTestId("tb-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(<ThoughtBubble {...defaultProps} config={{ title: "心聲時間", prompt: "說出你的心聲" }} />);
    expect(screen.getByTestId("tb-title").textContent).toContain("心聲時間");
    expect(screen.getByTestId("tb-prompt").textContent).toContain("說出你的心聲");
  });

  it("顯示提交數量", () => {
    render(<ThoughtBubble {...defaultProps} />);
    expect(screen.getByTestId("tb-count").textContent).toContain("0");
  });

  it("顯示輸入欄", () => {
    render(<ThoughtBubble {...defaultProps} />);
    expect(screen.getByTestId("tb-input")).toBeTruthy();
    expect(screen.getByTestId("tb-submit-btn")).toBeTruthy();
  });

  it("輸入欄為空時提交鈕禁用", () => {
    render(<ThoughtBubble {...defaultProps} />);
    expect((screen.getByTestId("tb-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("填寫後提交鈕啟用", () => {
    render(<ThoughtBubble {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tb-input"), { target: { value: "今天天氣真好" } });
    expect((screen.getByTestId("tb-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("點擊提交呼叫 updateState", () => {
    render(<ThoughtBubble {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tb-input"), { target: { value: "我想說的話" } });
    fireEvent.click(screen.getByTestId("tb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].thought).toBe("我想說的話");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", thought: "我的想法" }],
      revealed: false,
    };
    render(<ThoughtBubble {...defaultProps} />);
    expect(screen.getByTestId("tb-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("tb-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<ThoughtBubble {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("tb-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<ThoughtBubble {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("tb-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<ThoughtBubble {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("tb-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示泡泡卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", thought: "我很開心" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", thought: "需要休息" },
      ],
      revealed: true,
    };
    render(<ThoughtBubble {...defaultProps} />);
    expect(screen.getByTestId("tb-result")).toBeTruthy();
    expect(screen.getByTestId("tb-bubble-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tb-bubble-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<ThoughtBubble {...defaultProps} />);
    expect(screen.getByTestId("tb-empty")).toBeTruthy();
  });
});
