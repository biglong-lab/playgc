import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SentenceCompletion, {
  type SentenceCompletionConfig,
  type SentenceCompletionState,
} from "../SentenceCompletion";

const config: SentenceCompletionConfig = {
  title: "句子接龍",
  starter: "我認為…",
  maxLength: 80,
  maxPerPerson: 1,
  reactions: ["❤️", "😂"],
  showAuthor: true,
};

const emptyState: SentenceCompletionState = { entries: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
  onReact: vi.fn(),
};

function renderSC(overrides = {}) {
  return render(<SentenceCompletion {...baseProps} {...overrides} />);
}

describe("SentenceCompletion — 基本渲染", () => {
  it("顯示標題", () => {
    renderSC();
    expect(screen.getByTestId("sc-title")).toHaveTextContent("句子接龍");
  });

  it("顯示 starter", () => {
    renderSC();
    expect(screen.getByTestId("sc-starter")).toHaveTextContent("我認為…");
  });

  it("顯示已送出數量", () => {
    renderSC();
    expect(screen.getByTestId("sc-count")).toHaveTextContent("0");
  });

  it("顯示輸入框", () => {
    renderSC();
    expect(screen.getByTestId("sc-input")).toBeInTheDocument();
  });

  it("顯示剩餘字數", () => {
    renderSC({ draftText: "abc" });
    expect(screen.getByTestId("sc-chars-left")).toHaveTextContent("77");
  });
});

describe("SentenceCompletion — 送出邏輯", () => {
  it("空白時送出按鈕 disabled", () => {
    renderSC({ draftText: "" });
    expect(screen.getByTestId("sc-submit-btn")).toBeDisabled();
  });

  it("有文字時送出按鈕可點", () => {
    renderSC({ draftText: "很好！" });
    expect(screen.getByTestId("sc-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderSC({ draftText: "很好！", onSubmit });
    fireEvent.click(screen.getByTestId("sc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderSC({ onDraftChange });
    fireEvent.change(screen.getByTestId("sc-input"), { target: { value: "測試" } });
    expect(onDraftChange).toHaveBeenCalledWith("測試");
  });
});

describe("SentenceCompletion — 達上限", () => {
  const stateWithMyEntry: SentenceCompletionState = {
    entries: [
      { entryId: "e1", userId: "u1", userName: "User1", text: "已送出", reactions: {} },
    ],
    revealed: false,
  };

  it("達上限顯示提示，隱藏輸入框", () => {
    renderSC({ state: stateWithMyEntry });
    expect(screen.getByTestId("sc-limit-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("sc-input")).not.toBeInTheDocument();
  });

  it("達上限送出按鈕 disabled（即使有 draftText）", () => {
    renderSC({ state: stateWithMyEntry, draftText: "還要繼續" });
    expect(screen.queryByTestId("sc-submit-btn")).not.toBeInTheDocument();
  });
});

describe("SentenceCompletion — 揭曉前", () => {
  it("顯示揭曉按鈕", () => {
    renderSC();
    expect(screen.getByTestId("sc-reveal-btn")).toBeInTheDocument();
  });

  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderSC({ onReveal });
    fireEvent.click(screen.getByTestId("sc-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("揭曉前不顯示 sc-entries", () => {
    renderSC();
    expect(screen.queryByTestId("sc-entries")).not.toBeInTheDocument();
  });
});

describe("SentenceCompletion — 揭曉後", () => {
  const revealed: SentenceCompletionState = { entries: [], revealed: true };

  it("空白時顯示 sc-empty", () => {
    renderSC({ state: revealed });
    expect(screen.getByTestId("sc-empty")).toBeInTheDocument();
  });

  it("顯示 sc-entries 容器", () => {
    renderSC({ state: revealed });
    expect(screen.getByTestId("sc-entries")).toBeInTheDocument();
  });

  const revealedWithEntry: SentenceCompletionState = {
    entries: [
      {
        entryId: "e1",
        userId: "u2",
        userName: "Alice",
        text: "很棒的結局",
        reactions: { "❤️": ["u1"], "😂": [] },
      },
    ],
    revealed: true,
  };

  it("顯示作者名稱（showAuthor=true）", () => {
    renderSC({ state: revealedWithEntry });
    expect(screen.getByTestId("sc-author-e1")).toHaveTextContent("Alice");
  });

  it("不顯示作者名稱（showAuthor=false）", () => {
    renderSC({
      state: revealedWithEntry,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("sc-author-e1")).not.toBeInTheDocument();
  });

  it("顯示句子文字", () => {
    renderSC({ state: revealedWithEntry });
    expect(screen.getByTestId("sc-text-e1")).toHaveTextContent("很棒的結局");
  });

  it("顯示已有反應數量", () => {
    renderSC({ state: revealedWithEntry });
    expect(screen.getByTestId("sc-react-count-e1-❤️")).toHaveTextContent("1");
  });

  it("點反應觸發 onReact", () => {
    const onReact = vi.fn();
    renderSC({ state: revealedWithEntry, onReact });
    fireEvent.click(screen.getByTestId("sc-react-e1-❤️"));
    expect(onReact).toHaveBeenCalledWith("e1", "❤️");
  });

  it("已按讚顯示高亮樣式", () => {
    renderSC({ state: revealedWithEntry });
    const btn = screen.getByTestId("sc-react-e1-❤️");
    expect(btn.className).toContain("bg-purple-100");
  });

  it("未按讚顯示預設樣式", () => {
    renderSC({ state: revealedWithEntry });
    const btn = screen.getByTestId("sc-react-e1-😂");
    expect(btn.className).toContain("bg-gray-50");
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderSC({ state: revealed });
    expect(screen.queryByTestId("sc-reveal-btn")).not.toBeInTheDocument();
  });
});
