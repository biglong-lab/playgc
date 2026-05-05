import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WordLadder, {
  type WordLadderConfig,
  type WordLadderState,
} from "../WordLadder";

const config: WordLadderConfig = {
  title: "詞語接龍",
  prompt: "下一個詞必須以上一個詞的最後一字開頭",
  startWord: "金門",
  maxWordLength: 10,
};

const emptyState: WordLadderState = { chain: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftWord: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderWL(overrides = {}) {
  return render(<WordLadder {...baseProps} {...overrides} />);
}

describe("WordLadder — 基本渲染", () => {
  it("顯示標題", () => {
    renderWL();
    expect(screen.getByTestId("wl-title")).toHaveTextContent("詞語接龍");
  });

  it("顯示提示文字", () => {
    renderWL();
    expect(screen.getByTestId("wl-prompt")).toBeInTheDocument();
  });

  it("顯示起始詞 金門", () => {
    renderWL();
    expect(screen.getByTestId("wl-chain-word-0")).toHaveTextContent("金門");
  });

  it("顯示必須接的字（門）", () => {
    renderWL();
    expect(screen.getByTestId("wl-required-char")).toHaveTextContent("門");
  });

  it("顯示輸入框", () => {
    renderWL();
    expect(screen.getByTestId("wl-input")).toBeInTheDocument();
  });

  it("顯示已接龍人數 0", () => {
    renderWL();
    expect(screen.getByTestId("wl-count")).toHaveTextContent("0");
  });

  it("顯示揭曉按鈕", () => {
    renderWL();
    expect(screen.getByTestId("wl-reveal-btn")).toBeInTheDocument();
  });
});

describe("WordLadder — 送出邏輯", () => {
  it("空白時送出按鈕 disabled", () => {
    renderWL({ draftWord: "" });
    expect(screen.getByTestId("wl-submit-btn")).toBeDisabled();
  });

  it("不以「門」開頭時 disabled", () => {
    renderWL({ draftWord: "蘋果" });
    expect(screen.getByTestId("wl-submit-btn")).toBeDisabled();
  });

  it("不以「門」開頭時顯示錯誤訊息", () => {
    renderWL({ draftWord: "蘋果" });
    expect(screen.getByTestId("wl-error")).toBeInTheDocument();
  });

  it("以「門」開頭時可送出", () => {
    renderWL({ draftWord: "門票" });
    expect(screen.getByTestId("wl-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderWL({ draftWord: "門票", onSubmit });
    fireEvent.click(screen.getByTestId("wl-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderWL({ onDraftChange });
    fireEvent.change(screen.getByTestId("wl-input"), { target: { value: "門票" } });
    expect(onDraftChange).toHaveBeenCalledWith("門票");
  });
});

describe("WordLadder — 鏈條有內容時", () => {
  const stateWithChain: WordLadderState = {
    chain: [
      { entryId: "e1", userId: "u2", userName: "Bob", word: "門票" },
    ],
    revealed: false,
  };

  it("顯示兩個詞（起始詞＋接龍詞）", () => {
    renderWL({ state: stateWithChain });
    expect(screen.getByTestId("wl-chain-word-0")).toHaveTextContent("金門");
    expect(screen.getByTestId("wl-chain-word-1")).toHaveTextContent("門票");
  });

  it("顯示下一個需要的字為「票」", () => {
    renderWL({ state: stateWithChain });
    expect(screen.getByTestId("wl-required-char")).toHaveTextContent("票");
  });
});

describe("WordLadder — 已送出狀態", () => {
  const stateWithMyEntry: WordLadderState = {
    chain: [
      { entryId: "e1", userId: "u1", userName: "Alice", word: "門票" },
    ],
    revealed: false,
  };

  it("已送出顯示確認訊息", () => {
    renderWL({ state: stateWithMyEntry });
    expect(screen.getByTestId("wl-submitted-msg")).toBeInTheDocument();
  });

  it("已送出確認訊息包含送出的詞", () => {
    renderWL({ state: stateWithMyEntry });
    expect(screen.getByTestId("wl-submitted-msg")).toHaveTextContent("門票");
  });
});

describe("WordLadder — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderWL({ onReveal });
    fireEvent.click(screen.getByTestId("wl-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedWith2: WordLadderState = {
    chain: [
      { entryId: "e1", userId: "u1", userName: "Alice", word: "門票" },
      { entryId: "e2", userId: "u2", userName: "Bob", word: "票友" },
    ],
    revealed: true,
  };

  it("顯示 wl-result 容器", () => {
    renderWL({ state: revealedWith2 });
    expect(screen.getByTestId("wl-result")).toBeInTheDocument();
  });

  it("顯示結果第一個詞", () => {
    renderWL({ state: revealedWith2 });
    expect(screen.getByTestId("wl-result-word-0")).toHaveTextContent("門票");
  });

  it("顯示結果第二個詞", () => {
    renderWL({ state: revealedWith2 });
    expect(screen.getByTestId("wl-result-word-1")).toHaveTextContent("票友");
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderWL({ state: revealedWith2 });
    expect(screen.queryByTestId("wl-reveal-btn")).not.toBeInTheDocument();
  });
});
