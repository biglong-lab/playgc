import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AudienceQ, {
  AudienceQConfig,
  AudienceQState,
  AudQuestion,
} from "../AudienceQ";

const baseConfig: AudienceQConfig = {
  title: "現場提問",
  prompt: "有什麼想問的嗎？",
  maxLength: 50,
  showAuthor: true,
};

const emptyState: AudienceQState = { questions: [] };

const q1: AudQuestion = {
  questionId: "q1",
  userId: "u2",
  userName: "Bob",
  text: "這個活動多久一次？",
  votes: ["u1", "u3"],
  answered: false,
};

const q2: AudQuestion = {
  questionId: "q2",
  userId: "u3",
  userName: "Carol",
  text: "可以帶朋友來嗎？",
  votes: [],
  answered: true,
};

const withQState: AudienceQState = { questions: [q1, q2] };

function renderAq(
  overrides: Partial<Parameters<typeof AudienceQ>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onSubmitQuestion: vi.fn(),
    onUpvote: vi.fn(),
    onMarkAnswered: vi.fn(),
    ...overrides,
  };
  return { ...render(<AudienceQ {...props} />), props };
}

describe("AudienceQ — 基本渲染", () => {
  it("顯示標題", () => {
    renderAq();
    expect(screen.getByTestId("aq-title")).toHaveTextContent(
      "現場提問"
    );
  });

  it("顯示提示語", () => {
    renderAq();
    expect(screen.getByTestId("aq-prompt")).toHaveTextContent(
      "有什麼想問的嗎？"
    );
  });

  it("空列表顯示 aq-empty", () => {
    renderAq();
    expect(screen.getByTestId("aq-empty")).toBeInTheDocument();
  });

  it("顯示問題數量", () => {
    renderAq();
    expect(screen.getByTestId("aq-question-count")).toBeInTheDocument();
  });
});

describe("AudienceQ — 送出問題", () => {
  it("輸入框存在", () => {
    renderAq();
    expect(screen.getByTestId("aq-input")).toBeInTheDocument();
  });

  it("空白時送出鈕 disabled", () => {
    renderAq();
    expect(screen.getByTestId("aq-submit-btn")).toBeDisabled();
  });

  it("有內容時送出鈕可點", () => {
    renderAq();
    fireEvent.change(screen.getByTestId("aq-input"), {
      target: { value: "請問下次活動什麼時候？" },
    });
    expect(screen.getByTestId("aq-submit-btn")).not.toBeDisabled();
  });

  it("超過 maxLength 顯示錯誤", () => {
    renderAq({ config: { ...baseConfig, maxLength: 5 } });
    fireEvent.change(screen.getByTestId("aq-input"), {
      target: { value: "超過五個字的問題哈哈哈哈" },
    });
    expect(screen.getByTestId("aq-char-error")).toBeInTheDocument();
  });

  it("超過 maxLength 送出鈕 disabled", () => {
    renderAq({ config: { ...baseConfig, maxLength: 5 } });
    fireEvent.change(screen.getByTestId("aq-input"), {
      target: { value: "超過五個字的問題哈哈哈哈" },
    });
    expect(screen.getByTestId("aq-submit-btn")).toBeDisabled();
  });

  it("點送出呼叫 onSubmitQuestion", () => {
    const onSubmitQuestion = vi.fn();
    renderAq({ onSubmitQuestion });
    fireEvent.change(screen.getByTestId("aq-input"), {
      target: { value: "請問講師是誰？" },
    });
    fireEvent.click(screen.getByTestId("aq-submit-btn"));
    expect(onSubmitQuestion).toHaveBeenCalledWith("請問講師是誰？");
  });

  it("已送出問題顯示 aq-submitted-msg", () => {
    renderAq({
      state: {
        questions: [
          {
            questionId: "q99",
            userId: "u1",
            userName: "Alice",
            text: "我的問題",
            votes: [],
            answered: false,
          },
        ],
      },
    });
    expect(screen.getByTestId("aq-submitted-msg")).toBeInTheDocument();
  });

  it("已送出問題後不顯示輸入框", () => {
    renderAq({
      state: {
        questions: [
          {
            questionId: "q99",
            userId: "u1",
            userName: "Alice",
            text: "我的問題",
            votes: [],
            answered: false,
          },
        ],
      },
    });
    expect(screen.queryByTestId("aq-input")).not.toBeInTheDocument();
  });
});

describe("AudienceQ — 問題列表", () => {
  it("顯示問題文字", () => {
    renderAq({ state: withQState });
    expect(screen.getByTestId("aq-question-q1")).toHaveTextContent(
      "這個活動多久一次？"
    );
  });

  it("顯示作者（showAuthor=true）", () => {
    renderAq({ state: withQState });
    expect(screen.getByTestId("aq-author-q1")).toHaveTextContent(
      "Bob"
    );
  });

  it("隱藏作者（showAuthor=false）", () => {
    renderAq({
      config: { ...baseConfig, showAuthor: false },
      state: withQState,
    });
    expect(screen.queryByTestId("aq-author-q1")).not.toBeInTheDocument();
  });

  it("顯示按讚按鈕", () => {
    renderAq({ state: withQState });
    expect(screen.getByTestId("aq-upvote-q1")).toBeInTheDocument();
  });

  it("顯示讚數", () => {
    renderAq({ state: withQState });
    expect(screen.getByTestId("aq-vote-count-q1")).toHaveTextContent(
      "2"
    );
  });

  it("點讚呼叫 onUpvote", () => {
    const onUpvote = vi.fn();
    renderAq({ state: withQState, onUpvote });
    fireEvent.click(screen.getByTestId("aq-upvote-q1"));
    expect(onUpvote).toHaveBeenCalledWith("q1");
  });

  it("未回答問題顯示已回答按鈕", () => {
    renderAq({ state: withQState });
    expect(
      screen.getByTestId("aq-mark-answered-q1")
    ).toBeInTheDocument();
  });

  it("點已回答呼叫 onMarkAnswered", () => {
    const onMarkAnswered = vi.fn();
    renderAq({ state: withQState, onMarkAnswered });
    fireEvent.click(screen.getByTestId("aq-mark-answered-q1"));
    expect(onMarkAnswered).toHaveBeenCalledWith("q1");
  });

  it("已回答問題顯示 aq-answered-badge", () => {
    renderAq({ state: withQState });
    expect(
      screen.getByTestId("aq-answered-badge-q2")
    ).toBeInTheDocument();
  });

  it("已回答問題不顯示已回答按鈕", () => {
    renderAq({ state: withQState });
    expect(
      screen.queryByTestId("aq-mark-answered-q2")
    ).not.toBeInTheDocument();
  });

  it("已回答問題讚按鈕 disabled", () => {
    renderAq({ state: withQState });
    expect(screen.getByTestId("aq-upvote-q2")).toBeDisabled();
  });
});
