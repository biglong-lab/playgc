import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmojiStory, { EmojiStoryConfig, EmojiStoryState } from "../EmojiStory";

const baseConfig: EmojiStoryConfig = {
  title: "Emoji 故事",
  prompt: "選 3 個 Emoji",
  emojiOptions: [],
  maxEmojis: 3,
  captionMaxLength: 20,
  showAuthor: true,
};

const emptyState: EmojiStoryState = {
  stories: [],
  revealed: false,
};

const storyState: EmojiStoryState = {
  stories: [
    {
      storyId: "s1",
      userId: "u1",
      userName: "Alice",
      emojis: ["😊", "🔥", "⭐"],
      caption: "好開心",
      hearts: [],
    },
    {
      storyId: "s2",
      userId: "u2",
      userName: "Bob",
      emojis: ["😴", "🍕", "🎮"],
      caption: "",
      hearts: ["u1"],
    },
  ],
  revealed: true,
};

function renderEs(
  overrides: Partial<Parameters<typeof EmojiStory>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    onHeart: vi.fn(),
    ...overrides,
  };
  return { ...render(<EmojiStory {...props} />), props };
}

describe("EmojiStory — 基本渲染", () => {
  it("顯示標題", () => {
    renderEs();
    expect(screen.getByTestId("es-title")).toHaveTextContent("Emoji 故事");
  });

  it("顯示提示語", () => {
    renderEs();
    expect(screen.getByTestId("es-prompt")).toHaveTextContent("選 3 個 Emoji");
  });

  it("顯示已創作人數", () => {
    renderEs();
    expect(screen.getByTestId("es-count")).toBeInTheDocument();
  });

  it("未送出時顯示揭曉按鈕", () => {
    renderEs();
    expect(screen.getByTestId("es-reveal-btn")).toBeInTheDocument();
  });
});

describe("EmojiStory — Emoji 選擇", () => {
  it("預設顯示 DEFAULT_EMOJIS（30 個按鈕）", () => {
    renderEs();
    expect(screen.getByTestId("es-emoji-btn-😊")).toBeInTheDocument();
    expect(screen.getByTestId("es-emoji-btn-🎵")).toBeInTheDocument();
  });

  it("使用自訂 emojiOptions", () => {
    renderEs({ config: { ...baseConfig, emojiOptions: ["🐶", "🐱"] } });
    expect(screen.getByTestId("es-emoji-btn-🐶")).toBeInTheDocument();
    expect(screen.queryByTestId("es-emoji-btn-😊")).not.toBeInTheDocument();
  });

  it("點擊 emoji 加入已選清單", () => {
    renderEs();
    fireEvent.click(screen.getByTestId("es-emoji-btn-😊"));
    expect(screen.getByTestId("es-selected-emoji-0")).toBeInTheDocument();
  });

  it("已選數量 < maxEmojis 時送出鈕 disabled", () => {
    renderEs();
    fireEvent.click(screen.getByTestId("es-emoji-btn-😊"));
    expect(screen.getByTestId("es-submit-btn")).toBeDisabled();
  });

  it("達到 maxEmojis 送出鈕可點", () => {
    renderEs();
    fireEvent.click(screen.getByTestId("es-emoji-btn-😊"));
    fireEvent.click(screen.getByTestId("es-emoji-btn-🔥"));
    fireEvent.click(screen.getByTestId("es-emoji-btn-⭐"));
    expect(screen.getByTestId("es-submit-btn")).not.toBeDisabled();
  });

  it("超過 maxEmojis 時舊的被移除", () => {
    renderEs();
    fireEvent.click(screen.getByTestId("es-emoji-btn-😊"));
    fireEvent.click(screen.getByTestId("es-emoji-btn-🔥"));
    fireEvent.click(screen.getByTestId("es-emoji-btn-⭐"));
    fireEvent.click(screen.getByTestId("es-emoji-btn-🎉"));
    const selected = screen.getByTestId("es-selected");
    expect(selected.children).toHaveLength(3);
  });

  it("點擊已選 emoji 取消選取", () => {
    renderEs();
    fireEvent.click(screen.getByTestId("es-emoji-btn-😊"));
    fireEvent.click(screen.getByTestId("es-selected-emoji-0"));
    expect(screen.queryByTestId("es-selected-emoji-0")).not.toBeInTheDocument();
  });
});

