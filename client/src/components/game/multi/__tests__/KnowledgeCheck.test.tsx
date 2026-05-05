import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import KnowledgeCheck from "../KnowledgeCheck";
import type { KnowledgeCheckConfig, KnowledgeCheckState } from "../KnowledgeCheck";

const defaultConfig: KnowledgeCheckConfig = {
  title: "🧠 知識確認",
  questions: [
    {
      id: "q1",
      text: "台灣最高峰是？",
      options: ["玉山", "雪山", "合歡山", "秀姑巒山"],
      correctIndex: 0,
      explanation: "玉山海拔 3,952 公尺，是台灣最高峰。",
    },
    {
      id: "q2",
      text: "台灣面積約多少平方公里？",
      options: ["15,000", "36,000", "26,000", "45,000"],
      correctIndex: 1,
    },
  ],
  showExplanation: true,
  pointsPerCorrect: 10,
};

const initialState: KnowledgeCheckState = {
  currentQuestionIndex: 0,
  answers: [],
  revealed: false,
};

const mockProps = {
  config: defaultConfig,
  state: initialState,
  myUserId: "u1",
  isHost: false,
  onAnswer: vi.fn(),
  onReveal: vi.fn(),
  onNext: vi.fn(),
};

describe("KnowledgeCheck", () => {
  it("顯示標題", () => {
    render(<KnowledgeCheck {...mockProps} />);
    expect(screen.getByTestId("kc-title")).toHaveTextContent("知識確認");
  });

  it("顯示進度", () => {
    render(<KnowledgeCheck {...mockProps} />);
    expect(screen.getByTestId("kc-progress")).toHaveTextContent("1 / 2");
  });

  it("顯示當前題目", () => {
    render(<KnowledgeCheck {...mockProps} />);
    expect(screen.getByTestId("kc-question")).toHaveTextContent("台灣最高峰");
  });

  it("顯示所有選項", () => {
    render(<KnowledgeCheck {...mockProps} />);
    expect(screen.getByTestId("kc-option-0")).toHaveTextContent("玉山");
    expect(screen.getByTestId("kc-option-3")).toHaveTextContent("秀姑巒山");
  });

  it("點擊選項呼叫 onAnswer", () => {
    const onAnswer = vi.fn();
    render(<KnowledgeCheck {...mockProps} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByTestId("kc-option-1"));
    expect(onAnswer).toHaveBeenCalledWith(1);
  });

  it("顯示作答人數", () => {
    render(<KnowledgeCheck {...mockProps} />);
    expect(screen.getByTestId("kc-answer-count")).toHaveTextContent("0");
  });

  it("未作答顯示提示", () => {
    render(<KnowledgeCheck {...mockProps} />);
    expect(screen.getByTestId("kc-hint")).toBeInTheDocument();
  });

  it("已作答顯示等待揭曉", () => {
    const state: KnowledgeCheckState = {
      ...initialState,
      answers: [{ userId: "u1", userName: "Alice", questionId: "q1", selectedIndex: 0, answeredAt: 1000 }],
    };
    render(<KnowledgeCheck {...mockProps} state={state} />);
    expect(screen.getByTestId("kc-waiting-reveal")).toBeInTheDocument();
  });

  it("已作答後選項 disabled", () => {
    const state: KnowledgeCheckState = {
      ...initialState,
      answers: [{ userId: "u1", userName: "Alice", questionId: "q1", selectedIndex: 0, answeredAt: 1000 }],
    };
    render(<KnowledgeCheck {...mockProps} state={state} />);
    expect(screen.getByTestId("kc-option-0")).toBeDisabled();
  });

  it("isHost=true 顯示揭曉按鈕", () => {
    render(<KnowledgeCheck {...mockProps} isHost={true} />);
    expect(screen.getByTestId("kc-reveal-btn")).toBeInTheDocument();
  });

  it("isHost=false 不顯示揭曉按鈕", () => {
    render(<KnowledgeCheck {...mockProps} isHost={false} />);
    expect(screen.queryByTestId("kc-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    render(<KnowledgeCheck {...mockProps} isHost={true} onReveal={onReveal} />);
    fireEvent.click(screen.getByTestId("kc-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("揭曉後顯示正確答案標記", () => {
    const state: KnowledgeCheckState = { ...initialState, revealed: true };
    render(<KnowledgeCheck {...mockProps} state={state} />);
    expect(screen.getByTestId("kc-correct-mark-0")).toBeInTheDocument();
  });

  it("揭曉後顯示百分比", () => {
    const state: KnowledgeCheckState = {
      ...initialState,
      answers: [{ userId: "u1", userName: "Alice", questionId: "q1", selectedIndex: 0, answeredAt: 1000 }],
      revealed: true,
    };
    render(<KnowledgeCheck {...mockProps} state={state} />);
    expect(screen.getByTestId("kc-pct-0")).toHaveTextContent("100%");
  });

  it("showExplanation=true 揭曉後顯示解析", () => {
    const state: KnowledgeCheckState = { ...initialState, revealed: true };
    render(<KnowledgeCheck {...mockProps} state={state} />);
    expect(screen.getByTestId("kc-explanation")).toHaveTextContent("玉山海拔");
  });

  it("showExplanation=false 不顯示解析", () => {
    const config = { ...defaultConfig, showExplanation: false };
    const state: KnowledgeCheckState = { ...initialState, revealed: true };
    render(<KnowledgeCheck {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("kc-explanation")).not.toBeInTheDocument();
  });

  it("isHost=true 揭曉後顯示下一題", () => {
    const state: KnowledgeCheckState = { ...initialState, revealed: true };
    render(<KnowledgeCheck {...mockProps} state={state} isHost={true} />);
    expect(screen.getByTestId("kc-next-btn")).toBeInTheDocument();
  });

  it("點擊下一題呼叫 onNext", () => {
    const onNext = vi.fn();
    const state: KnowledgeCheckState = { ...initialState, revealed: true };
    render(<KnowledgeCheck {...mockProps} state={state} isHost={true} onNext={onNext} />);
    fireEvent.click(screen.getByTestId("kc-next-btn"));
    expect(onNext).toHaveBeenCalled();
  });

  it("最後一題按鈕文字為「結束」", () => {
    const state: KnowledgeCheckState = {
      currentQuestionIndex: 1,
      answers: [],
      revealed: true,
    };
    render(<KnowledgeCheck {...mockProps} state={state} isHost={true} />);
    expect(screen.getByTestId("kc-next-btn")).toHaveTextContent("結束");
  });

  it("全部題目完成顯示結果畫面", () => {
    const state: KnowledgeCheckState = {
      currentQuestionIndex: 2,
      answers: [
        { userId: "u1", userName: "Alice", questionId: "q1", selectedIndex: 0, answeredAt: 1000 },
        { userId: "u1", userName: "Alice", questionId: "q2", selectedIndex: 1, answeredAt: 2000 },
      ],
      revealed: false,
    };
    render(<KnowledgeCheck {...mockProps} state={state} />);
    expect(screen.getByTestId("kc-done")).toBeInTheDocument();
    expect(screen.getByTestId("kc-final-score")).toHaveTextContent("2 / 2");
  });

  it("顯示得分", () => {
    const state: KnowledgeCheckState = {
      currentQuestionIndex: 2,
      answers: [
        { userId: "u1", userName: "Alice", questionId: "q1", selectedIndex: 0, answeredAt: 1000 },
      ],
      revealed: false,
    };
    render(<KnowledgeCheck {...mockProps} state={state} />);
    expect(screen.getByTestId("kc-points")).toHaveTextContent("10");
  });
});
