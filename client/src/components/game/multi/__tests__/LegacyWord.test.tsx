import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LegacyWord } from "../LegacyWord";

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

describe("LegacyWord", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<LegacyWord {...defaultProps} />);
    expect(screen.getByTestId("lgw-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<LegacyWord {...defaultProps} />);
    expect(screen.getByTestId("lgw-title").textContent).toBe("傳承之詞");
  });

  it("顯示自定義標題", () => {
    render(<LegacyWord {...defaultProps} config={{ title: "留給未來的詞" }} />);
    expect(screen.getByTestId("lgw-title").textContent).toBe("留給未來的詞");
  });

  it("顯示提示文字", () => {
    render(<LegacyWord {...defaultProps} />);
    expect(screen.getByTestId("lgw-prompt")).toBeTruthy();
  });

  it("顯示自定義提示", () => {
    render(<LegacyWord {...defaultProps} config={{ prompt: "留給下一代的一個詞？" }} />);
    expect(screen.getByTestId("lgw-prompt").textContent).toBe("留給下一代的一個詞？");
  });

  it("顯示已分享人數", () => {
    render(<LegacyWord {...defaultProps} />);
    expect(screen.getByTestId("lgw-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<LegacyWord {...defaultProps} />);
    expect(screen.getByTestId("lgw-form")).toBeTruthy();
  });

  it("顯示詞輸入框", () => {
    render(<LegacyWord {...defaultProps} />);
    expect(screen.getByTestId("lgw-word-input")).toBeTruthy();
  });

  it("顯示理由輸入框", () => {
    render(<LegacyWord {...defaultProps} />);
    expect(screen.getByTestId("lgw-reason-input")).toBeTruthy();
  });

  it("未填時提交按鈕禁用", () => {
    render(<LegacyWord {...defaultProps} />);
    expect((screen.getByTestId("lgw-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("只填詞不填理由時仍禁用", () => {
    render(<LegacyWord {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lgw-word-input"), { target: { value: "誠信" } });
    expect((screen.getByTestId("lgw-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("理由不足 4 字時仍禁用", () => {
    render(<LegacyWord {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lgw-word-input"), { target: { value: "誠信" } });
    fireEvent.change(screen.getByTestId("lgw-reason-input"), { target: { value: "好" } });
    expect((screen.getByTestId("lgw-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("詞和理由都填寫後啟用按鈕", () => {
    render(<LegacyWord {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lgw-word-input"), { target: { value: "誠信" } });
    fireEvent.change(screen.getByTestId("lgw-reason-input"), { target: { value: "對人誠實最重要" } });
    expect((screen.getByTestId("lgw-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 word 和 reason", () => {
    render(<LegacyWord {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lgw-word-input"), { target: { value: "勇氣" } });
    fireEvent.change(screen.getByTestId("lgw-reason-input"), { target: { value: "勇於面對挑戰" } });
    fireEvent.click(screen.getByTestId("lgw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ word: string; reason: string }> };
    expect(s.entries[0].word).toBe("勇氣");
    expect(s.entries[0].reason).toBe("勇於面對挑戰");
  });

  it("已提交後顯示我的傳承", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", word: "誠信", reason: "誠實最重要" }], revealed: false };
    render(<LegacyWord {...defaultProps} />);
    expect(screen.getByTestId("lgw-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", word: "誠信", reason: "誠實最重要" }], revealed: false };
    render(<LegacyWord {...defaultProps} />);
    expect(screen.queryByTestId("lgw-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<LegacyWord {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("lgw-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<LegacyWord {...defaultProps} />);
    expect(screen.queryByTestId("lgw-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 lgw-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<LegacyWord {...defaultProps} />);
    expect(screen.getByTestId("lgw-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊傳承", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", word: "誠信", reason: "誠實最重要" }], revealed: true };
    render(<LegacyWord {...defaultProps} />);
    expect(screen.getByTestId("lgw-result")).toBeTruthy();
    expect(screen.getByTestId("lgw-card-u1-1")).toBeTruthy();
  });
});
