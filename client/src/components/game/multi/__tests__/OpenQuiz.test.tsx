import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpenQuiz } from "../OpenQuiz";

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

describe("OpenQuiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<OpenQuiz {...defaultProps} />);
    expect(screen.getByTestId("oq-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<OpenQuiz {...defaultProps} />);
    expect(screen.getByTestId("oq-title").textContent).toContain("開放問答");
    expect(screen.getByTestId("oq-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <OpenQuiz
        {...defaultProps}
        config={{ title: "我的問題", prompt: "問一個你想知道的問題", questionLabel: "問題", answerLabel: "答案" }}
      />,
    );
    expect(screen.getByTestId("oq-title").textContent).toContain("我的問題");
    expect(screen.getByTestId("oq-prompt").textContent).toContain("問一個你想知道的問題");
  });

  it("顯示問答數量", () => {
    render(<OpenQuiz {...defaultProps} />);
    expect(screen.getByTestId("oq-count").textContent).toContain("0");
  });

  it("顯示問題和答案輸入欄", () => {
    render(<OpenQuiz {...defaultProps} />);
    expect(screen.getByTestId("oq-question-input")).toBeTruthy();
    expect(screen.getByTestId("oq-answer-input")).toBeTruthy();
    expect(screen.getByTestId("oq-submit-btn")).toBeTruthy();
  });

  it("問題或答案空白時提交鈕禁用", () => {
    render(<OpenQuiz {...defaultProps} />);
    const btn = screen.getByTestId("oq-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填問題時提交鈕禁用", () => {
    render(<OpenQuiz {...defaultProps} />);
    fireEvent.change(screen.getByTestId("oq-question-input"), { target: { value: "為什麼？" } });
    const btn = screen.getByTestId("oq-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("問答都填後可提交", () => {
    render(<OpenQuiz {...defaultProps} />);
    fireEvent.change(screen.getByTestId("oq-question-input"), { target: { value: "你的夢想是什麼？" } });
    fireEvent.change(screen.getByTestId("oq-answer-input"), { target: { value: "環遊世界" } });
    fireEvent.click(screen.getByTestId("oq-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].question).toBe("你的夢想是什麼？");
    expect(arg.entries[0].answer).toBe("環遊世界");
  });

  it("已提交顯示我的問答，隱藏輸入", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", question: "問Q", answer: "答A" }],
      revealed: false,
    };
    render(<OpenQuiz {...defaultProps} />);
    expect(screen.getByTestId("oq-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("oq-question-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<OpenQuiz {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("oq-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<OpenQuiz {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("oq-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<OpenQuiz {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("oq-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示所有問答卡", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", question: "問Q1", answer: "答A1" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", question: "問Q2", answer: "答A2" },
      ],
      revealed: true,
    };
    render(<OpenQuiz {...defaultProps} />);
    expect(screen.getByTestId("oq-result")).toBeTruthy();
    expect(screen.getByTestId("oq-entry-u1-1")).toBeTruthy();
    expect(screen.getByTestId("oq-entry-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<OpenQuiz {...defaultProps} />);
    expect(screen.getByTestId("oq-empty")).toBeTruthy();
  });
});
