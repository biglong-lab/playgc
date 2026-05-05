import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmojiReaction, {
  EmojiReactionConfig,
  EmojiReactionState,
  Reaction,
} from "../EmojiReaction";

const baseConfig: EmojiReactionConfig = {
  title: "情緒反應測試",
  prompt: "用一個 Emoji 表達感受",
  maxNote: 20,
};

const emptyState: EmojiReactionState = { reactions: [], revealed: false };

const reactions: Reaction[] = [
  { reactionId: "r1", userId: "u1", userName: "Alice", emoji: "😄", note: "很開心" },
  { reactionId: "r2", userId: "u2", userName: "Bob", emoji: "🤔", note: "" },
  { reactionId: "r3", userId: "u3", userName: "Carol", emoji: "😄", note: "好玩" },
];

const revealedState: EmojiReactionState = { reactions, revealed: true };

function renderEr(overrides: Partial<Parameters<typeof EmojiReaction>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<EmojiReaction {...props} />), props };
}

describe("EmojiReaction — 基本渲染", () => {
  it("顯示標題", () => {
    renderEr();
    expect(screen.getByTestId("er-title")).toHaveTextContent("情緒反應測試");
  });

  it("顯示提示語", () => {
    renderEr();
    expect(screen.getByTestId("er-prompt")).toHaveTextContent("用一個 Emoji 表達感受");
  });

  it("顯示 Emoji 選擇格", () => {
    renderEr();
    expect(screen.getByTestId("er-emoji-grid")).toBeInTheDocument();
  });

  it("顯示人數計數器", () => {
    renderEr();
    expect(screen.getByTestId("er-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderEr();
    expect(screen.getByTestId("er-reveal-btn")).toBeInTheDocument();
  });
});

describe("EmojiReaction — 提交互動", () => {
  it("選擇 Emoji 後顯示輸入欄位和送出鈕", () => {
    renderEr();
    fireEvent.click(screen.getByTestId("er-emoji-😄"));
    expect(screen.getByTestId("er-note-input")).toBeInTheDocument();
    expect(screen.getByTestId("er-submit-btn")).toBeInTheDocument();
  });

  it("未選 Emoji 時不顯示送出鈕", () => {
    renderEr();
    expect(screen.queryByTestId("er-submit-btn")).not.toBeInTheDocument();
  });

  it("點送出呼叫 onSubmit 並帶 emoji", () => {
    const onSubmit = vi.fn();
    renderEr({ onSubmit });
    fireEvent.click(screen.getByTestId("er-emoji-🤩"));
    fireEvent.click(screen.getByTestId("er-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("🤩", "");
  });

  it("點送出呼叫 onSubmit 並帶備註", () => {
    const onSubmit = vi.fn();
    renderEr({ onSubmit });
    fireEvent.click(screen.getByTestId("er-emoji-😌"));
    fireEvent.change(screen.getByTestId("er-note-input"), {
      target: { value: "很放鬆" },
    });
    fireEvent.click(screen.getByTestId("er-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("😌", "很放鬆");
  });

  it("已送出時顯示 er-submitted", () => {
    renderEr({
      state: { reactions: [reactions[0]], revealed: false },
      myUserId: "u1",
    });
    expect(screen.getByTestId("er-submitted")).toBeInTheDocument();
  });

  it("已送出後顯示 Emoji", () => {
    renderEr({
      state: { reactions: [reactions[0]], revealed: false },
      myUserId: "u1",
    });
    expect(screen.getByTestId("er-submitted")).toHaveTextContent("😄");
  });

  it("點公布按鈕呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderEr({ onReveal });
    fireEvent.click(screen.getByTestId("er-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});

describe("EmojiReaction — 公布後顯示", () => {
  it("公布後顯示 er-result", () => {
    renderEr({ state: revealedState });
    expect(screen.getByTestId("er-result")).toBeInTheDocument();
  });

  it("😄 組顯示 2 人", () => {
    renderEr({ state: revealedState });
    expect(screen.getByTestId("er-group-😄")).toHaveTextContent("2 人");
  });

  it("🤔 組顯示 1 人", () => {
    renderEr({ state: revealedState });
    expect(screen.getByTestId("er-group-🤔")).toBeInTheDocument();
  });

  it("顯示個別回應", () => {
    renderEr({ state: revealedState });
    expect(screen.getByTestId("er-reaction-r1")).toBeInTheDocument();
    expect(screen.getByTestId("er-reaction-r2")).toBeInTheDocument();
  });

  it("無回應時顯示 er-empty", () => {
    renderEr({ state: { reactions: [], revealed: true } });
    expect(screen.getByTestId("er-empty")).toBeInTheDocument();
  });

  it("公布後不顯示 Emoji 選擇格", () => {
    renderEr({ state: revealedState });
    expect(screen.queryByTestId("er-emoji-grid")).not.toBeInTheDocument();
  });
});
