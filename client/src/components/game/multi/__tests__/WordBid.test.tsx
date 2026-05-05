import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WordBid, {
  type WordBidConfig,
  type WordBidState,
} from "../WordBid";

const config: WordBidConfig = {
  title: "字詞競標",
  topic: "台灣之美",
  prompt: "用一個詞代表這個主題！",
  maxWordLength: 8,
  maxVotesPerPerson: 2,
};

const emptyState: WordBidState = { words: [], votes: [], phase: "submit" };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftWord: "",
  onDraftChange: vi.fn(),
  onSubmitWord: vi.fn(),
  onVote: vi.fn(),
  onAdvancePhase: vi.fn(),
};

function renderWB(overrides: Partial<typeof baseProps> = {}) {
  return render(<WordBid {...baseProps} {...overrides} />);
}

describe("WordBid — 基本渲染", () => {
  it("顯示標題", () => {
    renderWB();
    expect(screen.getByTestId("wb-title")).toHaveTextContent("字詞競標");
  });

  it("顯示主題", () => {
    renderWB();
    expect(screen.getByTestId("wb-topic")).toHaveTextContent("台灣之美");
  });

  it("顯示提示語", () => {
    renderWB();
    expect(screen.getByTestId("wb-prompt")).toHaveTextContent("用一個詞代表");
  });

  it("顯示 phase 標示（submit）", () => {
    renderWB();
    expect(screen.getByTestId("wb-phase")).toHaveTextContent("提交階段");
  });

  it("顯示計數", () => {
    renderWB();
    expect(screen.getByTestId("wb-count")).toBeInTheDocument();
  });

  it("顯示輸入框（submit phase）", () => {
    renderWB();
    expect(screen.getByTestId("wb-input")).toBeInTheDocument();
  });

  it("顯示進入投票按鈕", () => {
    renderWB();
    expect(screen.getByTestId("wb-advance-btn")).toBeInTheDocument();
  });
});

describe("WordBid — 提交詞語", () => {
  it("空白輸入送出按鈕 disabled", () => {
    renderWB({ draftWord: "" });
    expect(screen.getByTestId("wb-submit-btn")).toBeDisabled();
  });

  it("有效輸入送出按鈕 enabled", () => {
    renderWB({ draftWord: "友善" });
    expect(screen.getByTestId("wb-submit-btn")).not.toBeDisabled();
  });

  it("超過 maxWordLength 顯示錯誤", () => {
    renderWB({ draftWord: "a".repeat(10) });
    expect(screen.getByTestId("wb-error")).toBeInTheDocument();
  });

  it("超過 maxWordLength 送出按鈕 disabled", () => {
    renderWB({ draftWord: "a".repeat(10) });
    expect(screen.getByTestId("wb-submit-btn")).toBeDisabled();
  });

  it("點送出觸發 onSubmitWord", () => {
    const onSubmitWord = vi.fn();
    renderWB({ draftWord: "友善", onSubmitWord });
    fireEvent.click(screen.getByTestId("wb-submit-btn"));
    expect(onSubmitWord).toHaveBeenCalledOnce();
  });

  it("onChange 觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderWB({ onDraftChange });
    fireEvent.change(screen.getByTestId("wb-input"), { target: { value: "美麗" } });
    expect(onDraftChange).toHaveBeenCalledWith("美麗");
  });

  it("已提交後顯示 wb-submitted-msg", () => {
    const state: WordBidState = {
      words: [{ wordId: "w1", userId: "u1", userName: "Alice", word: "友善" }],
      votes: [],
      phase: "submit",
    };
    renderWB({ state });
    expect(screen.getByTestId("wb-submitted-msg")).toBeInTheDocument();
  });

  it("已提交後 submitted-msg 包含詞語", () => {
    const state: WordBidState = {
      words: [{ wordId: "w1", userId: "u1", userName: "Alice", word: "友善" }],
      votes: [],
      phase: "submit",
    };
    renderWB({ state });
    expect(screen.getByTestId("wb-submitted-msg")).toHaveTextContent("友善");
  });
});

describe("WordBid — 投票階段", () => {
  const stateVote: WordBidState = {
    words: [
      { wordId: "w1", userId: "u2", userName: "Bob", word: "熱情" },
      { wordId: "w2", userId: "u3", userName: "Carol", word: "自然" },
    ],
    votes: [],
    phase: "vote",
  };

  it("顯示 vote phase 標示", () => {
    renderWB({ state: stateVote });
    expect(screen.getByTestId("wb-phase")).toHaveTextContent("投票階段");
  });

  it("顯示所有詞語", () => {
    renderWB({ state: stateVote });
    expect(screen.getByTestId("wb-word-w1")).toBeInTheDocument();
    expect(screen.getByTestId("wb-word-w2")).toBeInTheDocument();
  });

  it("點投票觸發 onVote", () => {
    const onVote = vi.fn();
    renderWB({ state: stateVote, onVote });
    fireEvent.click(screen.getByTestId("wb-vote-btn-w1"));
    expect(onVote).toHaveBeenCalledWith("w1");
  });

  it("已投票的詞語顯示已投", () => {
    const state: WordBidState = {
      ...stateVote,
      votes: [{ voterId: "u1", wordId: "w1" }],
    };
    renderWB({ state });
    expect(screen.getByTestId("wb-vote-btn-w1")).toHaveTextContent("✓ 已投");
  });

  it("有票數時顯示票數", () => {
    const state: WordBidState = {
      ...stateVote,
      votes: [{ voterId: "u2", wordId: "w1" }],
    };
    renderWB({ state });
    expect(screen.getByTestId("wb-vote-count-w1")).toHaveTextContent("1 票");
  });
});

describe("WordBid — 結果階段", () => {
  const stateResult: WordBidState = {
    words: [
      { wordId: "w1", userId: "u1", userName: "Alice", word: "友善" },
      { wordId: "w2", userId: "u2", userName: "Bob", word: "熱情" },
    ],
    votes: [
      { voterId: "u2", wordId: "w1" },
      { voterId: "u3", wordId: "w1" },
      { voterId: "u1", wordId: "w2" },
    ],
    phase: "result",
  };

  it("顯示 result phase 標示", () => {
    renderWB({ state: stateResult });
    expect(screen.getByTestId("wb-phase")).toHaveTextContent("結果揭曉");
  });

  it("顯示 wb-result", () => {
    renderWB({ state: stateResult });
    expect(screen.getByTestId("wb-result")).toBeInTheDocument();
  });

  it("顯示每個詞語的結果", () => {
    renderWB({ state: stateResult });
    expect(screen.getByTestId("wb-result-word-w1")).toBeInTheDocument();
    expect(screen.getByTestId("wb-result-word-w2")).toBeInTheDocument();
  });

  it("顯示正確票數", () => {
    renderWB({ state: stateResult });
    expect(screen.getByTestId("wb-result-count-w1")).toHaveTextContent("2 票");
    expect(screen.getByTestId("wb-result-count-w2")).toHaveTextContent("1 票");
  });

  it("無詞語時顯示 wb-empty", () => {
    const empty: WordBidState = { words: [], votes: [], phase: "result" };
    renderWB({ state: empty });
    expect(screen.getByTestId("wb-empty")).toBeInTheDocument();
  });

  it("點進入下一階段觸發 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderWB({ onAdvancePhase });
    fireEvent.click(screen.getByTestId("wb-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledOnce();
  });
});
