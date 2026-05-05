import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MindSync, { MindSyncConfig, MindSyncState } from "../MindSync";

const baseConfig: MindSyncConfig = {
  title: "默契大考驗",
  description: "獨立作答，揭曉後看看誰最有默契！",
  questions: ["最想去哪？", "最愛什麼食物？"],
  maxAnswerLength: 10,
};

const emptyState: MindSyncState = { answers: [], revealed: false };

const fullState: MindSyncState = {
  answers: [
    { answerId: "a1", userId: "u1", userName: "Alice", questionIdx: 0, answer: "日本" },
    { answerId: "a2", userId: "u1", userName: "Alice", questionIdx: 1, answer: "拉麵" },
    { answerId: "a3", userId: "u2", userName: "Bob", questionIdx: 0, answer: "日本" },
    { answerId: "a4", userId: "u2", userName: "Bob", questionIdx: 1, answer: "壽司" },
  ],
  revealed: true,
};

function renderMs(overrides: Partial<Parameters<typeof MindSync>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onSubmitAnswers: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<MindSync {...props} />), props };
}

describe("MindSync — 基本渲染", () => {
  it("顯示標題", () => {
    renderMs();
    expect(screen.getByTestId("ms-title")).toHaveTextContent("默契大考驗");
  });

  it("顯示描述", () => {
    renderMs();
    expect(screen.getByTestId("ms-description")).toBeInTheDocument();
  });

  it("顯示作答人數", () => {
    renderMs();
    expect(screen.getByTestId("ms-submitter-count")).toBeInTheDocument();
  });

  it("顯示所有問題", () => {
    renderMs();
    expect(screen.getByTestId("ms-question-0")).toHaveTextContent("最想去哪？");
    expect(screen.getByTestId("ms-question-1")).toHaveTextContent("最愛什麼食物？");
  });

  it("顯示所有答案輸入框", () => {
    renderMs();
    expect(screen.getByTestId("ms-answer-input-0")).toBeInTheDocument();
    expect(screen.getByTestId("ms-answer-input-1")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderMs();
    expect(screen.getByTestId("ms-reveal-btn")).toBeInTheDocument();
  });
});

describe("MindSync — 作答驗證", () => {
  it("未填答時送出鈕 disabled", () => {
    renderMs();
    expect(screen.getByTestId("ms-submit-btn")).toBeDisabled();
  });

  it("填完所有題目後送出鈕可點", () => {
    renderMs();
    fireEvent.change(screen.getByTestId("ms-answer-input-0"), {
      target: { value: "日本" },
    });
    fireEvent.change(screen.getByTestId("ms-answer-input-1"), {
      target: { value: "拉麵" },
    });
    expect(screen.getByTestId("ms-submit-btn")).not.toBeDisabled();
  });

  it("答案超過 maxAnswerLength 顯示錯誤", () => {
    renderMs();
    fireEvent.change(screen.getByTestId("ms-answer-input-0"), {
      target: { value: "超過十個字的答案哈哈哈" },
    });
    expect(screen.getByTestId("ms-answer-error-0")).toBeInTheDocument();
  });

  it("答案超長時送出鈕 disabled", () => {
    renderMs();
    fireEvent.change(screen.getByTestId("ms-answer-input-0"), {
      target: { value: "超過十個字的答案哈哈哈" },
    });
    fireEvent.change(screen.getByTestId("ms-answer-input-1"), {
      target: { value: "拉麵" },
    });
    expect(screen.getByTestId("ms-submit-btn")).toBeDisabled();
  });
});

describe("MindSync — 送出", () => {
  it("點送出呼叫 onSubmitAnswers", () => {
    const onSubmitAnswers = vi.fn();
    renderMs({ onSubmitAnswers });
    fireEvent.change(screen.getByTestId("ms-answer-input-0"), {
      target: { value: "日本" },
    });
    fireEvent.change(screen.getByTestId("ms-answer-input-1"), {
      target: { value: "拉麵" },
    });
    fireEvent.click(screen.getByTestId("ms-submit-btn"));
    expect(onSubmitAnswers).toHaveBeenCalledWith([
      { questionIdx: 0, answer: "日本" },
      { questionIdx: 1, answer: "拉麵" },
    ]);
  });

  it("已送出時顯示 ms-submitted-msg", () => {
    renderMs({
      state: {
        answers: [
          { answerId: "a1", userId: "u1", userName: "Alice", questionIdx: 0, answer: "日本" },
          { answerId: "a2", userId: "u1", userName: "Alice", questionIdx: 1, answer: "拉麵" },
        ],
        revealed: false,
      },
      myUserId: "u1",
    });
    expect(screen.getByTestId("ms-submitted-msg")).toBeInTheDocument();
  });

  it("已送出時隱藏輸入區", () => {
    renderMs({
      state: {
        answers: [
          { answerId: "a1", userId: "u1", userName: "Alice", questionIdx: 0, answer: "日本" },
          { answerId: "a2", userId: "u1", userName: "Alice", questionIdx: 1, answer: "拉麵" },
        ],
        revealed: false,
      },
      myUserId: "u1",
    });
    expect(screen.queryByTestId("ms-submit-btn")).not.toBeInTheDocument();
  });
});

describe("MindSync — 揭曉", () => {
  it("點揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderMs({ onReveal });
    fireEvent.click(screen.getByTestId("ms-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("revealed=true 顯示 ms-result", () => {
    renderMs({ state: fullState });
    expect(screen.getByTestId("ms-result")).toBeInTheDocument();
  });

  it("revealed=true 沒有揭曉按鈕", () => {
    renderMs({ state: fullState });
    expect(screen.queryByTestId("ms-reveal-btn")).not.toBeInTheDocument();
  });

  it("無答案時顯示 ms-empty", () => {
    renderMs({ state: { answers: [], revealed: true } });
    expect(screen.getByTestId("ms-empty")).toBeInTheDocument();
  });

  it("每個問題都有結果區塊", () => {
    renderMs({ state: fullState });
    expect(screen.getByTestId("ms-question-result-0")).toBeInTheDocument();
    expect(screen.getByTestId("ms-question-result-1")).toBeInTheDocument();
  });

  it("相同答案分在同一組顯示", () => {
    renderMs({ state: fullState });
    const group = screen.getByTestId("ms-group-0-日本");
    expect(group).toBeInTheDocument();
    expect(group).toHaveTextContent("Alice");
    expect(group).toHaveTextContent("Bob");
  });

  it("不同答案分開顯示", () => {
    renderMs({ state: fullState });
    expect(screen.getByTestId("ms-group-1-拉麵")).toBeInTheDocument();
    expect(screen.getByTestId("ms-group-1-壽司")).toBeInTheDocument();
  });

  it("多人相同答案顯示默契標記", () => {
    renderMs({ state: fullState });
    const group = screen.getByTestId("ms-group-0-日本");
    expect(group).toHaveTextContent("默契");
  });
});
