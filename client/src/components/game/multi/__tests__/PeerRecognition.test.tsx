import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PeerRecognition from "../PeerRecognition";
import type { PeerRecognitionConfig, PeerRecognitionState, RecognitionCard } from "../PeerRecognition";

const defaultConfig: PeerRecognitionConfig = {
  title: "🌟 同伴表揚牆",
  prompt: "寫下你想感謝的人",
  placeholder: "感謝你在這次活動中…",
  maxLength: 100,
  allowAnonymous: true,
  emojiOptions: ["🌟", "🙌", "❤️"],
};

const emptyState: PeerRecognitionState = { cards: [] };

const card1: RecognitionCard = {
  id: "c1",
  fromUserId: "u1",
  fromUserName: "Alice",
  toName: "Bob",
  message: "謝謝你的幫助！",
  emoji: "🌟",
  hearts: ["u2"],
  addedAt: 1000,
  anonymous: false,
};

const card2: RecognitionCard = {
  id: "c2",
  fromUserId: "u2",
  fromUserName: "Bob",
  toName: "Carol",
  message: "你的報告很精彩",
  emoji: "🙌",
  hearts: [],
  addedAt: 2000,
  anonymous: true,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  draftTo: "",
  draftMessage: "",
  draftEmoji: "",
  draftAnonymous: false,
  onToChange: vi.fn(),
  onMessageChange: vi.fn(),
  onEmojiChange: vi.fn(),
  onAnonymousChange: vi.fn(),
  onSubmit: vi.fn(),
  onHeart: vi.fn(),
};

describe("PeerRecognition", () => {
  it("顯示標題", () => {
    render(<PeerRecognition {...mockProps} />);
    expect(screen.getByTestId("recognition-title")).toHaveTextContent("同伴表揚牆");
  });

  it("顯示提示語", () => {
    render(<PeerRecognition {...mockProps} />);
    expect(screen.getByTestId("recognition-prompt")).toHaveTextContent("寫下你想感謝的人");
  });

  it("顯示感謝數 0", () => {
    render(<PeerRecognition {...mockProps} />);
    expect(screen.getByTestId("card-count")).toHaveTextContent("0");
  });

  it("未提交時顯示表單", () => {
    render(<PeerRecognition {...mockProps} />);
    expect(screen.getByTestId("recognition-form")).toBeInTheDocument();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<PeerRecognition {...mockProps} />);
    expect(screen.getByTestId("submit-recognition-btn")).toBeDisabled();
  });

  it("有對象/訊息/emoji 時提交按鈕啟用", () => {
    render(<PeerRecognition {...mockProps} draftTo="Bob" draftMessage="謝謝！" draftEmoji="🌟" />);
    expect(screen.getByTestId("submit-recognition-btn")).not.toBeDisabled();
  });

  it("輸入對象名稱呼叫 onToChange", () => {
    const onToChange = vi.fn();
    render(<PeerRecognition {...mockProps} onToChange={onToChange} />);
    fireEvent.change(screen.getByTestId("to-input"), { target: { value: "Bob" } });
    expect(onToChange).toHaveBeenCalledWith("Bob");
  });

  it("輸入訊息呼叫 onMessageChange", () => {
    const onMessageChange = vi.fn();
    render(<PeerRecognition {...mockProps} onMessageChange={onMessageChange} />);
    fireEvent.change(screen.getByTestId("message-input"), { target: { value: "謝謝！" } });
    expect(onMessageChange).toHaveBeenCalledWith("謝謝！");
  });

  it("點擊 emoji 呼叫 onEmojiChange", () => {
    const onEmojiChange = vi.fn();
    render(<PeerRecognition {...mockProps} onEmojiChange={onEmojiChange} />);
    fireEvent.click(screen.getByTestId("emoji-btn-🌟"));
    expect(onEmojiChange).toHaveBeenCalledWith("🌟");
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<PeerRecognition {...mockProps} draftTo="Bob" draftMessage="謝謝！" draftEmoji="🌟" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("submit-recognition-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("顯示感謝卡片", () => {
    const state = { cards: [card1, card2] };
    render(<PeerRecognition {...mockProps} state={state} />);
    expect(screen.getByTestId("card-c1")).toBeInTheDocument();
    expect(screen.getByTestId("card-c2")).toBeInTheDocument();
  });

  it("卡片顯示對象名稱", () => {
    const state = { cards: [card1] };
    render(<PeerRecognition {...mockProps} state={state} />);
    expect(screen.getByTestId("card-to-c1")).toHaveTextContent("Bob");
  });

  it("卡片顯示感謝訊息", () => {
    const state = { cards: [card1] };
    render(<PeerRecognition {...mockProps} state={state} />);
    expect(screen.getByTestId("card-message-c1")).toHaveTextContent("謝謝你的幫助！");
  });

  it("匿名卡片顯示匿名", () => {
    const state = { cards: [card2] };
    render(<PeerRecognition {...mockProps} state={state} />);
    expect(screen.getByTestId("card-from-c2")).toHaveTextContent("匿名");
  });

  it("非匿名卡片顯示作者名", () => {
    const state = { cards: [card1] };
    render(<PeerRecognition {...mockProps} state={state} />);
    expect(screen.getByTestId("card-from-c1")).toHaveTextContent("Alice");
  });

  it("顯示心 button 和計數", () => {
    const state = { cards: [card1] };
    render(<PeerRecognition {...mockProps} myUserId="u3" state={state} />);
    expect(screen.getByTestId("heart-btn-c1")).toBeInTheDocument();
    expect(screen.getByTestId("heart-count-c1")).toHaveTextContent("1");
  });

  it("點擊心 button 呼叫 onHeart", () => {
    const onHeart = vi.fn();
    const state = { cards: [card1] };
    render(<PeerRecognition {...mockProps} myUserId="u3" state={state} onHeart={onHeart} />);
    fireEvent.click(screen.getByTestId("heart-btn-c1"));
    expect(onHeart).toHaveBeenCalledWith("c1");
  });

  it("自己的卡片 heart button disabled", () => {
    const state = { cards: [card1] };
    render(<PeerRecognition {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("heart-btn-c1")).toBeDisabled();
  });

  it("無卡片時顯示空狀態", () => {
    render(<PeerRecognition {...mockProps} />);
    expect(screen.getByTestId("empty-cards")).toBeInTheDocument();
  });

  it("有卡片時顯示感謝數", () => {
    const state = { cards: [card1, card2] };
    render(<PeerRecognition {...mockProps} state={state} />);
    expect(screen.getByTestId("card-count")).toHaveTextContent("2");
  });
});
