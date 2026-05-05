import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WonderBoard } from "../WonderBoard";

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

describe("WonderBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<WonderBoard {...defaultProps} />);
    expect(screen.getByTestId("wo-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<WonderBoard {...defaultProps} />);
    expect(screen.getByTestId("wo-title").textContent).toContain("好奇探索板");
    expect(screen.getByTestId("wo-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <WonderBoard {...defaultProps} config={{ title: "好奇牆", prompt: "你好奇什麼？" }} />,
    );
    expect(screen.getByTestId("wo-title").textContent).toContain("好奇牆");
    expect(screen.getByTestId("wo-prompt").textContent).toContain("你好奇什麼？");
  });

  it("顯示提交數量", () => {
    render(<WonderBoard {...defaultProps} />);
    expect(screen.getByTestId("wo-count").textContent).toContain("0");
  });

  it("顯示輸入欄", () => {
    render(<WonderBoard {...defaultProps} />);
    expect(screen.getByTestId("wo-input")).toBeTruthy();
    expect(screen.getByTestId("wo-submit-btn")).toBeTruthy();
  });

  it("輸入欄為空時提交鈕禁用", () => {
    render(<WonderBoard {...defaultProps} />);
    expect((screen.getByTestId("wo-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("填寫後提交鈕啟用", () => {
    render(<WonderBoard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wo-input"), { target: { value: "我好奇 AI 能不能取代創意" } });
    expect((screen.getByTestId("wo-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("填寫後點擊提交", () => {
    render(<WonderBoard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wo-input"), { target: { value: "我好奇未來如何" } });
    fireEvent.click(screen.getByTestId("wo-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].wonder).toBe("我好奇未來如何");
  });

  it("已提交顯示我的好奇心", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", wonder: "我好奇未來" }],
      revealed: false,
    };
    render(<WonderBoard {...defaultProps} />);
    expect(screen.getByTestId("wo-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("wo-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<WonderBoard {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("wo-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<WonderBoard {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("wo-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<WonderBoard {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("wo-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示卡片牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", wonder: "我好奇未來" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", wonder: "我好奇宇宙" },
      ],
      revealed: true,
    };
    render(<WonderBoard {...defaultProps} />);
    expect(screen.getByTestId("wo-result")).toBeTruthy();
    expect(screen.getByTestId("wo-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("wo-card-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<WonderBoard {...defaultProps} />);
    expect(screen.getByTestId("wo-empty")).toBeTruthy();
  });
});
