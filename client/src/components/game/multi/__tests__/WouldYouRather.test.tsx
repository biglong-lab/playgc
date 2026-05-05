import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WouldYouRather from "../WouldYouRather";
import type {
  WouldYouRatherConfig,
  WouldYouRatherState,
} from "../WouldYouRather";

const defaultConfig: WouldYouRatherConfig = {
  title: "🤔 你選哪個？",
  optionA: "永遠只能吃同一種食物",
  emojiA: "🍜",
  optionB: "永遠只能聽同一首歌",
  emojiB: "🎵",
  showVoterNames: true,
};

const emptyState: WouldYouRatherState = { votes: [], revealed: false };

const voteA = {
  userId: "u1",
  userName: "Alice",
  choice: "A" as const,
  votedAt: 1000,
};
const voteB = {
  userId: "u2",
  userName: "Bob",
  choice: "B" as const,
  votedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  onVote: vi.fn(),
  onReveal: vi.fn(),
};

describe("WouldYouRather", () => {
  it("顯示標題", () => {
    render(<WouldYouRather {...mockProps} />);
    expect(screen.getByTestId("wyr-title")).toHaveTextContent("你選哪個");
  });

  it("顯示選項 A 文字", () => {
    render(<WouldYouRather {...mockProps} />);
    expect(screen.getByTestId("wyr-label-a")).toHaveTextContent("永遠只能吃同一種食物");
  });

  it("顯示選項 B 文字", () => {
    render(<WouldYouRather {...mockProps} />);
    expect(screen.getByTestId("wyr-label-b")).toHaveTextContent("永遠只能聽同一首歌");
  });

  it("顯示 emoji A", () => {
    render(<WouldYouRather {...mockProps} />);
    expect(screen.getByTestId("wyr-emoji-a")).toHaveTextContent("🍜");
  });

  it("顯示 emoji B", () => {
    render(<WouldYouRather {...mockProps} />);
    expect(screen.getByTestId("wyr-emoji-b")).toHaveTextContent("🎵");
  });

  it("無 emoji 時不顯示", () => {
    const config = { ...defaultConfig, emojiA: undefined, emojiB: undefined };
    render(<WouldYouRather {...mockProps} config={config} />);
    expect(screen.queryByTestId("wyr-emoji-a")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wyr-emoji-b")).not.toBeInTheDocument();
  });

  it("未投票顯示提示", () => {
    render(<WouldYouRather {...mockProps} />);
    expect(screen.getByTestId("wyr-hint")).toBeInTheDocument();
  });

  it("點選選項 A 呼叫 onVote(A)", () => {
    const onVote = vi.fn();
    render(<WouldYouRather {...mockProps} onVote={onVote} />);
    fireEvent.click(screen.getByTestId("wyr-option-a"));
    expect(onVote).toHaveBeenCalledWith("A");
  });

  it("點選選項 B 呼叫 onVote(B)", () => {
    const onVote = vi.fn();
    render(<WouldYouRather {...mockProps} onVote={onVote} />);
    fireEvent.click(screen.getByTestId("wyr-option-b"));
    expect(onVote).toHaveBeenCalledWith("B");
  });

  it("已投票後顯示已投票訊息與人數", () => {
    const state: WouldYouRatherState = { votes: [voteA], revealed: false };
    render(<WouldYouRather {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("wyr-voted-msg")).toBeInTheDocument();
    expect(screen.getByTestId("wyr-count")).toHaveTextContent("1");
  });

  it("已投票後兩個選項都 disabled", () => {
    const state: WouldYouRatherState = { votes: [voteA], revealed: false };
    render(<WouldYouRather {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("wyr-option-a")).toBeDisabled();
    expect(screen.getByTestId("wyr-option-b")).toBeDisabled();
  });

  it("選了 A 顯示 my-choice-a 標記", () => {
    const state: WouldYouRatherState = { votes: [voteA], revealed: false };
    render(<WouldYouRather {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("wyr-my-choice-a")).toBeInTheDocument();
    expect(screen.queryByTestId("wyr-my-choice-b")).not.toBeInTheDocument();
  });

  it("選了 B 顯示 my-choice-b 標記", () => {
    const state: WouldYouRatherState = {
      votes: [voteB],
      revealed: false,
    };
    render(<WouldYouRather {...mockProps} state={state} myUserId="u2" />);
    expect(screen.getByTestId("wyr-my-choice-b")).toBeInTheDocument();
    expect(screen.queryByTestId("wyr-my-choice-a")).not.toBeInTheDocument();
  });

  it("有票且未揭曉時顯示揭曉按鈕", () => {
    const state: WouldYouRatherState = { votes: [voteA], revealed: false };
    render(<WouldYouRather {...mockProps} state={state} />);
    expect(screen.getByTestId("wyr-reveal-btn")).toBeInTheDocument();
  });

  it("無票時不顯示揭曉按鈕", () => {
    render(<WouldYouRather {...mockProps} />);
    expect(screen.queryByTestId("wyr-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    const state: WouldYouRatherState = { votes: [voteA], revealed: false };
    render(<WouldYouRather {...mockProps} state={state} onReveal={onReveal} />);
    fireEvent.click(screen.getByTestId("wyr-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("已揭曉後不顯示揭曉按鈕", () => {
    const state: WouldYouRatherState = { votes: [voteA, voteB], revealed: true };
    render(<WouldYouRather {...mockProps} state={state} />);
    expect(screen.queryByTestId("wyr-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後顯示揭曉訊息", () => {
    const state: WouldYouRatherState = { votes: [voteA, voteB], revealed: true };
    render(<WouldYouRather {...mockProps} state={state} />);
    expect(screen.getByTestId("wyr-revealed-msg")).toBeInTheDocument();
    expect(screen.getByTestId("wyr-total")).toHaveTextContent("2");
  });

  it("揭曉後顯示 A 結果與百分比", () => {
    const state: WouldYouRatherState = { votes: [voteA, voteB], revealed: true };
    render(<WouldYouRather {...mockProps} state={state} />);
    expect(screen.getByTestId("wyr-result-a")).toBeInTheDocument();
    expect(screen.getByTestId("wyr-pct-a")).toHaveTextContent("50%");
  });

  it("揭曉後顯示 B 結果與百分比", () => {
    const state: WouldYouRatherState = { votes: [voteA, voteB], revealed: true };
    render(<WouldYouRather {...mockProps} state={state} />);
    expect(screen.getByTestId("wyr-result-b")).toBeInTheDocument();
    expect(screen.getByTestId("wyr-pct-b")).toHaveTextContent("50%");
  });

  it("showVoterNames=true 顯示投票者名稱", () => {
    const state: WouldYouRatherState = { votes: [voteA, voteB], revealed: true };
    render(<WouldYouRather {...mockProps} state={state} />);
    expect(screen.getByTestId("wyr-voter-a-u1")).toHaveTextContent("Alice");
    expect(screen.getByTestId("wyr-voter-b-u2")).toHaveTextContent("Bob");
  });

  it("showVoterNames=false 不顯示投票者名稱", () => {
    const config = { ...defaultConfig, showVoterNames: false };
    const state: WouldYouRatherState = { votes: [voteA, voteB], revealed: true };
    render(<WouldYouRather {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("wyr-voters-a")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wyr-voters-b")).not.toBeInTheDocument();
  });

  it("全票 A 時 A pct=100 B pct=0", () => {
    const state: WouldYouRatherState = { votes: [voteA, { ...voteA, userId: "u3", userName: "Carol" }], revealed: true };
    render(<WouldYouRather {...mockProps} state={state} />);
    expect(screen.getByTestId("wyr-pct-a")).toHaveTextContent("100%");
    expect(screen.getByTestId("wyr-pct-b")).toHaveTextContent("0%");
  });

  it("0 票未揭曉顯示等待提示", () => {
    render(<WouldYouRather {...mockProps} />);
    expect(screen.getByTestId("wyr-empty")).toBeInTheDocument();
  });
});
