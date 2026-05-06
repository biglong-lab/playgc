import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorMood } from "../ColorMood";

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

describe("ColorMood", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<ColorMood {...defaultProps} />);
    expect(screen.getByTestId("cmd-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<ColorMood {...defaultProps} />);
    expect(screen.getByTestId("cmd-title").textContent).toBe("今日色彩心情");
  });

  it("顯示自定義標題", () => {
    render(<ColorMood {...defaultProps} config={{ title: "我的心情調色盤" }} />);
    expect(screen.getByTestId("cmd-title").textContent).toBe("我的心情調色盤");
  });

  it("顯示提示文字", () => {
    render(<ColorMood {...defaultProps} />);
    expect(screen.getByTestId("cmd-prompt")).toBeTruthy();
  });

  it("顯示已完成人數", () => {
    render(<ColorMood {...defaultProps} />);
    expect(screen.getByTestId("cmd-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<ColorMood {...defaultProps} />);
    expect(screen.getByTestId("cmd-form")).toBeTruthy();
  });

  it("顯示 8 種顏色選項", () => {
    render(<ColorMood {...defaultProps} />);
    expect(screen.getByTestId("cmd-color-grid")).toBeTruthy();
    expect(screen.getByTestId("cmd-color-red")).toBeTruthy();
    expect(screen.getByTestId("cmd-color-orange")).toBeTruthy();
    expect(screen.getByTestId("cmd-color-yellow")).toBeTruthy();
    expect(screen.getByTestId("cmd-color-green")).toBeTruthy();
    expect(screen.getByTestId("cmd-color-blue")).toBeTruthy();
    expect(screen.getByTestId("cmd-color-purple")).toBeTruthy();
    expect(screen.getByTestId("cmd-color-pink")).toBeTruthy();
    expect(screen.getByTestId("cmd-color-gray")).toBeTruthy();
  });

  it("顯示說明輸入框", () => {
    render(<ColorMood {...defaultProps} />);
    expect(screen.getByTestId("cmd-note-input")).toBeTruthy();
  });

  it("未填說明時提交按鈕禁用", () => {
    render(<ColorMood {...defaultProps} />);
    expect((screen.getByTestId("cmd-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 3 字時仍禁用", () => {
    render(<ColorMood {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cmd-note-input"), { target: { value: "好" } });
    expect((screen.getByTestId("cmd-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("3 字以上啟用提交按鈕", () => {
    render(<ColorMood {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cmd-note-input"), { target: { value: "今天充滿熱情" } });
    expect((screen.getByTestId("cmd-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換顏色選項", () => {
    render(<ColorMood {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cmd-color-red"));
    expect(screen.getByTestId("cmd-color-red").className).toContain("border-gray-400");
  });

  it("提交後呼叫 updateState 含 color 和 note", () => {
    render(<ColorMood {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cmd-color-yellow"));
    fireEvent.change(screen.getByTestId("cmd-note-input"), { target: { value: "今天陽光明媚很開心" } });
    fireEvent.click(screen.getByTestId("cmd-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; color: string; note: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].color).toBe("yellow");
    expect(s.entries[0].note).toBe("今天陽光明媚很開心");
  });

  it("已提交後顯示我的色彩", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", color: "purple", note: "有點神秘感" }], revealed: false };
    render(<ColorMood {...defaultProps} />);
    expect(screen.getByTestId("cmd-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", color: "purple", note: "有點神秘感" }], revealed: false };
    render(<ColorMood {...defaultProps} />);
    expect(screen.queryByTestId("cmd-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<ColorMood {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("cmd-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<ColorMood {...defaultProps} />);
    expect(screen.queryByTestId("cmd-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 cmd-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<ColorMood {...defaultProps} />);
    expect(screen.getByTestId("cmd-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊色彩牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", color: "green", note: "生機盎然" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", color: "blue", note: "沉靜思考" },
      ],
      revealed: true,
    };
    render(<ColorMood {...defaultProps} />);
    expect(screen.getByTestId("cmd-result")).toBeTruthy();
    expect(screen.getByTestId("cmd-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("cmd-card-u2-1")).toBeTruthy();
  });
});
