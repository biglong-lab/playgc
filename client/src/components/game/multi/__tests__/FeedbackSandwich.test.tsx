import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FeedbackSandwich, {
  type FeedbackSandwichConfig,
  type FeedbackSandwichState,
} from "../FeedbackSandwich";

const config: FeedbackSandwichConfig = {
  title: "三明治反饋",
  targetName: "今天的課程",
  goodPrompt: "最好的是…",
  betterPrompt: "可改的是…",
  goPrompt: "我會…",
  maxLength: 150,
  showAuthor: true,
};

const emptyState: FeedbackSandwichState = { entries: [], revealed: false };
const emptyDraft = { good: "", better: "", go: "" };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draft: emptyDraft,
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderFS(overrides = {}) {
  return render(<FeedbackSandwich {...baseProps} {...overrides} />);
}

describe("FeedbackSandwich — 基本渲染", () => {
  it("顯示標題", () => {
    renderFS();
    expect(screen.getByTestId("fs-title")).toHaveTextContent("三明治反饋");
  });

  it("顯示回饋對象", () => {
    renderFS();
    expect(screen.getByTestId("fs-target")).toHaveTextContent("今天的課程");
  });

  it("顯示三個輸入欄位", () => {
    renderFS();
    expect(screen.getByTestId("fs-input-good")).toBeInTheDocument();
    expect(screen.getByTestId("fs-input-better")).toBeInTheDocument();
    expect(screen.getByTestId("fs-input-go")).toBeInTheDocument();
  });

  it("顯示已送出人數 0", () => {
    renderFS();
    expect(screen.getByTestId("fs-count")).toHaveTextContent("0");
  });

  it("顯示揭曉按鈕", () => {
    renderFS();
    expect(screen.getByTestId("fs-reveal-btn")).toBeInTheDocument();
  });
});

describe("FeedbackSandwich — 送出邏輯", () => {
  it("三欄都空時送出按鈕 disabled", () => {
    renderFS({ draft: emptyDraft });
    expect(screen.getByTestId("fs-submit-btn")).toBeDisabled();
  });

  it("只有 good 有值時仍 disabled", () => {
    renderFS({ draft: { good: "很好", better: "", go: "" } });
    expect(screen.getByTestId("fs-submit-btn")).toBeDisabled();
  });

  it("三欄都有值時可送出", () => {
    renderFS({ draft: { good: "很好", better: "再好點", go: "我去做" } });
    expect(screen.getByTestId("fs-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderFS({ draft: { good: "很好", better: "再好點", go: "我去做" }, onSubmit });
    fireEvent.click(screen.getByTestId("fs-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderFS({ onDraftChange });
    fireEvent.change(screen.getByTestId("fs-input-good"), { target: { value: "精彩" } });
    expect(onDraftChange).toHaveBeenCalledWith("good", "精彩");
  });
});

describe("FeedbackSandwich — 已送出狀態", () => {
  const stateWithMyEntry: FeedbackSandwichState = {
    entries: [
      { entryId: "e1", userId: "u1", userName: "Alice", good: "很棒", better: "可以更短", go: "要實踐" },
    ],
    revealed: false,
  };

  it("已送出顯示確認訊息", () => {
    renderFS({ state: stateWithMyEntry });
    expect(screen.getByTestId("fs-submitted-msg")).toBeInTheDocument();
  });

  it("已送出隱藏輸入區", () => {
    renderFS({ state: stateWithMyEntry });
    expect(screen.queryByTestId("fs-input-good")).not.toBeInTheDocument();
  });
});

describe("FeedbackSandwich — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderFS({ onReveal });
    fireEvent.click(screen.getByTestId("fs-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: FeedbackSandwichState = { entries: [], revealed: true };

  it("揭曉空白顯示 fs-empty", () => {
    renderFS({ state: revealedEmpty });
    expect(screen.getByTestId("fs-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderFS({ state: revealedEmpty });
    expect(screen.queryByTestId("fs-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWithEntry: FeedbackSandwichState = {
    entries: [
      { entryId: "e1", userId: "u2", userName: "Bob", good: "內容豐富", better: "可更互動", go: "回去複習" },
    ],
    revealed: true,
  };

  it("顯示 fs-result 容器", () => {
    renderFS({ state: revealedWithEntry });
    expect(screen.getByTestId("fs-result")).toBeInTheDocument();
  });

  it("顯示三個區段", () => {
    renderFS({ state: revealedWithEntry });
    expect(screen.getByTestId("fs-section-good")).toBeInTheDocument();
    expect(screen.getByTestId("fs-section-better")).toBeInTheDocument();
    expect(screen.getByTestId("fs-section-go")).toBeInTheDocument();
  });

  it("顯示 good 欄的條目", () => {
    renderFS({ state: revealedWithEntry });
    expect(screen.getByTestId("fs-good-e1")).toBeInTheDocument();
  });

  it("顯示作者名稱（showAuthor=true）", () => {
    renderFS({ state: revealedWithEntry });
    expect(screen.getByTestId("fs-author-good-e1")).toHaveTextContent("Bob");
  });

  it("不顯示作者（showAuthor=false）", () => {
    renderFS({
      state: revealedWithEntry,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("fs-author-good-e1")).not.toBeInTheDocument();
  });
});
