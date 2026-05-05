import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AfterAction } from "../AfterAction";

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

describe("AfterAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<AfterAction {...defaultProps} />);
    expect(screen.getByTestId("aa-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<AfterAction {...defaultProps} />);
    expect(screen.getByTestId("aa-title").textContent).toContain("事後覆盤");
    expect(screen.getByTestId("aa-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <AfterAction
        {...defaultProps}
        config={{ title: "複盤會議", prompt: "你學到什麼？" }}
      />,
    );
    expect(screen.getByTestId("aa-title").textContent).toContain("複盤會議");
    expect(screen.getByTestId("aa-prompt").textContent).toContain("你學到什麼？");
  });

  it("顯示提交數量", () => {
    render(<AfterAction {...defaultProps} />);
    expect(screen.getByTestId("aa-count").textContent).toContain("0");
  });

  it("顯示三個輸入欄", () => {
    render(<AfterAction {...defaultProps} />);
    expect(screen.getByTestId("aa-well-input")).toBeTruthy();
    expect(screen.getByTestId("aa-wrong-input")).toBeTruthy();
    expect(screen.getByTestId("aa-lessons-input")).toBeTruthy();
    expect(screen.getByTestId("aa-submit-btn")).toBeTruthy();
  });

  it("三欄皆空時提交鈕禁用", () => {
    render(<AfterAction {...defaultProps} />);
    const btn = screen.getByTestId("aa-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填一欄也可提交（OR 邏輯）", () => {
    render(<AfterAction {...defaultProps} />);
    fireEvent.change(screen.getByTestId("aa-well-input"), { target: { value: "溝通順暢" } });
    const btn = screen.getByTestId("aa-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("填寫後提交", () => {
    render(<AfterAction {...defaultProps} />);
    fireEvent.change(screen.getByTestId("aa-well-input"), { target: { value: "溝通順暢" } });
    fireEvent.change(screen.getByTestId("aa-wrong-input"), { target: { value: "時間不夠" } });
    fireEvent.change(screen.getByTestId("aa-lessons-input"), { target: { value: "提早規劃" } });
    fireEvent.click(screen.getByTestId("aa-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].wentWell).toBe("溝通順暢");
    expect(arg.entries[0].wentWrong).toBe("時間不夠");
    expect(arg.entries[0].lessons).toBe("提早規劃");
  });

  it("已提交顯示我的覆盤", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", wentWell: "順暢", wentWrong: "太慢", lessons: "提早開始" }],
      revealed: false,
    };
    render(<AfterAction {...defaultProps} />);
    expect(screen.getByTestId("aa-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("aa-well-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<AfterAction {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("aa-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<AfterAction {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("aa-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<AfterAction {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("aa-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示三欄結果", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", wentWell: "順暢", wentWrong: "", lessons: "多練習" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", wentWell: "", wentWrong: "太慢", lessons: "" },
      ],
      revealed: true,
    };
    render(<AfterAction {...defaultProps} />);
    expect(screen.getByTestId("aa-result")).toBeTruthy();
    expect(screen.getByTestId("aa-col-well")).toBeTruthy();
    expect(screen.getByTestId("aa-col-wrong")).toBeTruthy();
    expect(screen.getByTestId("aa-col-lessons")).toBeTruthy();
  });

  it("revealed=true 各欄顯示對應 item", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", wentWell: "順暢", wentWrong: "太慢", lessons: "提早開始" },
      ],
      revealed: true,
    };
    render(<AfterAction {...defaultProps} />);
    expect(screen.getByTestId("aa-item-u1-1-well")).toBeTruthy();
    expect(screen.getByTestId("aa-item-u1-1-wrong")).toBeTruthy();
    expect(screen.getByTestId("aa-item-u1-1-lessons")).toBeTruthy();
  });
});
