import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReverseBrainstorm } from "../ReverseBrainstorm";

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

describe("ReverseBrainstorm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ReverseBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("rb-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<ReverseBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("rb-title").textContent).toContain("反向腦力激盪");
    expect(screen.getByTestId("rb-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <ReverseBrainstorm
        {...defaultProps}
        config={{ title: "反向思考", prompt: "如何失敗？" }}
      />,
    );
    expect(screen.getByTestId("rb-title").textContent).toContain("反向思考");
    expect(screen.getByTestId("rb-prompt").textContent).toContain("如何失敗？");
  });

  it("顯示提交數量", () => {
    render(<ReverseBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("rb-count").textContent).toContain("0");
  });

  it("顯示輸入欄", () => {
    render(<ReverseBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("rb-input")).toBeTruthy();
    expect(screen.getByTestId("rb-submit-btn")).toBeTruthy();
  });

  it("輸入欄為空時提交鈕禁用", () => {
    render(<ReverseBrainstorm {...defaultProps} />);
    const btn = screen.getByTestId("rb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("填寫後提交鈕啟用", () => {
    render(<ReverseBrainstorm {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rb-input"), { target: { value: "不開會議記錄" } });
    const btn = screen.getByTestId("rb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("填寫後點擊提交", () => {
    render(<ReverseBrainstorm {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rb-input"), { target: { value: "不開會議記錄" } });
    fireEvent.click(screen.getByTestId("rb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].badIdea).toBe("不開會議記錄");
  });

  it("已提交顯示我的壞主意", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", badIdea: "不開會議記錄" }],
      revealed: false,
    };
    render(<ReverseBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("rb-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("rb-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<ReverseBrainstorm {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("rb-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<ReverseBrainstorm {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("rb-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<ReverseBrainstorm {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("rb-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示所有壞主意", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", badIdea: "不開記錄" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", badIdea: "拒絕回饋" },
      ],
      revealed: true,
    };
    render(<ReverseBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("rb-result")).toBeTruthy();
    expect(screen.getByTestId("rb-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("rb-card-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<ReverseBrainstorm {...defaultProps} />);
    expect(screen.getByTestId("rb-empty")).toBeTruthy();
  });
});
