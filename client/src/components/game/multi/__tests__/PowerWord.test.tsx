import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PowerWord } from "../PowerWord";

let mockState: Record<string, unknown> = { words: [], revealed: false };
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
  mockState = { words: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("PowerWord", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<PowerWord {...defaultProps} />);
    expect(screen.getByTestId("pwr-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<PowerWord {...defaultProps} />);
    expect(screen.getByTestId("pwr-title").textContent).toBe("力量之詞");
  });

  it("顯示自定義標題", () => {
    render(<PowerWord {...defaultProps} config={{ title: "今日關鍵字" }} />);
    expect(screen.getByTestId("pwr-title").textContent).toBe("今日關鍵字");
  });

  it("顯示提示文字", () => {
    render(<PowerWord {...defaultProps} />);
    expect(screen.getByTestId("pwr-prompt")).toBeTruthy();
  });

  it("顯示自定義提示", () => {
    render(<PowerWord {...defaultProps} config={{ prompt: "選一個代表你的詞" }} />);
    expect(screen.getByTestId("pwr-prompt").textContent).toBe("選一個代表你的詞");
  });

  it("顯示已分享人數", () => {
    render(<PowerWord {...defaultProps} />);
    expect(screen.getByTestId("pwr-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<PowerWord {...defaultProps} />);
    expect(screen.getByTestId("pwr-form")).toBeTruthy();
  });

  it("顯示力量詞格", () => {
    render(<PowerWord {...defaultProps} />);
    expect(screen.getByTestId("pwr-word-grid")).toBeTruthy();
    expect(screen.getByTestId("pwr-word-勇氣")).toBeTruthy();
    expect(screen.getByTestId("pwr-word-智慧")).toBeTruthy();
    expect(screen.getByTestId("pwr-word-創新")).toBeTruthy();
  });

  it("顯示原因輸入框", () => {
    render(<PowerWord {...defaultProps} />);
    expect(screen.getByTestId("pwr-reason-input")).toBeTruthy();
  });

  it("未填原因時提交按鈕禁用", () => {
    render(<PowerWord {...defaultProps} />);
    expect((screen.getByTestId("pwr-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 3 字時仍禁用", () => {
    render(<PowerWord {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pwr-reason-input"), { target: { value: "好" } });
    expect((screen.getByTestId("pwr-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("3 字以上啟用提交按鈕", () => {
    render(<PowerWord {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pwr-reason-input"), { target: { value: "今天很有突破感" } });
    expect((screen.getByTestId("pwr-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換力量詞", () => {
    render(<PowerWord {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pwr-word-熱情"));
    expect(screen.getByTestId("pwr-word-熱情").className).toContain("amber-200");
  });

  it("提交後呼叫 updateState 含 word 和 reason", () => {
    render(<PowerWord {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pwr-word-突破"));
    fireEvent.change(screen.getByTestId("pwr-reason-input"), { target: { value: "今天跨出了重要一步" } });
    fireEvent.click(screen.getByTestId("pwr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { words: Array<{ userId: string; word: string; reason: string }> };
    expect(s.words[0].userId).toBe("u1");
    expect(s.words[0].word).toBe("突破");
    expect(s.words[0].reason).toBe("今天跨出了重要一步");
  });

  it("已提交後顯示我的力量詞", () => {
    mockState = { words: [{ entryId: "u1-1", userId: "u1", userName: "Alice", word: "勇氣", reason: "勇敢說出想法" }], revealed: false };
    render(<PowerWord {...defaultProps} />);
    expect(screen.getByTestId("pwr-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { words: [{ entryId: "u1-1", userId: "u1", userName: "Alice", word: "勇氣", reason: "勇敢說出想法" }], revealed: false };
    render(<PowerWord {...defaultProps} />);
    expect(screen.queryByTestId("pwr-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<PowerWord {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("pwr-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<PowerWord {...defaultProps} />);
    expect(screen.queryByTestId("pwr-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 pwr-empty", () => {
    mockState = { words: [], revealed: true };
    render(<PowerWord {...defaultProps} />);
    expect(screen.getByTestId("pwr-empty")).toBeTruthy();
  });

  it("揭曉後顯示力量詞牆", () => {
    mockState = {
      words: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", word: "勇氣", reason: "勇敢表達" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", word: "協作", reason: "一起完成" },
      ],
      revealed: true,
    };
    render(<PowerWord {...defaultProps} />);
    expect(screen.getByTestId("pwr-result")).toBeTruthy();
    expect(screen.getByTestId("pwr-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("pwr-card-u2-1")).toBeTruthy();
  });
});
