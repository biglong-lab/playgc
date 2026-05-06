import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PuzzlePiece } from "../PuzzlePiece";

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

describe("PuzzlePiece", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.getByTestId("pzp-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.getByTestId("pzp-title").textContent).toBe("我是哪塊拼圖");
  });

  it("顯示自定義標題", () => {
    render(<PuzzlePiece {...defaultProps} config={{ title: "團隊拼圖" }} />);
    expect(screen.getByTestId("pzp-title").textContent).toBe("團隊拼圖");
  });

  it("顯示提示文字", () => {
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.getByTestId("pzp-prompt")).toBeTruthy();
  });

  it("顯示已拼入塊數", () => {
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.getByTestId("pzp-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.getByTestId("pzp-form")).toBeTruthy();
  });

  it("顯示 5 個拼圖塊類型", () => {
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.getByTestId("pzp-piece-grid")).toBeTruthy();
    expect(screen.getByTestId("pzp-piece-corner")).toBeTruthy();
    expect(screen.getByTestId("pzp-piece-edge")).toBeTruthy();
    expect(screen.getByTestId("pzp-piece-center")).toBeTruthy();
    expect(screen.getByTestId("pzp-piece-detail")).toBeTruthy();
    expect(screen.getByTestId("pzp-piece-bridge")).toBeTruthy();
  });

  it("顯示貢獻輸入框", () => {
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.getByTestId("pzp-contribution-input")).toBeTruthy();
  });

  it("未填貢獻時提交按鈕禁用", () => {
    render(<PuzzlePiece {...defaultProps} />);
    expect((screen.getByTestId("pzp-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<PuzzlePiece {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pzp-contribution-input"), { target: { value: "穩定" } });
    expect((screen.getByTestId("pzp-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<PuzzlePiece {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pzp-contribution-input"), { target: { value: "為團隊提供穩定的後盾" } });
    expect((screen.getByTestId("pzp-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換拼圖塊類型", () => {
    render(<PuzzlePiece {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pzp-piece-bridge"));
    expect(screen.getByTestId("pzp-piece-bridge").className).toContain("cyan-100");
  });

  it("提交後呼叫 updateState 含 pieceType 和 contribution", () => {
    render(<PuzzlePiece {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pzp-piece-center"));
    fireEvent.change(screen.getByTestId("pzp-contribution-input"), { target: { value: "推動整個計畫向前邁進的關鍵力量" } });
    fireEvent.click(screen.getByTestId("pzp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; pieceType: string; contribution: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].pieceType).toBe("center");
    expect(s.entries[0].contribution).toBe("推動整個計畫向前邁進的關鍵力量");
  });

  it("已提交後顯示我的拼圖塊", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", pieceType: "edge", contribution: "連接不同部門讓溝通更順暢" }], revealed: false };
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.getByTestId("pzp-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", pieceType: "edge", contribution: "連接不同部門讓溝通更順暢" }], revealed: false };
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.queryByTestId("pzp-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<PuzzlePiece {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("pzp-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.queryByTestId("pzp-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 pzp-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.getByTestId("pzp-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有拼圖塊", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", pieceType: "corner", contribution: "為整個計畫打好穩定的根基" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", pieceType: "detail", contribution: "確保每個細節都完美執行" },
      ],
      revealed: true,
    };
    render(<PuzzlePiece {...defaultProps} />);
    expect(screen.getByTestId("pzp-result")).toBeTruthy();
    expect(screen.getByTestId("pzp-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("pzp-card-u2-1")).toBeTruthy();
  });
});
