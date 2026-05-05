import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GratitudeWall from "../GratitudeWall";
import type { GratitudeWallConfig, GratitudeWallState } from "../GratitudeWall";

const defaultConfig: GratitudeWallConfig = {
  title: "💖 感恩塗鴉牆",
  prompt: "寫下你的感謝！",
  placeholder: "感謝…",
  maxLength: 80,
  maxCardsPerPerson: 3,
  showAuthor: true,
  cardColors: ["bg-yellow-100", "bg-pink-100"],
};

const emptyState: GratitudeWallState = { cards: [] };

const card1 = {
  id: "c1",
  userId: "u2",
  userName: "Bob",
  text: "感謝你在最低谷時幫助我",
  emoji: "🙏",
  color: "bg-yellow-100",
  hearts: ["u1"],
  addedAt: 1000,
};

const card2 = {
  id: "c2",
  userId: "u1",
  userName: "Alice",
  text: "感謝這次活動讓我認識大家",
  emoji: "❤️",
  color: "bg-pink-100",
  hearts: [],
  addedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  draftEmoji: "",
  onTextChange: vi.fn(),
  onEmojiChange: vi.fn(),
  onAdd: vi.fn(),
  onHeart: vi.fn(),
};

describe("GratitudeWall", () => {
  it("顯示標題", () => {
    render(<GratitudeWall {...mockProps} />);
    expect(screen.getByTestId("gw-title")).toHaveTextContent("感恩塗鴉牆");
  });

  it("顯示提示語", () => {
    render(<GratitudeWall {...mockProps} />);
    expect(screen.getByTestId("gw-prompt")).toHaveTextContent("寫下你的感謝！");
  });

  it("顯示新增表單", () => {
    render(<GratitudeWall {...mockProps} />);
    expect(screen.getByTestId("gw-add-form")).toBeInTheDocument();
  });

  it("空白時送出按鈕 disabled", () => {
    render(<GratitudeWall {...mockProps} />);
    expect(screen.getByTestId("gw-add-btn")).toBeDisabled();
  });

  it("有文字時送出按鈕啟用", () => {
    render(<GratitudeWall {...mockProps} draftText="感謝你" />);
    expect(screen.getByTestId("gw-add-btn")).not.toBeDisabled();
  });

  it("點擊 emoji 呼叫 onEmojiChange", () => {
    const onEmojiChange = vi.fn();
    render(<GratitudeWall {...mockProps} onEmojiChange={onEmojiChange} />);
    fireEvent.click(screen.getByTestId("gw-emoji-🙏"));
    expect(onEmojiChange).toHaveBeenCalledWith("🙏");
  });

  it("輸入文字呼叫 onTextChange", () => {
    const onTextChange = vi.fn();
    render(<GratitudeWall {...mockProps} onTextChange={onTextChange} />);
    fireEvent.change(screen.getByTestId("gw-text-input"), { target: { value: "感謝" } });
    expect(onTextChange).toHaveBeenCalledWith("感謝");
  });

  it("點擊送出呼叫 onAdd", () => {
    const onAdd = vi.fn();
    render(<GratitudeWall {...mockProps} draftText="感謝你" onAdd={onAdd} />);
    fireEvent.click(screen.getByTestId("gw-add-btn"));
    expect(onAdd).toHaveBeenCalled();
  });

  it("無卡片時顯示空狀態", () => {
    render(<GratitudeWall {...mockProps} />);
    expect(screen.getByTestId("gw-empty")).toBeInTheDocument();
  });

  it("有卡片時顯示列表", () => {
    const state: GratitudeWallState = { cards: [card1, card2] };
    render(<GratitudeWall {...mockProps} state={state} />);
    expect(screen.getByTestId("gw-card-c1")).toBeInTheDocument();
    expect(screen.getByTestId("gw-card-c2")).toBeInTheDocument();
  });

  it("顯示卡片文字", () => {
    const state: GratitudeWallState = { cards: [card1] };
    render(<GratitudeWall {...mockProps} state={state} />);
    expect(screen.getByTestId("gw-card-text-c1")).toHaveTextContent("感謝你在最低谷時幫助我");
  });

  it("顯示 emoji", () => {
    const state: GratitudeWallState = { cards: [card1] };
    render(<GratitudeWall {...mockProps} state={state} />);
    expect(screen.getByTestId("gw-card-emoji-c1")).toHaveTextContent("🙏");
  });

  it("顯示作者", () => {
    const state: GratitudeWallState = { cards: [card1] };
    render(<GratitudeWall {...mockProps} myUserId="u3" state={state} />);
    expect(screen.getByTestId("gw-card-author-c1")).toHaveTextContent("Bob");
  });

  it("顯示 heart 數", () => {
    const state: GratitudeWallState = { cards: [card1] };
    render(<GratitudeWall {...mockProps} state={state} />);
    expect(screen.getByTestId("gw-heart-count-c1")).toHaveTextContent("1");
  });

  it("點擊 heart 呼叫 onHeart", () => {
    const onHeart = vi.fn();
    const state: GratitudeWallState = { cards: [card1] };
    render(<GratitudeWall {...mockProps} state={state} onHeart={onHeart} />);
    fireEvent.click(screen.getByTestId("gw-heart-btn-c1"));
    expect(onHeart).toHaveBeenCalledWith("c1");
  });

  it("達到上限後顯示已達上限並隱藏表單", () => {
    const myCards = [
      { ...card2, id: "mc1" },
      { ...card2, id: "mc2" },
      { ...card2, id: "mc3" },
    ];
    const state: GratitudeWallState = { cards: myCards };
    render(<GratitudeWall {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("gw-max-reached")).toBeInTheDocument();
    expect(screen.queryByTestId("gw-add-form")).not.toBeInTheDocument();
  });

  it("顯示卡片數量", () => {
    const state: GratitudeWallState = { cards: [card1, card2] };
    render(<GratitudeWall {...mockProps} state={state} />);
    expect(screen.getByTestId("gw-card-count")).toHaveTextContent("2");
  });
});
