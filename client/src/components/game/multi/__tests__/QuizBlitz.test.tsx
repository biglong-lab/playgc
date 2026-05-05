import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuizBlitz, {
  QuizBlitzConfig,
  QuizBlitzState,
} from "../QuizBlitz";

const questions = [
  {
    questionId: "q1",
    text: "台灣最高的山是？",
    options: ["玉山", "合歡山", "雪山", "阿里山"],
    correctIndex: 0,
  },
  {
    questionId: "q2",
    text: "台灣最長的河流是？",
    options: ["淡水河", "濁水溪", "高屏溪", "大甲溪"],
    correctIndex: 1,
  },
];

const baseConfig: QuizBlitzConfig = {
  title: "地理大考驗",
  questions,
  showLeaderboard: true,
};

const waitingState: QuizBlitzState = {
  currentQuestionIndex: -1,
  answers: [],
  phase: "waiting",
};

const questionState: QuizBlitzState = {
  currentQuestionIndex: 0,
  answers: [],
  phase: "question",
};

const answeredState: QuizBlitzState = {
  currentQuestionIndex: 0,
  answers: [
    {
      userId: "u1",
      userName: "Alice",
      questionId: "q1",
      answerIndex: 0,
      answeredAt: 1000,
    },
  ],
  phase: "question",
};

const revealState: QuizBlitzState = {
  currentQuestionIndex: 0,
  answers: [
    {
      userId: "u1",
      userName: "Alice",
      questionId: "q1",
      answerIndex: 0,
      answeredAt: 1000,
    },
    {
      userId: "u2",
      userName: "Bob",
      questionId: "q1",
      answerIndex: 2,
      answeredAt: 2000,
    },
  ],
  phase: "reveal",
};

const doneState: QuizBlitzState = {
  currentQuestionIndex: 1,
  answers: [
    {
      userId: "u1",
      userName: "Alice",
      questionId: "q1",
      answerIndex: 0,
      answeredAt: 1000,
    },
    {
      userId: "u2",
      userName: "Bob",
      questionId: "q1",
      answerIndex: 2,
      answeredAt: 2000,
    },
    {
      userId: "u1",
      userName: "Alice",
      questionId: "q2",
      answerIndex: 1,
      answeredAt: 3000,
    },
    {
      userId: "u2",
      userName: "Bob",
      questionId: "q2",
      answerIndex: 1,
      answeredAt: 4000,
    },
  ],
  phase: "done",
};

function renderQb(
  overrides: Partial<Parameters<typeof QuizBlitz>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: waitingState,
    myUserId: "u1",
    onAnswer: vi.fn(),
    onAdvance: vi.fn(),
    ...overrides,
  };
  return { ...render(<QuizBlitz {...props} />), props };
}

describe("QuizBlitz — 基本渲染", () => {
  it("顯示標題", () => {
    renderQb();
    expect(screen.getByTestId("qb-title")).toHaveTextContent("地理大考驗");
  });

  it("顯示題數", () => {
    renderQb();
    expect(screen.getByTestId("qb-question-count")).toBeInTheDocument();
  });

  it("等待階段顯示正確 phase 標籤", () => {
    renderQb();
    expect(screen.getByTestId("qb-phase")).toHaveTextContent("等待開始");
  });
});

describe("QuizBlitz — 等待階段", () => {
  it("顯示開始按鈕", () => {
    renderQb();
    expect(screen.getByTestId("qb-advance-btn")).toBeInTheDocument();
  });

  it("點開始呼叫 onAdvance", () => {
    const onAdvance = vi.fn();
    renderQb({ onAdvance });
    fireEvent.click(screen.getByTestId("qb-advance-btn"));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("QuizBlitz — 作答階段", () => {
  it("顯示題目文字", () => {
    renderQb({ state: questionState });
    expect(screen.getByTestId("qb-question-text")).toHaveTextContent(
      "台灣最高的山是？"
    );
  });

  it("顯示四個選項", () => {
    renderQb({ state: questionState });
    expect(screen.getByTestId("qb-option-0")).toBeInTheDocument();
    expect(screen.getByTestId("qb-option-1")).toBeInTheDocument();
    expect(screen.getByTestId("qb-option-2")).toBeInTheDocument();
    expect(screen.getByTestId("qb-option-3")).toBeInTheDocument();
  });

  it("點選項呼叫 onAnswer", () => {
    const onAnswer = vi.fn();
    renderQb({ state: questionState, onAnswer });
    fireEvent.click(screen.getByTestId("qb-option-2"));
    expect(onAnswer).toHaveBeenCalledWith("q1", 2);
  });

  it("已作答後選項 disabled", () => {
    renderQb({ state: answeredState });
    expect(screen.getByTestId("qb-option-1")).toBeDisabled();
  });

  it("顯示揭曉按鈕", () => {
    renderQb({ state: questionState });
    expect(screen.getByTestId("qb-advance-btn")).toBeInTheDocument();
  });

  it("點揭曉呼叫 onAdvance", () => {
    const onAdvance = vi.fn();
    renderQb({ state: questionState, onAdvance });
    fireEvent.click(screen.getByTestId("qb-advance-btn"));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("QuizBlitz — 揭曉階段", () => {
  it("顯示揭曉 phase 標籤", () => {
    renderQb({ state: revealState });
    expect(screen.getByTestId("qb-phase")).toHaveTextContent("揭曉");
  });

  it("答對時顯示 correct badge", () => {
    renderQb({ state: revealState });
    expect(screen.getByTestId("qb-correct-badge")).toBeInTheDocument();
  });

  it("答錯時不顯示 correct badge", () => {
    renderQb({ state: revealState, myUserId: "u2" });
    expect(
      screen.queryByTestId("qb-correct-badge")
    ).not.toBeInTheDocument();
  });

  it("顯示下一步按鈕", () => {
    renderQb({ state: revealState });
    expect(screen.getByTestId("qb-advance-btn")).toBeInTheDocument();
  });

  it("點揭曉呼叫 onAdvance", () => {
    const onAdvance = vi.fn();
    renderQb({ state: revealState, onAdvance });
    fireEvent.click(screen.getByTestId("qb-advance-btn"));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("QuizBlitz — 結束排行榜", () => {
  it("顯示結束 phase 標籤", () => {
    renderQb({ state: doneState });
    expect(screen.getByTestId("qb-phase")).toHaveTextContent("結束");
  });

  it("顯示排行榜", () => {
    renderQb({ state: doneState });
    expect(screen.getByTestId("qb-leaderboard")).toBeInTheDocument();
  });

  it("顯示各玩家得分", () => {
    renderQb({ state: doneState });
    expect(screen.getByTestId("qb-score-u1")).toBeInTheDocument();
    expect(screen.getByTestId("qb-score-u2")).toBeInTheDocument();
  });

  it("顯示冠軍", () => {
    renderQb({ state: doneState });
    expect(screen.getByTestId("qb-winner")).toBeInTheDocument();
  });

  it("無作答時顯示 qb-empty", () => {
    renderQb({
      state: { currentQuestionIndex: 1, answers: [], phase: "done" },
    });
    expect(screen.getByTestId("qb-empty")).toBeInTheDocument();
  });
});
