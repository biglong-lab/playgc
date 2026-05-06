import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FirstWord } from "../FirstWord";

let mockState: Record<string, unknown> = { words: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

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

beforeEach(() => {
  mockState = { words: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("FirstWord", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<FirstWord {...defaultProps} />);
    expect(screen.getByTestId("fwd-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<FirstWord {...defaultProps} />);
    expect(screen.getByTestId("fwd-title").textContent).toBe("第一個字");
  });

  it("顯示自定義標題", () => {
    render(<FirstWord {...defaultProps} config={{ title: "直覺反應" }} />);
    expect(screen.getByTestId("fwd-title").textContent).toBe("直覺反應");
  });

  it("顯示問題文字", () => {
    render(<FirstWord {...defaultProps} />);
    expect(screen.getByTestId("fwd-question")).toBeTruthy();
  });

  it("顯示自定義問題", () => {
    render(<FirstWord {...defaultProps} config={{ question: "今天的心情一個詞？" }} />);
    expect(screen.getByTestId("fwd-question").textContent).toBe("今天的心情一個詞？");
  });

  it("顯示已回應人數", () => {
    render(<FirstWord {...defaultProps} />);
    expect(screen.getByTestId("fwd-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<FirstWord {...defaultProps} />);
    expect(screen.getByTestId("fwd-form")).toBeTruthy();
  });

  it("顯示文字輸入框", () => {
    render(<FirstWord {...defaultProps} />);
    expect(screen.getByTestId("fwd-word-input")).toBeTruthy();
  });

  it("未填寫時提交按鈕禁用", () => {
    render(<FirstWord {...defaultProps} />);
    const btn = screen.getByTestId("fwd-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("填入 1-10 字後啟用提交按鈕", () => {
    render(<FirstWord {...defaultProps} />);
    fireEvent.change(screen.getByTestId("fwd-word-input"), { target: { value: "驚喜" } });
    const btn = screen.getByTestId("fwd-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 word", () => {
    render(<FirstWord {...defaultProps} />);
    fireEvent.change(screen.getByTestId("fwd-word-input"), { target: { value: "感動" } });
    fireEvent.click(screen.getByTestId("fwd-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      words: Array<{ userId: string; word: string }>;
    };
    expect(newState.words[0].userId).toBe("u1");
    expect(newState.words[0].word).toBe("感動");
  });

  it("已提交後顯示我的詞", () => {
    mockState = {
      words: [{ entryId: "u1-1", userId: "u1", userName: "Alice", word: "開心" }],
      revealed: false,
    };
    render(<FirstWord {...defaultProps} />);
    expect(screen.getByTestId("fwd-my-entry")).toBeTruthy();
    expect(screen.getByTestId("fwd-my-entry").textContent).toContain("開心");
  });

  it("已提交後隱藏表單", () => {
    mockState = {
      words: [{ entryId: "u1-1", userId: "u1", userName: "Alice", word: "開心" }],
      revealed: false,
    };
    render(<FirstWord {...defaultProps} />);
    expect(screen.queryByTestId("fwd-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<FirstWord {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("fwd-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<FirstWord {...defaultProps} />);
    expect(screen.queryByTestId("fwd-reveal-btn")).toBeNull();
  });

  it("揭曉後無詞顯示 fwd-empty", () => {
    mockState = { words: [], revealed: true };
    render(<FirstWord {...defaultProps} />);
    expect(screen.getByTestId("fwd-empty")).toBeTruthy();
  });

  it("揭曉後顯示詞雲", () => {
    mockState = {
      words: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", word: "感動" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", word: "期待" },
      ],
      revealed: true,
    };
    render(<FirstWord {...defaultProps} />);
    expect(screen.getByTestId("fwd-result")).toBeTruthy();
  });

  it("揭曉後顯示各詞卡片", () => {
    mockState = {
      words: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", word: "感動" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", word: "期待" },
      ],
      revealed: true,
    };
    render(<FirstWord {...defaultProps} />);
    expect(screen.getByTestId("fwd-word-u1-1")).toBeTruthy();
    expect(screen.getByTestId("fwd-word-u2-1")).toBeTruthy();
  });
});
