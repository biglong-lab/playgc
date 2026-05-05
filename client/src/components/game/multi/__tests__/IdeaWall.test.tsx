import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import IdeaWall from "../IdeaWall";
import type { IdeaWallConfig, IdeaWallState, IdeaCard } from "../IdeaWall";

const defaultConfig: IdeaWallConfig = {
  title: "💡 創意投票牆",
  prompt: "分享你的點子！",
  placeholder: "寫下你的想法…",
  maxLength: 80,
  maxIdeasPerPerson: 3,
  showAuthor: true,
  allowVoteOwn: false,
};

const emptyState: IdeaWallState = { ideas: [] };

const idea1: IdeaCard = {
  id: "i1",
  userId: "u1",
  userName: "Alice",
  text: "舉辦每月讀書會",
  emoji: "📚",
  votes: ["u2", "u3"],
  addedAt: 1000,
};

const idea2: IdeaCard = {
  id: "i2",
  userId: "u2",
  userName: "Bob",
  text: "設立匿名建議箱",
  emoji: "📬",
  votes: ["u1"],
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
  onVote: vi.fn(),
};

describe("IdeaWall", () => {
  it("顯示標題", () => {
    render(<IdeaWall {...mockProps} />);
    expect(screen.getByTestId("idea-title")).toHaveTextContent("創意投票牆");
  });

  it("顯示提示語", () => {
    render(<IdeaWall {...mockProps} />);
    expect(screen.getByTestId("idea-prompt")).toHaveTextContent("分享你的點子！");
  });

  it("顯示想法數量 0", () => {
    render(<IdeaWall {...mockProps} />);
    expect(screen.getByTestId("idea-count")).toHaveTextContent("0");
  });

  it("顯示表單", () => {
    render(<IdeaWall {...mockProps} />);
    expect(screen.getByTestId("add-idea-form")).toBeInTheDocument();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<IdeaWall {...mockProps} />);
    expect(screen.getByTestId("add-idea-btn")).toBeDisabled();
  });

  it("有文字時提交按鈕啟用", () => {
    render(<IdeaWall {...mockProps} draftText="好主意！" />);
    expect(screen.getByTestId("add-idea-btn")).not.toBeDisabled();
  });

  it("點擊 emoji 呼叫 onEmojiChange", () => {
    const onEmojiChange = vi.fn();
    render(<IdeaWall {...mockProps} onEmojiChange={onEmojiChange} />);
    fireEvent.click(screen.getByTestId("idea-emoji-💡"));
    expect(onEmojiChange).toHaveBeenCalledWith("💡");
  });

  it("輸入文字呼叫 onTextChange", () => {
    const onTextChange = vi.fn();
    render(<IdeaWall {...mockProps} onTextChange={onTextChange} />);
    fireEvent.change(screen.getByTestId("idea-text-input"), { target: { value: "好點子" } });
    expect(onTextChange).toHaveBeenCalledWith("好點子");
  });

  it("點擊提交按鈕呼叫 onAdd", () => {
    const onAdd = vi.fn();
    render(<IdeaWall {...mockProps} draftText="好點子" onAdd={onAdd} />);
    fireEvent.click(screen.getByTestId("add-idea-btn"));
    expect(onAdd).toHaveBeenCalled();
  });

  it("無想法時顯示空狀態", () => {
    render(<IdeaWall {...mockProps} />);
    expect(screen.getByTestId("empty-ideas")).toBeInTheDocument();
  });

  it("有想法時顯示想法列表", () => {
    const state = { ideas: [idea1, idea2] };
    render(<IdeaWall {...mockProps} state={state} />);
    expect(screen.getByTestId("idea-i1")).toBeInTheDocument();
    expect(screen.getByTestId("idea-i2")).toBeInTheDocument();
  });

  it("顯示想法文字", () => {
    const state = { ideas: [idea1] };
    render(<IdeaWall {...mockProps} state={state} />);
    expect(screen.getByTestId("idea-text-i1")).toHaveTextContent("舉辦每月讀書會");
  });

  it("顯示投票數", () => {
    const state = { ideas: [idea1] };
    render(<IdeaWall {...mockProps} state={state} />);
    expect(screen.getByTestId("vote-count-i1")).toHaveTextContent("2");
  });

  it("自己的想法投票按鈕 disabled（allowVoteOwn=false）", () => {
    const state = { ideas: [idea1] };
    render(<IdeaWall {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("vote-btn-i1")).toBeDisabled();
  });

  it("別人的想法投票按鈕可點", () => {
    const state = { ideas: [idea2] };
    render(<IdeaWall {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("vote-btn-i2")).not.toBeDisabled();
  });

  it("點擊投票呼叫 onVote", () => {
    const onVote = vi.fn();
    const state = { ideas: [idea2] };
    render(<IdeaWall {...mockProps} myUserId="u1" state={state} onVote={onVote} />);
    fireEvent.click(screen.getByTestId("vote-btn-i2"));
    expect(onVote).toHaveBeenCalledWith("i2");
  });

  it("投票最多的想法排第一", () => {
    const state = { ideas: [idea2, idea1] };
    render(<IdeaWall {...mockProps} myUserId="u9" state={state} />);
    expect(screen.getByTestId("idea-rank-i1")).toHaveTextContent("1");
    expect(screen.getByTestId("idea-rank-i2")).toHaveTextContent("2");
  });

  it("達到上限後顯示提示並隱藏表單", () => {
    const myIdeas = Array.from({ length: 3 }, (_, i) => ({
      ...idea1,
      id: `my${i}`,
      userId: "u1",
    }));
    const state = { ideas: myIdeas };
    render(<IdeaWall {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("max-ideas-reached")).toBeInTheDocument();
    expect(screen.queryByTestId("add-idea-form")).not.toBeInTheDocument();
  });

  it("顯示作者名字", () => {
    const state = { ideas: [idea2] };
    render(<IdeaWall {...mockProps} myUserId="u3" state={state} />);
    expect(screen.getByTestId("idea-author-i2")).toHaveTextContent("Bob");
  });
});
