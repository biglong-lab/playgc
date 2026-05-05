import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DailyIntention, {
  DailyIntentionConfig,
  DailyIntentionState,
  IntentionCard,
} from "../DailyIntention";

const baseConfig: DailyIntentionConfig = {
  title: "今日意圖測試",
  prompt: "你今天的意圖是？",
  maxLength: 60,
};

const emptyState: DailyIntentionState = { intentions: [], revealed: false };

const cards: IntentionCard[] = [
  { intentionId: "c1", userId: "u1", userName: "Alice", text: "保持專注" },
  { intentionId: "c2", userId: "u2", userName: "Bob", text: "主動發言" },
  { intentionId: "c3", userId: "u3", userName: "Carol", text: "認真聆聽" },
];

const revealedState: DailyIntentionState = { intentions: cards, revealed: true };

function renderDi(overrides: Partial<Parameters<typeof DailyIntention>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<DailyIntention {...props} />), props };
}

describe("DailyIntention — 基本渲染", () => {
  it("顯示標題", () => {
    renderDi();
    expect(screen.getByTestId("di-title")).toHaveTextContent("今日意圖測試");
  });

  it("顯示 prompt", () => {
    renderDi();
    expect(screen.getByTestId("di-prompt")).toHaveTextContent("你今天的意圖是？");
  });

  it("顯示輸入框", () => {
    renderDi();
    expect(screen.getByTestId("di-input")).toBeInTheDocument();
  });

  it("顯示送出按鈕", () => {
    renderDi();
    expect(screen.getByTestId("di-submit-btn")).toBeInTheDocument();
  });

  it("顯示已填寫人數 0", () => {
    renderDi();
    expect(screen.getByTestId("di-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderDi();
    expect(screen.getByTestId("di-reveal-btn")).toBeInTheDocument();
  });
});

describe("DailyIntention — 互動", () => {
  it("空輸入時送出鈕 disabled", () => {
    renderDi();
    expect(screen.getByTestId("di-submit-btn")).toBeDisabled();
  });

  it("有輸入後送出鈕可點", () => {
    renderDi();
    fireEvent.change(screen.getByTestId("di-input"), {
      target: { value: "保持專注" },
    });
    expect(screen.getByTestId("di-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶正確文字", () => {
    const onSubmit = vi.fn();
    renderDi({ onSubmit });
    fireEvent.change(screen.getByTestId("di-input"), {
      target: { value: "今天好好學習" },
    });
    fireEvent.click(screen.getByTestId("di-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("今天好好學習");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderDi({ onReveal });
    fireEvent.click(screen.getByTestId("di-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已提交者顯示 di-my-card", () => {
    const myCard: IntentionCard = {
      intentionId: "c99",
      userId: "u4",
      userName: "David",
      text: "認真聆聽",
    };
    renderDi({
      state: { intentions: [myCard], revealed: false },
      myUserId: "u4",
    });
    expect(screen.getByTestId("di-my-card")).toHaveTextContent("認真聆聽");
  });

  it("已提交者不顯示輸入框", () => {
    const myCard: IntentionCard = {
      intentionId: "c99",
      userId: "u4",
      userName: "David",
      text: "認真聆聽",
    };
    renderDi({
      state: { intentions: [myCard], revealed: false },
      myUserId: "u4",
    });
    expect(screen.queryByTestId("di-input")).not.toBeInTheDocument();
  });

  it("已有 3 人提交顯示人數 3", () => {
    renderDi({ state: { intentions: cards, revealed: false } });
    expect(screen.getByTestId("di-count")).toHaveTextContent("3");
  });
});

describe("DailyIntention — 公布結果", () => {
  it("公布後顯示 di-result", () => {
    renderDi({ state: revealedState });
    expect(screen.getByTestId("di-result")).toBeInTheDocument();
  });

  it("公布後顯示所有意圖卡", () => {
    renderDi({ state: revealedState });
    expect(screen.getByTestId("di-card-c1")).toBeInTheDocument();
    expect(screen.getByTestId("di-card-c2")).toBeInTheDocument();
    expect(screen.getByTestId("di-card-c3")).toBeInTheDocument();
  });

  it("卡片顯示意圖文字", () => {
    renderDi({ state: revealedState });
    expect(screen.getByTestId("di-card-c1")).toHaveTextContent("保持專注");
  });

  it("卡片顯示使用者名字", () => {
    renderDi({ state: revealedState });
    expect(screen.getByTestId("di-card-c1")).toHaveTextContent("Alice");
  });

  it("無人提交顯示 di-empty", () => {
    renderDi({ state: { intentions: [], revealed: true } });
    expect(screen.getByTestId("di-empty")).toBeInTheDocument();
  });
});