describe("EmojiStory — 說明輸入", () => {
  it("caption 超過 captionMaxLength 顯示錯誤", () => {
    renderEs({ config: { ...baseConfig, captionMaxLength: 3 } });
    fireEvent.change(screen.getByTestId("es-caption-input"), {
      target: { value: "超過三字元的文字" },
    });
    expect(screen.getByTestId("es-caption-error")).toBeInTheDocument();
  });

  it("caption 超長時送出鈕 disabled", () => {
    renderEs({ config: { ...baseConfig, captionMaxLength: 3 } });
    fireEvent.click(screen.getByTestId("es-emoji-btn-😊"));
    fireEvent.click(screen.getByTestId("es-emoji-btn-🔥"));
    fireEvent.click(screen.getByTestId("es-emoji-btn-⭐"));
    fireEvent.change(screen.getByTestId("es-caption-input"), {
      target: { value: "超過三字元的文字" },
    });
    expect(screen.getByTestId("es-submit-btn")).toBeDisabled();
  });
});

describe("EmojiStory — 送出", () => {
  it("送出時呼叫 onSubmit 並重設選取", () => {
    const onSubmit = vi.fn();
    renderEs({ onSubmit });
    fireEvent.click(screen.getByTestId("es-emoji-btn-😊"));
    fireEvent.click(screen.getByTestId("es-emoji-btn-🔥"));
    fireEvent.click(screen.getByTestId("es-emoji-btn-⭐"));
    fireEvent.click(screen.getByTestId("es-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(["😊", "🔥", "⭐"], "");
  });

  it("已送出時顯示已送出訊息", () => {
    renderEs({
      state: {
        stories: [{ storyId: "s1", userId: "u1", userName: "Alice", emojis: ["😊", "🔥", "⭐"], caption: "", hearts: [] }],
        revealed: false,
      },
      myUserId: "u1",
    });
    expect(screen.getByTestId("es-submitted-msg")).toBeInTheDocument();
  });

  it("已送出時隱藏輸入區", () => {
    renderEs({
      state: {
        stories: [{ storyId: "s1", userId: "u1", userName: "Alice", emojis: ["😊", "🔥", "⭐"], caption: "", hearts: [] }],
        revealed: false,
      },
      myUserId: "u1",
    });
    expect(screen.queryByTestId("es-submit-btn")).not.toBeInTheDocument();
  });
});

describe("EmojiStory — 揭曉", () => {
  it("點擊揭曉按鈕呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderEs({ onReveal });
    fireEvent.click(screen.getByTestId("es-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("revealed=true 顯示所有故事", () => {
    renderEs({ state: storyState });
    expect(screen.getByTestId("es-story-s1")).toBeInTheDocument();
    expect(screen.getByTestId("es-story-s2")).toBeInTheDocument();
  });

  it("revealed=true 沒有揭曉按鈕", () => {
    renderEs({ state: storyState });
    expect(screen.queryByTestId("es-reveal-btn")).not.toBeInTheDocument();
  });

  it("顯示作者（showAuthor=true）", () => {
    renderEs({ state: storyState });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("隱藏作者（showAuthor=false）", () => {
    renderEs({ config: { ...baseConfig, showAuthor: false }, state: storyState });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("無故事時顯示 es-empty", () => {
    renderEs({ state: { stories: [], revealed: true } });
    expect(screen.getByTestId("es-empty")).toBeInTheDocument();
  });
});

describe("EmojiStory — 愛心", () => {
  it("按愛心呼叫 onHeart", () => {
    const onHeart = vi.fn();
    renderEs({ state: storyState, onHeart });
    fireEvent.click(screen.getByTestId("es-heart-s1"));
    expect(onHeart).toHaveBeenCalledWith("s1");
  });

  it("顯示愛心數量", () => {
    renderEs({ state: storyState });
    expect(screen.getByTestId("es-heart-count-s2")).toHaveTextContent("1");
  });

  it("自己已愛心顯示紅心", () => {
    renderEs({ state: storyState, myUserId: "u1" });
    expect(screen.getByTestId("es-heart-s2")).toHaveTextContent("❤️");
  });
});
