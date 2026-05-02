import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TriviaShowdown from "../TriviaShowdown";

const sampleConfig = {
  title: "知識搶答",
  questions: [
    {
      id: "q1",
      prompt: "1+1=?",
      options: ["1", "2", "3", "4"],
      correctIdx: 1,
      timeLimitSec: 15,
    },
  ],
};

describe("TriviaShowdown", () => {
  it("hostMode intro 狀態顯示題目 + 開始按鈕", () => {
    render(
      <TriviaShowdown
        config={sampleConfig}
        hostMode={true}
        state={{
          currentQuestionIdx: 0,
          status: "intro",
          answered: {},
          scores: {},
        }}
      />,
    );
    expect(screen.getByText("1+1=?")).toBeInTheDocument();
    expect(screen.getByTestId("btn-start-question")).toBeInTheDocument();
  });

  it("hostMode revealed 狀態顯示正確答案 + 下一題按鈕", () => {
    render(
      <TriviaShowdown
        config={sampleConfig}
        hostMode={true}
        state={{
          currentQuestionIdx: 0,
          status: "revealed",
          answered: { Alice: { choice: 1, ts: Date.now() } },
          scores: { Alice: 100 },
        }}
      />,
    );
    expect(screen.getByTestId("btn-next-question")).toBeInTheDocument();
  });

  it("hostMode ended 狀態顯示最終排行", () => {
    render(
      <TriviaShowdown
        config={sampleConfig}
        hostMode={true}
        state={{
          currentQuestionIdx: 0,
          status: "ended",
          answered: {},
          scores: { Alice: 200, Bob: 150, Carol: 100 },
        }}
      />,
    );
    expect(screen.getByText("最終結果")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("玩家 answering 狀態可點選 A/B/C/D", () => {
    const onPulse = vi.fn();
    render(
      <TriviaShowdown
        config={sampleConfig}
        hostMode={false}
        myUserName="我"
        onPulse={onPulse}
        state={{
          currentQuestionIdx: 0,
          status: "answering",
          answered: {},
          scores: {},
          questionStartedAt: Date.now(),
        }}
      />,
    );
    expect(screen.getByTestId("btn-answer-A")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("btn-answer-B"));
    expect(onPulse).toHaveBeenCalledWith("answer", expect.objectContaining({ choice: 1 }));
  });

  it("玩家答過後不再響應點擊", () => {
    const onPulse = vi.fn();
    render(
      <TriviaShowdown
        config={sampleConfig}
        hostMode={false}
        myUserName="我"
        onPulse={onPulse}
        state={{
          currentQuestionIdx: 0,
          status: "answering",
          answered: { 我: { choice: 1, ts: Date.now() } },
          scores: {},
          questionStartedAt: Date.now(),
        }}
      />,
    );
    fireEvent.click(screen.getByTestId("btn-answer-C"));
    expect(onPulse).not.toHaveBeenCalled();
  });

  it("玩家 ended 狀態顯示我的成績", () => {
    render(
      <TriviaShowdown
        config={sampleConfig}
        hostMode={false}
        myUserName="我"
        state={{
          currentQuestionIdx: 0,
          status: "ended",
          answered: {},
          scores: { 我: 175, Alice: 200 },
        }}
      />,
    );
    expect(screen.getByText("遊戲結束")).toBeInTheDocument();
    expect(screen.getByText("175 分")).toBeInTheDocument();
    expect(screen.getByText("排名 #2")).toBeInTheDocument();
  });
});
