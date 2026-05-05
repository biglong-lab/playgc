import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ActionItem, { ActionItemConfig, ActionItemState, ActionEntry } from "../ActionItem";

const baseConfig: ActionItemConfig = {
  title: "行動承諾測試",
  prompt: "活動後你打算做什麼？",
  maxLength: 60,
  timeOptions: ["今天", "本週", "本月"],
};

const emptyState: ActionItemState = { actions: [], revealed: false };

const actions: ActionEntry[] = [
  { actionId: "a1", userId: "u1", userName: "Alice", text: "整理今天的筆記", timeframe: "今天" },
  { actionId: "a2", userId: "u2", userName: "Bob", text: "分享給團隊三個重點", timeframe: "本週" },
  { actionId: "a3", userId: "u3", userName: "Carol", text: "讀完推薦的書", timeframe: "本月" },
];

const revealedState: ActionItemState = { actions, revealed: true };

function renderAi(overrides: Partial<Parameters<typeof ActionItem>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<ActionItem {...props} />), props };
}

describe("ActionItem — 基本渲染", () => {
  it("顯示標題", () => {
    renderAi();
    expect(screen.getByTestId("ai-title")).toHaveTextContent("行動承諾測試");
  });

  it("顯示 prompt", () => {
    renderAi();
    expect(screen.getByTestId("ai-prompt")).toHaveTextContent("活動後你打算做什麼？");
  });

  it("顯示時間選項", () => {
    renderAi();
    expect(screen.getByTestId("ai-time-0")).toHaveTextContent("今天");
    expect(screen.getByTestId("ai-time-1")).toHaveTextContent("本週");
    expect(screen.getByTestId("ai-time-2")).toHaveTextContent("本月");
  });

  it("顯示文字輸入框", () => {
    renderAi();
    expect(screen.getByTestId("ai-text-input")).toBeInTheDocument();
  });

  it("顯示已提交人數 0", () => {
    renderAi();
    expect(screen.getByTestId("ai-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderAi();
    expect(screen.getByTestId("ai-reveal-btn")).toBeInTheDocument();
  });
});

describe("ActionItem — 互動", () => {
  it("空輸入時送出鈕 disabled", () => {
    renderAi();
    expect(screen.getByTestId("ai-submit-btn")).toBeDisabled();
  });

  it("有輸入後送出鈕可點", () => {
    renderAi();
    fireEvent.change(screen.getByTestId("ai-text-input"), { target: { value: "複習今天所學" } });
    expect(screen.getByTestId("ai-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶文字和時間框架", () => {
    const onSubmit = vi.fn();
    renderAi({ onSubmit });
    fireEvent.click(screen.getByTestId("ai-time-1"));
    fireEvent.change(screen.getByTestId("ai-text-input"), { target: { value: "整理筆記" } });
    fireEvent.click(screen.getByTestId("ai-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("整理筆記", "本週");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderAi({ onReveal });
    fireEvent.click(screen.getByTestId("ai-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已提交者顯示 ai-my-action", () => {
    const myAction: ActionEntry = {
      actionId: "a99",
      userId: "u4",
      userName: "David",
      text: "明天付諸行動",
      timeframe: "今天",
    };
    renderAi({ state: { actions: [myAction], revealed: false } });
    expect(screen.getByTestId("ai-my-action")).toHaveTextContent("明天付諸行動");
  });

  it("已提交者不顯示輸入框", () => {
    const myAction: ActionEntry = {
      actionId: "a99",
      userId: "u4",
      userName: "David",
      text: "已提交",
      timeframe: "今天",
    };
    renderAi({ state: { actions: [myAction], revealed: false } });
    expect(screen.queryByTestId("ai-text-input")).not.toBeInTheDocument();
  });

  it("已有 3 人提交顯示人數 3", () => {
    renderAi({ state: { actions, revealed: false } });
    expect(screen.getByTestId("ai-count")).toHaveTextContent("3");
  });
});

describe("ActionItem — 公布結果", () => {
  it("公布後顯示 ai-result", () => {
    renderAi({ state: revealedState });
    expect(screen.getByTestId("ai-result")).toBeInTheDocument();
  });

  it("顯示所有行動項目", () => {
    renderAi({ state: revealedState });
    expect(screen.getByTestId("ai-action-a1")).toBeInTheDocument();
    expect(screen.getByTestId("ai-action-a2")).toBeInTheDocument();
    expect(screen.getByTestId("ai-action-a3")).toBeInTheDocument();
  });

  it("行動項目顯示承諾文字", () => {
    renderAi({ state: revealedState });
    expect(screen.getByTestId("ai-action-a1")).toHaveTextContent("整理今天的筆記");
  });

  it("依時間框架分群顯示", () => {
    renderAi({ state: revealedState });
    expect(screen.getByTestId("ai-group-0")).toBeInTheDocument();
  });

  it("無承諾顯示 ai-empty", () => {
    renderAi({ state: { actions: [], revealed: true } });
    expect(screen.getByTestId("ai-empty")).toBeInTheDocument();
  });
});
