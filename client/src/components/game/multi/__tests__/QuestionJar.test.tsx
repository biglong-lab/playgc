import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionJar } from "../QuestionJar";

let mockState: Record<string, unknown> = { questions: [], revealed: false, pickedId: null };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((next) => { mockState = next; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "小明", email: "user@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { questions: [], revealed: false, pickedId: null };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("QuestionJar", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<QuestionJar {...defaultProps} />);
    expect(screen.getByTestId("qj-loading")).toBeDefined();
  });

  test("顯示預設標題與提示", () => {
    render(<QuestionJar {...defaultProps} />);
    expect(screen.getByTestId("qj-title").textContent).toBe("問題罐");
    expect(screen.getByTestId("qj-prompt").textContent).toContain("問題");
  });

  test("顯示自訂 config", () => {
    render(<QuestionJar {...defaultProps} config={{ title: "Q&A Jar" }} />);
    expect(screen.getByTestId("qj-title").textContent).toBe("Q&A Jar");
  });

  test("顯示已投入問題數", () => {
    render(<QuestionJar {...defaultProps} />);
    expect(screen.getByTestId("qj-count").textContent).toContain("0");
  });

  test("空輸入時提交鈕禁用", () => {
    render(<QuestionJar {...defaultProps} />);
    const btn = screen.getByTestId("qj-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("輸入後提交鈕啟用", () => {
    render(<QuestionJar {...defaultProps} />);
    fireEvent.change(screen.getByTestId("qj-input"), { target: { value: "我的問題" } });
    const btn = screen.getByTestId("qj-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶正確 question", () => {
    render(<QuestionJar {...defaultProps} />);
    fireEvent.change(screen.getByTestId("qj-input"), { target: { value: "為什麼天空是藍的？" } });
    fireEvent.click(screen.getByTestId("qj-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as { questions: Array<{ text: string; votes: unknown[] }> };
    expect(called.questions[0].text).toBe("為什麼天空是藍的？");
    expect(called.questions[0].votes).toHaveLength(0);
  });

  test("已投入顯示 my-entry", () => {
    mockState = {
      questions: [{ questionId: "q1", userId: "u1", text: "我的問題", votes: [] }],
      revealed: false,
      pickedId: null,
    };
    render(<QuestionJar {...defaultProps} />);
    expect(screen.getByTestId("qj-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<QuestionJar {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("qj-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<QuestionJar {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("qj-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<QuestionJar {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("qj-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示問題卡片與投票按鈕", () => {
    mockState = {
      questions: [{ questionId: "q1", userId: "u2", text: "好問題？", votes: [] }],
      revealed: true,
      pickedId: null,
    };
    render(<QuestionJar {...defaultProps} />);
    expect(screen.getByTestId("qj-result")).toBeDefined();
    expect(screen.getByTestId("qj-card-q1")).toBeDefined();
    expect(screen.getByTestId("qj-vote-q1")).toBeDefined();
  });

  test("點投票呼叫 updateState 加入 vote", () => {
    mockState = {
      questions: [{ questionId: "q1", userId: "u2", text: "好問題？", votes: [] }],
      revealed: true,
      pickedId: null,
    };
    render(<QuestionJar {...defaultProps} />);
    fireEvent.click(screen.getByTestId("qj-vote-q1"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as { questions: Array<{ votes: string[] }> };
    expect(called.questions[0].votes).toContain("u1");
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { questions: [], revealed: true, pickedId: null };
    render(<QuestionJar {...defaultProps} />);
    expect(screen.getByTestId("qj-empty")).toBeDefined();
  });
});
